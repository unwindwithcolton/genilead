"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────
type Tier = "HOT" | "WARM" | "COLD";
type UrgencyState = "overdue" | "due" | "upcoming";

interface TouchEntry {
  channel: "sms" | "email" | "call";
  title: string;
  date: string;
}

interface QueueLead {
  id: string;
  listingId: string;
  address: string;
  tier: Tier;
  urgencyState: UrgencyState;
  score: number;
  chips: string[];
  bestPhone: string | null;
  bestPhoneType: "mobile" | "landline" | "voip" | "unknown" | null;
  bestPhoneDnc: boolean;
  bestEmail: string | null;
  contactConfidence: "high" | "medium" | null;
  enrichedAt: string | null;
  canRefresh: boolean;
  aiDraft: string;
  aiAngle: string;
  sequenceName: string;
  sequenceTotal: number;
  sequenceStep: number;
  touches: number;
  lastContact: string;
  contactLog: TouchEntry[];
  evidenceSummary: string | null;
  signals: { color: "red" | "amber" | "gray"; text: string }[];
  ownerType: string;
  mailingAddress: string | null;
  holdPeriod: string | null;
  source: string;
  fubThread: boolean;
  fubThreadLabel: string;
  fubLastActivity: string | null;
  fubPipelineStage: string | null;
  outreachMode: OutreachMode;
  stateCode: string | null;
}

// ── Outreach mode (legal guardrails) ──────────────────────────────────────
type OutreachMode = "sms_and_call" | "call_only" | "no_number" | "dnc_blocked";

// Area code → UTC offset (standard time). Covers US/Canada.
const AREA_CODE_TZ: Record<string, string> = {
  "201":"America/New_York","202":"America/New_York","203":"America/New_York",
  "205":"America/Chicago","206":"America/Los_Angeles","207":"America/New_York",
  "208":"America/Boise","209":"America/Los_Angeles","210":"America/Chicago",
  "212":"America/New_York","213":"America/Los_Angeles","214":"America/Chicago",
  "215":"America/New_York","216":"America/New_York","217":"America/Chicago",
  "218":"America/Chicago","219":"America/Chicago","224":"America/Chicago",
  "225":"America/Chicago","228":"America/Chicago","229":"America/New_York",
  "231":"America/Detroit","234":"America/New_York","239":"America/New_York",
  "240":"America/New_York","248":"America/Detroit","251":"America/Chicago",
  "252":"America/New_York","253":"America/Los_Angeles","254":"America/Chicago",
  "256":"America/Chicago","260":"America/Indiana/Indianapolis","262":"America/Chicago",
  "267":"America/New_York","269":"America/Detroit","270":"America/Chicago",
  "272":"America/New_York","276":"America/New_York","281":"America/Chicago",
  "301":"America/New_York","302":"America/New_York","303":"America/Denver",
  "304":"America/New_York","305":"America/New_York","307":"America/Denver",
  "308":"America/Chicago","309":"America/Chicago","310":"America/Los_Angeles",
  "312":"America/Chicago","313":"America/Detroit","314":"America/Chicago",
  "315":"America/New_York","316":"America/Chicago","317":"America/Indiana/Indianapolis",
  "318":"America/Chicago","319":"America/Chicago","320":"America/Chicago",
  "321":"America/New_York","323":"America/Los_Angeles","325":"America/Chicago",
  "330":"America/New_York","331":"America/Chicago","334":"America/Chicago",
  "336":"America/New_York","337":"America/Chicago","339":"America/New_York",
  "340":"America/Puerto_Rico","347":"America/New_York","351":"America/New_York",
  "352":"America/New_York","360":"America/Los_Angeles","361":"America/Chicago",
  "386":"America/New_York","401":"America/New_York","402":"America/Chicago",
  "404":"America/New_York","405":"America/Chicago","406":"America/Denver",
  "407":"America/New_York","408":"America/Los_Angeles","409":"America/Chicago",
  "410":"America/New_York","412":"America/New_York","413":"America/New_York",
  "414":"America/Chicago","415":"America/Los_Angeles","417":"America/Chicago",
  "419":"America/New_York","423":"America/New_York","424":"America/Los_Angeles",
  "425":"America/Los_Angeles","430":"America/Chicago","432":"America/Chicago",
  "434":"America/New_York","435":"America/Denver","440":"America/New_York",
  "442":"America/Los_Angeles","443":"America/New_York","458":"America/Los_Angeles",
  "469":"America/Chicago","470":"America/New_York","475":"America/New_York",
  "478":"America/New_York","479":"America/Chicago","480":"America/Phoenix",
  "484":"America/New_York","501":"America/Chicago","502":"America/Kentucky/Louisville",
  "503":"America/Los_Angeles","504":"America/Chicago","505":"America/Denver",
  "507":"America/Chicago","508":"America/New_York","509":"America/Los_Angeles",
  "510":"America/Los_Angeles","512":"America/Chicago","513":"America/New_York",
  "515":"America/Chicago","516":"America/New_York","517":"America/Detroit",
  "518":"America/New_York","520":"America/Phoenix","530":"America/Los_Angeles",
  "531":"America/Chicago","534":"America/Chicago","539":"America/Chicago",
  "540":"America/New_York","541":"America/Los_Angeles","551":"America/New_York",
  "559":"America/Los_Angeles","561":"America/New_York","562":"America/Los_Angeles",
  "563":"America/Chicago","567":"America/New_York","570":"America/New_York",
  "571":"America/New_York","573":"America/Chicago","574":"America/Indiana/Indianapolis",
  "575":"America/Denver","580":"America/Chicago","585":"America/New_York",
  "586":"America/Detroit","601":"America/Chicago","602":"America/Phoenix",
  "603":"America/New_York","605":"America/Chicago","606":"America/New_York",
  "607":"America/New_York","608":"America/Chicago","609":"America/New_York",
  "610":"America/New_York","612":"America/Chicago","614":"America/New_York",
  "615":"America/Chicago","616":"America/Detroit","617":"America/New_York",
  "618":"America/Chicago","619":"America/Los_Angeles","620":"America/Chicago",
  "623":"America/Phoenix","626":"America/Los_Angeles","628":"America/Los_Angeles",
  "629":"America/Chicago","630":"America/Chicago","631":"America/New_York",
  "636":"America/Chicago","641":"America/Chicago","646":"America/New_York",
  "650":"America/Los_Angeles","651":"America/Chicago","657":"America/Los_Angeles",
  "660":"America/Chicago","661":"America/Los_Angeles","662":"America/Chicago",
  "667":"America/New_York","669":"America/Los_Angeles","671":"Pacific/Guam",
  "678":"America/New_York","681":"America/New_York","682":"America/Chicago",
  "701":"America/Chicago","702":"America/Los_Angeles","703":"America/New_York",
  "704":"America/New_York","706":"America/New_York","707":"America/Los_Angeles",
  "708":"America/Chicago","712":"America/Chicago","713":"America/Chicago",
  "714":"America/Los_Angeles","715":"America/Chicago","716":"America/New_York",
  "717":"America/New_York","718":"America/New_York","719":"America/Denver",
  "720":"America/Denver","724":"America/New_York","725":"America/Los_Angeles",
  "727":"America/New_York","731":"America/Chicago","732":"America/New_York",
  "734":"America/Detroit","737":"America/Chicago","740":"America/New_York",
  "743":"America/New_York","747":"America/Los_Angeles","754":"America/New_York",
  "757":"America/New_York","760":"America/Los_Angeles","762":"America/New_York",
  "763":"America/Chicago","765":"America/Indiana/Indianapolis","769":"America/Chicago",
  "770":"America/New_York","772":"America/New_York","773":"America/Chicago",
  "774":"America/New_York","775":"America/Los_Angeles","779":"America/Chicago",
  "781":"America/New_York","785":"America/Chicago","786":"America/New_York",
  "801":"America/Denver","802":"America/New_York","803":"America/New_York",
  "804":"America/New_York","805":"America/Los_Angeles","806":"America/Chicago",
  "808":"Pacific/Honolulu","810":"America/Detroit","812":"America/Indiana/Indianapolis",
  "813":"America/New_York","814":"America/New_York","815":"America/Chicago",
  "816":"America/Chicago","817":"America/Chicago","818":"America/Los_Angeles",
  "820":"America/Los_Angeles","828":"America/New_York","830":"America/Chicago",
  "831":"America/Los_Angeles","832":"America/Chicago","843":"America/New_York",
  "845":"America/New_York","847":"America/Chicago","848":"America/New_York",
  "850":"America/Chicago","856":"America/New_York","857":"America/New_York",
  "858":"America/Los_Angeles","859":"America/Kentucky/Louisville","860":"America/New_York",
  "862":"America/New_York","863":"America/New_York","864":"America/New_York",
  "865":"America/New_York","870":"America/Chicago","872":"America/Chicago",
  "878":"America/New_York","901":"America/Chicago","903":"America/Chicago",
  "904":"America/New_York","906":"America/Detroit","907":"America/Anchorage",
  "908":"America/New_York","909":"America/Los_Angeles","910":"America/New_York",
  "912":"America/New_York","913":"America/Chicago","914":"America/New_York",
  "915":"America/Denver","916":"America/Los_Angeles","917":"America/New_York",
  "918":"America/Chicago","919":"America/New_York","920":"America/Chicago",
  "925":"America/Los_Angeles","928":"America/Phoenix","929":"America/New_York",
  "931":"America/Chicago","936":"America/Chicago","937":"America/New_York",
  "938":"America/Chicago","940":"America/Chicago","941":"America/New_York",
  "947":"America/Detroit","949":"America/Los_Angeles","951":"America/Los_Angeles",
  "952":"America/Chicago","954":"America/New_York","956":"America/Chicago",
  "959":"America/New_York","970":"America/Denver","971":"America/Los_Angeles",
  "972":"America/Chicago","973":"America/New_York","978":"America/New_York",
  "979":"America/Chicago","980":"America/New_York","984":"America/New_York",
  "985":"America/Chicago","989":"America/Detroit",
};

// HIGH-RISK states for cold outreach — stricter state DNC laws
const HIGH_RISK_STATES = ["FL","TX","OK","IN","WY"];

function getAreaCode(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") return digits.slice(1, 4);
  if (digits.length === 10) return digits.slice(0, 3);
  return null;
}

function isWithinContactWindow(phone: string | null): { allowed: boolean; reason: string | null } {
  const ac = getAreaCode(phone);
  const tz = ac ? (AREA_CODE_TZ[ac] ?? "America/New_York") : "America/New_York";
  try {
    const now = new Date();
    const localHour = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(now));
    if (localHour < 8)  return { allowed: false, reason: `It's ${localHour < 10 ? "0"+localHour : localHour}:00 local time — TCPA requires 8am–9pm` };
    if (localHour >= 21) return { allowed: false, reason: `It's after 9pm local time — TCPA requires 8am–9pm` };
  } catch { /* fallback: allow */ }
  return { allowed: true, reason: null };
}

function getOutreachMode(phone: string | null, phoneType: string | null, dnc: boolean): OutreachMode {
  if (!phone) return "no_number";
  if (dnc)    return "dnc_blocked";
  const t = phoneType ?? "unknown";
  if (t === "landline") return "call_only";
  // mobile, voip, unknown → treat as mobile (TCPA applies)
  return "sms_and_call";
}

function prioritizeLeads(leads: QueueLead[]): QueueLead[] {
  const tierRank: Record<Tier, number> = { HOT: 0, WARM: 1, COLD: 2 };
  const modeRank: Record<OutreachMode, number> = { sms_and_call: 0, call_only: 1, no_number: 2, dnc_blocked: 3 };
  return [...leads].sort((a, b) => {
    if (tierRank[a.tier] !== tierRank[b.tier]) return tierRank[a.tier] - tierRank[b.tier];
    if (modeRank[a.outreachMode] !== modeRank[b.outreachMode]) return modeRank[a.outreachMode] - modeRank[b.outreachMode];
    return b.score - a.score;
  });
}

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

const REASON_LABELS: Record<string, string | null> = {
  tax_delinquent: "Tax delinquent", absentee_owner: "Absentee owner",
  high_equity: "High equity", significant_equity: "High equity",
  equity_position: "Equity position", equity_spread_detected: "Equity spread",
  equity_spread_favorable: "Equity spread", equity_spread_high: "High equity spread",
  positive_equity_spread: "Equity spread", potential_equity_position: "Equity position",
  minimal_equity_spread: "Low equity spread", appreciation_since_purchase: "Appreciated",
  avm_appreciation: "AVM appreciation", long_ownership: "Long ownership",
  long_hold_period: "Long hold", held_long_term: "Long hold",
  recent_acquisition: "Recent acquisition", off_market_candidate: "Off-market candidate",
  off_market_potential: "Off-market potential", off_market_property: "Off-market",
  off_market_status: "Off-market", owner_occupied: "Owner-occupied",
  no_active_listing: "No active listing", not_currently_listed: "Not listed",
  no_listing_active: "Not listed", price_reduction: "Price reduction",
  equity_gain: "Equity gain",
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

function chipsFrom(codes: string[] | null, summary: string | null): string[] {
  if (codes && codes.length > 0)
    return codes.map(c => REASON_LABELS[c]).filter((l): l is string => !!l).slice(0, 3);
  const t = (summary ?? "").toLowerCase();
  const out: string[] = [];
  if (t.includes("tax delinqu")) out.push("Tax delinquent");
  if (t.includes("absentee")) out.push("Absentee owner");
  if (t.includes("equity") && out.length < 3) out.push("High equity");
  if (t.includes("long ownership") && out.length < 3) out.push("Long ownership");
  return out.slice(0, 3);
}

function tierFrom(score: number, temperature: string | null): Tier {
  const t = (temperature ?? "").toUpperCase();
  if (t === "HOT") return "HOT";
  if (t === "WARM" || score >= 40) return "WARM";
  return "COLD";
}

function urgencyFrom(tier: Tier): UrgencyState {
  if (tier === "HOT") return "overdue";
  if (tier === "WARM") return "due";
  return "upcoming";
}

function signalsFrom(codes: string[] | null, summary: string | null, chips: string[]): { color: "red" | "amber" | "gray"; text: string }[] {
  const RED_KEYS   = ["tax_delinquent"];
  const AMBER_KEYS = ["absentee_owner","long_ownership","long_hold_period","held_long_term","off_market_candidate"];
  if (codes && codes.length > 0)
    return codes.filter(c => REASON_LABELS[c]).slice(0, 4).map(c => ({
      color: RED_KEYS.includes(c) ? "red" : AMBER_KEYS.includes(c) ? "amber" : "gray",
      text: REASON_LABELS[c] as string,
    }));
  return chips.map((ch, i) => ({ color: i === 0 ? "red" : i === 1 ? "amber" : "gray", text: ch }));
}

function angleFrom(chips: string[]): string {
  if (chips.includes("Tax delinquent") && chips.includes("Absentee owner"))
    return "Tax delinquency + absentee owner — lead with urgency, keep it brief";
  if (chips.includes("Tax delinquent"))   return "Tax delinquency — financial pressure angle, be direct";
  if (chips.includes("Long hold") || chips.includes("Long ownership"))
    return "Long hold + market timing — opportunity framing";
  if (chips.includes("High equity") || chips.includes("Equity spread"))
    return "High equity — lead with market insight, no pressure";
  if (chips.includes("Absentee owner"))   return "Absentee owner — low-pressure check-in, offer value";
  return "AI-scored lead — review signals before dialing";
}

function mapScoreToLead(s: ScoreRow): QueueLead {
  const listing  = Array.isArray(s.listings) ? s.listings[0] : s.listings;
  const address  = listing?.address ?? "Unknown address";
  const city     = listing?.city ?? "";
  const fullAddr = city ? `${address}, ${city}` : address;
  const tier     = tierFrom(s.score, s.temperature ?? null);
  const chips    = chipsFrom(s.reason_codes ?? null, s.evidence_summary ?? null);
  const trusted  = listing?.contact_confidence === "high" || listing?.contact_confidence === "medium";
  const daysSince = listing?.enriched_at ? (Date.now() - new Date(listing.enriched_at).getTime()) / 86_400_000 : null;
  const draft    = s.outreach_sms ?? `Hi, this is [Your Name] from [Agency]. I noticed your property at ${address} and wanted to reach out — do you have a moment to connect?`;
  return {
    id: s.id, listingId: s.listing_id, address: fullAddr, tier,
    urgencyState: urgencyFrom(tier), score: s.score, chips,
    bestPhone:         trusted ? (listing?.best_phone ?? null) : null,
    bestPhoneType:     trusted ? (listing?.phone_type ?? null) : null,
    bestPhoneDnc:      trusted ? (listing?.is_dnc ?? false) : false,
    bestEmail:         trusted ? (listing?.best_email ?? null) : null,
    contactConfidence: trusted ? (listing!.contact_confidence as "high" | "medium") : null,
    enrichedAt:        listing?.enriched_at ?? null,
    canRefresh:        daysSince === null || daysSince >= 7,
    aiDraft: draft, aiAngle: angleFrom(chips),
    sequenceName:  tier === "HOT" ? "Hot seller — 7-step" : tier === "WARM" ? "Warm seller — 7-step" : "Cold intro — 5-step",
    sequenceTotal: tier === "COLD" ? 5 : 7, sequenceStep: 1,
    touches: 0, lastContact: "—", contactLog: [],
    evidenceSummary: s.evidence_summary ?? null,
    signals: signalsFrom(s.reason_codes ?? null, s.evidence_summary ?? null, chips),
    ownerType: "Absentee", mailingAddress: null, holdPeriod: null,
    source: listing?.source ?? "ATTOM",
    fubThread: false, fubThreadLabel: "No thread", fubLastActivity: null, fubPipelineStage: null,
    outreachMode: getOutreachMode(
      trusted ? (listing?.best_phone ?? null) : null,
      trusted ? (listing?.phone_type ?? null) : null,
      trusted ? (listing?.is_dnc ?? false) : false,
    ),
    stateCode: listing?.state ?? null,
  };
}

// ── Colour tokens ──────────────────────────────────────────────────────────
const C = {
  bg: "#0b0d11", surface: "#13151b", card: "#1a1d26", card2: "#1f2230",
  border: "rgba(255,255,255,0.07)", accent: "#3b82f6",
  hot: "#ef4444", warm: "#f59e0b", success: "#10b981",
  tp: "#f0f2f7", ts: "#8892a4", tm: "#6b7094",
} as const;

const TIER_COLOR: Record<Tier, string> = { HOT: C.hot, WARM: C.warm, COLD: C.ts };
const SIG_COLOR:  Record<"red"|"amber"|"gray", string> = { red: C.hot, amber: C.warm, gray: C.ts };
const LOG_STYLES: Record<"sms"|"email"|"call", { bg: string; color: string; label: string }> = {
  sms:   { bg: "rgba(16,185,129,0.12)", color: "#34d399", label: "S" },
  email: { bg: "rgba(59,130,246,0.12)", color: "#60a5fa", label: "E" },
  call:  { bg: "rgba(245,158,11,0.10)", color: "#fbbf24", label: "C" },
};

// ── CopyButton ─────────────────────────────────────────────────────────────
function CopyButton({ value, style }: { value: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(value).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      style={{
        fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 4,
        cursor: "pointer", fontFamily: "var(--font-ui)", flexShrink: 0,
        background: copied ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.1)",
        color:      copied ? "#34d399" : C.accent,
        border:     copied ? "1px solid rgba(16,185,129,0.22)" : "1px solid rgba(59,130,246,0.22)",
        transition: "all 0.15s", ...style,
      }}
    >{copied ? "Copied ✓" : "Copy"}</button>
  );
}

// ── RetraceButton ──────────────────────────────────────────────────────────
function RetraceButton({ listingId, onRefreshed }: { listingId: string; onRefreshed: (u: Partial<QueueLead>) => void }) {
  const [running, setRunning] = useState(false);
  return (
    <button
      onClick={async () => {
        setRunning(true);
        try {
          const res  = await fetch("/api/skip-trace/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listing_id: listingId }) });
          const json = await res.json();
          if (json.ui) onRefreshed({ bestPhone: json.ui.bestPhone, bestEmail: json.ui.bestEmail, contactConfidence: json.ui.contactConfidence, enrichedAt: json.ui.enrichedAt, canRefresh: json.ui.canRefresh });
        } catch (err) { console.error("[RetraceButton]", err); }
        finally { setRunning(false); }
      }}
      disabled={running}
      style={{ fontSize: 10, fontWeight: 600, padding: "5px 10px", borderRadius: 4, cursor: running ? "default" : "pointer", fontFamily: "var(--font-ui)", background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.22)", opacity: running ? 0.5 : 1, transition: "opacity 0.15s", width: "100%", marginTop: 6 }}
    >{running ? "Running…" : "⚡ Re-run skip trace (BatchData)"}</button>
  );
}

// ── LeadCard ───────────────────────────────────────────────────────────────
function LeadCard({ lead, position, onClick }: { lead: QueueLead; position: number; onClick?: () => void }) {
  const isHot = lead.tier === "HOT";
  const cardStyle: React.CSSProperties =
    position === 0  ? { transform: "translateX(0) scale(1)",                    opacity: 1,    zIndex: 3, pointerEvents: "all",  filter: "none" }
    : position === 1  ? { transform: "translateX(56%) scale(0.88)",               opacity: 0.4,  zIndex: 2, pointerEvents: "none", filter: "brightness(0.6)" }
    : position === 2  ? { transform: "translateX(82%) scale(0.78)",               opacity: 0.18, zIndex: 1, pointerEvents: "none", filter: "brightness(0.35)" }
    : position === -1 ? { transform: "translateX(-56%) scale(0.88)",              opacity: 0.4,  zIndex: 2, pointerEvents: "none", filter: "brightness(0.6)" }
    :                   { transform: "translateX(110%) scale(0.7)",               opacity: 0,    zIndex: 0, pointerEvents: "none" };
  return (
    <div onClick={onClick} style={{
      position: "absolute", width: "100%", borderRadius: 14, padding: "14px 16px 12px",
      cursor: position !== 0 ? "pointer" : "default",
      transition: "all 0.5s cubic-bezier(0.77,0,0.175,1)", willChange: "transform, opacity",
      background: isHot ? "linear-gradient(135deg,#1e1520 0%,#1a1d26 60%)" : "linear-gradient(135deg,#1a1c14 0%,#1a1d26 60%)",
      border: isHot ? "1px solid rgba(239,68,68,0.22)" : "1px solid rgba(245,158,11,0.18)",
      boxShadow: isHot
        ? "0 0 0 1px rgba(239,68,68,0.07),0 16px 48px rgba(0,0,0,0.55),0 0 32px rgba(239,68,68,0.05),inset 0 1px 0 rgba(255,255,255,0.04)"
        : "0 0 0 1px rgba(245,158,11,0.05),0 16px 48px rgba(0,0,0,0.55),0 0 32px rgba(245,158,11,0.04),inset 0 1px 0 rgba(255,255,255,0.04)",
      ...cardStyle,
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "14px 14px 0 0", background: isHot ? "linear-gradient(90deg,#ef4444,transparent 70%)" : "linear-gradient(90deg,#f59e0b,transparent 70%)" }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 3, letterSpacing: "0.8px", background: isHot ? "rgba(239,68,68,0.18)" : "rgba(245,158,11,0.14)", color: isHot ? "#f87171" : "#fbbf24", border: isHot ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(245,158,11,0.3)" }}>{lead.tier}</span>
            {lead.chips.map(c => <span key={c} style={{ fontSize: 9, color: C.ts, padding: "1px 5px", borderRadius: 3, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>{c}</span>)}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.5px", lineHeight: 1.15, color: C.tp, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.address}</div>
          <div style={{ fontSize: 10, color: C.tm }}>Score {lead.score} · {lead.sequenceName}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.5px", color: C.tm, textTransform: "uppercase", marginBottom: 5 }}>Owner phone</div>
          {lead.bestPhone ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 300, letterSpacing: "0.05em", color: C.tp, fontVariantNumeric: "tabular-nums", marginBottom: 6, lineHeight: 1 }}>{lead.bestPhone}</div>
              <CopyButton value={lead.bestPhone} />
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "#fbbf24", fontWeight: 500, fontStyle: "italic", marginBottom: 6 }}>No number on record</div>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.22)" }}>BatchData · No match</span>
            </>
          )}
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 9, display: "flex", gap: 6 }}>
        {lead.contactLog.length === 0 ? (
          <div style={{ fontSize: 10, color: C.tm, fontStyle: "italic" }}>No prior contact</div>
        ) : lead.contactLog.slice(0, 3).map((t, i) => {
          const ico = LOG_STYLES[t.channel];
          return (
            <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 5, padding: "4px 6px", borderRadius: 5, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, background: ico.bg, color: ico.color }}>{ico.label}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 500, color: C.ts, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                <div style={{ fontSize: 9, color: C.tm }}>{t.date}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── RailSection ────────────────────────────────────────────────────────────
function RailSection({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.6px", color: C.tm, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>{label}</div>
      {children}
    </div>
  );
}

// ── Queue Dropdown ─────────────────────────────────────────────────────────
function QueueDropdown({ leads, curIdx, onSelect }: { leads: QueueLead[]; curIdx: number; onSelect: (i: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hotCount  = leads.filter(l => l.tier === "HOT").length;
  const warmCount = leads.filter(l => l.tier === "WARM").length;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "5px 11px", borderRadius: 6,
          background: open ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${open ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)"}`,
          color: C.tp, fontSize: 12, fontWeight: 500,
          cursor: "pointer", fontFamily: "var(--font-ui)",
          transition: "all .15s",
        }}
        onMouseEnter={e => { if (!open) (e.currentTarget.style.background = "rgba(255,255,255,0.07)"); }}
        onMouseLeave={e => { if (!open) (e.currentTarget.style.background = "rgba(255,255,255,0.04)"); }}
      >
        {/* Mini tier pips */}
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          {hotCount > 0  && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 2, background: "rgba(239,68,68,0.15)", color: "#f87171" }}>{hotCount} HOT</span>}
          {warmCount > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 2, background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}>{warmCount} WARM</span>}
        </div>
        Queue · {leads.length} leads
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transition: "transform .15s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          width: 280, maxHeight: 420, overflowY: "auto",
          background: C.surface,
          border: `1px solid rgba(255,255,255,0.1)`,
          borderRadius: 10,
          boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
          zIndex: 50,
        }}>
          {/* Session progress header */}
          <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.tm, marginBottom: 5 }}>
              <span style={{ fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>Today&apos;s session</span>
              <span>{curIdx} of {leads.length} worked</span>
            </div>
            <div style={{ height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1, overflow: "hidden" }}>
              <div style={{ height: 2, background: C.accent, borderRadius: 1, width: `${leads.length > 0 ? (curIdx / leads.length) * 100 : 0}%`, transition: "width .3s" }} />
            </div>
          </div>
          {/* Lead rows */}
          {leads.map((l, i) => {
            const active = i === curIdx;
            const tc = TIER_COLOR[l.tier];
            return (
              <div
                key={l.id}
                onClick={() => { onSelect(i); setOpen(false); }}
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  borderLeft: `2px solid ${active ? tc : "transparent"}`,
                  cursor: "pointer",
                  background: active ? `${tc}12` : "transparent",
                  transition: "background .1s",
                  display: "flex", alignItems: "center", gap: 8,
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
              >
                <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 2, flexShrink: 0, background: l.tier === "HOT" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.12)", color: l.tier === "HOT" ? "#f87171" : "#fbbf24" }}>{l.tier}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: C.tp, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.address.split(",")[0]}</div>
                  <div style={{ fontSize: 10, color: C.tm }}>Score {l.score} · {l.touches} touch{l.touches !== 1 ? "es" : ""}</div>
                </div>
                {!l.bestPhone && <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 2, background: "rgba(245,158,11,0.1)", color: "#fbbf24", flexShrink: 0 }}>NO#</span>}
                {active && <span style={{ fontSize: 9, color: C.accent, flexShrink: 0 }}>← now</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function OutreachScreen() {
  const [leads,        setLeads]        = useState<QueueLead[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [curIdx,       setCurIdx]       = useState(0);
  const [draft,        setDraft]        = useState("");
  const [aiOn,         setAiOn]         = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: scores, error } = await supabase
        .from("listing_scores")
        .select(`id, listing_id, score, confidence_score, temperature, evidence_summary, recommended_action, reason_codes, outreach_sms, outreach_email, listings ( address, city, state, zip, list_price, source, best_phone, best_email, contact_confidence, enriched_at )`)
        .order("score", { ascending: false })
        .limit(20);
      if (error) { console.error("[OutreachScreen] fetch:", error); setLoading(false); return; }
      const mapped = prioritizeLeads((scores ?? []).map(s => mapScoreToLead(s as ScoreRow)));
      setLeads(mapped);
      if (mapped.length > 0) setDraft(mapped[0].aiDraft);
      setLoading(false);
    }
    load();
  }, []);

  const lead = leads[curIdx] ?? null;

  useEffect(() => {
    if (!lead) return;
    setDraft(aiOn ? lead.aiDraft : "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curIdx]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") advance();
      if (e.key === "ArrowLeft")  goTo((curIdx - 1 + leads.length) % leads.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curIdx, leads.length]);

  const goTo = useCallback((i: number) => {
    const target = leads[i];
    if (!target) return;
    setCurIdx(i);
    setDraft(aiOn ? target.aiDraft : "");
    setRegenerating(false);
  }, [leads, aiOn]);

  const advance = useCallback(() => {
    goTo((curIdx + 1) % leads.length);
  }, [curIdx, leads.length, goTo]);

  async function postOutreach(channel: "sms" | "email" | "call" | "skip") {
    if (!lead) return;
    try {
      const res  = await fetch("/api/outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listing_id: lead.listingId, score_id: lead.id, channel, body: draft, step: lead.sequenceStep }) });
      const json = await res.json();
      if (json.ok) setLeads(prev => prev.map(l => l.id !== lead.id ? l : { ...l, touches: json.touches ?? l.touches, lastContact: json.lastContact ?? l.lastContact, sequenceStep: json.nextStep ?? l.sequenceStep, contactLog: json.newLogEntry ? [json.newLogEntry, ...l.contactLog] : l.contactLog }));
    } catch (err) { console.error("[OutreachScreen] postOutreach:", err); }
  }

  async function handleSendSms()      { await postOutreach("sms");  advance(); }
  async function handleCalled()       { await postOutreach("call"); advance(); }
  async function handleNoAnswer()     { await postOutreach("call"); advance(); }
  async function handleNotInterested(){ await postOutreach("skip"); advance(); }
  async function handleSkip()         { await postOutreach("skip"); advance(); }

  function handleSnooze() {
    setLeads(prev => { const next = prev.filter((_, i) => i !== curIdx); setCurIdx(Math.min(curIdx, next.length - 1)); return next; });
  }
  function handleDirectMail() { postOutreach("skip"); advance(); }
  function handleRegenerate() {
    if (!lead) return;
    setRegenerating(true); setDraft("");
    setTimeout(() => { setRegenerating(false); setDraft(lead.aiDraft); }, 700);
  }
  function handleToggleAI() { const next = !aiOn; setAiOn(next); setDraft(next ? (lead?.aiDraft ?? "") : ""); }
  function handleLeadRefreshed(updated: Partial<QueueLead>) { setLeads(prev => prev.map(l => l.id === lead?.id ? { ...l, ...updated } : l)); }

  if (loading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.tm, fontSize: 13 }}>Loading outreach queue…</div>;
  if (!lead)   return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.tm, fontSize: 13 }}>Queue is clear. Ingest runs daily at 6:00 AM.</div>;

  const hasNumber  = !!lead.bestPhone;
  const isHot      = lead.tier === "HOT";
  const isDnc      = lead.outreachMode === "dnc_blocked";
  const isLandline = lead.outreachMode === "call_only";
  const isHighRisk = lead.stateCode ? HIGH_RISK_STATES.includes(lead.stateCode) : false;
  const tzWindow   = isWithinContactWindow(lead.bestPhone);
  const smsBlocked = isDnc || isLandline || !tzWindow.allowed;

  const bdLabel  = lead.contactConfidence === "high" ? "BatchData · Verified" : lead.contactConfidence === "medium" ? "BatchData · Likely match" : "BatchData · No match";
  const bdBg     = lead.contactConfidence === "high" ? "rgba(16,185,129,0.12)" : lead.contactConfidence === "medium" ? "rgba(245,158,11,0.10)" : "rgba(239,68,68,0.08)";
  const bdColor  = lead.contactConfidence === "high" ? "#10b981" : lead.contactConfidence === "medium" ? "#fbbf24" : "#f87171";
  const bdBorder = lead.contactConfidence === "high" ? "1px solid rgba(16,185,129,0.22)" : lead.contactConfidence === "medium" ? "1px solid rgba(245,158,11,0.20)" : "1px solid rgba(239,68,68,0.18)";

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", background: C.bg, fontFamily: "var(--font-ui)" }}>

      {/* ══ CENTER ══ */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: C.bg }}>

        {/* Topbar */}
        <div style={{ height: 42, flexShrink: 0, background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.2px" }}>Outreach</span>
          <div style={{ width: 1, height: 14, background: C.border }} />
          <span style={{ fontSize: 11, color: C.tm }}>Lead {curIdx + 1} of {leads.length}</span>

          {/* ── Queue dropdown lives here ── */}
          <QueueDropdown leads={leads} curIdx={curIdx} onSelect={goTo} />

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", animation: "blink 2s infinite" }} />
            Session active
          </div>
        </div>

        {/* ── CAROUSEL STAGE ── */}
        <div style={{
          height: "30vh", minHeight: 185, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", padding: "14px 0 18px",
          overflow: "hidden", // ← fixes card bleed into right rail
          background: isHot
            ? "radial-gradient(ellipse at 50% 120%,rgba(239,68,68,0.22) 0%,rgba(239,68,68,0.06) 40%,transparent 70%)"
            : "radial-gradient(ellipse at 50% 120%,rgba(245,158,11,0.18) 0%,rgba(245,158,11,0.05) 40%,transparent 70%)",
          transition: "background 0.8s cubic-bezier(0.4,0,0.2,1)",
          animation: "glowPulse 3s ease-in-out infinite",
        }}>
          {/* Card stack */}
          <div style={{ position: "relative", width: "66%", maxWidth: 560, height: "100%", top: "14%" }}>
            {leads.map((l, i) => {
              const offset = i - curIdx;
              const pos = offset === 0 ? 0 : offset === 1 ? 1 : offset === 2 ? 2 : offset === -1 ? -1 : 99;
              return <LeadCard key={l.id} lead={l} position={pos} onClick={pos !== 0 ? () => goTo(i) : undefined} />;
            })}
          </div>
          {/* Nav arrows */}
          <button
            onClick={() => goTo((curIdx - 1 + leads.length) % leads.length)}
            style={{
              position: "absolute", left: "calc(17% - 36px)", top: "50%", transform: "translateY(-50%)",
              width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)", color: C.ts, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontFamily: "var(--font-ui)", transition: "all .15s", zIndex: 10,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = C.tp; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = C.ts; }}
          >‹</button>
          <button
            onClick={advance}
            style={{
              position: "absolute", right: "calc(17% - 36px)", top: "50%", transform: "translateY(-50%)",
              width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)", color: C.ts, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontFamily: "var(--font-ui)", transition: "all .15s", zIndex: 10,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = C.tp; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = C.ts; }}
          >›</button>
          
        </div>

        {/* ── WORK AREA ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 20px 16px", borderTop: `1px solid ${C.border}`, gap: 10, overflow: "hidden", minHeight: 0 }}>

          {/* Draft header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.tm, letterSpacing: "0.5px", textTransform: "uppercase" }}>SMS Draft</span>
              {aiOn && <span style={{ fontSize: 10, color: "#4a7aaa", fontStyle: "italic" }}>— {lead.aiAngle}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {aiOn && (
                <button onClick={handleRegenerate} style={{ fontSize: 10, color: C.tm, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", fontFamily: "var(--font-ui)", transition: "color .1s" }} onMouseEnter={e => (e.currentTarget.style.color = C.ts)} onMouseLeave={e => (e.currentTarget.style.color = C.tm)}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M8.5 5A3.5 3.5 0 1 1 5 1.5M8.5 1.5v3h-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Regen
                </button>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: C.tm }}>{aiOn ? "AI on" : "AI off"}</span>
                <div onClick={handleToggleAI} style={{ width: 28, height: 16, borderRadius: 8, cursor: "pointer", background: aiOn ? C.accent : "rgba(255,255,255,0.1)", border: aiOn ? `1px solid ${C.accent}` : "1px solid rgba(255,255,255,0.12)", position: "relative", transition: "background .2s" }}>
                  <div style={{ position: "absolute", top: 2, left: 2, width: 10, height: 10, borderRadius: "50%", background: aiOn ? "#fff" : "rgba(255,255,255,0.5)", transform: aiOn ? "translateX(12px)" : "translateX(0)", transition: "transform .2s, background .2s" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Legal warning banner */}
          {(isDnc || isLandline || !tzWindow.allowed || isHighRisk) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
              {isDnc && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 11, color: "#f87171" }}>
                  <span style={{ fontWeight: 700 }}>⛔ DNC — Do Not Contact.</span> This number is on the Do Not Call registry. SMS and calls are blocked.
                </div>
              )}
              {!isDnc && isLandline && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 6, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)", fontSize: 11, color: "#fbbf24" }}>
                  <span style={{ fontWeight: 700 }}>📞 Landline only.</span> TCPA prohibits texting landlines. Call only.
                </div>
              )}
              {!tzWindow.allowed && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 6, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)", fontSize: 11, color: "#fbbf24" }}>
                  <span style={{ fontWeight: 700 }}>⏰ Outside contact window.</span> {tzWindow.reason} — TCPA restricts outreach to 8am–9pm recipient local time.
                </div>
              )}
              {isHighRisk && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 6, background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.18)", fontSize: 11, color: "#a78bfa" }}>
                  <span style={{ fontWeight: 700 }}>⚠️ High-risk state ({lead.stateCode}).</span> FL, TX, OK, IN, WY have stricter cold-call laws. Verify compliance before outreach.
                </div>
              )}
            </div>
          )}
          {/* Textarea */}
          <textarea ref={draftRef} value={regenerating ? "" : draft} onChange={e => setDraft(e.target.value)}
            placeholder={regenerating ? "Regenerating…" : !hasNumber ? "No number — use action buttons below" : !aiOn ? "Write your own message…" : "Edit before sending…"}
            disabled={!hasNumber}
            style={{ flex: 1, width: "100%", minHeight: 0, background: C.card, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#e0e4f0", fontFamily: "var(--font-ui)", resize: "none", lineHeight: 1.7, outline: "none", opacity: hasNumber ? 1 : 0.4, transition: "border-color .15s, opacity .2s" }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.3)"; }}
            onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
          />

          {/* Actions */}
          {hasNumber ? (
            <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
              <button
                onClick={smsBlocked ? undefined : handleSendSms}
                disabled={smsBlocked}
                style={{ flex: 1.4, padding: "10px 14px", borderRadius: 9, fontSize: 12, fontWeight: 600, letterSpacing: "-0.1px", cursor: smsBlocked ? "not-allowed" : "pointer", background: smsBlocked ? "rgba(255,255,255,0.05)" : C.accent, color: smsBlocked ? C.tm : "#fff", border: smsBlocked ? `1px solid ${C.border}` : "none", fontFamily: "var(--font-ui)", boxShadow: smsBlocked ? "none" : "0 2px 14px rgba(59,130,246,0.22)", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, transition: "background .15s", opacity: smsBlocked ? 0.5 : 1 }}
                onMouseEnter={e => { if (!smsBlocked) e.currentTarget.style.background = "#2563eb"; }}
                onMouseLeave={e => { if (!smsBlocked) e.currentTarget.style.background = C.accent; }}
              >
                {isDnc ? "⛔ SMS blocked — DNC" : isLandline ? "📞 Call only — landline" : !tzWindow.allowed ? "⏰ Outside contact window" : "↑ Send SMS via FUB"}
                <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>{smsBlocked ? "Cannot send SMS" : "Logs touch · advances sequence"}</span>
              </button>
              <button onClick={isDnc ? undefined : handleCalled} disabled={isDnc} style={{ ...secondaryBtn("rgba(16,185,129,0.1)", "#34d399", "rgba(16,185,129,0.22)"), opacity: isDnc ? 0.35 : 1, cursor: isDnc ? "not-allowed" : "pointer" }}>✓ Called<span style={subLabel}>{isDnc ? "Blocked" : "Connected"}</span></button>
              <button onClick={isDnc ? undefined : handleNoAnswer} disabled={isDnc} style={{ ...secondaryBtn("rgba(245,158,11,0.07)", "#fbbf24", "rgba(245,158,11,0.18)"), opacity: isDnc ? 0.35 : 1, cursor: isDnc ? "not-allowed" : "pointer" }}>○ No answer<span style={subLabel}>{isDnc ? "Blocked" : "Log attempt"}</span></button>
              <button onClick={handleNotInterested} style={secondaryBtn("rgba(239,68,68,0.07)", "#f87171", "rgba(239,68,68,0.16)")}>✕ Not interested<span style={subLabel}>Remove</span></button>
              <button onClick={handleSkip} style={{ ...secondaryBtn("transparent", C.tm, "rgba(255,255,255,0.07)"), flex: 0.7 }}>Skip<span style={subLabel}>Tomorrow</span></button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
              <button onClick={() => handleLeadRefreshed({})} style={secondaryBtn("rgba(245,158,11,0.1)",  "#fbbf24", "rgba(245,158,11,0.22)", 1.4)}>⚡ Re-run skip trace<span style={subLabel}>Via BatchData</span></button>
              <button onClick={handleDirectMail}              style={secondaryBtn("rgba(16,185,129,0.08)", "#34d399", "rgba(16,185,129,0.18)")}>✉ Direct mail       <span style={subLabel}>Property address</span></button>
              <button onClick={handleSnooze}                  style={secondaryBtn("rgba(59,130,246,0.07)", "#60a5fa", "rgba(59,130,246,0.18)")}>🕐 Snooze            <span style={subLabel}>Re-trace in 30d</span></button>
              <button onClick={handleSkip} style={{ ...secondaryBtn("transparent", C.tm, "rgba(255,255,255,0.07)"), flex: 0.7 }}>Skip<span style={subLabel}>Remove</span></button>
            </div>
          )}
        </div>
      </div>

      {/* ══ RIGHT RAIL ══ */}
      <div style={{ width: 248, minWidth: 248, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflowY: "auto" }}>

        <RailSection label="FUB Status">
          {lead.fubThread ? (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 6, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.14)" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, marginTop: 4, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#60a5fa", marginBottom: 2 }}>{lead.fubThreadLabel} — <span style={{ textDecoration: "underline", cursor: "pointer" }}>Open in Inbox →</span></div>
                <div style={{ fontSize: 10, color: C.tm }}>{lead.fubLastActivity ?? "No recent activity"}</div>
                {lead.fubPipelineStage && <div style={{ fontSize: 10, color: C.tm, marginTop: 2 }}>Pipeline: {lead.fubPipelineStage}</div>}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: C.tm, fontStyle: "italic" }}>No thread — cold lead, never contacted via FUB</div>
          )}
        </RailSection>

        <RailSection label={<>Contact<span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: bdBg, color: bdColor, border: bdBorder, display: "inline-flex", alignItems: "center", gap: 3, textTransform: "none" }}><span style={{ width: 4, height: 4, borderRadius: "50%", background: bdColor, display: "inline-block", flexShrink: 0 }} />{bdLabel}</span></>}>
          {lead.bestPhone ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#eceef5", letterSpacing: "0.02em" }}>{lead.bestPhone}</span>
                <CopyButton value={lead.bestPhone} />
              </div>
              {lead.bestPhoneType && <div style={{ fontSize: 10, color: C.tm, marginBottom: lead.bestEmail ? 5 : 0 }}>{lead.bestPhoneType}{lead.bestPhoneDnc && <span style={{ marginLeft: 6, color: "#f87171", fontWeight: 700 }}>· DNC</span>}</div>}
              {lead.bestEmail && <div style={{ fontSize: 11, color: C.ts, marginTop: 4 }}>{lead.bestEmail}</div>}
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: "#fbbf24", fontStyle: "italic", marginBottom: 4 }}>No phone found</div>
              {lead.bestEmail && <div style={{ fontSize: 11, color: C.ts, marginBottom: 4 }}>{lead.bestEmail}</div>}
              {lead.canRefresh && <RetraceButton listingId={lead.listingId} onRefreshed={handleLeadRefreshed} />}
            </>
          )}
        </RailSection>

        <RailSection label="Signals — why this lead">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {lead.signals.length > 0 ? lead.signals.map((s, i) => (
              <div key={i} style={{ fontSize: 11, padding: "5px 8px", borderRadius: 5, lineHeight: 1.35, background: "rgba(255,255,255,0.02)", borderLeft: `2px solid ${SIG_COLOR[s.color]}40`, color: SIG_COLOR[s.color] }}>{s.text}</div>
            )) : (
              <div style={{ fontSize: 11, color: C.tm, fontStyle: "italic" }}>{lead.evidenceSummary ?? "Surfaced by daily AI scoring run."}</div>
            )}
          </div>
        </RailSection>

        <RailSection label="Score">
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-1.5px", lineHeight: 1, marginBottom: 3, color: lead.tier === "HOT" ? "#f87171" : "#fbbf24" }}>{lead.score}</div>
          <div style={{ fontSize: 10, color: C.tm }}>{lead.tier} · {lead.chips.join(" · ")}</div>
        </RailSection>

        <RailSection label="Sequence">
          <div style={{ display: "flex", gap: 3, marginBottom: 5 }}>
            {Array.from({ length: lead.sequenceTotal }, (_, i) => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < lead.sequenceStep - 1 ? "rgba(16,185,129,0.5)" : i === lead.sequenceStep - 1 ? C.accent : "rgba(255,255,255,0.07)", transition: "background .3s" }} />
            ))}
          </div>
          <div style={{ fontSize: 10, color: C.tm }}>Step {lead.sequenceStep} of {lead.sequenceTotal} — {lead.sequenceName}</div>
        </RailSection>

        <RailSection label="Last touches">
          {lead.contactLog.length === 0 ? (
            <div style={{ fontSize: 11, color: C.tm, fontStyle: "italic" }}>No prior contact</div>
          ) : lead.contactLog.slice(0, 3).map((t, i) => {
            const ico = LOG_STYLES[t.channel];
            return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "5px 0", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, marginTop: 1, background: ico.bg, color: ico.color }}>{ico.label}</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: C.ts }}>{t.title}</div>
                  <div style={{ fontSize: 10, color: C.tm, marginTop: 1 }}>{t.date}</div>
                </div>
              </div>
            );
          })}
        </RailSection>

        <RailSection label="Owner info">
          {[["Type", lead.ownerType], ["Mailing addr", lead.mailingAddress ?? "Unknown"], ["Hold period", lead.holdPeriod ?? "Unknown"], ["Source", lead.source]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
              <span style={{ fontSize: 10, color: C.tm, flexShrink: 0 }}>{k}</span>
              <span style={{ fontSize: 10, color: C.ts, textAlign: "right" }}>{v}</span>
            </div>
          ))}
        </RailSection>

      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes glowPulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
      `}</style>
    </div>
  );
}

function secondaryBtn(bg: string, color: string, border: string, flex: number = 1): React.CSSProperties {
  return { flex, padding: "10px 10px", borderRadius: 9, fontSize: 12, fontWeight: 600, letterSpacing: "-0.1px", cursor: "pointer", background: bg, color, border: `1px solid ${border}`, fontFamily: "var(--font-ui)", transition: "all .15s", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 };
}
const subLabel: React.CSSProperties = { fontSize: 9, fontWeight: 400, opacity: 0.65 };