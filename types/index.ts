// ─── Scalar / Union Types ────────────────────────────────────────────────────

export type Temperature = "hot" | "warm" | "cold";

export type ConsentStatus =
  | "unknown"
  | "transactional"
  | "marketing"
  | "opted_out";

export type OpportunityType =
  | "price_drop"
  | "motivated"
  | "off_market"
  | "market_value";

// ─── Core Domain Types ────────────────────────────────────────────────────────

export interface Listing {
  id: string;
  source: string;
  source_id: string;
  address: string | null;
  zip: string;
  city: string | null;
  state: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  list_price: number | null;
  avm_value: number | null;
  days_on_market: number | null;
  price_cuts: number;
  last_sold_price: number | null;
  last_sold_date: string | null; // ISO date string
  owner_type: string | null;
  tax_delinquent: boolean;
  last_source_updated: string | null; // ISO timestamp
  last_synced_at: string | null; // ISO timestamp
  raw_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ListingScore {
  id: string;
  listing_id: string;
  score: number;
  confidence_score: number;
  temperature: Temperature;
  opportunity_type: OpportunityType | null;
  reason_codes: string[];
  evidence_summary: string | null;
  freshness_warnings: string[];
  recommended_action: string | null;
  requires_human_review: boolean;
  disallowed_data_flags: string[];
  outreach_sms: string | null;
  outreach_email: { subject: string; body: string } | null;
  prompt_version: string;
  scored_at: string;
}

export interface Contact {
  id: string;
  listing_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  consent_status: ConsentStatus;
  opted_out_at: string | null;
  created_at: string;
}

export interface OutreachLog {
  id: string;
  contact_id: string;
  user_id: string;
  message_type: string | null;
  channel: string | null;
  draft: string | null;
  approved_by: string | null;
  consent_status: ConsentStatus | null;
  sent_at: string | null;
  created_at: string;
}

export interface UserSearch {
  id: string;
  user_id: string;
  zip_codes: string[];
  filters: Record<string, unknown>;
  active: boolean;
  created_at: string;
}

export interface UserAction {
  id: string;
  user_id: string;
  listing_id: string;
  action_type: string;
  created_at: string;
}

export interface IngestLog {
  id: string;
  run_id: string;
  source: string | null;
  zip: string | null;
  status: string | null;
  records_in: number | null;
  records_saved: number | null;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface ApiUsage {
  id: string;
  source: string | null;
  endpoint: string | null;
  zip: string | null;
  user_id: string | null;
  cached: boolean | null;
  cost_units: number | null;
  created_at: string;
}

// ─── View / Joined Types ──────────────────────────────────────────────────────

/** Listing with its latest score attached — used in the UI feed */
export interface ScoredListing extends Listing {
  latest_score: ListingScore | null;
}