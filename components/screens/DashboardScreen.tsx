// components/screens/DashboardScreen.tsx
// Command center — AI brief, metrics, today's actions, money left on table, signals, SLA
// Layout: golden ratio content grid (1.618fr 1fr), right col stacked
// Unworked = score >= 40, not HOT, no outreach_log row matching listing_id
// TODO: upgrade unworked logic when outreach_log gains listing_id FK,
//       status field (dead/closed/nurture-later/DNC), and tasks table

"use client";
import { useState, useEffect } from "react";
import { ClosingPlasma } from "@/components/ui/closing-plasma";
import { createClient } from "@/lib/supabase";
import type { Tab } from "@/components/Sidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionItem {
  id: string;
  listingId: string;
  address: string;
  city: string;
  reason: string;
  cta: string;
  tier: "hot" | "warm" | "nurture";
  score: number;
  chips: string[];
  evidenceSummary: string;
  recommendedAction: string | null;
  confidenceScore: number;
  zip: string;
  // Property signals
  avmValue:       number | null;
  lastSoldPrice:  number | null;
  lastSoldDate:   string | null;
  sqft:           number | null;
  beds:           number | null;
  baths:          number | null;
  // Enrichment — only present when contactConfidence is high or medium
  bestPhone:         string | null;
  bestPhoneType:     "mobile" | "landline" | "voip" | "unknown" | null;
  bestPhoneDnc:      boolean;
  bestEmail:         string | null;
  contactConfidence: "high" | "medium" | null;
  confidenceReason:  string | null;
  enrichedAt:        string | null;
  canRefresh:        boolean;
}

interface UnworkedLead {
  id: string;
  address: string;
  score: number;
  temperature: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tierFrom(score: number, temperature: string): "hot" | "warm" | "nurture" {
  if (temperature?.toUpperCase() === "HOT") return "hot";
  if (score >= 40) return "warm";
  return "nurture";
}

function ctaFrom(tier: "hot" | "warm" | "nurture", recommended: string | null): string {
  if (recommended) {
    const r = recommended.toLowerCase();
    if (r.includes("call"))    return "Call now";
    if (r.includes("text"))    return "Text today";
    if (r.includes("nurture")) return tier === "warm" ? "Nurture" : "Add to nurture";
    if (r.includes("watch"))   return "Watch 7 days";
  }
  if (tier === "hot")    return "Call now";
  if (tier === "warm")   return "Nurture";
  return "Add to nurture";
}

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Parse reason_codes or evidence_summary into short chip labels
// Prefers reason_codes array from DB; falls back to keyword scan of evidence_summary
const REASON_LABELS: Record<string, string | null> = {
  // Positive signals — show as chips
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
  // Suppress — data quality flags, not actionable signals
  avm_missing:              null,
  avm_unavailable:          null,
  insufficient_data:        null,
  list_price_missing:       null,
  missing_avm:              null,
  missing_avm_data:         null,
  missing_list_price:       null,
  missing_listing_data:     null,
  missing_market_data:      null,
  missing_market_signals:   null,
  missing_market_timing:    null,
  missing_owner_data:       null,
  missing_ownership_data:   null,
  missing_price:            null,
  missing_price_signals:    null,
  missing_pricing_data:     null,
  missing_pricing_signals:  null,
  missing_valuation:        null,
  missing_valuation_data:   null,
  no_avm_available:         null,
  no_avm_data:              null,
  no_avm_value:             null,
  no_days_on_market:        null,
  no_list_price:            null,
  no_listing_price:         null,
  no_listing_signals:       null,
  no_listing_status:        null,
  no_market_activity:       null,
  no_market_indicators:     null,
  no_market_signals:        null,
  no_market_timing_data:    null,
  no_motivation_indicators: null,
  no_motivation_signals:    null,
  no_owner_data:            null,
  no_owner_type:            null,
  no_owner_type_data:       null,
  no_price_cuts:            null,
  no_price_signals:         null,
  no_pricing_signals:       null,
  no_tax_delinquency:       null,
  not_tax_delinquent:       null,
  owner_type_unknown:       null,
  price_missing:            null,
  price_unavailable:        null,
  stale_listing_data:       null,
  stale_market_data:        null,
  stale_sales_data:         null,
  stale_transaction_data:   null,
  aged_transaction_data:    null,
  unknown_owner_type:       null,
};

// Condense evidence_summary into a short scannable tag line (max ~60 chars)
// Used in the action row subtitle — not the chips, which are separate
function reasonFrom(evidenceSummary: string, reasonCodes: string[]): string {
  // Prefer structured reason_codes — suppress nulls, join with dots
  if (reasonCodes.length > 0) {
    const labels = reasonCodes
      .map((c) => REASON_LABELS[c])
      .filter((label): label is string => !!label)
      .slice(0, 3);
    if (labels.length > 0) return labels.join(" · ");
  }
  // Fallback: take only the first 60 chars of evidence_summary, cut at last space
  const text = evidenceSummary.trim();
  if (!text) return "AI scoring complete";
  if (text.length <= 60) return text;
  const cut = text.slice(0, 60).lastIndexOf(" ");
  return text.slice(0, cut > 0 ? cut : 60) + "…";
}

function chipsFrom(reasonCodes: string[] | null, evidenceSummary: string | null): string[] {
  // Prefer structured reason_codes from DB
  if (reasonCodes && reasonCodes.length > 0) {
    return reasonCodes
      .map((c) => REASON_LABELS[c])           // null = suppressed, undefined = unknown
      .filter((label): label is string => !!label) // drop nulls and unknowns
      .slice(0, 3);
  }
  // Fallback: keyword scan of evidence_summary
  const text = (evidenceSummary ?? "").toLowerCase();
  const chips: string[] = [];
  if (text.includes("tax delinqu"))                    chips.push("Tax delinquent");
  if (text.includes("absentee"))                       chips.push("Absentee owner");
  if (text.includes("equity") && chips.length < 3)    chips.push("High equity");
  if (text.includes("long ownership") && chips.length < 3) chips.push("Long ownership");
  return chips.slice(0, 3);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// KPI card — two variants: action (colored) and status (neutral)
function KpiCard({
  label, value, sub, variant = "neutral", onClick, pulse,
}: {
  label: string;
  value: string | number;
  sub: string;
  variant?: "hot" | "amber" | "pink" | "neutral";
  onClick?: () => void;
  pulse?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const borderColor: Record<string, string> = {
    hot:     "rgba(220,38,38,0.28)",
    amber:   "rgba(245,158,11,0.20)",
    pink:    "rgba(220,38,38,0.15)",
    neutral: "var(--border)",
  };
  const bgGradient: Record<string, string> = {
    hot:     "linear-gradient(135deg, rgba(220,38,38,0.08) 0%, var(--bg-surface) 60%)",
    amber:   "linear-gradient(135deg, rgba(245,158,11,0.05) 0%, var(--bg-surface) 60%)",
    pink:    "linear-gradient(135deg, rgba(220,38,38,0.04) 0%, var(--bg-surface) 60%)",
    neutral: "var(--bg-surface)",
  };
  const valueColor: Record<string, string> = {
    hot:     "var(--hot)",
    amber:   "var(--warm)",
    pink:    "#f87171",
    neutral: "var(--text-primary)",
  };
  const pulseColor: Record<string, string> = {
    hot:   "var(--hot)",
    amber: "var(--warm)",
    pink:  "#f87171",
    neutral: "transparent",
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: bgGradient[variant],
        border: `1px solid ${hovered && onClick ? valueColor[variant] : borderColor[variant]}`,
        borderRadius: "var(--r-md)",
        padding: "13px 15px",
        position: "relative",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s",
      }}
    >
      {/* Label row */}
      <div style={{
        fontSize: "9.5px", fontWeight: 800, letterSpacing: "0.07em",
        textTransform: "uppercase", color: "var(--text-muted)",
        display: "flex", alignItems: "center", gap: 5, marginBottom: 8,
      }}>
        {pulse && variant !== "neutral" && (
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: pulseColor[variant],
            boxShadow: `0 0 0 2px ${pulseColor[variant]}33`,
            flexShrink: 0,
          }} />
        )}
        {label}
      </div>
      {/* Value */}
      <div style={{
        fontSize: "26px", fontWeight: 800, lineHeight: 1,
        color: valueColor[variant],
      }}>
        {value}
      </div>
      {/* Sub */}
      <div style={{ fontSize: "10px", color: "#7a7f96", marginTop: 4 }}>{sub}</div>
      {/* Arrow — only on clickable cards */}
      {onClick && (
        <div style={{ position: "absolute", bottom: 10, right: 12, fontSize: "11px", color: "#2a2d3d" }}>→</div>
      )}
    </div>
  );
}

// Panel wrapper — clean card shell, no left accent border (accent removed in v4)
function Panel({ children, amberBorder }: { children: React.ReactNode; amberBorder?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => amberBorder ? setHovered(true) : undefined}
      onMouseLeave={() => amberBorder ? setHovered(false) : undefined}
      style={{
        background: "var(--bg-surface)",
        border: amberBorder
          ? `1px solid ${hovered ? "rgba(245,158,11,0.45)" : "rgba(245,158,11,0.20)"}`
          : "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        transition: amberBorder ? "border-color 0.15s" : undefined,
      }}
    >
      {children}
    </div>
  );
}

function PanelHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 16px",
      borderBottom: "1px solid var(--border)",
    }}>
      {children}
    </div>
  );
}

// Tier separator — thin labeled divider between WARM and NURTURE groups
function TierDivider({ label }: { label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "5px 16px",
      background: "var(--bg-base)",
    }}>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <div style={{
        fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "#2e3350",
      }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

// Reason chip — small pill tag for HOT row signal signals
function ReasonChip({ label, hot }: { label: string; hot?: boolean }) {
  return (
    <span style={{
      fontSize: "9.5px", fontWeight: 700, padding: "2px 7px", borderRadius: 4,
      whiteSpace: "nowrap",
      background: hot ? "rgba(220,38,38,0.12)" : "#161a24",
      color:      hot ? "#f87171"              : "var(--text-muted)",
      border:     hot ? "1px solid rgba(220,38,38,0.18)" : "1px solid var(--border)",
    }}>
      {label}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DashboardScreenProps {
  onNavigate: (tab: Tab) => void;
}

export default function DashboardScreen({ onNavigate }: DashboardScreenProps) {
  const [actions,  setActions]  = useState<ActionItem[]>([]);
  const [unworked, setUnworked] = useState<UnworkedLead[]>([]);
  const [metrics,  setMetrics]  = useState({ hot: 0, total: 0, missedSla: 3 });
  const [loading,  setLoading]  = useState(true);
  const [userName,        setUserName]        = useState<string>("");
  const [selectedAction,  setSelectedAction]  = useState<ActionItem | null>(null);
  const [dismissedIds,    setDismissedIds]    = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Pull display name — email prefix as fallback
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const email = session.user.email ?? "";
        const name  = session.user.user_metadata?.full_name
          ?? session.user.user_metadata?.name
          ?? email.split("@")[0];
        setUserName(name.charAt(0).toUpperCase() + name.slice(1));
      }

      // Scores joined with listings
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
          listings (
            address, city, state, zip,
            beds, baths, sqft,
            avm_value, last_sold_price, last_sold_date,
            best_phone, best_email, contact_confidence,
            enriched_at
          )
        `)
        .order("score", { ascending: false })
        .limit(20);

      // TODO: once outreach_log has listing_id FK, cross-reference here
      //       to accurately identify unworked leads

      if (scores) {
        const isHot = (s: { temperature: string }) => s.temperature?.toUpperCase() === "HOT";

        const hot   = scores.filter(isHot);
        const total = scores.length;

        setMetrics({ hot: hot.length, total, missedSla: 3 }); // missedSla static until outreach_log FK

        // Today's actions — top 6 by score
        const items: ActionItem[] = scores.slice(0, 6).map((s) => {
          const raw     = Array.isArray(s.listings) ? s.listings[0] : s.listings;
          const listing = raw as {
            address:            string;
            city:               string;
            state:              string;
            zip:                string;
            beds:               number | null;
            baths:              number | null;
            sqft:               number | null;
            avm_value:          number | null;
            last_sold_price:    number | null;
            last_sold_date:     string | null;
            best_phone:         string | null;
            best_email:         string | null;
            contact_confidence: "high" | "medium" | "low" | "none" | null;
            enriched_at:        string | null;
          } | null;
          const tier    = tierFrom(s.score, s.temperature ?? "");
          const trusted = listing?.contact_confidence === "high" || listing?.contact_confidence === "medium";
          const daysSinceEnriched = listing?.enriched_at
            ? (Date.now() - new Date(listing.enriched_at).getTime()) / 86_400_000
            : null;

          return {
            id:        s.id,
            listingId: s.listing_id,
            address:   listing?.address ?? "Unknown address",
            city:      listing?.city    ?? "",
            reason:    reasonFrom(s.evidence_summary ?? "", s.reason_codes ?? []),
            cta:               ctaFrom(tier, s.recommended_action),
            tier,
            score:             s.score,
            chips:             chipsFrom(s.reason_codes ?? null, s.evidence_summary ?? null),
            evidenceSummary:   s.evidence_summary ?? "",
            recommendedAction: s.recommended_action ?? null,
            confidenceScore:   s.confidence_score ?? 0,
            // Enrichment — only populated when trusted
            bestPhone:         trusted ? (listing?.best_phone ?? null)  : null,
            bestPhoneType:     null, // not stored on listings — available in enrichment_results if needed later
            bestPhoneDnc:      false,
            bestEmail:         trusted ? (listing?.best_email ?? null)  : null,
            contactConfidence: trusted ? (listing.contact_confidence as "high" | "medium") : null,
            confidenceReason:  null,
            enrichedAt:        listing?.enriched_at ?? null,
            canRefresh:        daysSinceEnriched === null || daysSinceEnriched >= 7,
            zip:           listing?.zip            ?? "",
            avmValue:      listing?.avm_value      ?? null,
            lastSoldPrice: listing?.last_sold_price ?? null,
            lastSoldDate:  listing?.last_sold_date  ?? null,
            sqft:          listing?.sqft            ?? null,
            beds:          listing?.beds            ?? null,
            baths:         listing?.baths           ?? null,
          };
        });
        setActions(items);

        // Unworked — score >= 40, HOT excluded (already surfaced as urgent above)
        // TODO: exclude listing_ids with outreach_log rows once FK exists
        // TODO: exclude status IN ('dead','closed','nurture-later','dnc') once col exists
        // TODO: exclude listing_ids with future task rows once tasks table exists
        const unworkedItems: UnworkedLead[] = scores
          .filter((s) => s.score >= 40 && !isHot(s))
          .slice(0, 5)
          .map((s) => {
            const raw     = Array.isArray(s.listings) ? s.listings[0] : s.listings;
            const listing = raw as { address: string } | null;
            return {
              id:          s.id,
              address:     listing?.address ?? "Unknown address",
              score:       s.score,
              temperature: s.temperature,
            };
          });
        setUnworked(unworkedItems);
      }

      setLoading(false);
    }

    load();
  }, []);

  const now            = new Date();
  const greeting       = greetingFor(now.getHours());
  const todayStr       = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const visibleActions = actions.filter((a) => !dismissedIds.has(a.id));
  const urgentCount    = visibleActions.filter((a) => a.tier === "hot").length;

  // Tier-driven styles — all CSS variables, no hardcoded hex in JSX
  const tierBorderColor: Record<string, string> = {
    hot:     "var(--hot)",
    warm:    "var(--warm)",
    nurture: "#252836",
  };
  const tierHoverBg: Record<string, string> = {
    hot:     "rgba(220,38,38,0.07)",
    warm:    "rgba(245,158,11,0.06)",
    nurture: "#161a24",
  };
  const tierHoverBorder: Record<string, string> = {
    hot:     "#ff6b6b",
    warm:    "#fbbf24",
    nurture: "var(--accent)",
  };
  const tierTagColor: Record<string, string> = {
    hot:  "#f87171",
    warm: "#fbbf24",
  };
  const tierScoreStyle: Record<string, React.CSSProperties> = {
    hot:     { background: "rgba(220,38,38,0.14)", color: "#f87171" },
    warm:    { background: "rgba(245,158,11,0.10)", color: "#fbbf24" },
    nurture: { background: "var(--bg-card)",        color: "var(--text-muted)" },
  };
  const tierCtaStyle: Record<string, React.CSSProperties> = {
    hot:     { background: "#dc2626",                         color: "#fff",           border: "none"                                      },
    warm:    { background: "transparent",                     color: "var(--warm)",    border: "1.5px solid rgba(245,158,11,0.40)"          },
    nurture: { background: "transparent",                     color: "#5a6080",        border: "1.5px solid #252836"                        },
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

      {/* ── Plasma — full viewport so it bleeds behind the glass sidebar ── */}
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}>
        <ClosingPlasma
          speed={1}
          turbulence={1}
          mouseInfluence={1}
          grain={1}
          sparkle={1}
          vignette={1}
          opacity={1}
          interactive={true}
          className="w-full h-full"
        />
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(11,13,17,0.48)",
        }} />
      </div>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", display: "flex", flexDirection: "column", gap: "16px", position: "relative", zIndex: 1, background: "transparent" }}>
        {loading ? (
          <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading...</div>
        ) : (
          <>
            {/* ── ZIP selector ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>Area</span>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { zip: "60950", label: "60950", hot: 2, warm: 7 },
                ].map(z => (
                  <div key={z.zip} style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "5px 12px", borderRadius: 20,
                    background: "rgba(59,130,246,0.12)",
                    border: "1px solid rgba(59,130,246,0.35)",
                    cursor: "pointer",
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#c0c8e0" }}>{z.zip}</span>
                    <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700 }}>{z.hot} HOT</span>
                    <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>{z.warm} WARM</span>
                  </div>
                ))}
                <button style={{
                  padding: "5px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                  background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--text-muted)", cursor: "pointer",
                }}>+ Add ZIP</button>
              </div>
            </div>

            {/* ── KPI row — all 4 cards operational ───────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              <KpiCard
                label="Unworked Hot"
                value={metrics.hot}
                sub="Need a call today"
                variant="hot"
                pulse
                onClick={metrics.hot > 0 ? () => onNavigate("outreach") : undefined}
              />
              <KpiCard
                label="Needs Follow-Up"
                value={unworked.length}
                sub="Scored ≥ 40, no outreach"
                variant="amber"
                pulse
                onClick={unworked.length > 0 ? () => onNavigate("outreach") : undefined}
              />
              <KpiCard
                label="Total Leads"
                value={metrics.total}
                sub="Across active zips"
                variant="neutral"
              />
              <KpiCard
                label="Active Zips"
                value="1"
                sub="zip 90210"
                variant="neutral"
              />
            </div>

            {/* ── Today's Pulse + slide-in drawer ──────────────────────────── */}
            <div style={{ display: "flex", gap: 0, alignItems: "stretch", borderRadius: "var(--r-md)", overflow: "hidden", border: "1px solid var(--border)" }}>

              {/* Pulse list — compresses when drawer is open */}
              <div style={{ flex: selectedAction ? "0 0 52%" : "1 1 100%", transition: "flex-basis 0.3s cubic-bezier(0.4,0,0.2,1)", minWidth: 0, overflow: "hidden" }}>
                <div style={{ background: "var(--bg-surface)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8b90a8" }}>
                        ⚡ Today&apos;s Pulse
                      </span>
                      {urgentCount > 0 && (
                        <span style={{ fontSize: "9px", fontWeight: 800, padding: "2px 6px", borderRadius: 6, background: "rgba(220,38,38,0.18)", color: "var(--hot)" }}>
                          {urgentCount} urgent
                        </span>
                      )}
                    </div>
                    <button onClick={() => onNavigate("outreach")} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: "10.5px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      View all →
                    </button>
                  </div>

                  {visibleActions.length === 0 ? (
                    <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                      No scored leads yet. Ingest runs daily at 6:00 AM.
                    </div>
                  ) : (
                    <div>
                      {visibleActions.map((action, i) => {
                        const prevTier   = i > 0 ? visibleActions[i - 1].tier : null;
                        const showDivider = action.tier === "nurture" && prevTier !== "nurture";
                        const isSelected  = selectedAction?.id === action.id;
                        return (
                          <ActionRow
                            key={action.id}
                            action={action}
                            isLast={i === actions.length - 1}
                            showDivider={showDivider}
                            isSelected={isSelected}
                            tierBorderColor={tierBorderColor}
                            tierHoverBg={tierHoverBg}
                            tierHoverBorder={tierHoverBorder}
                            tierTagColor={tierTagColor}
                            tierScoreStyle={tierScoreStyle}
                            tierCtaStyle={tierCtaStyle}
                            onNavigate={onNavigate}
                            onSelect={() => setSelectedAction(isSelected ? null : action)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer — expands from the right */}
              {selectedAction && (
                <PulseDrawer
                  action={selectedAction}
                  onClose={() => setSelectedAction(null)}
                  onNavigate={onNavigate}
                  onRefreshed={(updated) => setSelectedAction((prev) =>
                    prev ? { ...prev, ...updated } : prev
                  )}
                  onDismiss={() => {
                    setDismissedIds((prev) => new Set([...prev, selectedAction.id]));
                    setSelectedAction(null);
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ScoreChip — tappable score with inline breakdown popover ─────────────────

function ScoreChip({ action, tierScoreStyle }: {
  action: ActionItem;
  tierScoreStyle: Record<string, React.CSSProperties>;
}) {
  const [open, setOpen] = useState(false);

  const chipColor = action.tier === "hot"
    ? { bg: "rgba(220,38,38,0.10)", color: "#f87171", border: "1px solid rgba(220,38,38,0.18)" }
    : action.tier === "warm"
    ? { bg: "rgba(245,158,11,0.10)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.20)" }
    : { bg: "rgba(255,255,255,0.05)", color: "#6b7094", border: "1px solid rgba(255,255,255,0.08)" };

  return (
    <div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          fontSize: "11px", fontWeight: 800, padding: "3px 8px",
          borderRadius: 5, minWidth: 34, textAlign: "center",
          cursor: "pointer",
          outline: open ? "1.5px solid rgba(59,130,246,0.5)" : "none",
          ...tierScoreStyle[action.tier],
        }}
      >
        {action.score}
      </div>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50,
            background: "#13151b", border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 8, padding: "12px 14px", width: 220,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a3f55" }}>Why this score</span>
              <span style={{ fontSize: "12px", fontWeight: 800, ...tierScoreStyle[action.tier], padding: "1px 7px", borderRadius: 4 }}>{action.score}</span>
            </div>

            {/* Reason chips */}
            {action.chips.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                {action.chips.map((chip) => (
                  <span key={chip} style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: chipColor.bg, color: chipColor.color, border: chipColor.border }}>
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Evidence summary */}
            {action.evidenceSummary ? (
              <div style={{ fontSize: "11px", color: "#6b7094", lineHeight: 1.55, borderTop: action.chips.length > 0 ? "1px solid rgba(255,255,255,0.05)" : "none", paddingTop: action.chips.length > 0 ? 9 : 0 }}>
                {action.evidenceSummary.length > 120
                  ? action.evidenceSummary.slice(0, action.evidenceSummary.lastIndexOf(" ", 120)) + "…"
                  : action.evidenceSummary}
              </div>
            ) : (
              <div style={{ fontSize: "11px", color: "#3a3f55" }}>No evidence summary available.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── ActionRow — extracted to keep JSX above readable ─────────────────────────

function ActionRow({
  action, isLast, showDivider, isSelected,
  tierBorderColor, tierHoverBg, tierHoverBorder,
  tierTagColor, tierScoreStyle, tierCtaStyle,
  onNavigate, onSelect,
}: {
  action: ActionItem;
  isLast: boolean;
  showDivider: boolean;
  isSelected: boolean;
  tierBorderColor: Record<string, string>;
  tierHoverBg: Record<string, string>;
  tierHoverBorder: Record<string, string>;
  tierTagColor: Record<string, string>;
  tierScoreStyle: Record<string, React.CSSProperties>;
  tierCtaStyle: Record<string, React.CSSProperties>;
  onNavigate: (tab: Tab) => void;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <>
      {showDivider && <TierDivider label="Nurture queue" />}
      <div
        onClick={onSelect}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px",
          borderBottom: isLast ? "none" : "1px solid var(--bg-base)",
          borderLeft: isSelected
            ? "3px solid var(--accent)"
            : `3px solid ${hovered ? tierHoverBorder[action.tier] : tierBorderColor[action.tier]}`,
          background: isSelected
            ? "rgba(59,130,246,0.07)"
            : hovered ? tierHoverBg[action.tier] : "transparent",
          cursor: "pointer",
          transition: "background 0.1s, border-left-color 0.1s",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Address + ZIP */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, minWidth: 0 }}>
            <div style={{
              fontSize: "13px", fontWeight: 700,
              color: action.tier === "nurture" ? "#c8ccd8" : "#eceef5",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              letterSpacing: "0.01em", flex: 1, minWidth: 0,
            }}>
              {action.address}{action.city ? `, ${action.city}` : ""}
            </div>
            {action.zip && (
              <span style={{
                fontSize: "9.5px", fontWeight: 600, padding: "2px 6px",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 4, color: "var(--text-muted)", letterSpacing: "0.04em", flexShrink: 0,
              }}>
                {action.zip}
              </span>
            )}
          </div>
          {/* Tag line */}
          <div style={{
            fontSize: "11px",
            color: action.tier === "nurture" ? "var(--text-muted)" : "#9da2ba",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            lineHeight: 1.4,
          }}>
            {action.tier !== "nurture" && (
              <span style={{ color: tierTagColor[action.tier], fontWeight: 800, fontSize: "9.5px", letterSpacing: "0.04em", marginRight: 6 }}>
                ● {action.tier.toUpperCase()}
              </span>
            )}
            {action.reason}
          </div>
          {/* Reason chips — HOT rows only */}
          {action.tier === "hot" && action.chips.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
              {action.chips.map((chip, ci) => (
                <ReasonChip key={chip} label={chip} hot={ci < 2} />
              ))}
            </div>
          )}
        </div>
        {/* Score chip — tappable, opens breakdown popover */}
        <ScoreChip action={action} tierScoreStyle={tierScoreStyle} />
      </div>
    </>
  );
}

// ─── ContactSection ───────────────────────────────────────────────────────────

function ContactSection({ action, onRefreshed }: {
  action: ActionItem;
  onRefreshed: (updated: Partial<ActionItem>) => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [copied,     setCopied]     = useState(false);

  const confidenceBadge: Record<string, React.CSSProperties> = {
    high:   { background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.22)" },
    medium: { background: "rgba(245,158,11,0.10)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.20)" },
  };

  async function handleCopy() {
    if (!action.bestPhone) return;
    await navigator.clipboard.writeText(action.bestPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res  = await fetch("/api/skip-trace/refresh", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ listing_id: action.listingId }),
      });
      const json = await res.json();
      if (json.ui) {
        onRefreshed({
          bestPhone:         json.ui.bestPhone,
          bestEmail:         json.ui.bestEmail,
          contactConfidence: json.ui.contactConfidence,
          confidenceReason:  json.ui.confidenceReason,
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
    <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a3f55" }}>
          Contact
        </div>
        {action.contactConfidence && (
          <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 7px", borderRadius: 4, ...confidenceBadge[action.contactConfidence] }}>
            {action.contactConfidence === "high" ? "Verified" : "Likely match"}
          </span>
        )}
      </div>

      {/* Phone */}
      {action.bestPhone ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: action.bestEmail ? 8 : 0 }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#eceef5", letterSpacing: "0.02em" }}>
              {action.bestPhone}
            </div>
            {action.bestPhoneType && (
              <div style={{ fontSize: "10px", color: "#6b7094", marginTop: 2 }}>
                {action.bestPhoneType}
                {action.bestPhoneDnc && (
                  <span style={{ marginLeft: 6, color: "#f87171", fontWeight: 700 }}>· DNC</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleCopy}
            style={{
              fontSize: "10px", fontWeight: 700, padding: "4px 10px", borderRadius: 4,
              cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
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
        <div style={{ fontSize: "11px", color: "#6b7094", marginBottom: action.bestEmail ? 8 : 0 }}>
          No phone found
        </div>
      )}

      {/* Email */}
      {action.bestEmail && (
        <div style={{ fontSize: "11px", color: "#9da2ba", marginBottom: 10 }}>
          {action.bestEmail}
        </div>
      )}

      {/* Re-run skip trace — only when canRefresh */}
      {action.canRefresh && (
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            fontSize: "10px", fontWeight: 600, padding: "4px 10px", borderRadius: 4,
            cursor: refreshing ? "default" : "pointer", fontFamily: "inherit",
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

// ─── Helpers — signal formatting ─────────────────────────────────────────────

function fmt$(n: number | null): string {
  if (!n) return "—";
  return "$" + (n >= 1_000_000
    ? (n / 1_000_000).toFixed(1) + "M"
    : (n / 1_000).toFixed(0) + "k");
}

function fmtSqft(n: number | null): string {
  if (!n) return "—";
  return n.toLocaleString() + " sqft";
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function equitySpread(avm: number | null, lastSold: number | null): string {
  if (!avm || !lastSold) return "—";
  const spread = avm - lastSold;
  return (spread >= 0 ? "+" : "") + fmt$(spread);
}

function yearsHeld(lastSoldDate: string | null): string {
  if (!lastSoldDate) return "—";
  const years = Math.floor((Date.now() - new Date(lastSoldDate).getTime()) / (365.25 * 86_400_000));
  if (years < 1) return "< 1 yr";
  return `${years} yr${years !== 1 ? "s" : ""}`;
}

// ─── TimelineEvent ────────────────────────────────────────────────────────────

function TimelineEvent({ dot, label, sub, muted }: {
  dot: "grey" | "green" | "blue" | "amber";
  label: string;
  sub?: string;
  muted?: boolean;
}) {
  const dotColor = {
    grey:  "#252836",
    green: "var(--success)",
    blue:  "var(--accent)",
    amber: "var(--warm)",
  }[dot];

  return (
    <div style={{ display: "flex", gap: 10, paddingBottom: 12, position: "relative" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0, marginTop: 3 }} />
        <div style={{ width: 1, flex: 1, background: "rgba(255,255,255,0.05)", marginTop: 4 }} />
      </div>
      <div style={{ flex: 1, paddingBottom: 2 }}>
        <div style={{ fontSize: "11.5px", fontWeight: 600, color: muted ? "#3a3f55" : "#9da2ba", lineHeight: 1.4 }}>{label}</div>
        {sub && <div style={{ fontSize: "10px", color: "#3a3f55", marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── PulseDrawer ──────────────────────────────────────────────────────────────

function PulseDrawer({ action, onClose, onNavigate, onRefreshed, onDismiss }: {
  action: ActionItem;
  onClose: () => void;
  onNavigate: (tab: Tab) => void;
  onRefreshed: (updated: Partial<ActionItem>) => void;
  onDismiss: () => void;
}) {
  const tierBadgeStyle: Record<string, React.CSSProperties> = {
    hot:     { background: "rgba(220,38,38,0.18)",  color: "#f87171"  },
    warm:    { background: "rgba(245,158,11,0.14)",  color: "#fbbf24"  },
    nurture: { background: "rgba(255,255,255,0.06)", color: "#6b7094"  },
  };

  const spread    = action.avmValue && action.lastSoldPrice ? action.avmValue - action.lastSoldPrice : null;
  const spreadPos = spread !== null && spread >= 0;
  const hasFubActivity = false; // gate: true once FUB key is live and activity exists

  return (
    <div style={{
      flex: "0 0 48%",
      borderLeft: "1px solid var(--border)",
      background: "#0f1118",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      animation: "drawerSlideIn 0.3s cubic-bezier(0.4,0,0.2,1)",
    }}>
      <style>{`
        @keyframes drawerSlideIn {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: "#0b0d11", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "12px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "#eceef5", letterSpacing: "0.01em", marginBottom: 5 }}>
            {action.address}{action.city ? `, ${action.city}` : ""}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "9px", fontWeight: 800, padding: "2px 7px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.05em", ...tierBadgeStyle[action.tier] }}>
              {action.tier.toUpperCase()}
            </span>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#6b7094" }}>Score {action.score}</span>
            {action.zip && (
              <span style={{ fontSize: "9.5px", fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7094", letterSpacing: "0.04em" }}>
                {action.zip}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#3a3f55", cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: 0, fontFamily: "inherit" }}>✕</button>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", minHeight: 0 }}>

        {/* ── Property signals ── */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a3f55", marginBottom: 10 }}>Property signals</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>

            {spread !== null && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#6b7094" }}>Equity spread</span>
                <span style={{ fontSize: "13px", fontWeight: 800, color: spreadPos ? "#10b981" : "#f87171" }}>
                  {equitySpread(action.avmValue, action.lastSoldPrice)}
                </span>
              </div>
            )}

            {action.avmValue && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#6b7094" }}>Est. value (AVM)</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#eceef5" }}>{fmt$(action.avmValue)}</span>
              </div>
            )}

            {action.lastSoldPrice && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#6b7094" }}>Last sold</span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#9da2ba" }}>
                  {fmt$(action.lastSoldPrice)} · {fmtDate(action.lastSoldDate)}
                </span>
              </div>
            )}

            {action.lastSoldDate && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#6b7094" }}>Held</span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#9da2ba" }}>{yearsHeld(action.lastSoldDate)}</span>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", color: "#6b7094" }}>Owner type</span>
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                background: action.chips.some(c => c.toLowerCase().includes("absentee")) ? "rgba(245,158,11,0.10)" : "rgba(255,255,255,0.05)",
                color:      action.chips.some(c => c.toLowerCase().includes("absentee")) ? "#fbbf24"               : "#9da2ba",
                border:     action.chips.some(c => c.toLowerCase().includes("absentee")) ? "1px solid rgba(245,158,11,0.20)" : "1px solid rgba(255,255,255,0.07)",
              }}>
                {action.chips.some(c => c.toLowerCase().includes("absentee")) ? "Absentee" : "Owner-occupied"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", color: "#6b7094" }}>Tax delinquent</span>
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                background: action.chips.some(c => c.toLowerCase().includes("tax")) ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.04)",
                color:      action.chips.some(c => c.toLowerCase().includes("tax")) ? "#f87171"              : "#6b7094",
                border:     action.chips.some(c => c.toLowerCase().includes("tax")) ? "1px solid rgba(220,38,38,0.18)" : "1px solid rgba(255,255,255,0.06)",
              }}>
                {action.chips.some(c => c.toLowerCase().includes("tax")) ? "Yes" : "No"}
              </span>
            </div>

            {(action.beds || action.sqft) && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#6b7094" }}>Property</span>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#9da2ba" }}>
                  {[action.beds ? `${action.beds}bd` : null, action.baths ? `${action.baths}ba` : null, fmtSqft(action.sqft)].filter(Boolean).join(" · ")}
                </span>
              </div>
            )}

          </div>
        </div>

        {/* ── Why it surfaced — chips ── */}
        {action.chips.length > 0 && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a3f55", marginBottom: 8 }}>Why it surfaced</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {action.chips.map((chip) => (
                <span key={chip} style={{ fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: 4,
                  background: action.tier === "hot" ? "rgba(220,38,38,0.10)" : "rgba(245,158,11,0.10)",
                  color:      action.tier === "hot" ? "#f87171"              : "#fbbf24",
                  border:     action.tier === "hot" ? "1px solid rgba(220,38,38,0.18)" : "1px solid rgba(245,158,11,0.20)",
                }}>
                  {chip}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── AI Summary ── */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a3f55", marginBottom: 8 }}>AI Summary</div>
          <div style={{ fontSize: "11.5px", color: "#9da2ba", lineHeight: 1.6, background: "#13151b", borderLeft: "3px solid rgba(59,130,246,0.4)", padding: "10px 12px" }}>
            {action.evidenceSummary || "AI scoring complete. No summary available."}
          </div>
        </div>

        {/* ── Contact — quick reference ── */}
        {(action.contactConfidence === "high" || action.contactConfidence === "medium") && (
          <ContactSection action={action} onRefreshed={onRefreshed} />
        )}

        {/* ── Activity timeline ── */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a3f55", marginBottom: 10 }}>Activity</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <TimelineEvent dot="grey" label="Ingested into system" sub={action.enrichedAt ? fmtDate(action.enrichedAt) : "Recently"} />
            {action.enrichedAt && (
              <TimelineEvent dot="blue" label="Skip trace ran" sub={action.contactConfidence ? `BatchData · ${action.contactConfidence === "high" ? "Verified match" : "Likely match"}` : "BatchData · No match"} />
            )}
            {!hasFubActivity && (
              <TimelineEvent dot="grey" label="No contact attempts logged" sub="FUB activity will appear here once API key is connected" muted />
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={() => onNavigate("outreach")}
            style={{ fontSize: "12px", fontWeight: 700, padding: "10px 13px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", background: "var(--accent)", color: "#fff", border: "none", width: "100%", textAlign: "center" }}
          >
            Open in Outreach →
          </button>
          {hasFubActivity && (
            <button
              onClick={() => onNavigate("inbox")}
              style={{ fontSize: "11px", fontWeight: 600, padding: "8px 13px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", background: "transparent", color: "var(--accent)", border: "1px solid rgba(59,130,246,0.30)", width: "100%", textAlign: "center" }}
            >
              Open in Inbox →
            </button>
          )}
          <button
            onClick={onDismiss}
            style={{ fontSize: "11px", fontWeight: 600, padding: "7px 13px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", background: "transparent", color: "#3a3f55", border: "1px solid #1a1d26", width: "100%", textAlign: "center" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(220,38,38,0.20)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#3a3f55";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a1d26";
            }}
          >
            Dismiss
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── MoneyRow ─────────────────────────────────────────────────────────────────

function MoneyRow({ lead, isLast, onNavigate }: {
  lead: UnworkedLead;
  isLast: boolean;
  onNavigate: (tab: Tab) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={() => onNavigate("opportunities")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "9px 15px",
        borderBottom: isLast ? "none" : "1px solid var(--bg-base)",
        background: hovered ? "#1a1d26" : "transparent",
        cursor: "pointer", transition: "background 0.1s",
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: 500, color: "#b8bcd0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {lead.address}
      </div>
      <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--warm)", flexShrink: 0, marginLeft: 8 }}>
        {lead.score} pts
      </div>
    </div>
  );
}

// ─── SlaWarningBox ────────────────────────────────────────────────────────────

function SlaWarningBox({ count, onClick }: { count: number; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: hovered ? "rgba(220,38,38,0.13)" : "rgba(220,38,38,0.08)",
        border: "1px solid rgba(220,38,38,0.18)",
        borderRadius: 6, padding: "8px 12px",
        cursor: "pointer", transition: "background 0.1s",
      }}
    >
      <div style={{ fontSize: "11px", color: "#9094a8", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: "10px" }}>⚠</span>
        Missed SLA window
      </div>
      <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--hot)" }}>{count} leads</div>
    </div>
  );
}

// ─── SignalRow ────────────────────────────────────────────────────────────────

function SignalRow({ action, isLast, onNavigate }: {
  action: ActionItem;
  isLast: boolean;
  onNavigate: (tab: Tab) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={() => onNavigate("opportunities")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 15px",
        borderBottom: isLast ? "none" : "1px solid var(--bg-base)",
        background: hovered ? "#161a24" : "transparent",
        cursor: "pointer", transition: "background 0.1s",
      }}
    >
      <span style={{
        fontSize: "9px", fontWeight: 800, padding: "2px 6px", borderRadius: 4,
        textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0,
        ...(action.tier === "hot"
          ? { background: "rgba(220,38,38,0.16)", color: "var(--hot)" }
          : { background: "rgba(59,111,240,0.16)", color: "var(--accent)" }
        ),
      }}>
        {action.tier === "hot" ? "Urgent" : "New"}
      </span>
      <div style={{ flex: 1, fontSize: "11px", color: "#b0b4c8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {action.address} — score {action.score}
      </div>
      <div style={{ fontSize: "9.5px", color: "var(--text-muted)", flexShrink: 0 }}>Today</div>
    </div>
  );
}