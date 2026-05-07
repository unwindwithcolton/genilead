// ─── Follow Up Boss integration ───────────────────────────────────────────────
// Pushes a scored listing to FUB as a new event (contact + note).
// Docs: https://docs.followupboss.com/reference/createevent

import type { ScoredListing } from "../types";

const FUB_BASE = "https://api.followupboss.com/v1";

export interface FubPushResult {
  success: boolean;
  error?: string;
  fubEventId?: number;
}

export async function pushListingToFub(
  listing: ScoredListing,
  apiKey?: string
): Promise<FubPushResult> {
  const key = apiKey ?? process.env.FOLLOWUPBOSS_API_KEY;

  if (!key) {
    return { success: false, error: "FOLLOWUPBOSS_API_KEY is not configured" };
  }

  const score = listing.latest_score;
  if (!score) {
    return { success: false, error: "No score available for this listing" };
  }

  // Build a note that includes the full outreach context
  // This appears in the FUB contact timeline
  const noteLines = [
    `GeniLead Score: ${score.score}/100 — ${score.temperature.toUpperCase()}`,
    `Opportunity: ${score.opportunity_type ?? "unknown"}`,
    `Confidence: ${score.confidence_score}%`,
    `Signals: ${score.reason_codes.join(", ")}`,
    ``,
    `Evidence: ${score.evidence_summary}`,
    ``,
    score.outreach_sms
      ? `SMS Draft:\n${score.outreach_sms}`
      : null,
    score.outreach_email
      ? `Email Draft:\nSubject: ${score.outreach_email.subject}\n\n${score.outreach_email.body}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const payload = {
    source: "GeniLead",
    type: "Property Lead",
    person: {
      // FUB requires a name — use address as identifier since we don't have owner name
      name: `Property — ${listing.address ?? listing.zip}`,
      address: [listing.address, listing.city, listing.state, listing.zip]
        .filter(Boolean)
        .join(", "),
    },
    description: noteLines,
    // Tag so agent can filter GeniLead leads in FUB
    tags: ["genilead", score.temperature],
  };

  try {
    const res = await fetch(`${FUB_BASE}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // FUB uses HTTP Basic auth — API key as username, empty password
        Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        error: `FUB API error ${res.status}: ${text}`,
      };
    }

    const json = await res.json();
    return { success: true, fubEventId: json.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}