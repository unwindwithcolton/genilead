// lib/skipTrace/normalize.ts

import {
  BatchDataRawResponse,
  BatchDataPhone,
  BatchDataEmail,
  NormalizedEnrichmentResult,
  NormalizedPhone,
  NormalizedEmail,
  EnrichmentRecord,
  EnrichmentUIState,
} from './types';

// ─── Core normalization ───────────────────────────────────────────────────────

export function normalizeResponse(raw: BatchDataRawResponse): NormalizedEnrichmentResult {
  return {
    phones:    (raw.phones ?? []).map(normalizePhone).filter((p): p is NormalizedPhone => p !== null),
    emails:    (raw.emails ?? []).map(normalizeEmail).filter((e): e is NormalizedEmail => e !== null),
    matchStatus:
      raw.status === 'match'         ? 'matched'  :
      raw.status === 'partial_match' ? 'partial'  :
      raw.status === 'no_match'      ? 'no_match' : 'error',
    nameMatchScore:    raw.nameMatch?.score    ?? null,
    addressMatchScore: raw.addressMatch?.score ?? null,
  };
}

// ─── Phone ────────────────────────────────────────────────────────────────────

function normalizePhone(p: BatchDataPhone): NormalizedPhone | null {
  const cleaned = p.number?.replace(/\D/g, '');
  // Must be exactly 10 digits after stripping — drop anything malformed
  if (!cleaned || cleaned.length !== 10) return null;

  return {
    number:    `+1${cleaned}`,       // E.164
    type:      p.type ?? 'unknown',
    isPrimary: p.isPrimary ?? false,
    dnc:       p.dnc ?? false,
    source:    'batchdata',
  };
}

// ─── Email ────────────────────────────────────────────────────────────────────

function normalizeEmail(e: BatchDataEmail): NormalizedEmail | null {
  if (!e.address?.includes('@')) return null;

  return {
    address:   e.address.trim().toLowerCase(),
    isValid:   e.isValid  ?? true,
    isPrimary: e.isPrimary ?? false,
    source:    'batchdata',
  };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

// E.164 (+13125550100) → display ((312) 555-0100)
export function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '').slice(-10);
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// ─── UI state builder ─────────────────────────────────────────────────────────

export function buildUIState(record: EnrichmentRecord): EnrichmentUIState {
  const phones = record.normalized?.phones ?? [];
  const emails = record.normalized?.emails ?? [];

  const bestPhone = phones.find(p => p.isPrimary) ?? phones[0] ?? null;
  const bestEmail = emails.find(e => e.isPrimary) ?? emails[0] ?? null;

  const daysSinceEnriched = record.enriched_at
    ? (Date.now() - new Date(record.enriched_at).getTime()) / 86_400_000
    : null;

  return {
    status:          record.enrichment_status,
    bestPhone:       bestPhone ? formatPhone(bestPhone.number) : null,
    bestPhoneType:   bestPhone?.type ?? null,
    bestPhoneDnc:    bestPhone?.dnc ?? false,
    allPhones:       phones.map(p => ({
                       number: formatPhone(p.number),
                       type:   p.type,
                       dnc:    p.dnc,
                     })),
    bestEmail:       bestEmail?.address ?? null,
    allEmails:       emails.map(e => ({
                       address: e.address,
                       isValid: e.isValid,
                     })),
    contactConfidence:  record.contact_confidence  ?? null,
    confidenceReason:   record.confidence_reason   ?? null,
    wrongPartyRisk:     record.wrong_party_risk     ?? null,
    enrichedAt:         record.enriched_at          ?? null,
    // Allow refresh if never enriched, or if it's been 7+ days
    canRefresh: daysSinceEnriched === null || daysSinceEnriched >= 7,
  };
}