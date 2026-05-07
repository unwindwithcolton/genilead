import { createBrowserClient } from "@supabase/ssr";
import type { Listing, ListingScore } from "../types";

// ─── Client ───────────────────────────────────────────────────────────────────

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ─── Row → Domain Mappers ─────────────────────────────────────────────────────

/**
 * Maps a raw Supabase row from the `listings` table to the typed Listing interface.
 * Handles null coercion and numeric casting from postgres text fields.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapListing(row: Record<string, any>): Listing {
  return {
    id: row.id,
    source: row.source,
    source_id: row.source_id,
    address: row.address ?? null,
    zip: row.zip,
    city: row.city ?? null,
    state: row.state ?? null,
    beds: row.beds != null ? Number(row.beds) : null,
    baths: row.baths != null ? Number(row.baths) : null,
    sqft: row.sqft != null ? Number(row.sqft) : null,
    list_price: row.list_price != null ? Number(row.list_price) : null,
    avm_value: row.avm_value != null ? Number(row.avm_value) : null,
    days_on_market:
      row.days_on_market != null ? Number(row.days_on_market) : null,
    price_cuts: Number(row.price_cuts ?? 0),
    last_sold_price:
      row.last_sold_price != null ? Number(row.last_sold_price) : null,
    last_sold_date: row.last_sold_date ?? null,
    owner_type: row.owner_type ?? null,
    tax_delinquent: Boolean(row.tax_delinquent),
    last_source_updated: row.last_source_updated ?? null,
    last_synced_at: row.last_synced_at ?? null,
    raw_data: row.raw_data ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Maps a raw Supabase row from the `listing_scores` table to ListingScore.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapListingScore(row: Record<string, any>): ListingScore {
  return {
    id: row.id,
    listing_id: row.listing_id,
    score: Number(row.score),
    confidence_score: Number(row.confidence_score),
    temperature: row.temperature,
    opportunity_type: row.opportunity_type ?? null,
    reason_codes: row.reason_codes ?? [],
    evidence_summary: row.evidence_summary ?? null,
    freshness_warnings: row.freshness_warnings ?? [],
    recommended_action: row.recommended_action ?? null,
    requires_human_review: Boolean(row.requires_human_review),
    disallowed_data_flags: row.disallowed_data_flags ?? [],
    outreach_sms: row.outreach_sms ?? null,
    outreach_email: row.outreach_email ?? null,
    prompt_version: row.prompt_version,
    scored_at: row.scored_at,
  };
}