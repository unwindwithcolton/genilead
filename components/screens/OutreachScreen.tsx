"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────
type Tier = "HOT" | "WARM" | "COLD";
type ChannelChip = "SMS" | "Email" | "Call";
type UrgencyState = "overdue" | "due" | "upcoming";
type ComposerTab = "SMS" | "Email" | "Call script";
type FilterPill = "All" | "Overdue" | "Due today" | "Upcoming";

interface QueueLead {
  id: string;
  listingId: string;
  name: string;
  tier: Tier;
  channel: ChannelChip;
  urgencyState: UrgencyState;
  urgencyText: string;
  touches: number;
  source: string;
  lastContact: string;
  unread?: boolean;
  // center panel
  address: string;
  ask: string;
  consentOk: boolean;
  aiSignals: string[];
  aiOpening: string;
  drafts: Record<ComposerTab, string>;
  sequenceName: string;
  sequenceTotal: number;
  sequenceStep: number;
  // right rail
  touchStats: { touches: number; lastContact: string; replies: number };
  contactLog: { channel: "sms" | "email" | "call"; title: string; date: string }[];
  talkingPush: string;
  talkingWatch: string;
  whyNow: string;
  scores: { label: string; value: number; color: string }[];
  // enrichment — mirrors DashboardScreen ActionItem
  bestPhone:         string | null;
  bestPhoneType:     "mobile" | "landline" | "voip" | "unknown" | null;
  bestPhoneDnc:      boolean;
  bestEmail:         string | null;
  contactConfidence: "high" | "medium" | null;
  enrichedAt:        string | null;
  canRefresh:        boolean;
}

// ── Supabase row shapes ────────────────────────────────────────────────────

interface ListingJoin {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  list_price: number | null;
  source: string | null;
  best_phone: string | null;
  best_email: string | null;
  contact_confidence: "high" | "medium" | "low" | "none" | null;
  enriched_at: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScoreRow = {
  id: string;
  listing_id: string;
  score: number;
  confidence_score: number | null;
  temperature: string | null;
  evidence_summary: string | null;
  recommended_action: string | null;
  reason_codes: string[] | null;
  outreach_sms: string | null;
  outreach_email: { subject: string; body: string } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listings: any;
};

// ── Mapping helpers ────────────────────────────────────────────────────────

const REASON_LABELS: Record<string, string | null> = {
  tax_delinquent:            "Tax delinquent",
  absentee_owner:            "Absentee owner",
  high_equity:               "High equity",
  significant_equity:        "High equity",
  equity_position:           "Equity position",
  equity_spread_detected:    "Equity spread",
  equity_spread_favorable:   "Equity spread",
  equity_spread_high:        "High equity spread",
  positive_equity_spread:    "Equity spread",
  potential_equity_position: "Equity position",
  minimal_equity_spread:     "Low equity spread",
  appreciation_since_purchase: "Appreciated",
  avm_appreciation:          "AVM appreciation",
  long_ownership:            "Long ownership",
  long_hold_period:          "Long hold",
  held_long_term:            "Long hold",
  recent_acquisition:        "Recent acquisition",
  off_market_candidate:      "Off-market candidate",
  off_market_potential:      "Off-market potential",
  off_market_property:       "Off-market",
  off_market_status:         "Off-market",
  owner_occupied:            "Owner-occupied",
  no_active_listing:         "No active listing",
  not_currently_listed:      "Not listed",
  no_listing_active:         "Not listed",
  price_reduction:           "Price reduction",
  equity_gain:               "Equity gain",
  // suppress data-quality noise
  avm_missing: null, avm_unavailable: null, insufficient_data: null,
  list_price_missing: null, missing_avm: null, missing_avm_data: null,
  missing_list_price: null, missing_listing_data: null, missing_market_data: null,
  missing_market_signals: null, missing_market_timing: null, missing_owner_data: null,
  missing_ownership_data: null, missing_price: null, missing_price_signals: null,
  missing_pricing_data: null, missing_pricing_signals: null, missing_valuation: null,
  missing_valuation_data: null, no_avm_available: null, no_avm_data: null,
  no_avm_value: null, no_days_on_market: null, no_list_price: null,
  no_listing_price: null, no_listing_signals: null, no_listing_status: null,
  no_market_activity: null, no_market_indicators: null, no_market_signals: null,
  no_market_timing_data: null, no_motivation_indicators: null,
  no_motivation_signals: null, no_owner_data: null, no_owner_type: null,
  no_owner_type_data: null, no_price_cuts: null, no_price_signals: null,
  no_pricing_signals: null, no_tax_delinquency: null, not_tax_delinquent: null,
  owner_type_unknown: null, price_missing: null, price_unavailable: null,
  stale_listing_data: null, stale_market_data: null, stale_sales_data: null,
  stale_transaction_data: null, aged_transaction_data: null, unknown_owner_type: null,
};

function chipsFrom(reasonCodes: string[] | null, evidenceSummary: string | null): string[] {
  if (reasonCodes && reasonCodes.length > 0) {
    return reasonCodes
      .map((c) => REASON_LABELS[c])
      .filter((l): l is string => !!l)
      .slice(0, 3);
  }
  const text = (evidenceSummary ?? "").toLowerCase();
  const chips: string[] = [];
  if (text.includes("tax delinqu"))                       chips.push("Tax delinquent");
  if (text.includes("absentee"))                          chips.push("Absentee owner");
  if (text.includes("equity") && chips.length < 3)       chips.push("High equity");
  if (text.includes("long ownership") && chips.length < 3) chips.push("Long ownership");
  return chips.slice(0, 3);
}

function tierFrom(score: number, temperature: string | null): Tier {
  const t = (temperature ?? "").toUpperCase();
  if (t === "HOT")  return "HOT";
  if (t === "WARM" || score >= 40) return "WARM";
  return "COLD";
}

function urgencyFrom(tier: Tier): { state: UrgencyState; text: string } {
  if (tier === "HOT")  return { state: "overdue",  text: "Follow-up overdue" };
  if (tier === "WARM") return { state: "due",      text: "Follow-up due today" };
  return                      { state: "upcoming", text: "In queue" };
}

function channelFrom(score: ScoreRow): ChannelChip {
  if (score.outreach_sms)   return "SMS";
  if (score.outreach_email) return "Email";
  return "SMS";
}

function draftsFrom(score: ScoreRow, address: string): Record<ComposerTab, string> {
  const sms   = score.outreach_sms ?? `Hi, this is [Your Name] from [Agency]. I wanted to reach out about ${address}. Do you have a moment to connect?`;
  const email = score.outreach_email
    ? `Subject: ${score.outreach_email.subject}\n\n${score.outreach_email.body}`
    : `Hi,\n\nI wanted to reach out about ${address}. I have some information that may be relevant to you.\n\nWould you be open to a quick call?\n\nBest,\n[Your Name]`;
  const callScript = `Opener: 'Hi, [Your Name] calling about ${address}.'\n\nKey points:\n• ${(score.reason_codes ?? []).slice(0, 3).map((c) => REASON_LABELS[c] ?? c).filter(Boolean).join("\n• ") || "Review property details"}\n\nClose: 'Would you be open to a quick conversation?'`;
  return { SMS: sms, Email: email, "Call script": callScript };
}

function aiOpeningFrom(evidenceSummary: string | null, address: string): string {
  if (evidenceSummary && evidenceSummary.length > 20) {
    // Use first sentence of evidence summary as the basis for the opener
    const first = evidenceSummary.split(".")[0];
    return `"${first}. I'd love to connect about ${address} — do you have a moment?"`;
  }
  return `"Hi — I wanted to reach out about ${address}. I have some information that might be relevant to you. Worth a quick conversation?"`;
}

function whyNowFrom(evidenceSummary: string | null, chips: string[]): string {
  if (evidenceSummary && evidenceSummary.length > 20) return evidenceSummary;
  if (chips.length > 0) return chips.join(", ") + " — flagged by AI scoring.";
  return "Surfaced by daily AI scoring run.";
}

function mapScoreToLead(s: ScoreRow): QueueLead {
  const listing = Array.isArray(s.listings) ? (s.listings as ScoreRow["listings"][])[0] : s.listings;
  const address  = listing?.address ?? "Unknown address";
  const city     = listing?.city ?? "";
  const fullAddr = city ? `${address}, ${city}` : address;
  const tier     = tierFrom(s.score, s.temperature ?? null);
  const urgency  = urgencyFrom(tier);
  const chips    = chipsFrom(s.reason_codes ?? null, s.evidence_summary ?? null);
  const trusted  = listing?.contact_confidence === "high" || listing?.contact_confidence === "medium";
  const daysSinceEnriched = listing?.enriched_at
    ? (Date.now() - new Date(listing.enriched_at).getTime()) / 86_400_000
    : null;

  const askPrice = listing?.list_price
    ? `$${(listing.list_price / 1000).toFixed(0)}k ask`
    : "Price unknown";

  return {
    id:           s.id,
    listingId:    s.listing_id,
    name:         fullAddr,           // no owner name yet — address is the identity
    tier,
    channel:      channelFrom(s),
    urgencyState: urgency.state,
    urgencyText:  urgency.text,
    touches:      0,                  // TODO: derive from outreach_log once listing_id FK is queried
    source:       listing?.source ?? "Attom",
    lastContact:  "—",                // TODO: from outreach_log
    unread:       tier === "HOT",
    address:      fullAddr,
    ask:          askPrice,
    consentOk:    trusted,
    aiSignals:    chips.length > 0 ? chips : ["AI scored"],
    aiOpening:    aiOpeningFrom(s.evidence_summary ?? null, address),
    drafts:       draftsFrom(s, address),
    sequenceName: tier === "HOT" ? "Hot seller — 7-step" : tier === "WARM" ? "Warm seller — 7-step" : "Cold intro — 5-step",
    sequenceTotal: tier === "COLD" ? 5 : 7,
    sequenceStep:  1,                 // TODO: derive from outreach_log step tracking
    touchStats:   { touches: 0, lastContact: "—", replies: 0 },
    contactLog:   [],                 // TODO: populate from outreach_log once listing_id FK is live
    talkingPush:  chips.length > 0
      ? chips.join(", ") + ". Flagged as a motivated seller signal."
      : "Review AI evidence summary for push points.",
    talkingWatch: "No prior contact history. Keep first message short and low-pressure.",
    whyNow:       whyNowFrom(s.evidence_summary ?? null, chips),
    scores: [
      { label: "Opportunity", value: s.score,                       color: "var(--accent)" },
      { label: "Confidence",  value: Math.round((s.confidence_score ?? 0) * 100), color: "var(--accent)" },
      { label: "Fit",         value: Math.min(s.score + 10, 100),   color: "#8892a4" },
      { label: "Contact risk",value: trusted ? 20 : 60,             color: trusted ? "var(--success)" : "var(--warm)" },
    ],
    // Enrichment — mirrors DashboardScreen ContactSection pattern exactly
    bestPhone:         trusted ? (listing?.best_phone ?? null)  : null,
    bestPhoneType:     null,
    bestPhoneDnc:      false,
    bestEmail:         trusted ? (listing?.best_email ?? null)  : null,
    contactConfidence: trusted ? (listing!.contact_confidence as "high" | "medium") : null,
    enrichedAt:        listing?.enriched_at ?? null,
    canRefresh:        daysSinceEnriched === null || daysSinceEnriched >= 7,
  };
}

// ── Sequence steps ─────────────────────────────────────────────────────────
function buildSteps(step: number, total: number): { label: string; state: "done" | "now" | "future" }[] {
  const labels = ["D1 SMS", "D2 Email", "D4 SMS", "D6 Call", "D9 Email", "D12 SMS", "D14 Email"];
  return Array.from({ length: total }, (_, i) => ({
    label: labels[i] ?? `Step ${i + 1}`,
    state: i < step - 1 ? "done" : i === step - 1 ? "now" : "future",
  }));
}

// ── Colour helpers ─────────────────────────────────────────────────────────
const TIER_STYLES: Record<Tier, { bg: string; color: string; border: string }> = {
  HOT:  { bg: "rgba(239,68,68,0.14)",   color: "#f87171", border: "rgba(239,68,68,0.3)"   },
  WARM: { bg: "rgba(245,158,11,0.12)",  color: "#fbbf24", border: "rgba(245,158,11,0.28)" },
  COLD: { bg: "rgba(107,114,128,0.1)",  color: "#9ca3af", border: "rgba(107,114,128,0.2)" },
};

const CH_CHIP_STYLES: Record<ChannelChip, { bg: string; color: string; border: string }> = {
  SMS:   { bg: "rgba(16,185,129,0.1)",  color: "#34d399", border: "rgba(16,185,129,0.22)" },
  Email: { bg: "rgba(59,130,246,0.1)",  color: "#60a5fa", border: "rgba(59,130,246,0.22)" },
  Call:  { bg: "rgba(245,158,11,0.1)",  color: "#fbbf24", border: "rgba(245,158,11,0.2)"  },
};

const URGENCY_COLOR: Record<UrgencyState, string> = {
  overdue:  "#f87171",
  due:      "#fbbf24",
  upcoming: "var(--text-muted)",
};

const LOG_ICON_STYLES: Record<"sms" | "email" | "call", { bg: string; color: string; label: string }> = {
  sms:   { bg: "rgba(16,185,129,0.12)", color: "#34d399", label: "S" },
  email: { bg: "rgba(59,130,246,0.12)", color: "#60a5fa", label: "E" },
  call:  { bg: "rgba(245,158,11,0.10)", color: "#fbbf24", label: "C" },
};

// ── Inline SVG icons ───────────────────────────────────────────────────────
function IcoStar() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path d="M5.5 1L6.8 4.2H10L7.4 6.3 8.3 9.5 5.5 7.6 2.7 9.5 3.6 6.3 1 4.2H4.2L5.5 1Z" fill="#60a5fa" />
    </svg>
  );
}
function IcoRegen() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M8.5 5A3.5 3.5 0 1 1 5 1.5M8.5 1.5v3h-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IcoCheck() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5.5" stroke="#34d399" strokeWidth="1" />
      <path d="M3.5 6l1.6 1.6L8.5 4" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IcoNow() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5.5" stroke="#3b82f6" strokeWidth="1.5" />
      <circle cx="6" cy="6" r="2" fill="#3b82f6" />
    </svg>
  );
}
function IcoInfo() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <circle cx="5" cy="5" r="4.5" stroke="#6b7094" strokeWidth="1" />
      <path d="M5 4.5v3M5 3.2v.4" stroke="#6b7094" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
function IcoConsentOk() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <circle cx="5" cy="5" r="4.5" stroke="#34d399" strokeWidth="1" />
      <path d="M3 5l1.3 1.3L7 3.5" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IcoConsentNo() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <circle cx="5" cy="5" r="4.5" stroke="#f87171" strokeWidth="1" />
      <path d="M3.5 3.5l3 3M6.5 3.5l-3 3" stroke="#f87171" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function IcoPushUp() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M5 8V2M5 2L2.5 4.5M5 2L7.5 4.5" stroke="#34d399" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IcoWarn() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M5 2v3.5M5 7.2v.4" stroke="#f87171" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="5" cy="5" r="4.5" stroke="#f87171" strokeWidth="1" />
    </svg>
  );
}

// ── ContextSection — collapsible talking points + why now ─────────────────
function ContextSection({ lead }: { lead: QueueLead }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--border)", background: "#0d1019" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 14px", background: "transparent", border: "none", cursor: "pointer",
          fontFamily: "var(--font-ui)",
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.6px", color: "var(--text-muted)", textTransform: "uppercase" }}>Context</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)", display: "inline-block", transition: "transform .15s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ borderRadius: "var(--r-sm)", padding: "10px 12px", background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "#34d399", marginBottom: 6 }}>
              <IcoPushUp /> Push on
            </div>
            <div style={{ fontSize: 12, color: "#c8cfe0", lineHeight: 1.55 }}>{lead.talkingPush}</div>
          </div>
          <div style={{ borderRadius: "var(--r-sm)", padding: "10px 12px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "#f87171", marginBottom: 6 }}>
              <IcoWarn /> Watch out
            </div>
            <div style={{ fontSize: 12, color: "#c8cfe0", lineHeight: 1.55 }}>{lead.talkingWatch}</div>
          </div>
          <div style={{ padding: "9px 11px", borderRadius: "var(--r-sm)", background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.14)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", color: "#60a5fa", textTransform: "uppercase", marginBottom: 5 }}>Why this lead now</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>{lead.whyNow}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ContactSection — identical to DashboardScreen ─────────────────────────
function ContactSection({
  lead,
  onRefreshed,
}: {
  lead: QueueLead;
  onRefreshed: (updated: Partial<QueueLead>) => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [copied,     setCopied]     = useState(false);

  const confidenceBadge: Record<string, React.CSSProperties> = {
    high:   { background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.22)" },
    medium: { background: "rgba(245,158,11,0.10)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.20)" },
  };

  async function handleCopy() {
    if (!lead.bestPhone) return;
    await navigator.clipboard.writeText(lead.bestPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res  = await fetch("/api/skip-trace/refresh", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ listing_id: lead.listingId }),
      });
      const json = await res.json();
      if (json.ui) {
        onRefreshed({
          bestPhone:         json.ui.bestPhone,
          bestEmail:         json.ui.bestEmail,
          contactConfidence: json.ui.contactConfidence,
          enrichedAt:        json.ui.enrichedAt,
          canRefresh:        json.ui.canRefresh,
        });
      }
    } catch (err) {
      console.error("[ContactSection] refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", color: "var(--text-muted)", textTransform: "uppercase" }}>Contact</div>
        {lead.contactConfidence && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, ...confidenceBadge[lead.contactConfidence] }}>
            {lead.contactConfidence === "high" ? "Verified" : "Likely match"}
          </span>
        )}
      </div>

      {lead.bestPhone ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: lead.bestEmail ? 6 : 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#eceef5", letterSpacing: "0.02em" }}>{lead.bestPhone}</div>
            {lead.bestPhoneType && (
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                {lead.bestPhoneType}
                {lead.bestPhoneDnc && <span style={{ marginLeft: 6, color: "#f87171", fontWeight: 700 }}>· DNC</span>}
              </div>
            )}
          </div>
          <button
            onClick={handleCopy}
            style={{
              fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 4,
              cursor: "pointer", fontFamily: "var(--font-ui)", flexShrink: 0,
              background: copied ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.10)",
              color:      copied ? "#10b981"               : "var(--accent)",
              border:     copied ? "1px solid rgba(16,185,129,0.22)" : "1px solid rgba(59,130,246,0.22)",
              transition: "all 0.15s",
            }}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: lead.bestEmail ? 6 : 0 }}>No phone found</div>
      )}

      {lead.bestEmail && (
        <div style={{ fontSize: 11, color: "#9da2ba", marginBottom: 8 }}>{lead.bestEmail}</div>
      )}

      {lead.canRefresh && (
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 4,
            cursor: refreshing ? "default" : "pointer", fontFamily: "var(--font-ui)",
            background: "transparent", color: "#3a3f55",
            border: "1px solid #1a1d26",
            opacity: refreshing ? 0.5 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {refreshing ? "Refreshing…" : "Re-run skip trace"}
        </button>
      )}
    </div>
  );
}
// ── SequenceTemplatePanel — collapsed by default ───────────────────────────
function SequenceTemplatePanel({
  lead,
  steps,
  templates,
  hoveredTemplate,
  setHoveredTemplate,
  onUseTemplate,
}: {
  lead: QueueLead;
  steps: { label: string; state: "done" | "now" | "future" }[];
  templates: { channel: string; name: string; desc: string }[];
  hoveredTemplate: number | null;
  setHoveredTemplate: (i: number | null) => void;
  onUseTemplate: (t: { channel: string; name: string; desc: string }) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      {/* Toggle row */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 18px", background: "transparent", border: "none", cursor: "pointer",
          fontFamily: "var(--font-ui)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Sequence &amp; Templates
          </span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Step {lead.sequenceStep} of {lead.sequenceTotal} · {templates.length} templates
          </span>
        </div>
        <span style={{ fontSize: 10, color: "var(--text-muted)", display: "inline-block", transition: "transform .15s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </button>

      {open && (
        <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Sequence */}
          <div style={{ background: "var(--bg-surface)", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{lead.sequenceName}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>Step {lead.sequenceStep} of {lead.sequenceTotal}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {i > 0 && <div style={{ width: 12, height: 1, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, whiteSpace: "nowrap", color: s.state === "done" ? "#34d399" : s.state === "now" ? "#60a5fa" : "#3a3f55", fontWeight: s.state === "now" ? 600 : 400 }}>
                    {s.state === "done" && <IcoCheck />}
                    {s.state === "now"  && <IcoNow />}
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Templates */}
          <div style={{ background: "var(--bg-surface)", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px 8px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", color: "var(--text-muted)", textTransform: "uppercase" }}>Swap template</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{templates.length} available</span>
            </div>
            {templates.map((t, i) => (
              <div
                key={i}
                onClick={() => onUseTemplate(t)}
                onMouseEnter={() => setHoveredTemplate(i)}
                onMouseLeave={() => setHoveredTemplate(null)}
                style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", borderBottom: i < templates.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", cursor: "pointer", background: hoveredTemplate === i ? "var(--bg-card-hover)" : "transparent", transition: "background .1s" }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, marginTop: 1, background: t.channel === "SMS" ? "rgba(16,185,129,0.1)" : "rgba(59,130,246,0.1)", color: t.channel === "SMS" ? "#34d399" : "#60a5fa", border: t.channel === "SMS" ? "1px solid rgba(16,185,129,0.18)" : "1px solid rgba(59,130,246,0.18)" }}>
                  {t.channel === "SMS" ? "S" : "E"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.desc}</div>
                </div>
                <div style={{ fontSize: 10, color: "#60a5fa", opacity: hoveredTemplate === i ? 1 : 0, transition: "opacity .1s", padding: "2px 7px", borderRadius: 3, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.08)", whiteSpace: "nowrap", flexShrink: 0, alignSelf: "center" }}>
                  Use →
                </div>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
// ── Sub-components ─────────────────────────────────────────────────────────

function QueueRow({ lead, selected, onClick }: { lead: QueueLead; selected: boolean; onClick: () => void }) {
  const tier = TIER_STYLES[lead.tier];
  const ch   = CH_CHIP_STYLES[lead.channel];
  return (
    <div
      onClick={onClick}
      style={{
        padding: "11px 12px 11px 15px",
        borderLeft: `3px solid ${selected ? "var(--accent)" : "transparent"}`,
        borderBottom: "1px solid rgba(255,255,255,0.035)",
        cursor: "pointer",
        background: selected ? "rgba(59,130,246,0.07)" : undefined,
        boxShadow: selected ? "inset 0 0 0 1px rgba(59,130,246,0.18)" : undefined,
        transition: "background .12s",
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.025)"; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = ""; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 3, letterSpacing: "0.3px", flexShrink: 0, background: tier.bg, color: tier.color, border: `1px solid ${tier.border}` }}>
          {lead.tier}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text-primary)" }}>
          {lead.name}
        </span>
        {lead.unread && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 3, letterSpacing: "0.2px", flexShrink: 0, background: ch.bg, color: ch.color, border: `1px solid ${ch.border}` }}>
          {lead.channel}
        </span>
        <span style={{ fontSize: 11, color: URGENCY_COLOR[lead.urgencyState], whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {lead.urgencyText}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {lead.touches} {lead.touches === 1 ? "touch" : "touches"} · {lead.source} · {lead.lastContact}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function OutreachScreen() {
  const [leads,         setLeads]         = useState<QueueLead[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [activeFilter,  setActiveFilter]  = useState<FilterPill>("All");
  const [activeTab,     setActiveTab]     = useState<ComposerTab>("SMS");
  const [draft,         setDraft]         = useState<string>("");
  const [regenerating,  setRegenerating]  = useState(false);
  const [hoveredTemplate, setHoveredTemplate] = useState<number | null>(null);

  // ── Fetch from Supabase ──────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: scores, error } = await supabase
        .from("listing_scores")
        .select(`
          id,
          listing_id,
          score,
          confidence_score,
          temperature,
          evidence_summary,
          recommended_action,
          reason_codes,
          outreach_sms,
          outreach_email,
          listings (
            address, city, state, zip,
            list_price, source,
            best_phone, best_email, contact_confidence, enriched_at
          )
        `)
        .order("score", { ascending: false })
        .limit(20);

      if (error) {
        console.error("[OutreachScreen] fetch error:", error);
        setLoading(false);
        return;
      }

      const mapped = (scores ?? []).map((s) => mapScoreToLead(s as ScoreRow));
      setLeads(mapped);
      if (mapped.length > 0) {
        setSelectedId(mapped[0].id);
        setDraft(mapped[0].drafts["SMS"]);
      }
      setLoading(false);
    }

    load();
  }, []);

  const lead = leads.find(l => l.id === selectedId) ?? leads[0] ?? null;
  const steps = lead ? buildSteps(lead.sequenceStep, lead.sequenceTotal) : [];

  const filters: FilterPill[] = ["All", "Overdue", "Due today", "Upcoming"];

  const filteredLeads = leads.filter(l => {
    if (activeFilter === "All")       return true;
    if (activeFilter === "Overdue")   return l.urgencyState === "overdue";
    if (activeFilter === "Due today") return l.urgencyState === "due";
    if (activeFilter === "Upcoming")  return l.urgencyState === "upcoming";
    return true;
  });

  const TEMPLATES = [
    { channel: "SMS",   name: "Price drop alert — seller",  desc: "Personalised outreach when a property signal spikes" },
    { channel: "SMS",   name: "New signal match",            desc: "Surfaces a property based on scoring criteria" },
    { channel: "Email", name: "Re-engagement (90d+)",        desc: "Low-pressure check-in for leads quiet for 3+ months" },
    { channel: "Email", name: "Referral ask — past client",  desc: "Warm ask after a successful close or positive interaction" },
  ];

  function handleSelectLead(l: QueueLead) {
    setSelectedId(l.id);
    setActiveTab("SMS");
    setDraft(l.drafts["SMS"]);
    setRegenerating(false);
  }

  function handleTabChange(tab: ComposerTab) {
    setActiveTab(tab);
    if (lead) setDraft(lead.drafts[tab] ?? "");
  }

  function handleRegenerate() {
    if (!lead) return;
    setRegenerating(true);
    setDraft("");
    setTimeout(() => {
      setRegenerating(false);
      setDraft(lead.aiOpening.replace(/^"|"$/g, ""));
    }, 800);
  }

  async function handleSend() {
    if (!lead) return;
    if (activeTab === "Call script") {
      await navigator.clipboard.writeText(draft);
      return;
    }
    const channel: "sms" | "email" = activeTab === "SMS" ? "sms" : "email";
    try {
      const res  = await fetch("/api/outreach", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          listing_id: lead.listingId,
          score_id:   lead.id,
          channel,
          body:       draft,
          step:       lead.sequenceStep,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setLeads(prev => prev.map(l => {
          if (l.id !== selectedId) return l;
          return {
            ...l,
            touches:      json.touches     ?? l.touches,
            lastContact:  json.lastContact ?? l.lastContact,
            sequenceStep: json.nextStep    ?? l.sequenceStep,
            touchStats: {
              ...l.touchStats,
              touches:     json.touches     ?? l.touchStats.touches,
              lastContact: json.lastContact ?? l.touchStats.lastContact,
            },
            contactLog: json.newLogEntry
              ? [json.newLogEntry, ...l.contactLog]
              : l.contactLog,
          };
        }));
      }
    } catch (err) {
      console.error("[OutreachScreen] handleSend failed:", err);
    }
  }

  async function handleLogCall() {
    if (!lead) return;
    try {
      const res  = await fetch("/api/outreach", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          listing_id: lead.listingId,
          score_id:   lead.id,
          channel:    "call",
          body:       draft,
          step:       lead.sequenceStep,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setLeads(prev => prev.map(l => {
          if (l.id !== selectedId) return l;
          return {
            ...l,
            touches:      json.touches     ?? l.touches,
            lastContact:  json.lastContact ?? l.lastContact,
            sequenceStep: json.nextStep    ?? l.sequenceStep,
            touchStats: {
              ...l.touchStats,
              touches:     json.touches     ?? l.touchStats.touches,
              lastContact: json.lastContact ?? l.touchStats.lastContact,
            },
            contactLog: json.newLogEntry
              ? [json.newLogEntry, ...l.contactLog]
              : l.contactLog,
          };
        }));
      }
    } catch (err) {
      console.error("[OutreachScreen] handleLogCall failed:", err);
    }
  }

  async function handleSkip() {
    if (!lead) return;
    try {
      await fetch("/api/outreach", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          listing_id: lead.listingId,
          score_id:   lead.id,
          channel:    "skip",
          body:       "",
          step:       lead.sequenceStep,
        }),
      });
    } catch (err) {
      console.error("[OutreachScreen] handleSkip failed:", err);
    }
    // Advance to next lead regardless of network result
    const currentIndex = filteredLeads.findIndex(l => l.id === selectedId);
    const nextLead = filteredLeads[currentIndex + 1] ?? filteredLeads[0];
    if (nextLead && nextLead.id !== selectedId) handleSelectLead(nextLead);
  }

  function handleUseTemplate(t: typeof TEMPLATES[0]) {
    if (!lead) return;
    const tab: ComposerTab = t.channel === "SMS" ? "SMS" : "Email";
    setActiveTab(tab);
    setDraft(`[${t.name}] ${lead.drafts[tab]}`);
  }

  function handleLeadRefreshed(updated: Partial<QueueLead>) {
    setLeads(prev => prev.map(l => l.id === selectedId ? { ...l, ...updated } : l));
  }

  const sendLabel =
    activeTab === "SMS"        ? "Send SMS — log to CRM" :
    activeTab === "Email"      ? "Send Email — log to CRM" :
    "Copy script";

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", color: "var(--text-muted)", fontSize: 13 }}>
        Loading outreach queue…
      </div>
    );
  }

  if (!lead) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", color: "var(--text-muted)", fontSize: 13 }}>
        No scored leads found. Ingest runs daily at 6:00 AM.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", background: "var(--bg-base)", fontFamily: "var(--font-ui)" }}>

      {/* ══ LEFT RAIL ══ */}
      <div style={{ width: 272, minWidth: 272, background: "var(--bg-surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.3px", marginBottom: 10 }}>
            Draft queue{" "}
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>{filteredLeads.length} leads</span>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {filters.map(f => (
              <span
                key={f}
                onClick={() => setActiveFilter(f)}
                style={{
                  padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                  cursor: "pointer", userSelect: "none",
                  border: activeFilter === f ? "1px solid rgba(59,130,246,0.35)" : "1px solid rgba(255,255,255,0.1)",
                  color: activeFilter === f ? "#60a5fa" : "var(--text-secondary)",
                  background: activeFilter === f ? "rgba(59,130,246,0.12)" : "transparent",
                  transition: "background .1s",
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredLeads.map(l => (
            <QueueRow key={l.id} lead={l} selected={selectedId === l.id} onClick={() => handleSelectLead(l)} />
          ))}
        </div>
      </div>

      {/* ══ CENTER ══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-base)", minWidth: 0 }}>

        {/* Contact identity header */}
        <div style={{ padding: "13px 20px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "var(--bg-surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(59,130,246,0.14)", border: "1px solid rgba(59,130,246,0.28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#60a5fa", flexShrink: 0, letterSpacing: "-0.5px" }}>
              {lead.address.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.4px", color: "var(--text-primary)" }}>{lead.address}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: TIER_STYLES[lead.tier].color, letterSpacing: "0.3px" }}>{lead.tier}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· Score {lead.scores[0]?.value} · {lead.ask}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "4px 9px", borderRadius: 5, flexShrink: 0, background: lead.consentOk ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: lead.consentOk ? "1px solid rgba(16,185,129,0.22)" : "1px solid rgba(239,68,68,0.22)", color: lead.consentOk ? "#34d399" : "#f87171" }}>
            {lead.consentOk ? <IcoConsentOk /> : <IcoConsentNo />}
            {lead.consentOk ? "Contact verified" : "Contact unverified"}
          </div>
        </div>

        {/* AI + Composer — unified zone */}
        <div style={{ background: "#0e1320", borderBottom: "1px solid rgba(59,130,246,0.15)", padding: "12px 18px 0", flexShrink: 0 }}>

          {/* Signal chips + regenerate */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <IcoStar />
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {lead.aiSignals.map(s => (
                  <span key={s} style={{ fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 3, background: "rgba(59,130,246,0.1)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.18)" }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={handleRegenerate}
              style={{ fontSize: 10, color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", fontFamily: "var(--font-ui)", transition: "color .1s", flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text-secondary)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              <IcoRegen /> Regenerate
            </button>
          </div>

          {/* Unified card: AI suggestion flows into editable draft */}
          <div style={{ background: "#111827", borderRadius: "var(--r-md) var(--r-md) 0 0", border: "1px solid rgba(59,130,246,0.24)", borderBottom: "none", borderLeft: "3px solid var(--accent)", overflow: "hidden" }}>

            {/* AI suggested text — tap to use */}
            <div
              onClick={() => setDraft(lead.aiOpening.replace(/^"|"$/g, ""))}
              style={{ padding: "10px 14px 9px", borderBottom: "1px solid rgba(59,130,246,0.12)", cursor: "pointer" }}
              title="Click to use as draft"
            >
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.6px", color: "#4a7aaa", textTransform: "uppercase", marginBottom: 5 }}>AI suggestion — click to use</div>
              <div style={{ fontSize: 12.5, color: "#8ba8cc", lineHeight: 1.6, fontStyle: "italic" }}>
                {lead.aiOpening}
              </div>
            </div>

            {/* Tabs sit inside the card */}
            <div style={{ display: "flex", padding: "0 14px", background: "rgba(0,0,0,0.15)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {(["SMS", "Email", "Call script"] as ComposerTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  style={{ padding: "7px 12px", fontSize: 11, fontWeight: 500, color: activeTab === tab ? "#60a5fa" : "var(--text-muted)", background: "transparent", border: "none", borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent", cursor: "pointer", fontFamily: "var(--font-ui)", transition: "color .1s" }}
                >
                  {tab}
                </button>
              ))}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setDraft("")}
                  style={{ fontSize: 10, color: "var(--text-muted)", cursor: "pointer", padding: "1px 6px", borderRadius: 3, border: "none", background: "transparent", fontFamily: "var(--font-ui)" }}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Editable draft */}
            <textarea
              value={regenerating ? "" : draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={regenerating ? "Regenerating…" : "Edit your message…"}
              style={{ width: "100%", background: "transparent", border: "none", padding: "10px 14px 14px", fontSize: 13, color: "#e0e4f0", fontFamily: "var(--font-ui)", resize: "none", height: 110, lineHeight: 1.75, outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>

        {/* Composer body — sequence + templates collapsed */}
        <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-base)" }}>

          {/* Sequence + Templates — collapsible sub-panel */}
          <SequenceTemplatePanel
            lead={lead}
            steps={steps}
            templates={TEMPLATES}
            hoveredTemplate={hoveredTemplate}
            setHoveredTemplate={setHoveredTemplate}
            onUseTemplate={handleUseTemplate}
          />

        </div>

        {/* Actions zone */}
        <div style={{ flexShrink: 0, background: "#161921", borderTop: "1px solid var(--border-strong)", padding: "13px 18px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={handleSend}
              style={{ width: "100%", padding: "10px 16px", borderRadius: "var(--r-sm)", fontSize: 13, fontWeight: 600, letterSpacing: "-0.2px", cursor: "pointer", background: "var(--accent)", color: "#fff", border: "none", fontFamily: "var(--font-ui)", boxShadow: "0 1px 12px rgba(59,130,246,0.3)", transition: "background .1s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}
            >
              {sendLabel}
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              {(["Skip", "Log call"] as const).map(label => (
                <button
                  key={label}
                  onClick={label === "Skip" ? handleSkip : handleLogCall}
                  style={{ flex: 1, padding: "7px 12px", borderRadius: "var(--r-sm)", fontSize: 11, fontWeight: 500, cursor: "pointer", background: "transparent", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.07)", fontFamily: "var(--font-ui)", transition: "color .1s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--text-secondary)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <IcoInfo /> Sending will log to FUB and advance the sequence to step {lead.sequenceStep + 1}
          </div>
        </div>
      </div>

      {/* ══ RIGHT RAIL ══ */}
      <div style={{ width: 252, minWidth: 252, background: "var(--bg-surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* Touch stats */}
        <div style={{ padding: "13px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.6px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 9 }}>Touch history</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { num: String(lead.touchStats.touches), lbl: "touches"      },
              { num: lead.touchStats.lastContact,     lbl: "last contact" },
              { num: String(lead.touchStats.replies), lbl: "replies"      },
            ].map(box => (
              <div key={box.lbl} style={{ flex: 1, background: "var(--bg-card)", borderRadius: "var(--r-sm)", padding: "8px 6px 7px", textAlign: "center", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{box.num}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{box.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact section — BatchData enrichment, identical to DashboardScreen */}
        {(lead.contactConfidence === "high" || lead.contactConfidence === "medium") && (
          <ContactSection lead={lead} onRefreshed={handleLeadRefreshed} />
        )}

        {/* Contact log */}
        <div style={{ padding: "13px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.6px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 9 }}>Contact log</div>
          {lead.contactLog.length === 0 && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>No contact yet</div>
          )}
          {lead.contactLog.slice(0, 2).map((entry, i) => {
            const ico = LOG_ICON_STYLES[entry.channel];
            return (
              <div key={i} style={{ display: "flex", gap: 8, padding: "5px 0", alignItems: "flex-start" }}>
                <div style={{ width: 22, height: 22, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1, background: ico.bg, color: ico.color }}>
                  {ico.label}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#c8cfe0", lineHeight: 1.4 }}>{entry.title}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{entry.date}</div>
                </div>
              </div>
            );
          })}
          {lead.contactLog.length > 2 && (
            <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 6, cursor: "pointer" }}>
              View all activity ({lead.contactLog.length})
            </div>
          )}
        </div>

        {/* Context — collapsible */}
        <ContextSection lead={lead} />

        {/* Lead score */}
        <div style={{ padding: "13px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.6px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 9 }}>Lead score</div>
          {lead.scores.map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", minWidth: 80 }}>{s.label}</div>
              <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${s.value}%`, height: 4, borderRadius: 2, background: s.color }} />
              </div>
              <div style={{ fontSize: 10, color: s.color === "var(--text-secondary)" ? "var(--text-muted)" : s.color, minWidth: 20, textAlign: "right" }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}