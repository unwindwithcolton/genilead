// ─── Input ────────────────────────────────────────────────────────────────────

export interface SkipTraceInput {
  listing_id: string;
  owner_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

// ─── BatchData Raw ────────────────────────────────────────────────────────────

export interface BatchDataRawResponse {
  status: 'match' | 'no_match' | 'partial_match' | 'error';
  matchScore?: number;
  phones?: BatchDataPhone[];
  emails?: BatchDataEmail[];
  nameMatch?: { input: string; matched: string; score: number };
  addressMatch?: { input: string; matched: string; score: number };
  rawPayload?: unknown;
}

export interface BatchDataPhone {
  number: string;
  type?: 'mobile' | 'landline' | 'voip' | 'unknown';
  isPrimary?: boolean;
  dnc?: boolean;
  lastSeen?: string;
}

export interface BatchDataEmail {
  address: string;
  isValid?: boolean;
  isPrimary?: boolean;
  lastSeen?: string;
}

// ─── Normalized ───────────────────────────────────────────────────────────────

export interface NormalizedPhone {
  number: string;        // E.164: +13125550100
  type: 'mobile' | 'landline' | 'voip' | 'unknown';
  isPrimary: boolean;
  dnc: boolean;
  source: 'batchdata';
}

export interface NormalizedEmail {
  address: string;
  isValid: boolean;
  isPrimary: boolean;
  source: 'batchdata';
}

export interface NormalizedEnrichmentResult {
  phones: NormalizedPhone[];
  emails: NormalizedEmail[];
  matchStatus: 'matched' | 'partial' | 'no_match' | 'error';
  nameMatchScore: number | null;
  addressMatchScore: number | null;
}

// ─── Confidence ───────────────────────────────────────────────────────────────

export type ContactConfidence = 'high' | 'medium' | 'low' | 'none';

export interface EnrichmentConfidence {
  contact_confidence: ContactConfidence;
  confidence_reason: string;
  wrong_party_risk: 'high' | 'medium' | 'low';
}

// ─── Status ───────────────────────────────────────────────────────────────────

export type EnrichmentStatus =
  | 'pending'
  | 'matched'
  | 'partial'
  | 'no_match'
  | 'error'
  | 'skipped';

// ─── Stored record ────────────────────────────────────────────────────────────

export interface EnrichmentRecord {
  id: string;
  listing_id: string;
  requested_at: string;
  enriched_at: string | null;
  enrichment_status: EnrichmentStatus;
  raw_response: BatchDataRawResponse | null;
  normalized: NormalizedEnrichmentResult | null;
  contact_confidence: ContactConfidence | null;
  confidence_reason: string | null;
  wrong_party_risk: 'high' | 'medium' | 'low' | null;
  error_message: string | null;
  retry_count: number;
  triggered_by: 'auto' | 'manual';
}

// ─── UI-facing shape ──────────────────────────────────────────────────────────

export interface EnrichmentUIState {
  status: EnrichmentStatus;
  bestPhone: string | null;
  bestPhoneType: 'mobile' | 'landline' | 'voip' | 'unknown' | null;
  bestPhoneDnc: boolean;
  allPhones: { number: string; type: string; dnc: boolean }[];
  bestEmail: string | null;
  allEmails: { address: string; isValid: boolean }[];
  contactConfidence: ContactConfidence | null;
  confidenceReason: string | null;
  wrongPartyRisk: 'high' | 'medium' | 'low' | null;
  enrichedAt: string | null;
  canRefresh: boolean;
}