// lib/skipTrace/service.ts

import { createClient } from '@/lib/supabase';
import { batchDataClient } from './client';
import { normalizeResponse, buildUIState } from './normalize';
import { scoreConfidence } from './confidence';
import {
  SkipTraceInput,
  EnrichmentRecord,
  EnrichmentStatus,
  NormalizedEnrichmentResult,
  EnrichmentConfidence,
} from './types';

const RETRACE_COOLDOWN_DAYS = 30;
const MAX_RETRIES           = 3;

// ─── Public API ───────────────────────────────────────────────────────────────

export const skipTraceService = {

  // Called automatically when a lead hits HOT or score >= 60
  async trace(input: SkipTraceInput, triggeredBy: 'auto' | 'manual') {
    const supabase = createClient();

    // 1. Guard — skip if we already have a trusted, recent result
    const existing = await getLatestEnrichment(supabase, input.listing_id);
    if (existing && shouldSkip(existing)) {
      return { ui: buildUIState(existing), error: null };
    }

    // 2. Insert pending record so we have an id to update
    const { data: record, error: insertError } = await supabase
      .from('enrichment_results')
      .insert({
        listing_id:         input.listing_id,
        triggered_by:       triggeredBy,
        enrichment_status:  'pending',
      })
      .select()
      .single();

    if (insertError || !record) {
      return { ui: null, error: insertError?.message ?? 'Failed to insert enrichment record' };
    }

    // 3. Call BatchData
    const rawResult = await batchDataClient.lookup(input);

    if (rawResult.error || !rawResult.data) {
      await markError(
        supabase,
        record.id,
        input.listing_id,
        rawResult.error ?? 'No data returned',
        existing?.retry_count ?? 0
      );
      return { ui: null, error: rawResult.error };
    }

    // 4. Normalize raw response
    const normalized = normalizeResponse(rawResult.data);

    // 5. Score confidence
    const confidence = scoreConfidence(normalized, input);

    // 6. Derive status
    const status: EnrichmentStatus =
      normalized.matchStatus === 'matched' ? 'matched' :
      normalized.matchStatus === 'partial'  ? 'partial' :
      'no_match';

    const enrichedAt = new Date().toISOString();

    // 7. Update enrichment_results with full result
    await supabase
      .from('enrichment_results')
      .update({
        enriched_at:        enrichedAt,
        enrichment_status:  status,
        raw_response:       rawResult.data,
        normalized,
        contact_confidence: confidence.contact_confidence,
        confidence_reason:  confidence.confidence_reason,
        wrong_party_risk:   confidence.wrong_party_risk,
      })
      .eq('id', record.id);

    // 8. Denormalize best phone/email onto listings row
    await updateListingsSafe(supabase, input.listing_id, normalized, confidence, status, enrichedAt);

    // 9. Build the final record shape for buildUIState
    const finalRecord: EnrichmentRecord = {
      ...record,
      enriched_at:        enrichedAt,
      enrichment_status:  status,
      raw_response:       rawResult.data,
      normalized,
      contact_confidence: confidence.contact_confidence,
      confidence_reason:  confidence.confidence_reason,
      wrong_party_risk:   confidence.wrong_party_risk,
      error_message:      null,
    };

    return { ui: buildUIState(finalRecord), error: null };
  },

  // Manual refresh — bypasses the cooldown guard
  async refresh(listing_id: string) {
    const supabase = createClient();

    const { data: listing } = await supabase
      .from('listings')
      .select('owner_name, address, city, state, zip')
      .eq('id', listing_id)
      .single();

    if (!listing) return { ui: null, error: 'Listing not found' };

    return this.trace(
      { listing_id, ...listing } as SkipTraceInput,
      'manual'
    );
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getLatestEnrichment(
  supabase: ReturnType<typeof createClient>,
  listing_id: string
): Promise<EnrichmentRecord | null> {
  const { data } = await supabase
    .from('enrichment_results')
    .select('*')
    .eq('listing_id', listing_id)
    .order('requested_at', { ascending: false })
    .limit(1)
    .single();

  return (data as EnrichmentRecord) ?? null;
}

function shouldSkip(record: EnrichmentRecord): boolean {
  if (record.enrichment_status !== 'matched')                          return false;
  if (record.contact_confidence === 'low' || 
      record.contact_confidence === 'none')                            return false;
  if (!record.enriched_at)                                             return false;

  const daysSince = (Date.now() - new Date(record.enriched_at).getTime()) / 86_400_000;
  return daysSince < RETRACE_COOLDOWN_DAYS;
}

async function markError(
  supabase:    ReturnType<typeof createClient>,
  record_id:   string,
  listing_id:  string,
  error:       string,
  prevRetries: number
) {
  const retry_count = prevRetries + 1;
  const isFinal     = retry_count >= MAX_RETRIES;

  await supabase
    .from('enrichment_results')
    .update({
      enrichment_status: isFinal ? 'error' : 'pending',
      error_message:     error,
      retry_count,
    })
    .eq('id', record_id);

  await supabase
    .from('listings')
    .update({ enrichment_status: isFinal ? 'error' : 'pending' })
    .eq('id', listing_id);
}

// Only overwrites phone/email if we don't already have a trusted value
async function updateListingsSafe(
  supabase:    ReturnType<typeof createClient>,
  listing_id:  string,
  normalized:  NormalizedEnrichmentResult,
  confidence:  EnrichmentConfidence,
  status:      EnrichmentStatus,
  enrichedAt:  string
) {
  const { data: current } = await supabase
    .from('listings')
    .select('best_phone, best_email, contact_confidence')
    .eq('id', listing_id)
    .single();

  const trusted = ['high', 'medium'];
  const alreadyTrustedPhone = current?.best_phone  && trusted.includes(current?.contact_confidence);
  const alreadyTrustedEmail = current?.best_email  && trusted.includes(current?.contact_confidence);

  const bestPhone = normalized.phones.find(p => p.isPrimary)?.number
    ?? normalized.phones[0]?.number
    ?? null;

  const bestEmail = normalized.emails.find(e => e.isPrimary)?.address
    ?? normalized.emails[0]?.address
    ?? null;

  await supabase
    .from('listings')
    .update({
      ...(!alreadyTrustedPhone && bestPhone ? { best_phone: bestPhone } : {}),
      ...(!alreadyTrustedEmail && bestEmail ? { best_email: bestEmail } : {}),
      contact_confidence: confidence.contact_confidence,
      enriched_at:        enrichedAt,
      enrichment_status:  status,
    })
    .eq('id', listing_id);
}