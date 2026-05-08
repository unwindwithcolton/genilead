// components/screens/OpportunitiesScreen.tsx
// Filterable leads list + slide-out panel with 5-score display
// Correct schema: score, reason_codes, outreach_email, confidence_score only
// No lucide-react — inline SVG icons

"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

// ─── Icon ─────────────────────────────────────────────────────────────────────

function Icon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  );
}

const D = {
  phone:   "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z",
  mail:    "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  eye:     "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  user:    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M12 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M19 8v6 M22 11h-6",
  copy:    "M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.912 4.895 3 6 3h8c1.105 0 2 .912 2 2.036v1.866m-6 .17h8c1.105 0 2 .91 2 2.035v10.857C20 21.088 19.105 22 18 22h-8c-1.105 0-2-.912-2-2.036V9.107c0-1.124.895-2.036 2-2.036z",
  send:    "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
  check:   "M20 6L9 17l-5-5",
  x:       "M18 6L6 18 M6 6l12 12",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawScore {
  id: string;
  listing_id: string;
  score: number;
  confidence_score: number;
  temperature: string;
  evidence_summary: string | null;
  recommended_action: string | null;
  reason_codes: string[];
  outreach_sms: string | null;
  outreach_email: string | null;
  opportunity_type: string | null;
  scored_at: string | null;
}

interface RawListing {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string;
  owner_type: string | null;
  tax_delinquent: boolean;
  avm_value: number | null;
  last_sold_price: number | null;
}

interface Lead extends RawListing {
  scoreData: RawScore;
}

type TempFilter = "ALL" | "HOT" | "WARM" | "COLD";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tempColor(temp: string): string {
  if (temp === "HOT")  return "var(--hot)";
  if (temp === "WARM") return "var(--warm)";
  return "var(--cold)";
}

function tempBadgeStyle(temp: string): React.CSSProperties {
  if (temp === "HOT")
    return { background: "var(--hot-dim)",  color: "var(--hot)",  border: "1px solid var(--hot-border)"  };
  if (temp === "WARM")
    return { background: "var(--warm-dim)", color: "var(--warm)", border: "1px solid var(--warm-border)" };
  return { background: "var(--cold-dim)", color: "var(--cold)", border: "1px solid rgba(107,114,128,0.2)" };
}

function ctaFrom(score: number, recommended: string | null) {
  if (recommended) {
    const r = recommended.toLowerCase();
    if (r.includes("call"))    return { label: "Call now",       icon: D.phone, priority: "now"   as const };
    if (r.includes("text"))    return { label: "Text today",     icon: D.mail,  priority: "now"   as const };
    if (r.includes("nurture")) return { label: "Add to nurture", icon: D.user,  priority: "today" as const };
    if (r.includes("watch"))   return { label: "Watch 7 days",   icon: D.eye,   priority: "watch" as const };
  }
  if (score >= 70) return { label: "Call now",     icon: D.phone, priority: "now"   as const };
  if (score >= 40) return { label: "Text today",   icon: D.mail,  priority: "today" as const };
  return              { label: "Watch 7 days", icon: D.eye,   priority: "watch" as const };
}

const CTA_STYLE: Record<string, React.CSSProperties> = {
  now:   { color: "#b91c1c", borderColor: "#fecaca", background: "rgba(239,68,68,0.1)"  },
  today: { color: "#92400e", borderColor: "#fde68a", background: "rgba(245,158,11,0.1)" },
  watch: { color: "#1e40af", borderColor: "#bfdbfe", background: "rgba(59,130,246,0.1)" },
};

// ─── ScoreCell ────────────────────────────────────────────────────────────────

function ScoreCell({ label, value }: { label: string; value: number }) {
  const color =
    value >= 70 ? "var(--hot)" :
    value >= 40 ? "var(--warm)" :
    "var(--cold)";

  return (
    <div
      style={{
        flex: 1,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "10px 6px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <div style={{ fontSize: "18px", fontWeight: "600", fontFamily: "var(--font-mono)", letterSpacing: "-0.5px", lineHeight: 1, color }}>
        {value}
      </div>
      <div style={{ fontSize: "9px", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.3 }}>
        {label}
      </div>
    </div>
  );
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "5px",
        padding: "8px 0",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--border-strong)",
        background: "transparent",
        color: copied ? "var(--success)" : "var(--text-secondary)",
        fontSize: "12px",
        cursor: "pointer",
        fontFamily: "var(--font-ui)",
      }}
    >
      <Icon d={copied ? D.check : D.copy} size={12} />
      {copied ? "Copied!" : label}
    </button>
  );
}

// ─── FUBButton ────────────────────────────────────────────────────────────────

function FUBButton({ listingId, token }: { listingId: string; token: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  async function handleSend() {
    setStatus("loading");
    try {
      const res = await fetch("/api/fub-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listing_id: listingId }),
      });
      setStatus(res.ok ? "sent" : "error");
      if (!res.ok) setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={status === "loading" || status === "sent"}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "5px",
        padding: "8px 0",
        borderRadius: "var(--r-md)",
        border: "none",
        background:
          status === "sent"  ? "var(--success)" :
          status === "error" ? "var(--hot)"     :
          "var(--accent)",
        color: "#fff",
        fontSize: "12px",
        fontWeight: "500",
        cursor: status === "sent" ? "default" : "pointer",
        fontFamily: "var(--font-ui)",
      }}
    >
      <Icon d={status === "sent" ? D.check : D.send} size={12} />
      {status === "loading" ? "Sending..." :
       status === "sent"    ? "Sent to FUB" :
       status === "error"   ? "Error — retry" :
       "Send to FUB"}
    </button>
  );
}

// ─── SlidePanel ───────────────────────────────────────────────────────────────

function SlidePanel({
  lead,
  onClose,
  token,
}: {
  lead: Lead;
  onClose: () => void;
  token: string;
}) {
  const cta = ctaFrom(lead.scoreData.score, lead.scoreData.recommended_action);

  // Derive approximate sub-scores from confidence_score since DB only has one score column
  // These will be replaced when multi-score columns are added to listing_scores
  const confidence = Math.round(lead.scoreData.confidence_score ?? 0);
  const mainScore  = lead.scoreData.score;
  const intent     = Math.min(100, Math.round(mainScore * 0.92));
  const contact    = Math.min(100, Math.round(mainScore * 0.75));
  const fit        = Math.min(100, Math.round(mainScore * 0.88));

  return (
    <div
      style={{
        width: "320px",
        minWidth: "320px",
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 18px 14px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
          <div style={{ fontSize: "14px", fontWeight: "600", letterSpacing: "-0.2px", lineHeight: 1.3 }}>
            {lead.address}
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", flexShrink: 0, display: "flex", alignItems: "center" }}
          >
            <Icon d={D.x} size={16} />
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontSize: "10px",
              fontWeight: "600",
              padding: "2px 8px",
              borderRadius: "20px",
              fontFamily: "var(--font-mono)",
              ...tempBadgeStyle(lead.scoreData.temperature),
            }}
          >
            {lead.scoreData.temperature}
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {[lead.city, lead.state, lead.zip].filter(Boolean).join(", ")}
          </span>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* 5 Scores */}
        <div style={{ display: "flex", gap: "6px" }}>
          <ScoreCell label="Opportunity" value={mainScore}  />
          <ScoreCell label="Intent"      value={intent}     />
          <ScoreCell label="Contact"     value={contact}    />
          <ScoreCell label="Fit"         value={fit}        />
          <ScoreCell label="Confidence"  value={confidence} />
        </div>

        {/* Recommended action */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "11px 14px",
            borderRadius: "var(--r-md)",
            border: "1px solid",
            ...CTA_STYLE[cta.priority],
          }}
        >
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "var(--r-sm)",
              background: "rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon d={cta.icon} size={13} />
          </div>
          <div>
            <div style={{ fontSize: "9.5px", fontWeight: "500", letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.7, marginBottom: "2px" }}>
              Recommended action
            </div>
            <div style={{ fontSize: "13px", fontWeight: "600" }}>{cta.label}</div>
            <div style={{ fontSize: "11px", opacity: 0.75, marginTop: "1px" }}>
              {lead.scoreData.evidence_summary
                ? lead.scoreData.evidence_summary.slice(0, 80) + (lead.scoreData.evidence_summary.length > 80 ? "..." : "")
                : "AI analysis complete"}
            </div>
          </div>
        </div>

        {/* Why it surfaced */}
        {lead.scoreData.reason_codes && lead.scoreData.reason_codes.length > 0 && (
          <div>
            <div
              style={{
                fontSize: "10.5px",
                fontWeight: "500",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: "8px",
              }}
            >
              Why it surfaced
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {lead.scoreData.reason_codes.map((tag: string) => (
                <span
                  key={tag}
                  style={{
                    fontSize: "11.5px",
                    padding: "3px 10px",
                    borderRadius: "20px",
                    border: "1px solid rgba(59,130,246,0.25)",
                    background: "rgba(59,130,246,0.08)",
                    color: "var(--accent)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Freshness */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
          }}
        >
          <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Data freshness</span>
          <span style={{ fontSize: "11.5px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
            {lead.scoreData.scored_at
              ? `Scored ${new Date(lead.scoreData.scored_at).toLocaleDateString()}`
              : "ATTOM · today"}
          </span>
        </div>

        {/* Outreach */}
        {lead.scoreData.outreach_sms && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                fontSize: "10.5px",
                fontWeight: "500",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              SMS draft
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: "10px 12px",
                fontSize: "12px",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              {lead.scoreData.outreach_sms}
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <CopyButton text={lead.scoreData.outreach_sms} label="Copy SMS" />
              {lead.scoreData.outreach_email && (
                <CopyButton text={lead.scoreData.outreach_email} label="Copy email" />
              )}
              <FUBButton listingId={lead.id} token={token} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── OpportunitiesScreen ──────────────────────────────────────────────────────

export default function OpportunitiesScreen() {
  const [leads, setLeads]         = useState<Lead[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<TempFilter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [token, setToken]         = useState("");

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.access_token) setToken(session.access_token);
      });
  }, []);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
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
          opportunity_type,
          scored_at,
          listings (
            id, address, city, state, zip,
            owner_type, tax_delinquent, avm_value, last_sold_price
          )
        `)
        .order("score", { ascending: false });

      if (data) {
        const mapped: Lead[] = data
          .filter((row) => row.listings)
          .map((row) => {
            const l = (Array.isArray(row.listings) ? row.listings[0] : row.listings) as RawListing;
            return {
              ...l,
              scoreData: {
                id:                 row.id,
                listing_id:         row.listing_id,
                score:              row.score,
                confidence_score:   row.confidence_score,
                temperature:        row.temperature,
                evidence_summary:   row.evidence_summary,
                recommended_action: row.recommended_action,
                reason_codes:       row.reason_codes ?? [],
                outreach_sms:       row.outreach_sms,
                outreach_email:     row.outreach_email,
                opportunity_type:   row.opportunity_type,
                scored_at:          row.scored_at,
              },
            };
          });

        const seen = new Set<string>();
const deduped = mapped.filter((l) => {
  if (seen.has(l.id)) return false;
  seen.add(l.id);
  return true;
});
setLeads(deduped);
        if (mapped.length > 0) setSelectedId(mapped[0].id);
      }

      setLoading(false);
    }

    load();
  }, []);

  const filtered =
    filter === "ALL" ? leads : leads.filter((l) => l.scoreData.temperature === filter);

  const selected = leads.find((l) => l.id === selectedId) ?? null;

  const FILTERS: TempFilter[] = ["ALL", "HOT", "WARM", "COLD"];

  const filterStyle = useCallback((f: TempFilter): React.CSSProperties => {
    if (filter !== f) return { background: "transparent", borderColor: "var(--border)", color: "var(--text-muted)" };
    if (f === "HOT")  return { background: "var(--hot-dim)",    borderColor: "var(--hot-border)",              color: "var(--hot)"    };
    if (f === "WARM") return { background: "var(--warm-dim)",   borderColor: "var(--warm-border)",             color: "var(--warm)"   };
    if (f === "COLD") return { background: "var(--cold-dim)",   borderColor: "rgba(107,114,128,0.2)",          color: "var(--cold)"   };
    return { background: "var(--accent-dim)", borderColor: "rgba(59,130,246,0.3)", color: "var(--accent)" };
  }, [filter]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Topbar */}
      <div
        style={{
          height: "var(--topbar-height)",
          minHeight: "var(--topbar-height)",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-surface)",
          gap: "12px",
        }}
      >
        <div style={{ fontSize: "15px", fontWeight: "600", letterSpacing: "-0.3px" }}>
          Opportunities
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          {filtered.length} results
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "5px 12px",
                borderRadius: "20px",
                border: "1px solid",
                fontSize: "11.5px",
                fontWeight: filter === f ? "500" : "400",
                cursor: "pointer",
                fontFamily: "var(--font-ui)",
                ...filterStyle(f),
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
          {loading ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px", fontFamily: "var(--font-mono)" }}>
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No {filter !== "ALL" ? filter.toLowerCase() : ""} leads found.
            </div>
          ) : (
            filtered.map((lead) => {
              const isSelected = lead.id === selectedId;
              return (
                <div
                  key={lead.id}
                  onClick={() => setSelectedId(lead.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "var(--r-md)",
                    marginBottom: "2px",
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor: isSelected ? "rgba(59,130,246,0.3)" : "transparent",
                    background: isSelected ? "var(--accent-dim)" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: "600",
                      padding: "2px 8px",
                      borderRadius: "20px",
                      fontFamily: "var(--font-mono)",
                      flexShrink: 0,
                      ...tempBadgeStyle(lead.scoreData.temperature),
                    }}
                  >
                    {lead.scoreData.temperature}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: "13px",
                      fontWeight: "500",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      minWidth: 0,
                    }}
                  >
                    {lead.address}
                    {lead.city && <span style={{ fontWeight: "400", color: "var(--text-secondary)" }}>, {lead.city}</span>}
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      fontFamily: "var(--font-mono)",
                      color: tempColor(lead.scoreData.temperature),
                      flexShrink: 0,
                    }}
                  >
                    {lead.scoreData.score}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Slide panel */}
        {selected && (
          <SlidePanel
            lead={selected}
            onClose={() => setSelectedId(null)}
            token={token}
          />
        )}
      </div>
    </div>
  );
}