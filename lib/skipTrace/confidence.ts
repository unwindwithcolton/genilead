// lib/skipTrace/confidence.ts

import {
  NormalizedEnrichmentResult,
  EnrichmentConfidence,
  ContactConfidence,
  SkipTraceInput,
} from './types';

// ─── Main scorer ──────────────────────────────────────────────────────────────

export function scoreConfidence(
  normalized: NormalizedEnrichmentResult,
  _input: SkipTraceInput       // reserved — useful later for manual name cross-check
): EnrichmentConfidence {

  // No data at all — bail early
  if (normalized.matchStatus === 'no_match' || normalized.matchStatus === 'error') {
    return {
      contact_confidence: 'none',
      confidence_reason:  'No match returned by BatchData',
      wrong_party_risk:   'high',
    };
  }

  const phones      = normalized.phones;
  const hasMobile   = phones.some(p => p.type === 'mobile');
  const hasAnyPhone = phones.length > 0;

  const nameScore    = normalized.nameMatchScore    ?? 0;
  const addressScore = normalized.addressMatchScore ?? 0;

  // ─── Wrong-party risk — name match is the primary signal ─────────────────
  const wrong_party_risk =
    nameScore >= 80 ? 'low'    :
    nameScore >= 50 ? 'medium' : 'high';

  // ─── Contact confidence — match quality + phone type ─────────────────────
  let contact_confidence: ContactConfidence;
  let confidence_reason: string;

  if (nameScore >= 80 && addressScore >= 80 && hasMobile) {
    contact_confidence = 'high';
    confidence_reason  = 'Strong name + address match with mobile number';

  } else if (nameScore >= 60 && addressScore >= 60 && hasAnyPhone) {
    contact_confidence = 'medium';
    confidence_reason  = 'Good name + address match';

  } else if (normalized.matchStatus === 'partial' || nameScore < 60) {
    contact_confidence = 'low';
    confidence_reason  = nameScore < 60
      ? 'Weak name match — verify before calling'
      : 'Partial address match only';

  } else {
    contact_confidence = 'none';
    confidence_reason  = 'Insufficient match data';
  }

  return { contact_confidence, confidence_reason, wrong_party_risk };
}