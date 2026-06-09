// components/screens/ScoredLeadsScreen.tsx
// Scored Leads — full county scored dataset, searchable + filterable
// Filters: tier (HOT / WARM / NURTURE) + scored date (today / this week / last week / all time) + address search
// Click row → PulseDrawer (same as Dashboard)
// Data: listing_scores joined with listings, no limit cap

"use client";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import type { Tab } from "@/components/Sidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoredLead {
  id: string;
  listingId: string;
  address: string;
  city: string;
  zip: string;
  tier: "hot" | "warm" | "nurture";
  score: number;
  chips: string[];
  evidenceSummary: string;
  recommendedAction: string | null;
  confidenceScore: number;
  avmValue: number | null;
  lastSoldPrice: number | null;
  lastSoldDate: string | null;
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  bestPhone: string | null;
  bestEmail: string | null;
  contactConfidence: "high" | "medium" | null;
  enrichedAt: string | null;
  canRefresh: boolean;
  scoredAt: string;
  bestPhoneType: "mobile" | "landline" | "voip" | "unknown" | null;
  bestPhoneDnc: boolean;
  confidenceReason: string | null;
}

type TierFilter = "all" | "hot" | "warm" | "nurture";
type DateFilter = "all" | "today" | "week" | "last";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REASON_LABELS: Record<string, string | null> = {
  tax_delinquent:           "Tax delinquent",
  absentee_owner:           "Absentee owner",
  high_equity:              "High equity",
  significant_equity:       "High equity",
  equity_position:          "Equity position",
  equity_spread_detected:   "Equity spread",
  equity_spread_favorable:  "Equity spread",
  equity_spread_high:       "High equity spread",
  positive_equity_spread:   "Equity spread",
  potential_equity_position:"Equity position",
  minimal_equity_spread:    "Low equity spread",
  appreciation_since_purchase: "Appreciated",
  avm_appreciation:         "AVM appreciation",
  long_ownership:           "Long ownership",
  long_hold_period:         "Long hold",
  held_long_term:           "Long hold",
  recent_acquisition:       "Recent acquisition",
  off_market_candidate:     "Off-market candidate",
  off_market_potential:     "Off-market potential",
  off_market_property:      "Off-market",
  off_market_status:        "Off-market",
  owner_occupied:           "Owner-occupied",
  no_active_listing:        "No active listing",
  not_currently_listed:     "Not listed",
  no_listing_active:        "Not listed",
  price_reduction:          "Price reduction",
  equity_gain:              "Equity gain",
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
  no_market_timing_data: null, no_motivation_indicators: null, no_motivation_signals: null,
  no_owner_data: null, no_owner_type: null, no_owner_type_data: null,
  no_price_cuts: null, no_price_signals: null, no_pricing_signals: null,
  no_tax_delinquency: null, not_tax_delinquent: null, owner_type_unknown: null,
  price_missing: null, price_unavailable: null, stale_listing_data: null,
  stale_market_data: null, stale_sales_data: null, stale_transaction_data: null,
  aged_transaction_data: null, unknown_owner_type: null,
};

function tierFrom(score: number, temperature: string): "hot" | "warm" | "nurture" {
  if (temperature?.toUpperCase() === "HOT") return "hot";
  if (score >= 40) return "warm";
  return "nurture";
}

function chipsFrom(reasonCodes: string[] | null, evidenceSummary: string | null): string[] {
  if (reasonCodes && reasonCodes.length > 0) {
    return reasonCodes
      .map((c) => REASON_LABELS[c])
      .filter((l): l is string => !!l)
      .slice(0, 3);
  }
  const text = (evidenceSummary ?? "").toLowerCase();
  const chips: string[] = [];
  if (text.includes("tax delinqu"))                         chips.push("Tax delinquent");
  if (text.includes("absentee"))                            chips.push("Absentee owner");
  if (text.includes("equity") && chips.length < 3)         chips.push("High equity");
  if (text.includes("long ownership") && chips.length < 3) chips.push("Long ownership");
  return chips.slice(0, 3);
}

function fmt$(n: number | null): string {
  if (!n) return "—";
  return "$" + (n >= 1_000_000
    ? (n / 1_000_000).toFixed(1) + "M"
    : (n / 1_000).toFixed(0) + "k");
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function yearsHeld(d: string | null): string {
  if (!d) return "—";
  const y = Math.floor((Date.now() - new Date(d).getTime()) / (365.25 * 86_400_000));
  return y < 1 ? "< 1 yr" : `${y} yr${y !== 1 ? "s" : ""}`;
}

function equitySpread(avm: number | null, lastSold: number | null): string {
  if (!avm || !lastSold) return "—";
  const s = avm - lastSold;
  return (s >= 0 ? "+" : "") + fmt$(s);
}

function equityColor(avm: number | null, lastSold: number | null): string {
  if (!avm || !lastSold) return "#6b7094";
  return avm - lastSold >= 0 ? "#10b981" : "#f87171";
}

function scoredAtLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayStr = now.toDateString();
  if (d.toDateString() === todayStr) return "Scored today";
  return "Scored " + d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dateCategory(iso: string): "today" | "week" | "last" | "older" {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
  const startOfWeek  = new Date(startOfToday); startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfLast  = new Date(startOfWeek);  startOfLast.setDate(startOfWeek.getDate() - 7);
  if (d >= startOfToday.getTime()) return "today";
  if (d >= startOfWeek.getTime())  return "week";
  if (d >= startOfLast.getTime())  return "last";
  return "older";
}

// ─── ReasonChip ───────────────────────────────────────────────────────────────

function ReasonChip({ label, hot }: { label: string; hot?: boolean }) {
  return (
    <span style={{
      fontSize: "9.5px", fontWeight: 700, padding: "2px 7px", borderRadius: 4,
      whiteSpace: "nowrap",
      background: hot ? "rgba(220,38,38,0.12)" : "#161a24",
      color:      hot ? "#f87171"              : "var(--text-muted)",
      border:     hot ? "1px solid rgba(220,38,38,0.18)" : "1px solid var(--border)",
      display: "inline-block",
    }}>
      {label}
    </span>
  );
}

function DateChip({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: 4,
      background: "rgba(59,130,246,0.08)", color: "#60a5fa",
      border: "1px solid rgba(59,130,246,0.16)", whiteSpace: "nowrap",
      display: "inline-block",
    }}>
      {label}
    </span>
  );
}

// ─── TierDivider ──────────────────────────────────────────────────────────────

function TierDivider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 20px", background: "var(--bg-base)" }}>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2e3350" }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

// ─── LeadRow ──────────────────────────────────────────────────────────────────

function LeadRow({
  lead, isSelected, onSelect,
}: {
  lead: ScoredLead;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const borderColor = { hot: "var(--hot)", warm: "var(--warm)", nurture: "#1e2232" }[lead.tier];
  const hoverBg     = { hot: "rgba(220,38,38,0.06)", warm: "rgba(245,158,11,0.05)", nurture: "rgba(255,255,255,0.02)" }[lead.tier];
  const scoreStyle  = {
    hot:     { background: "rgba(220,38,38,0.14)",  color: "#f87171" },
    warm:    { background: "rgba(245,158,11,0.10)", color: "#fbbf24" },
    nurture: { background: "rgba(255,255,255,0.05)", color: "#6b7094" },
  }[lead.tier];
  const tierBadge = {
    hot:     { background: "rgba(220,38,38,0.14)",  color: "#f87171" },
    warm:    { background: "rgba(245,158,11,0.12)", color: "#fbbf24" },
    nurture: { background: "rgba(255,255,255,0.05)", color: "#6b7094" },
  }[lead.tier];

  const spread      = equitySpread(lead.avmValue, lead.lastSoldPrice);
  const spreadColor = equityColor(lead.avmValue, lead.lastSoldPrice);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 110px 82px 70px",
        alignItems: "center",
        padding: "12px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        borderLeft: `3px solid ${isSelected ? "var(--accent)" : hovered ? borderColor : borderColor}`,
        background: isSelected
          ? "rgba(59,130,246,0.07)"
          : hovered ? hoverBg : "transparent",
        cursor: "pointer",
        transition: "background 0.1s",
      }}
    >
      {/* Address + chips */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: "13px", fontWeight: 700,
          color: lead.tier === "nurture" ? "#c8ccd8" : "#eceef5",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          marginBottom: 4,
        }}>
          {lead.address}{lead.city ? `, ${lead.city}` : ""}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {lead.chips.map((chip, i) => (
            <ReasonChip key={chip} label={chip} hot={lead.tier === "hot" && i < 2} />
          ))}
          <DateChip label={scoredAtLabel(lead.scoredAt)} />
        </div>
      </div>

      {/* Equity spread */}
      <div style={{ fontSize: "12px", fontWeight: 700, color: spreadColor }}>
        {spread}
      </div>

      {/* Tier badge */}
      <div style={{ textAlign: "right" }}>
        <span style={{
          fontSize: "9px", fontWeight: 800, padding: "2px 8px", borderRadius: 4,
          textTransform: "uppercase", letterSpacing: "0.05em", display: "inline-block",
          ...tierBadge,
        }}>
          {lead.tier.toUpperCase()}
        </span>
      </div>

      {/* Score */}
      <div style={{ textAlign: "right" }}>
        <span style={{
          fontSize: "14px", fontWeight: 800, padding: "3px 8px", borderRadius: 6,
          display: "inline-block", ...scoreStyle,
        }}>
          {lead.score}
        </span>
      </div>
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function ScoredLeadsDrawer({
  lead, onClose, onNavigate,
}: {
  lead: ScoredLead;
  onClose: () => void;
  onNavigate: (tab: Tab) => void;
}) {
  const [copied, setCopied]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const tierBadge = {
    hot:     { background: "rgba(220,38,38,0.18)",  color: "#f87171" },
    warm:    { background: "rgba(245,158,11,0.14)",  color: "#fbbf24" },
    nurture: { background: "rgba(255,255,255,0.06)", color: "#6b7094" },
  }[lead.tier];

  const spread    = lead.avmValue && lead.lastSoldPrice ? lead.avmValue - lead.lastSoldPrice : null;
  const spreadPos = spread !== null && spread >= 0;

  async function handleCopy() {
    if (!lead.bestPhone) return;
    await navigator.clipboard.writeText(lead.bestPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch("/api/skip-trace/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: lead.listingId }),
      });
    } catch (err) {
      console.error("[ScoredLeadsDrawer] refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div style={{
      flex: "0 0 48%", borderLeft: "1px solid var(--border)",
      background: "#0f1118", display: "flex", flexDirection: "column",
      overflow: "hidden",
      animation: "drawerSlideIn 0.3s cubic-bezier(0.4,0,0.2,1)",
    }}>
      <style>{`
        @keyframes drawerSlideIn {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{ background: "#0b0d11", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "12px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "#eceef5", marginBottom: 5 }}>
            {lead.address}{lead.city ? `, ${lead.city}` : ""}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "9px", fontWeight: 800, padding: "2px 7px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.05em", ...tierBadge }}>
              {lead.tier.toUpperCase()}
            </span>
            <span style={{ fontSize: "10px", color: "#3a3f55" }}>{scoredAtLabel(lead.scoredAt)}</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#3a3f55", cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: 0, fontFamily: "inherit" }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* Why it surfaced */}
        {lead.chips.length > 0 && (
          <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a3f55", marginBottom: 7 }}>Why it surfaced</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {lead.chips.map((chip, i) => (
                <ReasonChip key={chip} label={chip} hot={lead.tier === "hot" && i < 2} />
              ))}
            </div>
          </div>
        )}

        {/* AI Summary */}
        <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a3f55", marginBottom: 6 }}>AI Summary</div>
          <div style={{ fontSize: "11.5px", color: "#9da2ba", lineHeight: 1.6, background: "#13151b", borderLeft: "3px solid rgba(59,130,246,0.4)", padding: "10px 12px" }}>
            {lead.evidenceSummary || "AI scoring complete. No summary available."}
          </div>
        </div>

        {/* Property signals */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a3f55", marginBottom: 8 }}>Property signals</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {spread !== null && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#9da2ba" }}>Equity spread</span>
                <span style={{ fontSize: "13px", fontWeight: 800, color: spreadPos ? "#10b981" : "#f87171" }}>
                  {equitySpread(lead.avmValue, lead.lastSoldPrice)}
                </span>
              </div>
            )}
            {lead.avmValue && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#9da2ba" }}>Est. value (AVM)</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#eceef5" }}>{fmt$(lead.avmValue)}</span>
              </div>
            )}
            {lead.lastSoldPrice && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#9da2ba" }}>Last sold</span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#9da2ba" }}>
                  {fmt$(lead.lastSoldPrice)} · {fmtDate(lead.lastSoldDate)}
                </span>
              </div>
            )}
            {lead.lastSoldDate && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#9da2ba" }}>Held</span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#9da2ba" }}>{yearsHeld(lead.lastSoldDate)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Contact — only when confident */}
        {(lead.contactConfidence === "high" || lead.contactConfidence === "medium") && (
          <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a3f55" }}>Contact</div>
              <span style={{
                fontSize: "9px", fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                ...(lead.contactConfidence === "high"
                  ? { background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.22)" }
                  : { background: "rgba(245,158,11,0.10)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.20)" }),
              }}>
                {lead.contactConfidence === "high" ? "Verified" : "Likely match"}
              </span>
            </div>
            {lead.bestPhone && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: lead.bestEmail ? 8 : 0 }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#eceef5" }}>{lead.bestPhone}</span>
                <button
                  onClick={handleCopy}
                  style={{
                    fontSize: "10px", fontWeight: 700, padding: "4px 10px", borderRadius: 4,
                    cursor: "pointer", fontFamily: "inherit",
                    background: copied ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.10)",
                    color:      copied ? "#10b981" : "var(--accent)",
                    border:     copied ? "1px solid rgba(16,185,129,0.22)" : "1px solid rgba(59,130,246,0.22)",
                  }}
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
            )}
            {lead.bestEmail && (
              <div style={{ fontSize: "11px", color: "#9da2ba" }}>{lead.bestEmail}</div>
            )}
            {lead.canRefresh && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                style={{
                  marginTop: 8, fontSize: "10px", fontWeight: 600, padding: "4px 10px",
                  borderRadius: 4, cursor: refreshing ? "default" : "pointer",
                  fontFamily: "inherit", background: "transparent", color: "#3a3f55",
                  border: "1px solid #1a1d26", opacity: refreshing ? 0.5 : 1,
                }}
              >
                {refreshing ? "Refreshing…" : "Re-run skip trace"}
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            onClick={() => onNavigate("outreach")}
            style={{ fontSize: "12px", fontWeight: 700, padding: "10px 13px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", background: "var(--accent)", color: "#fff", border: "none", width: "100%", textAlign: "center" }}
          >
            Open in Outreach →
          </button>
          <button
            onClick={() => onNavigate("pipeline")}
            style={{ fontSize: "11px", fontWeight: 600, padding: "8px 13px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", background: "transparent", color: "var(--accent)", border: "1px solid rgba(59,130,246,0.30)", width: "100%", textAlign: "center" }}
          >
            Add to Pipeline →
          </button>
          <button
            onClick={onClose}
            style={{ fontSize: "11px", fontWeight: 600, padding: "7px 13px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", background: "transparent", color: "#3a3f55", border: "1px solid #1a1d26", width: "100%", textAlign: "center" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(220,38,38,0.20)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#3a3f55"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a1d26"; }}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ScoredLeadsScreenProps {
  onNavigate: (tab: Tab) => void;
}

export default function ScoredLeadsScreen({ onNavigate }: ScoredLeadsScreenProps) {
  const [leads,         setLeads]         = useState<ScoredLead[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [tierFilter,    setTierFilter]    = useState<TierFilter>("all");
  const [dateFilter,    setDateFilter]    = useState<DateFilter>("all");
  const [selectedLead,  setSelectedLead]  = useState<ScoredLead | null>(null);

  // ── Fetch all scored leads ──────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: scores } = await supabase
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
          scored_at,
          listings (
            address, city, state, zip,
            beds, baths, sqft,
            avm_value, last_sold_price, last_sold_date,
            best_phone, best_email, contact_confidence,
            enriched_at
          )
        `)
        .order("score", { ascending: false });

      if (scores) {
        const items: ScoredLead[] = scores.map((s) => {
          const raw     = Array.isArray(s.listings) ? s.listings[0] : s.listings;
          const listing = raw as {
            address: string; city: string; state: string; zip: string;
            beds: number | null; baths: number | null; sqft: number | null;
            avm_value: number | null; last_sold_price: number | null; last_sold_date: string | null;
            best_phone: string | null; best_email: string | null;
            contact_confidence: "high" | "medium" | "low" | "none" | null;
            enriched_at: string | null;
          } | null;

          const tier    = tierFrom(s.score, s.temperature ?? "");
          const trusted = listing?.contact_confidence === "high" || listing?.contact_confidence === "medium";
          const daysSinceEnriched = listing?.enriched_at
            ? (Date.now() - new Date(listing.enriched_at).getTime()) / 86_400_000
            : null;

          return {
            id:                s.id,
            listingId:         s.listing_id,
            address:           listing?.address ?? "Unknown address",
            city:              listing?.city    ?? "",
            zip:               listing?.zip     ?? "",
            tier,
            score:             s.score,
            chips:             chipsFrom(s.reason_codes ?? null, s.evidence_summary ?? null),
            evidenceSummary:   s.evidence_summary ?? "",
            recommendedAction: s.recommended_action ?? null,
            confidenceScore:   s.confidence_score ?? 0,
            avmValue:          listing?.avm_value      ?? null,
            lastSoldPrice:     listing?.last_sold_price ?? null,
            lastSoldDate:      listing?.last_sold_date  ?? null,
            sqft:              listing?.sqft            ?? null,
            beds:              listing?.beds            ?? null,
            baths:             listing?.baths           ?? null,
            bestPhone:         trusted ? (listing?.best_phone ?? null) : null,
            bestPhoneType:     null,
            bestPhoneDnc:      false,
            bestEmail:         trusted ? (listing?.best_email ?? null) : null,
            contactConfidence: trusted ? (listing!.contact_confidence as "high" | "medium") : null,
            confidenceReason:  null,
            enrichedAt:        listing?.enriched_at ?? null,
            canRefresh:        daysSinceEnriched === null || daysSinceEnriched >= 7,
            scoredAt:          s.scored_at ?? new Date().toISOString(),
          };
        });
        setLeads(items);
      }

      setLoading(false);
    }
    load();
  }, []);

  // ── Filtered leads ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return leads.filter((lead) => {
      const tierOk   = tierFilter === "all" || lead.tier === tierFilter;
      const dateOk   = dateFilter === "all" || dateCategory(lead.scoredAt) === dateFilter;
      const searchOk = !q || `${lead.address} ${lead.city}`.toLowerCase().includes(q);
      return tierOk && dateOk && searchOk;
    });
  }, [leads, tierFilter, dateFilter, search]);

  const hasFilters   = tierFilter !== "all" || dateFilter !== "all" || search.trim() !== "";
  const hotCount     = leads.filter(l => l.tier === "hot").length;
  const warmCount    = leads.filter(l => l.tier === "warm").length;
  const nurtureCount = leads.filter(l => l.tier === "nurture").length;

  const showNurtureDivider = filtered.some(l => l.tier === "nurture") &&
    (filtered.some(l => l.tier === "hot") || filtered.some(l => l.tier === "warm"));

  // ── Pill helpers ────────────────────────────────────────────────────────────
  const tierPillStyle = (t: TierFilter): React.CSSProperties => {
    const active = tierFilter === t;
    if (!active) return { background: "transparent", color: "#6b7094", border: "1px solid rgba(255,255,255,0.08)" };
    if (t === "all")     return { background: "rgba(59,130,246,0.12)",  color: "#3b82f6", border: "1px solid rgba(59,130,246,0.35)" };
    if (t === "hot")     return { background: "rgba(239,68,68,0.12)",   color: "#f87171", border: "1px solid rgba(239,68,68,0.30)" };
    if (t === "warm")    return { background: "rgba(245,158,11,0.10)",  color: "#fbbf24", border: "1px solid rgba(245,158,11,0.28)" };
    return { background: "rgba(255,255,255,0.05)", color: "#8892a4", border: "1px solid rgba(255,255,255,0.14)" };
  };

  const datePillStyle = (d: DateFilter): React.CSSProperties => {
    const active = dateFilter === d;
    if (!active) return { background: "transparent", color: "#6b7094", border: "1px solid rgba(255,255,255,0.08)" };
    return { background: "rgba(59,130,246,0.10)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.28)" };
  };

  const pillBase: React.CSSProperties = {
    fontSize: "10px", fontWeight: 700, padding: "3px 11px", borderRadius: 20,
    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "all 0.1s",
  };

  const filterLabelStyle: React.CSSProperties = {
    fontSize: "9px", fontWeight: 800, letterSpacing: "0.07em",
    textTransform: "uppercase", color: "#2e3350", marginRight: 2, flexShrink: 0,
  };

  const sepStyle: React.CSSProperties = {
    width: 1, height: 14, background: "rgba(255,255,255,0.07)", flexShrink: 0,
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}>

      {/* ── Topbar ── */}
      <div style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>

        {/* Row 1: title + count + search */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 20px", height: 52 }}>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "#eceef5", letterSpacing: "-0.01em", flexShrink: 0 }}>
            Scored Leads
          </span>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#6b7094", background: "#1a1d26", padding: "2px 9px", borderRadius: 20, flexShrink: 0 }}>
            {filtered.length} of {leads.length}
          </span>
          <div style={{ position: "relative", flex: 1, maxWidth: 260, display: "flex", alignItems: "center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3a3f55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 8, pointerEvents: "none", flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search address…"
              style={{
                width: "100%", background: "#1a1d26", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 7, color: "#c0c8e0", fontSize: "11.5px",
                padding: "5px 10px 5px 28px", fontFamily: "inherit", outline: "none",
              }}
            />
          </div>
          {/* Stat pills — quick summary */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.18)" }}>
              {hotCount} HOT
            </span>
            <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "rgba(245,158,11,0.10)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.18)" }}>
              {warmCount} WARM
            </span>
            <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "rgba(255,255,255,0.05)", color: "#6b7094", border: "1px solid rgba(255,255,255,0.08)" }}>
              {nurtureCount} NURTURE
            </span>
          </div>
        </div>

        {/* Row 2: filter pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 20px 10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={filterLabelStyle}>Tier</span>
            {(["all","hot","warm","nurture"] as TierFilter[]).map(t => (
              <button key={t} onClick={() => setTierFilter(t)} style={{ ...pillBase, ...tierPillStyle(t) }}>
                {t === "all" ? "All" : t.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={sepStyle} />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={filterLabelStyle}>Scored</span>
            {([["all","All time"],["today","Today"],["week","This week"],["last","Last week"]] as [DateFilter, string][]).map(([d, label]) => (
              <button key={d} onClick={() => setDateFilter(d)} style={{ ...pillBase, ...datePillStyle(d) }}>
                {label}
              </button>
            ))}
          </div>
          {hasFilters && (
            <>
              <div style={sepStyle} />
              <button
                onClick={() => { setTierFilter("all"); setDateFilter("all"); setSearch(""); }}
                style={{ ...pillBase, background: "transparent", color: "#3b82f6", border: "none", padding: "3px 6px" }}
              >
                Clear ✕
              </button>
            </>
          )}
        </div>

        {/* Result bar — only when filters active */}
        {hasFilters && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 20px", background: "#0f1117", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize: "10px", color: "#3a3f55" }}>
              Showing {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
              {tierFilter !== "all" && ` · ${tierFilter.toUpperCase()}`}
              {dateFilter === "today" && " · scored today"}
              {dateFilter === "week"  && " · this week"}
              {dateFilter === "last"  && " · last week"}
              {search.trim() && ` · "${search.trim()}"`}
            </span>
          </div>
        )}
      </div>

      {/* ── List + drawer ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* List */}
        <div style={{ flex: selectedLead ? "0 0 52%" : "1 1 100%", transition: "flex-basis 0.3s cubic-bezier(0.4,0,0.2,1)", display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 82px 70px", padding: "6px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0f1117", flexShrink: 0 }}>
            {["Property", "Equity spread", "Tier", "Score"].map((col, i) => (
              <span key={col} style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2e3350", textAlign: i > 1 ? "right" : "left" }}>
                {col}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "32px 20px", color: "var(--text-muted)", fontSize: "13px" }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#3a3f55", fontSize: "12px" }}>
                No leads match your filters.
                <br />
                <button
                  onClick={() => { setTierFilter("all"); setDateFilter("all"); setSearch(""); }}
                  style={{ marginTop: 10, fontSize: "11px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                {filtered
                  .filter(l => l.tier !== "nurture")
                  .map(lead => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      isSelected={selectedLead?.id === lead.id}
                      onSelect={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
                    />
                  ))}

                {showNurtureDivider && <TierDivider label="Nurture queue" />}

                {filtered
                  .filter(l => l.tier === "nurture")
                  .map(lead => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      isSelected={selectedLead?.id === lead.id}
                      onSelect={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
                    />
                  ))}
              </>
            )}
          </div>
        </div>

        {/* Drawer */}
        {selectedLead && (
          <ScoredLeadsDrawer
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </div>
  );
}