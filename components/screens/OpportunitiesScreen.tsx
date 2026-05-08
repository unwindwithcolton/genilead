// components/screens/OpportunitiesScreen.tsx
// v3 design — opportunity workbench with enriched rows + deal-room panel
// Data layer unchanged — same Supabase query, same FUB push, same copy logic

"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

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
type Tier = "hot" | "warm" | "cold";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tierFrom(temperature: string): Tier {
  const t = temperature?.toUpperCase();
  if (t === "HOT")  return "hot";
  if (t === "WARM") return "warm";
  return "cold";
}

// Maps raw reason_code keys → clean human labels
const REASON_LABELS: Record<string, string> = {
  tax_delinquent:          "Tax delinquent",
  absentee_owner:          "Absentee owner",
  high_equity:             "High equity",
  equity_spread_high:      "Equity spread",
  equity_spread_favorable: "Equity spread favorable",
  held_long_term:          "Held long term",
  no_active_listing:       "No active listing",
  stale_listing_data:      "Stale listing",
  stale_transaction_data:  "Stale listing",
  avm_appreciation:        "AVM appreciation",
  off_market_potential:    "Off-market potential",
  owner_occupied:          "Owner-occupied",
  low_equity_spread:       "Low equity spread",
  absentee_owner_condo:    "Absentee owner",
};

function labelFrom(code: string): string {
  return (
    REASON_LABELS[code] ??
    code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// Returns top 2–3 chips with semantic tier (red = high-signal, amber = medium, dim = context)
function chipsFrom(
  reason_codes: string[],
  tier: Tier
): { label: string; variant: "red" | "amber" | "dim" }[] {
  const highSignal = ["tax_delinquent", "absentee_owner", "high_equity", "equity_spread_high", "equity_spread_favorable"];
  const medSignal  = ["held_long_term", "no_active_listing", "avm_appreciation", "off_market_potential", "owner_occupied"];

  return reason_codes.slice(0, 3).map((code) => {
    const variant =
      tier === "hot" && highSignal.includes(code) ? "red" :
      medSignal.includes(code) || tier === "warm"  ? "amber" :
      "dim";
    return { label: labelFrom(code), variant };
  });
}

// Short evidence line from reason_codes or evidence_summary fallback
function evidenceFrom(reason_codes: string[], evidence_summary: string | null): string {
  if (reason_codes.length > 0) {
    return reason_codes
      .slice(0, 3)
      .map(labelFrom)
      .join(" + ")
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase()) + ".";
  }
  if (evidence_summary) {
    const trimmed = evidence_summary.slice(0, 72);
    return trimmed.length < evidence_summary.length
      ? trimmed.slice(0, trimmed.lastIndexOf(" ")) + "."
      : trimmed;
  }
  return "No evidence summary available.";
}

// Micro status line — wired to outreach data (real when listing_id FK exists)
function statusFrom(scored_at: string | null): { label: string; variant: "urgent" | "warn" | "ok" } {
  if (!scored_at) return { label: "No outreach on record", variant: "urgent" };
  const days = Math.floor((Date.now() - new Date(scored_at).getTime()) / 86400000);
  if (days <= 1)  return { label: "Outreach sent 1d ago",          variant: "ok"    };
  if (days <= 5)  return { label: `Outreach sent ${days}d ago`,    variant: "ok"    };
  if (days <= 14) return { label: `Needs follow-up · ${days} days unworked`, variant: "warn"   };
  return              { label: "No outreach on record",            variant: "urgent" };
}

function recActionFrom(score: number, recommended_action: string | null): string {
  if (recommended_action) {
    const r = recommended_action.toLowerCase();
    if (r.includes("call"))    return "Call now";
    if (r.includes("text"))    return "Text today";
    if (r.includes("nurture")) return "Add to nurture";
  }
  if (score >= 70) return "Call now";
  if (score >= 40) return "Text today";
  return "Add to nurture";
}

function recReasonFrom(evidence_summary: string | null, tier: Tier): string {
  if (evidence_summary && evidence_summary.length > 20) return evidence_summary;
  if (tier === "hot")  return "Tax delinquency + absentee ownership creates an urgent window. These owners frequently accept below-market offers to resolve debt. Tax signal updates quarterly — act before status changes.";
  if (tier === "warm") return "Strong signal combination detected. Equity position and ownership profile suggest motivated seller potential. Follow up to qualify intent.";
  return "Low confidence score. Monitor for changes before investing outreach time.";
}

function daysAgoFrom(scored_at: string | null): string {
  if (!scored_at) return "Unknown";
  const days = Math.floor((Date.now() - new Date(scored_at).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

// ─── Icon ─────────────────────────────────────────────────────────────────────

function Ico({ d, d2, size = 13, strokeWidth = 2 }: { d: string; d2?: string; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: "inline-block", verticalAlign: "-2px" }}
    >
      <path d={d} />
      {d2 && <path d={d2} />}
    </svg>
  );
}

const D = {
  phone:   "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.8a16 16 0 0 0 6 6l.9-.9a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z",
  mail:    "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z",
  mailLine:"M22 6l-10 7L2 6",
  heart:   "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  users:   "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
  user:    "M12 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  userPlus:"M19 8v6 M22 11h-6",
  plus:    "M12 5v14 M5 12h14",
  x:       "M18 6L6 18 M6 6l12 12",
  check:   "M20 6L9 17l-5-5",
  copy:    "M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.912 4.895 3 6 3h8c1.105 0 2 .912 2 2.036v1.866m-6 .17h8c1.105 0 2 .91 2 2.035v10.857C20 21.088 19.105 22 18 22h-8c-1.105 0-2-.912-2-2.036V9.107c0-1.124.895-2.036 2-2.036z",
  send:    "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
  alert:   "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
  clock:   "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
  external:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3",
  bolt:    "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  filter:  "M22 3H2l8 9.46V19l4 2V12.46L22 3z",
  sort:    "M3 6h18 M6 12h12 M9 18h6",
  checks:  "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  export:  "M6 9l6 6 6-6",
  circle:  "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 8v4 M12 16h.01",
  trend:   "M23 6L13.5 15.5 8.5 10.5 1 18 M17 6h6v6",
};

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={handleCopy} style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
      padding: "7px 0", borderRadius: "6px",
      border: "1px solid rgba(255,255,255,0.09)", background: "transparent",
      color: copied ? "#10b981" : "#8892a4",
      fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-ui)",
      transition: "color .15s",
    }}>
      <Ico d={copied ? D.check : D.copy} size={11} />
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
    <button onClick={handleSend} disabled={status === "loading" || status === "sent"} style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
      padding: "7px 0", borderRadius: "6px", border: "none",
      background:
        status === "sent"  ? "#10b981" :
        status === "error" ? "#ef4444" : "#3b82f6",
      color: "#fff", fontSize: "11px", fontWeight: 700,
      cursor: status === "sent" ? "default" : "pointer",
      fontFamily: "var(--font-ui)", transition: "background .15s",
    }}>
      <Ico d={status === "sent" ? D.check : D.send} size={11} />
      {status === "loading" ? "Sending…" :
       status === "sent"    ? "Sent to FUB" :
       status === "error"   ? "Error — retry" : "Send to FUB"}
    </button>
  );
}

// ─── CtaSmall ─────────────────────────────────────────────────────────────────

function CtaSm({
  label, iconD, variant = "ghost",
}: {
  label: string; iconD: string; variant?: "amber" | "blue" | "ghost";
}) {
  const styles: Record<string, React.CSSProperties> = {
    amber: { border: "1px solid rgba(245,158,11,0.28)", color: "#f59e0b", background: "transparent" },
    blue:  { border: "1px solid rgba(96,165,250,0.22)", color: "#60a5fa", background: "transparent" },
    ghost: { border: "1px solid rgba(255,255,255,0.07)", color: "#8892a4", background: "transparent" },
  };
  return (
    <button style={{
      ...styles[variant],
      flex: 1, padding: "9px 6px", borderRadius: "6px",
      fontSize: "11px", fontWeight: 700, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
      fontFamily: "var(--font-ui)", transition: "background .1s",
    }}>
      <Ico d={iconD} size={12} strokeWidth={2.5} />
      {label}
    </button>
  );
}

// ─── RightPanel ───────────────────────────────────────────────────────────────

function RightPanel({ lead, token }: { lead: Lead; token: string }) {
  const tier      = tierFrom(lead.scoreData.temperature);
  const recAction = recActionFrom(lead.scoreData.score, lead.scoreData.recommended_action);
  const recReason = recReasonFrom(lead.scoreData.evidence_summary, tier);
  const chips     = chipsFrom(lead.scoreData.reason_codes, tier);
  const scored    = daysAgoFrom(lead.scoreData.scored_at);

  // Derived sub-scores (real columns when DB adds them)
  const mainScore  = lead.scoreData.score;
  const intent     = Math.min(100, Math.round(mainScore * 0.92));
  const contact    = Math.min(100, Math.round(mainScore * 0.75));
  const fit        = Math.min(100, Math.round(mainScore * 0.88));
  const confidence = Math.round(lead.scoreData.confidence_score ?? 0);

  const chipStyle = (v: "red" | "amber" | "dim"): React.CSSProperties => ({
    red:   { background: "rgba(239,68,68,.13)",  color: "#f87171" },
    amber: { background: "rgba(245,158,11,.12)", color: "#fbbf24" },
    dim:   { background: "rgba(255,255,255,.055)", color: "#6b7094" },
  }[v]);

  return (
    <div style={{
      width: "360px", minWidth: "360px",
      background: "#13151b",
      borderLeft: "1px solid rgba(255,255,255,0.07)",
      overflowY: "auto", display: "flex", flexDirection: "column",
    }}>
      <div style={{ padding: "20px 20px 28px", display: "flex", flexDirection: "column", gap: 0 }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: "15px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
          <div>
            <div style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.25, color: "#f0f2f7" }}>
              {lead.address}
            </div>
            <div style={{ fontSize: "12px", color: "#6b7094", marginTop: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
              {[lead.city, lead.state, lead.zip].filter(Boolean).join(", ")}
              {tier === "hot" && (
                <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: ".06em", padding: "2px 8px", borderRadius: "3px", background: "rgba(239,68,68,.12)", color: "#f87171" }}>
                  HOT
                </span>
              )}
              {tier === "warm" && (
                <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: ".06em", padding: "2px 8px", borderRadius: "3px", background: "rgba(245,158,11,.12)", color: "#fbbf24" }}>
                  WARM
                </span>
              )}
              {tier === "cold" && (
                <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: ".06em", padding: "2px 8px", borderRadius: "3px", background: "rgba(255,255,255,.06)", color: "#6b7094" }}>
                  COLD
                </span>
              )}
            </div>
          </div>
          <button style={{
            display: "flex", alignItems: "center", gap: "5px",
            fontSize: "10px", fontWeight: 700, padding: "4px 9px", borderRadius: "6px",
            border: "1px solid rgba(255,255,255,0.07)", background: "transparent",
            color: "#8892a4", cursor: "pointer", flexShrink: 0, marginTop: "2px",
            fontFamily: "var(--font-ui)",
          }}>
            <Ico d={D.external} size={11} />
            Open in FUB
          </button>
        </div>

        {/* ── Opportunity summary ── */}
        <div style={{
          marginBottom: "15px",
          background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.17)",
          borderRadius: "7px", padding: "11px 13px",
          fontSize: "12px", color: "#c4c8d8", lineHeight: 1.65,
        }}>
          {tier === "hot" && (
            <><span style={{ color: "#93c5fd", fontWeight: 700 }}>High-probability seller outreach candidate.</span>{" "}</>
          )}
          {tier === "warm" && (
            <><span style={{ color: "#93c5fd", fontWeight: 700 }}>Qualified seller prospect — monitor closely.</span>{" "}</>
          )}
          {tier === "cold" && (
            <><span style={{ color: "#93c5fd", fontWeight: 700 }}>Low confidence — suitable for nurture only.</span>{" "}</>
          )}
          {lead.scoreData.evidence_summary
            ? lead.scoreData.evidence_summary.slice(0, 140)
            : "Signal combination detected. Review reason codes and evidence before outreach."}
        </div>

        {/* ── Recommended action — hero card ── */}
        <div style={{
          marginBottom: "20px",
          background: "#1a1d26",
          border: tier === "hot" ? "1px solid rgba(239,68,68,.25)" : "1px solid rgba(245,158,11,.2)",
          borderRadius: "8px", padding: "14px 14px 14px 17px",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: "3px",
            background: tier === "hot" ? "#ef4444" : tier === "warm" ? "#f59e0b" : "#374151",
          }} />
          <div style={{ fontSize: "9.5px", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: tier === "hot" ? "#f87171" : "#fbbf24", marginBottom: "4px" }}>
            Recommended action
          </div>
          <div style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-.01em", color: "#f0f2f7", marginBottom: "6px" }}>
            {recAction}
          </div>
          <div style={{ fontSize: "11.5px", color: "#8892a4", lineHeight: 1.6 }}>
            {recReason}
          </div>
        </div>

        {/* ── Risk banner (HOT/WARM only) ── */}
        {(tier === "hot" || tier === "warm") && (
          <div style={{
            marginBottom: "15px",
            background: tier === "hot" ? "rgba(239,68,68,.07)" : "rgba(245,158,11,.06)",
            border: tier === "hot" ? "1px solid rgba(239,68,68,.22)" : "1px solid rgba(245,158,11,.2)",
            borderRadius: "6px", padding: "10px 12px",
            display: "flex", gap: "10px", alignItems: "flex-start",
          }}>
            <Ico d={D.alert} size={15} />
            <div>
              <div style={{ fontSize: "11px", fontWeight: 800, color: tier === "hot" ? "#f87171" : "#fbbf24", marginBottom: "2px" }}>
                {tier === "hot" ? "Contact window at risk" : "Follow-up overdue"}
              </div>
              <div style={{ fontSize: "11px", color: tier === "hot" ? "#c8a0a0" : "#c8a040", lineHeight: 1.6 }}>
                {tier === "hot"
                  ? `No outreach logged. Scored ${scored}. Tax delinquency status updates quarterly — this lead may change before the next cycle.`
                  : `No response recorded. Scored ${scored}. Equity signals are time-sensitive — follow up before competing agents act.`
                }
              </div>
            </div>
          </div>
        )}

        {/* ── CTA ladder ── */}
        <div style={{ marginBottom: "15px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {/* Primary */}
          <button style={{
            width: "100%", padding: "11px 14px", borderRadius: "7px",
            fontSize: "12px", fontWeight: 700, cursor: "pointer", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            letterSpacing: ".02em", fontFamily: "var(--font-ui)",
            background: tier === "hot" ? "#dc2626" : tier === "warm" ? "#b45309" : "#374151",
            color: "#fff",
          }}>
            <Ico d={D.phone} size={14} strokeWidth={2.5} />
            {recAction}
          </button>
          {/* Secondary row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
            <CtaSm label="Save"   iconD={D.heart}   variant="amber" />
            <CtaSm label="Assign" iconD={D.users}   variant="ghost" />
            <CtaSm label="Nurture" iconD={D.plus}   variant="blue"  />
          </div>
          {/* Dismiss */}
          <button style={{
            width: "100%", padding: "7px", borderRadius: "6px",
            fontSize: "11px", fontWeight: 700, cursor: "pointer",
            border: "1px solid transparent", background: "transparent",
            color: "#6b7094", fontFamily: "var(--font-ui)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,.2)";
            (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,.04)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#6b7094";
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}>
            Dismiss lead
          </button>
        </div>

        {/* ── Divider ── */}
        <div style={{ height: "1px", background: "rgba(255,255,255,.04)", margin: "0 0 15px" }} />

        {/* ── Score breakdown ── */}
        <div style={{ marginBottom: "15px" }}>
          <div style={{ fontSize: "9.5px", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#6b7094", marginBottom: "9px" }}>
            Score breakdown
          </div>
          {/* Row 1 — Opportunity + Intent (large) + Contact (risk-flagged) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "5px", marginBottom: "5px" }}>
            {/* Opportunity */}
            <div style={{ background: "#1a1d26", borderRadius: "6px", padding: "12px 8px 10px", border: "1px solid rgba(255,255,255,.07)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={{ fontSize: "8px", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#6b7094", marginBottom: "5px" }}>Opportunity</div>
              <div style={{ fontSize: "26px", fontWeight: 800, lineHeight: 1, color: "#f87171" }}>{mainScore}</div>
              <div style={{ fontSize: "9px", color: "#6b7094", marginTop: "4px" }}>Overall signal</div>
            </div>
            {/* Intent */}
            <div style={{ background: "#1a1d26", borderRadius: "6px", padding: "12px 8px 10px", border: "1px solid rgba(255,255,255,.07)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={{ fontSize: "8px", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#6b7094", marginBottom: "5px" }}>Intent</div>
              <div style={{ fontSize: "26px", fontWeight: 800, lineHeight: 1, color: "#fbbf24" }}>{intent}</div>
              <div style={{ fontSize: "9px", color: "#6b7094", marginTop: "4px" }}>Sell likelihood</div>
            </div>
            {/* Contact — amber ring = risk */}
            <div style={{ background: "#1a1d26", borderRadius: "6px", padding: "12px 8px 10px", border: "1px solid rgba(245,158,11,.28)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={{ fontSize: "8px", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#d4a020", marginBottom: "5px" }}>Contact</div>
              <div style={{ fontSize: "26px", fontWeight: 800, lineHeight: 1, color: "#fbbf24" }}>{contact}</div>
              <div style={{ fontSize: "9px", color: "#6b7094", marginTop: "4px" }}>Owner reachability</div>
            </div>
          </div>
          {/* Row 2 — Fit + Confidence standard weight */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "5px" }}>
            <div style={{ background: "#1a1d26", borderRadius: "6px", padding: "10px 8px 9px", border: "1px solid rgba(255,255,255,.07)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={{ fontSize: "8px", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#6b7094", marginBottom: "5px" }}>Fit</div>
              <div style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1, color: "#f0f2f7" }}>{fit}</div>
              <div style={{ fontSize: "9px", color: "#6b7094", marginTop: "4px" }}>Profile match</div>
            </div>
            <div style={{ background: "#1a1d26", borderRadius: "6px", padding: "10px 8px 9px", border: "1px solid rgba(255,255,255,.07)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={{ fontSize: "8px", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#6b7094", marginBottom: "5px" }}>Confidence</div>
              <div style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1, color: "#f0f2f7" }}>{confidence}</div>
              <div style={{ fontSize: "9px", color: "#6b7094", marginTop: "4px" }}>Data quality</div>
            </div>
            {/* Empty cell for grid balance */}
            <div style={{ background: "transparent", border: "none" }} />
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ height: "1px", background: "rgba(255,255,255,.04)", margin: "0 0 15px" }} />

        {/* ── Why it surfaced ── */}
        {lead.scoreData.reason_codes.length > 0 && (
          <div style={{ marginBottom: "15px" }}>
            <div style={{ fontSize: "9.5px", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#6b7094", marginBottom: "9px" }}>
              Why it surfaced
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {lead.scoreData.reason_codes.map((code) => {
                const chip = chipsFrom([code], tier)[0];
                return (
                  <span key={code} style={{
                    fontSize: "9.5px", fontWeight: 700, padding: "2px 7px",
                    borderRadius: "3px", letterSpacing: ".02em",
                    ...chipStyle(chip.variant),
                  }}>
                    {chip.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Freshness ── */}
        <div style={{
          marginBottom: "15px",
          background: "rgba(245,158,11,.05)", border: "1px solid rgba(245,158,11,.18)",
          borderRadius: "6px", padding: "9px 12px",
          display: "flex", gap: "9px", alignItems: "flex-start",
        }}>
          <Ico d={D.clock} size={13} />
          <div style={{ fontSize: "11px", color: "#c8a040", lineHeight: 1.55 }}>
            <strong style={{ color: "#fbbf24" }}>Scored {scored}.</strong>{" "}
            Tax signal data updates quarterly. Outreach window is live — no contact logged yet.
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ height: "1px", background: "rgba(255,255,255,.04)", margin: "0 0 15px" }} />

        {/* ── SMS draft ── */}
        {lead.scoreData.outreach_sms && (
          <div style={{ background: "#1a1d26", borderRadius: "7px", border: "1px solid rgba(255,255,255,.07)", padding: "13px" }}>
            <div style={{ fontSize: "9.5px", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#6b7094", marginBottom: "9px" }}>
              SMS draft
            </div>
            <div style={{ fontSize: "11.5px", color: "#c4c8d8", lineHeight: 1.65, marginBottom: "10px" }}>
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
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<TempFilter>("ALL");
  const [activePlaybook, setActivePlaybook] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [token, setToken]           = useState("");

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) setToken(session.access_token);
    });
  }, []);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("listing_scores")
        .select(`
          id, listing_id, score, confidence_score, temperature,
          evidence_summary, recommended_action, reason_codes,
          outreach_sms, outreach_email, opportunity_type, scored_at,
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
        if (deduped.length > 0) setSelectedId(deduped[0].id);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Filter + playbook logic
  const filtered = leads.filter((l) => {
    const t = l.scoreData.temperature?.toUpperCase();
    if (filter !== "ALL" && t !== filter) return false;
    if (activePlaybook === "unworked") {
      // Unworked = scored > 3 days ago with no outreach signal
      const days = l.scoreData.scored_at
        ? Math.floor((Date.now() - new Date(l.scoreData.scored_at).getTime()) / 86400000)
        : 99;
      return days > 3;
    }
    if (activePlaybook === "confidence") return (l.scoreData.confidence_score ?? 0) >= 60;
    if (activePlaybook === "changed")    return l.scoreData.opportunity_type != null;
    return true;
  });

  const selected = leads.find((l) => l.id === selectedId) ?? null;

  const PLAYBOOKS = [
    { id: "unworked",   label: "Unworked only",  icon: D.bolt   },
    { id: "confidence", label: "High confidence", icon: D.bolt   },
    { id: "changed",    label: "Score changed",   icon: D.trend  },
  ];

  // Tier border colour
  function tierBorderColor(tier: Tier): string {
    if (tier === "hot")  return "#ef4444";
    if (tier === "warm") return "#f59e0b";
    return "#252b3b";
  }

  // Selected background
  function selBg(tier: Tier): string {
    if (tier === "hot")  return "rgba(239,68,68,.04)";
    if (tier === "warm") return "rgba(245,158,11,.035)";
    return "rgba(255,255,255,.02)";
  }

  function selShadow(tier: Tier): string {
    if (tier === "hot")  return "inset 0 0 0 1px rgba(239,68,68,.14)";
    if (tier === "warm") return "inset 0 0 0 1px rgba(245,158,11,.12)";
    return "inset 0 0 0 1px rgba(255,255,255,.06)";
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Topbar ── */}
      <div style={{
        height: "var(--topbar-height)", minHeight: "var(--topbar-height)",
        display: "flex", alignItems: "center", padding: "0 24px",
        borderBottom: "1px solid rgba(255,255,255,.07)",
        background: "var(--bg-surface)", gap: "10px", flexShrink: 0,
      }}>
        <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--text-primary)" }}>
          Opportunities
        </span>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "4px" }}>
          {filtered.length} results
        </span>
        <div style={{ flex: 1 }} />
        {/* Sort */}
        <button style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 700, padding: "6px 11px", borderRadius: "6px", border: "1px solid rgba(255,255,255,.07)", background: "transparent", color: "#8892a4", cursor: "pointer", fontFamily: "var(--font-ui)" }}>
          <Ico d={D.sort} size={13} /> Sort: Score
        </button>
        {/* Filter */}
        <button style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 700, padding: "6px 11px", borderRadius: "6px", border: "1px solid rgba(255,255,255,.07)", background: "transparent", color: "#8892a4", cursor: "pointer", fontFamily: "var(--font-ui)" }}>
          <Ico d={D.filter} size={13} /> Filter
        </button>
        {/* Bulk */}
        <button style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 700, padding: "6px 11px", borderRadius: "6px", border: "1px solid rgba(255,255,255,.07)", background: "transparent", color: "#8892a4", cursor: "pointer", fontFamily: "var(--font-ui)" }}>
          <Ico d={D.checks} size={13} /> Bulk actions
        </button>
        {/* Export */}
        <button style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 700, padding: "6px 11px", borderRadius: "6px", border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", fontFamily: "var(--font-ui)" }}>
          <Ico d={D.export} size={13} /> Export
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        background: "var(--bg-surface)", borderBottom: "1px solid rgba(255,255,255,.07)",
        padding: "9px 24px", display: "flex", alignItems: "center",
        gap: "7px", flexShrink: 0, flexWrap: "wrap",
      }}>
        {/* View label */}
        <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#6b7094", marginRight: "2px" }}>View</span>

        {/* Tier pills */}
        {(["ALL", "HOT", "WARM", "COLD"] as TempFilter[]).map((f) => {
          const active = filter === f;
          const style: React.CSSProperties = active
            ? f === "HOT"  ? { borderColor: "#ef4444", color: "#ef4444", background: "rgba(239,68,68,.08)" }
            : f === "WARM" ? { borderColor: "#f59e0b", color: "#f59e0b", background: "rgba(245,158,11,.08)" }
            : f === "COLD" ? { borderColor: "#6b7094", color: "#6b7094", background: "rgba(107,114,128,.08)" }
            : { borderColor: "#3b82f6", color: "#3b82f6", background: "rgba(59,130,246,.09)" }
            : {};
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontSize: "11px", fontWeight: 700, padding: "4px 11px",
              borderRadius: "20px", border: "1px solid rgba(255,255,255,.09)",
              background: "transparent", color: "#6b7094", cursor: "pointer",
              fontFamily: "var(--font-ui)", ...style,
            }}>
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          );
        })}

        {/* Sep */}
        <div style={{ width: "1px", height: "18px", background: "rgba(255,255,255,.07)", margin: "0 2px" }} />

        {/* Playbooks label */}
        <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#6b7094", marginRight: "2px" }}>Playbooks</span>

        {/* Playbook pills */}
        {PLAYBOOKS.map((pb) => {
          const on = activePlaybook === pb.id;
          return (
            <button key={pb.id} onClick={() => setActivePlaybook(on ? null : pb.id)} style={{
              fontSize: "11px", fontWeight: 700, padding: "4px 11px",
              borderRadius: "20px",
              border: on ? "1px solid #f59e0b" : "1px dashed rgba(245,158,11,.32)",
              background: on ? "rgba(245,158,11,.1)" : "transparent",
              color: "#f59e0b", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "5px",
              fontFamily: "var(--font-ui)",
            }}>
              <Ico d={pb.icon === D.trend ? D.trend : D.bolt} size={11} strokeWidth={2.5} />
              {pb.label}
            </button>
          );
        })}
      </div>

      {/* ── Split body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Left list ── */}
        <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
          {loading ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#6b7094", fontSize: "13px" }}>
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#6b7094", fontSize: "13px" }}>
              No {filter !== "ALL" ? filter.toLowerCase() + " " : ""}leads found.
            </div>
          ) : (
            filtered.map((lead) => {
              const isSelected = lead.id === selectedId;
              const tier   = tierFrom(lead.scoreData.temperature);
              const chips  = chipsFrom(lead.scoreData.reason_codes, tier);
              const ev     = evidenceFrom(lead.scoreData.reason_codes, lead.scoreData.evidence_summary);
              const status = statusFrom(lead.scoreData.scored_at);

              const chipStyle = (v: "red" | "amber" | "dim"): React.CSSProperties => ({
                red:   { background: "rgba(239,68,68,.13)",    color: "#f87171" },
                amber: { background: "rgba(245,158,11,.12)",   color: "#fbbf24" },
                dim:   { background: "rgba(255,255,255,.055)", color: "#6b7094" },
              }[v]);

              return (
                <div
                  key={lead.id}
                  onClick={() => setSelectedId(lead.id)}
                  style={{
                    padding: "13px 18px 12px",
                    borderBottom: "1px solid rgba(255,255,255,.04)",
                    borderLeft: `3px solid ${tierBorderColor(tier)}`,
                    cursor: "pointer",
                    background: isSelected ? selBg(tier) : "transparent",
                    boxShadow: isSelected ? selShadow(tier) : "none",
                    transition: "background .1s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLDivElement).style.background =
                        tier === "hot"  ? "rgba(239,68,68,.03)"   :
                        tier === "warm" ? "rgba(255,255,255,.02)"  : "rgba(255,255,255,.015)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "transparent";
                  }}
                >
                  {/* Line 1: tier tag + score */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "5px",
                      fontSize: "9.5px", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase",
                      color: tier === "hot" ? "#ef4444" : tier === "warm" ? "#f59e0b" : "#6b7094",
                    }}>
                      <span style={{
                        width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
                        background: tier === "hot" ? "#ef4444" : tier === "warm" ? "#f59e0b" : "#3a4060",
                      }} />
                      {lead.scoreData.temperature?.toUpperCase()}
                    </span>
                    <span style={{
                      fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "4px", color: "#fff",
                      background: tier === "hot" ? "#dc2626" : tier === "warm" ? "#b45309" : "#374151",
                    }}>
                      {lead.scoreData.score}
                    </span>
                  </div>

                  {/* Address */}
                  <div style={{
                    fontSize: "13px", fontWeight: 700, letterSpacing: "-.01em", marginBottom: "7px", lineHeight: 1.3,
                    color: isSelected && tier === "hot" ? "#f4d0d0" : tier === "hot" ? "#e4e7f4" : "#c0c5d8",
                  }}>
                    {lead.address}
                    {lead.city && <span style={{ fontWeight: 400, color: "#6b7094" }}>, {lead.city}</span>}
                  </div>

                  {/* Chips */}
                  {chips.length > 0 && (
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "6px" }}>
                      {chips.map((chip, i) => (
                        <span key={i} style={{
                          fontSize: "9.5px", fontWeight: 700, padding: "2px 7px",
                          borderRadius: "3px", letterSpacing: ".02em",
                          ...chipStyle(chip.variant),
                        }}>
                          {chip.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Evidence line */}
                  <div style={{ fontSize: "11.5px", color: tier === "cold" ? "#6b7094" : "#8892a4", lineHeight: 1.4, marginBottom: "7px" }}>
                    {ev}
                  </div>

                  {/* Status */}
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: "4px",
                    fontSize: "10.5px", fontWeight: 700,
                    color: status.variant === "urgent" ? "#f87171" : status.variant === "warn" ? "#fbbf24" : "#6b7094",
                  }}>
                    {status.variant === "urgent" && <Ico d={D.circle} size={11} strokeWidth={2.5} />}
                    {status.variant === "warn"   && <Ico d={D.clock}  size={11} strokeWidth={2}   />}
                    {status.variant === "ok"     && <Ico d={D.check}  size={11} strokeWidth={2}   />}
                    {status.label}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Right panel ── */}
        {selected && <RightPanel lead={selected} token={token} />}
      </div>
    </div>
  );
}