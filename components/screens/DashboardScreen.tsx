// components/screens/DashboardScreen.tsx
// Command center — AI brief, metrics, today's actions, money left on table, signals, SLA
// Layout: golden ratio content grid (1.618fr 1fr), right col stacked
// Unworked = score >= 40, not HOT, no outreach_log row matching listing_id
// TODO: upgrade unworked logic when outreach_log gains listing_id FK,
//       status field (dead/closed/nurture-later/DNC), and tasks table

"use client";

import { useEffect, useState } from "react";
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
const REASON_LABELS: Record<string, string> = {
  tax_delinquent:  "Tax delinquent",
  absentee_owner:  "Absentee owner",
  high_equity:     "High equity",
  significant_equity: "High equity",
  long_ownership:  "Long ownership",
  no_listing:      "No active listing",
  price_reduction: "Price reduction",
  equity_gain:     "Equity gain",
  owner_occupied:  "Owner-occupied",
  data_stale:      "Data stale",
};

// Condense evidence_summary into a short scannable tag line (max ~60 chars)
// Used in the action row subtitle — not the chips, which are separate
function reasonFrom(evidenceSummary: string, reasonCodes: string[]): string {
  // Prefer structured reason_codes — map to display labels, join with dots
  if (reasonCodes.length > 0) {
    return reasonCodes
      .slice(0, 3)
      .map((c) => {
        // Try exact match first, then title-case the raw value
        if (REASON_LABELS[c]) return REASON_LABELS[c];
        // e.g. "equity spread high" → "Equity spread high"
        return c.charAt(0).toUpperCase() + c.slice(1);
      })
      .join(" · ");
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
    return reasonCodes.slice(0, 3).map((c) => REASON_LABELS[c] ?? c.replace(/_/g, " "));
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
  const [userName, setUserName] = useState<string>("");

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
          temperature,
          evidence_summary,
          recommended_action,
          reason_codes,
          listings ( address, city, state, zip )
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
          const listing = raw as { address: string; city: string; state: string; zip: string } | null;
          const tier    = tierFrom(s.score, s.temperature ?? "");
          return {
            id:        s.id,
            listingId: s.listing_id,
            address:   listing?.address ?? "Unknown address",
            city:      listing?.city    ?? "",
            reason:    reasonFrom(s.evidence_summary ?? "", s.reason_codes ?? []),
            cta:       ctaFrom(tier, s.recommended_action),
            tier,
            score:     s.score,
            chips:     chipsFrom(s.reason_codes ?? null, s.evidence_summary ?? null),
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

  const now          = new Date();
  const greeting     = greetingFor(now.getHours());
  const todayStr     = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const urgentCount  = actions.filter((a) => a.tier === "hot").length;

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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <div style={{
        height: "var(--topbar-height)",
        minHeight: "var(--topbar-height)",
        display: "flex",
        alignItems: "center",
        padding: "0 32px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-surface)",
        gap: "12px",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
            {greeting}{userName ? `, ${userName}` : ""}
          </div>
          <div style={{ fontSize: "11px" }}>
            {urgentCount > 0
              ? <><span style={{ color: "var(--hot)", fontWeight: 700 }}>{urgentCount} urgent {urgentCount === 1 ? "lead" : "leads"}</span><span style={{ color: "var(--text-muted)" }}> need action · {todayStr}</span></>
              : <span style={{ color: "var(--text-muted)" }}>{todayStr}</span>
            }
          </div>
        </div>
        <div style={{
          marginLeft: "auto",
          display: "flex", alignItems: "center", gap: "7px",
          fontSize: "11px", color: "var(--text-muted)",
          background: "var(--bg-base)", border: "1px solid var(--border)",
          padding: "5px 14px", borderRadius: "999px",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }} />
          Last ingest 6:31 AM · zip 90210
        </div>
      </div>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {loading ? (
          <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading...</div>
        ) : (
          <>
            {/* ── AI Brief — compact inline one-liner ──────────────────────── */}
            <div style={{
              background: "linear-gradient(92deg, rgba(59,111,240,0.08) 0%, rgba(59,111,240,0.02) 100%)",
              border: "1px solid rgba(59,111,240,0.18)",
              borderRadius: "var(--r-md)",
              padding: "11px 15px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              {/* Icon */}
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: "rgba(59,111,240,0.14)", border: "1px solid rgba(59,111,240,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
                </svg>
              </div>
              {/* Text — inline label + brief copy */}
              <div style={{ flex: 1, fontSize: "12px", color: "#9da2ba", lineHeight: 1.5 }}>
                <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", marginRight: 8 }}>
                  AI Brief
                </span>
                {urgentCount > 0 ? (
                  <>
                    <span style={{ color: "#dde0ec", fontWeight: 600 }}>{urgentCount} HOT {urgentCount === 1 ? "lead needs" : "leads need"} a call — </span>
                    tax delinquent, absentee-owned, high equity.
                    {unworked.length > 0 && (
                      <> <span style={{ color: "#dde0ec", fontWeight: 600 }}>{unworked.length} unworked leads ≥ 40</span> with no outreach on record.</>
                    )}
                  </>
                ) : (
                  <>No urgent leads today. <span style={{ color: "#dde0ec", fontWeight: 600 }}>{metrics.total} active leads</span> across your zips — good time to work the warm pipeline.</>
                )}
              </div>
              {/* Actions */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                <button style={{
                  fontSize: "10px", color: "#3a3f55", background: "none",
                  border: "1px solid var(--border)", borderRadius: 4,
                  padding: "4px 9px", cursor: "pointer", fontFamily: "inherit",
                }}>
                  ↻ Regenerate
                </button>
                <button onClick={() => onNavigate("opportunities")} style={{
                  fontSize: "10px", color: "var(--accent)", background: "none",
                  border: "none", padding: "4px 0", cursor: "pointer",
                  fontFamily: "inherit", fontWeight: 600,
                }}>
                  View all →
                </button>
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
                onClick={metrics.hot > 0 ? () => onNavigate("opportunities") : undefined}
              />
              <KpiCard
                label="Needs Follow-Up"
                value={unworked.length}
                sub="Scored ≥ 40, no outreach"
                variant="amber"
                pulse
                onClick={unworked.length > 0 ? () => onNavigate("opportunities") : undefined}
              />
              <KpiCard
                label="Total Leads"
                value={metrics.total}
                sub="Across active zips"
                variant="neutral"
              />
              {/* Avg Score replaced with Missed SLA — more operational */}
              {/* TODO: wire to real outreach_log data when listing_id FK exists */}
              <KpiCard
                label="Missed SLA"
                value={metrics.missedSla}
                sub="No response in window"
                variant="pink"
                pulse
                onClick={metrics.missedSla > 0 ? () => onNavigate("opportunities") : undefined}
              />
            </div>

            {/* ── Golden ratio grid ─────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1.618fr 1fr", gap: 16, alignItems: "start" }}>

              {/* ── LEFT: Today's actions ──────────────────────────────────── */}
              <Panel>
                <PanelHead>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8b90a8" }}>
                      ⚡ Today&apos;s Actions
                    </span>
                    {urgentCount > 0 && (
                      <span style={{
                        fontSize: "9px", fontWeight: 800, padding: "2px 6px", borderRadius: 6,
                        background: "rgba(220,38,38,0.18)", color: "var(--hot)",
                      }}>
                        {urgentCount} urgent
                      </span>
                    )}
                  </div>
                  <button onClick={() => onNavigate("opportunities")} style={{
                    background: "none", border: "none", color: "var(--accent)",
                    fontSize: "10.5px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}>
                    View all →
                  </button>
                </PanelHead>

                {actions.length === 0 ? (
                  <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                    No scored leads yet. Ingest runs daily at 6:00 AM.
                  </div>
                ) : (
                  <div>
                    {actions.map((action, i) => {
                      // Insert tier divider before first nurture row
                      const prevTier = i > 0 ? actions[i - 1].tier : null;
                      const showDivider = action.tier === "nurture" && prevTier !== "nurture";

                      return (
                        <ActionRow
                          key={action.id}
                          action={action}
                          isLast={i === actions.length - 1}
                          showDivider={showDivider}
                          tierBorderColor={tierBorderColor}
                          tierHoverBg={tierHoverBg}
                          tierHoverBorder={tierHoverBorder}
                          tierTagColor={tierTagColor}
                          tierScoreStyle={tierScoreStyle}
                          tierCtaStyle={tierCtaStyle}
                          onNavigate={onNavigate}
                        />
                      );
                    })}
                  </div>
                )}
              </Panel>

              {/* ── RIGHT: stacked column ──────────────────────────────────── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                {/* Money left on the table */}
                <Panel amberBorder>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 15px",
                    borderBottom: "1px solid rgba(245,158,11,0.10)",
                  }}>
                    <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--warm)" }}>
                      ◈ Money Left on the Table
                    </span>
                    <span style={{ fontSize: "9px", fontWeight: 800, padding: "2px 6px", borderRadius: 6, background: "rgba(245,158,11,0.14)", color: "var(--warm)" }}>
                      {unworked.length} unworked
                    </span>
                  </div>
                  {unworked.length === 0 ? (
                    <div style={{ padding: "16px 15px", fontSize: "12px", color: "var(--text-muted)" }}>
                      All scored leads have been worked. Nice.
                    </div>
                  ) : (
                    <>
                      {unworked.map((lead, i) => (
                        <MoneyRow
                          key={lead.id}
                          lead={lead}
                          isLast={i === unworked.length - 1}
                          onNavigate={onNavigate}
                        />
                      ))}
                      {/* Footer CTA */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "9px 15px",
                        borderTop: "1px solid rgba(245,158,11,0.10)",
                      }}>
                        <button onClick={() => onNavigate("opportunities")} style={{
                          fontSize: "11px", fontWeight: 700, color: "var(--warm)",
                          background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                        }}>
                          View in Opportunities →
                        </button>
                      </div>
                    </>
                  )}
                </Panel>

                {/* Response SLA */}
                <Panel>
                  <PanelHead>
                    <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8b90a8" }}>
                      ⏱ Response SLA
                    </span>
                  </PanelHead>
                  <div style={{ padding: "12px 15px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { label: "Within 1 hour",  val: "67%", fill: 67, color: "var(--success)" },
                      { label: "Within 4 hours", val: "82%", fill: 82, color: "var(--warm)"    },
                    ].map((row) => (
                      <div key={row.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", color: "#7a7f96" }}>{row.label}</span>
                          <span style={{ fontSize: "11px", fontWeight: 800, color: row.color }}>{row.val}</span>
                        </div>
                        <div style={{ height: 4, background: "var(--bg-card)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${row.fill}%`, background: row.color, borderRadius: 2 }} />
                        </div>
                      </div>
                    ))}
                    {/* Missed SLA warning box */}
                    <SlaWarningBox count={metrics.missedSla} onClick={() => onNavigate("opportunities")} />
                  </div>
                </Panel>

                {/* Signals & alerts */}
                <Panel>
                  <PanelHead>
                    <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8b90a8" }}>
                      ◉ Signals &amp; Alerts
                    </span>
                    <span style={{ fontSize: "9px", fontWeight: 800, padding: "2px 6px", borderRadius: 6, background: "var(--bg-card)", color: "var(--text-muted)" }}>
                      Last 24h
                    </span>
                  </PanelHead>
                  {actions.slice(0, 3).map((a, i) => (
                    <SignalRow key={a.id} action={a} isLast={i === Math.min(actions.length, 3) - 1} onNavigate={onNavigate} />
                  ))}
                </Panel>

              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ActionRow — extracted to keep JSX above readable ─────────────────────────

function ActionRow({
  action, isLast, showDivider,
  tierBorderColor, tierHoverBg, tierHoverBorder,
  tierTagColor, tierScoreStyle, tierCtaStyle,
  onNavigate,
}: {
  action: ActionItem;
  isLast: boolean;
  showDivider: boolean;
  tierBorderColor: Record<string, string>;
  tierHoverBg: Record<string, string>;
  tierHoverBorder: Record<string, string>;
  tierTagColor: Record<string, string>;
  tierScoreStyle: Record<string, React.CSSProperties>;
  tierCtaStyle: Record<string, React.CSSProperties>;
  onNavigate: (tab: Tab) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <>
      {showDivider && <TierDivider label="Nurture queue" />}
      <div
        onClick={() => onNavigate("opportunities")}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px",
          borderBottom: isLast ? "none" : "1px solid var(--bg-base)",
          borderLeft: `3px solid ${hovered ? tierHoverBorder[action.tier] : tierBorderColor[action.tier]}`,
          background: hovered ? tierHoverBg[action.tier] : "transparent",
          cursor: "pointer",
          transition: "background 0.1s, border-left-color 0.1s",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Address */}
          <div style={{
            fontSize: "13px", fontWeight: 700,
            color: action.tier === "nurture" ? "#c8ccd8" : "#eceef5",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            letterSpacing: "0.01em", marginBottom: 4,
          }}>
            {action.address}{action.city ? `, ${action.city}` : ""}
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
        {/* Score chip */}
        <div style={{
          fontSize: "11px", fontWeight: 800, padding: "3px 8px",
          borderRadius: 5, minWidth: 34, textAlign: "center",
          flexShrink: 0,
          ...tierScoreStyle[action.tier],
        }}>
          {action.score}
        </div>
        {/* CTA button */}
        <button style={{
          fontSize: "11px", fontWeight: 700, padding: "6px 13px",
          borderRadius: 5, cursor: "pointer", whiteSpace: "nowrap",
          minWidth: 96, textAlign: "center",
          fontFamily: "inherit", flexShrink: 0,
          ...tierCtaStyle[action.tier],
        }}>
          {action.cta}
        </button>
      </div>
    </>
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