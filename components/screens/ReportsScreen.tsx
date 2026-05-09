// components/screens/ReportsScreen.tsx
"use client";

import { useState } from "react";

// ── Static mock data ─────────────────────────────────────────────────────────

const THREADS = [
  { id: "marcus",  name: "Marcus Webb",    address: "412 Birchwood Dr",  channel: "SMS",   status: "replied",   respWindow: "18 min",  respFast: true,  tier: "HOT",  score: 91, ts: "2h ago",    insight: { text: "⚡ Replied in 18 min — strong buying signal", kind: "good" } },
  { id: "denise",  name: "Denise Alvarez", address: "88 Maple Terrace",  channel: "Email", status: "sent",      respWindow: null,      respFast: false, tier: "HOT",  score: 87, ts: "4h ago",    insight: { text: "HOT lead — no reply after 4h, follow up now", kind: "warn" } },
  { id: "raymond", name: "Raymond Cole",   address: "1901 Lakeview Ave", channel: "SMS",   status: "replied",   respWindow: "2h 14m",  respFast: true,  tier: "WARM", score: 74, ts: "6h ago",    insight: { text: "⚡ Replied in 2h 14m", kind: "good" } },
  { id: "priya",   name: "Priya Nair",     address: "309 Elm St",        channel: "Call",  status: "no-reply",  respWindow: null,      respFast: false, tier: "WARM", score: 68, ts: "Yesterday", insight: { text: "No reply after 18h — try SMS next", kind: "warn" } },
  { id: "tom",     name: "Tom Okafor",     address: "77 Ridgeline Blvd", channel: "Email", status: "bounced",   respWindow: null,      respFast: false, tier: "WARM", score: 65, ts: "Yesterday", insight: { text: "Bounced — update email before next send", kind: "alert" } },
  { id: "sandra",  name: "Sandra Kim",     address: "54 Orchard Loop",   channel: "SMS",   status: "replied",   respWindow: "4h 02m",  respFast: true,  tier: "WARM", score: 61, ts: "2d ago",    insight: { text: "⚡ Replied in 4h 02m", kind: "good" } },
  { id: "james",   name: "James Brauer",   address: "230 Westfield Ct",  channel: "Email", status: "no-reply",  respWindow: null,      respFast: false, tier: "WARM", score: 58, ts: "2d ago",    insight: { text: "No reply after 2d — low urgency", kind: "muted" } },
  { id: "linh",    name: "Linh Tran",      address: "14 Foxrun Circle",  channel: "SMS",   status: "sent",      respWindow: null,      respFast: false, tier: "COLD", score: 42, ts: "3d ago",    insight: null },
  { id: "derek",   name: "Derek Moss",     address: "891 Pinehurst Rd",  channel: "Call",  status: "no-reply",  respWindow: null,      respFast: false, tier: "COLD", score: 38, ts: "3d ago",    insight: null },
  { id: "angela",  name: "Angela Pierce",  address: "602 Sunbrook Dr",   channel: "Email", status: "no-reply",  respWindow: null,      respFast: false, tier: "COLD", score: 31, ts: "4d ago",    insight: null },
];

// ── Style helpers ─────────────────────────────────────────────────────────────

function channelBadgeStyle(ch: string): React.CSSProperties {
  if (ch === "SMS")   return { background: "rgba(16,185,129,0.12)", color: "#10b981" };
  if (ch === "Email") return { background: "rgba(59,130,246,0.12)", color: "#3b82f6" };
  return                     { background: "rgba(239,68,68,0.12)",  color: "#ef4444" };
}

function statusBadgeStyle(s: string): React.CSSProperties {
  if (s === "replied")  return { background: "rgba(16,185,129,0.12)", color: "var(--success)" };
  if (s === "sent")     return { background: "rgba(59,130,246,0.12)", color: "var(--accent)" };
  if (s === "bounced")  return { background: "rgba(239,68,68,0.12)",  color: "var(--hot)" };
  return                       { background: "rgba(107,114,128,0.1)", color: "var(--cold)" };
}

function statusLabel(s: string) {
  if (s === "replied")  return "Replied";
  if (s === "sent")     return "Sent";
  if (s === "bounced")  return "Bounced";
  return "No Reply";
}

function tierChipStyle(tier: string): React.CSSProperties {
  if (tier === "HOT")  return { background: "var(--hot-dim)",  color: "var(--hot)",  border: "1px solid var(--hot-border)" };
  if (tier === "WARM") return { background: "var(--warm-dim)", color: "var(--warm)", border: "1px solid var(--warm-border)" };
  return                      { background: "rgba(107,114,128,0.08)", color: "var(--cold)", border: "none" };
}

function insightStyle(kind: string): React.CSSProperties {
  if (kind === "good")  return { background: "rgba(16,185,129,0.12)", color: "var(--success)" };
  if (kind === "warn")  return { background: "rgba(245,158,11,0.12)", color: "var(--warm)" };
  if (kind === "alert") return { background: "rgba(239,68,68,0.12)",  color: "var(--hot)" };
  return                       { background: "rgba(255,255,255,0.04)", color: "var(--text-muted)" };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Sparkline() {
  return (
    <svg width="72" height="28" viewBox="0 0 72 28" style={{ opacity: 0.4, flexShrink: 0, marginBottom: "4px" }}>
      <polyline points="0,24 12,20 24,22 36,13 48,15 60,7 72,3" fill="none" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="72" cy="3" r="2.5" fill="var(--success)" />
    </svg>
  );
}

function ArrowUp() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M5 8V2M2 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M5 2v6M2 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
      <path d="M4 1l.9 1.8 2 .3-1.45 1.4.34 2L4 5.6l-1.79.94.34-2L1.1 3.1l2-.3z" fill="var(--success)" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const [activeRange, setActiveRange] = useState<"7d" | "30d" | "90d">("30d");

  // Shared style atoms
  const s = {
    badge: {
      display: "inline-flex" as const,
      alignItems: "center" as const,
      gap: "4px",
      padding: "3px 8px",
      borderRadius: "99px",
      fontSize: "10px",
      fontWeight: "600",
    } as React.CSSProperties,
    tierChip: {
      display: "inline-flex" as const,
      alignItems: "center" as const,
      padding: "3px 8px",
      borderRadius: "99px",
      fontSize: "10px",
      fontWeight: "700",
      letterSpacing: "0.3px",
    } as React.CSSProperties,
    insightTag: {
      display: "inline-flex" as const,
      alignItems: "center" as const,
      gap: "4px",
      padding: "2px 7px",
      borderRadius: "99px",
      fontSize: "10px",
      fontWeight: "500",
      marginTop: "3px",
      whiteSpace: "nowrap" as const,
    } as React.CSSProperties,
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Topbar ── */}
      <div style={{
        height: "var(--topbar-height)", minHeight: "var(--topbar-height)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", borderBottom: "1px solid var(--border)",
        background: "var(--bg-surface)", gap: "16px",
      }}>
        <div style={{ fontSize: "15px", fontWeight: "600", letterSpacing: "-0.3px" }}>Reports</div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Range pills */}
          <div style={{ display: "flex", gap: "4px" }}>
            {(["7d", "30d", "90d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setActiveRange(r)}
                style={{
                  padding: "5px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "500",
                  border: activeRange === r ? "1px solid rgba(59,130,246,0.3)" : "1px solid var(--border)",
                  background: activeRange === r ? "rgba(59,130,246,0.12)" : "transparent",
                  color: activeRange === r ? "var(--accent)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >{r}</button>
            ))}
          </div>
          {/* Export */}
          <button style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "5px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "500",
            color: "var(--text-secondary)", background: "transparent",
            border: "1px solid var(--border-strong)", cursor: "pointer",
          }}>
            <ExportIcon /> Export
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "24px 28px",
        display: "flex", flexDirection: "column", gap: "16px",
      }}>

        {/* ── KPI Unified Card ── */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "14px",
          display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr 1px 1fr",
          overflow: "hidden", position: "relative",
        }}>
          {/* Full-width top accent — green covers reply-rate quarter */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "2px",
            background: "linear-gradient(90deg, var(--success) 0%, var(--success) 25%, var(--border-strong) 25%)",
            pointerEvents: "none",
          }} />

          {/* Hero: Reply Rate */}
          <div style={{ padding: "22px 24px 20px", display: "flex", flexDirection: "column", gap: "4px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 0% 60%, rgba(16,185,129,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--success)" }}>Reply Rate</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", justifyContent: "space-between" }}>
              <div style={{ fontSize: "44px", fontWeight: 800, letterSpacing: "-2px", lineHeight: 1, color: "var(--text-primary)" }}>
                37<span style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "-0.5px", verticalAlign: "super" }}>%</span>
              </div>
              <Sparkline />
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4 }}>34 replies · 91 sends this period</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, color: "var(--success)", marginTop: "2px" }}>
              <ArrowUp /> +6 pts vs prior 30d
            </div>
          </div>

          {/* Divider */}
          <div style={{ background: "var(--border)", alignSelf: "stretch" }} />

          {/* Leads Scored */}
          <div style={{ padding: "22px 20px 20px", display: "flex", flexDirection: "column", gap: "4px", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "var(--accent)" }} />
            <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)" }}>Leads Scored</div>
            <div style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-1px", lineHeight: 1, color: "var(--text-primary)", marginTop: "2px" }}>184</div>
            <div style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11px", fontWeight: 500, color: "var(--success)", marginTop: "4px" }}>
              <ArrowUp /> +23 vs prior period
            </div>
          </div>

          {/* Divider */}
          <div style={{ background: "var(--border)", alignSelf: "stretch" }} />

          {/* Outreach Sent */}
          <div style={{ padding: "22px 20px 20px", display: "flex", flexDirection: "column", gap: "4px", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "var(--warm)" }} />
            <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)" }}>Outreach Sent</div>
            <div style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-1px", lineHeight: 1, color: "var(--text-primary)", marginTop: "2px" }}>91</div>
            <div style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11px", fontWeight: 500, color: "var(--success)", marginTop: "4px" }}>
              <ArrowUp /> +11 vs prior period
            </div>
          </div>

          {/* Divider */}
          <div style={{ background: "var(--border)", alignSelf: "stretch" }} />

          {/* Hot Leads */}
          <div style={{ padding: "22px 20px 20px", display: "flex", flexDirection: "column", gap: "4px", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "var(--hot)" }} />
            <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)" }}>Hot Leads</div>
            <div style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-1px", lineHeight: 1, color: "var(--text-primary)", marginTop: "2px" }}>12</div>
            <div style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11px", fontWeight: 500, color: "var(--hot)", marginTop: "4px" }}>
              <ArrowDown /> −3 vs prior period
            </div>
          </div>
        </div>

        {/* ── Insight Bar ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>

          {/* Strength */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderLeft: "3px solid var(--success)", borderRadius: "10px",
            padding: "16px 18px", display: "flex", flexDirection: "column", gap: "6px",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 0% 50%, rgba(16,185,129,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--success)" }}>Strength</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.2px", lineHeight: 1.3 }}>
              SMS is outperforming every other channel by 17 points
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5, paddingTop: "6px", borderTop: "1px solid var(--border)", marginTop: "2px" }}>
              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Action:</span> Shift more HOT-tier outreach to SMS first. Email as follow-up only if no reply within 24h.
            </div>
          </div>

          {/* Biggest leak */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderLeft: "3px solid var(--hot)", borderRadius: "10px",
            padding: "16px 18px", display: "flex", flexDirection: "column", gap: "6px",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 0% 50%, rgba(239,68,68,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--hot)" }}>Biggest leak</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.2px", lineHeight: 1.3 }}>
              93 scored leads never received outreach this period
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5, paddingTop: "6px", borderTop: "1px solid var(--border)", marginTop: "2px" }}>
              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Action:</span> That's 50.5% of your pipeline idle. Prioritise WARM leads scored &gt;3d ago with no contact — fastest wins.
            </div>
          </div>

        </div>

        {/* ── Response Speed by Channel ── */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "14px", padding: "18px 20px",
          display: "flex", flexDirection: "column", gap: "14px",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.2px" }}>Response Speed by Channel</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Avg time from send → reply, replied leads only</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { label: "SMS",   dot: "var(--success)", barW: "22%", barColor: "var(--success)", avg: "1h 42m", ctx: "Fastest channel",      ctxColor: "var(--success)" },
              { label: "Email", dot: "var(--accent)",  barW: "58%", barColor: "var(--accent)",  avg: "5h 17m", ctx: "3× slower than SMS",   ctxColor: "var(--text-muted)" },
              { label: "Call",  dot: "var(--hot)",     barW: "82%", barColor: "var(--hot)",     avg: "7h 55m", ctx: "Lowest connect rate",  ctxColor: "var(--text-muted)" },
            ].map((row, i, arr) => (
              <div key={row.label} style={{
                display: "grid", gridTemplateColumns: "80px 1fr 80px 130px",
                alignItems: "center", gap: "14px",
                padding: "10px 0",
                borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: row.dot, flexShrink: 0, display: "inline-block" }} />
                  {row.label}
                </div>
                <div style={{ height: "4px", background: "rgba(255,255,255,0.04)", borderRadius: "99px", overflow: "hidden" }}>
                  <div style={{ width: row.barW, height: "100%", borderRadius: "99px", background: row.barColor, opacity: row.label === "Call" ? 0.7 : 1 }} />
                </div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", textAlign: "right" }}>{row.avg}</div>
                <div style={{ fontSize: "10px", fontWeight: 500, color: row.ctxColor, textAlign: "right" }}>{row.ctx}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mid Row: Funnel + Channel Performance ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "12px" }}>

          {/* Funnel */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.2px" }}>Lead Pipeline Funnel</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>Scored → Contacted → Replied → Appointment</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { label: "Scored",      count: 184, pct: "100%", w: "100%",  color: "rgba(59,130,246,0.45)", drop: null },
                { label: "Contacted",   count: 91,  pct: "49.5%",w: "49.5%", color: "rgba(245,158,11,0.5)",  drop: { pct: "↓ 50.5% drop", note: "— 93 leads never contacted" } },
                { label: "Replied",     count: 34,  pct: "18.5%",w: "18.5%", color: "rgba(16,185,129,0.55)", drop: { pct: "↓ 62.6% drop", note: "— 57 contacts with no reply" }, minW: "44px" },
                { label: "Appointment", count: 7,   pct: "3.8%", w: "3.8%",  color: "rgba(59,130,246,0.85)", drop: { pct: "↓ 79.4% drop", note: "— 27 replies didn't convert" }, minW: "40px" },
              ].map((row, i) => (
                <div key={row.label}>
                  {row.drop && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", paddingLeft: "116px", margin: "-2px 0 6px" }}>
                      <div style={{ width: "1px", height: "12px", background: "var(--border-strong)" }} />
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                        <span style={{ color: "var(--hot)", fontWeight: 600 }}>{row.drop.pct}</span> {row.drop.note}
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", width: "104px", flexShrink: 0 }}>{row.label}</div>
                    <div style={{ flex: 1, height: "26px", background: "rgba(255,255,255,0.03)", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border)" }}>
                      <div style={{ width: row.w, minWidth: (row as any).minW || "auto", height: "100%", borderRadius: "6px", background: row.color, display: "flex", alignItems: "center", paddingLeft: "10px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{row.count}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", width: "36px", textAlign: "right", flexShrink: 0 }}>{row.pct}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Channel Performance */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.2px" }}>Channel Performance</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>Reply rate by outreach type</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                { key: "sms",   label: "SMS",   sent: "44 sent",       rate: "48%", rateColor: "var(--success)", barW: "48%", barColor: "var(--success)", best: true },
                { key: "email", label: "Email", sent: "35 sent",       rate: "31%", rateColor: "var(--text-primary)", barW: "31%", barColor: "var(--accent)",   best: false },
                { key: "call",  label: "Call",  sent: "12 attempted",  rate: "18%", rateColor: "var(--text-muted)",   barW: "18%", barColor: "var(--hot)",     best: false },
              ].map((ch, i, arr) => (
                <div key={ch.key}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{
                          width: "24px", height: "24px", borderRadius: "6px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "11px", fontWeight: 700, flexShrink: 0,
                          background: ch.key === "sms" ? "rgba(16,185,129,0.15)" : ch.key === "email" ? "rgba(59,130,246,0.15)" : "rgba(239,68,68,0.15)",
                          color: ch.key === "sms" ? "var(--success)" : ch.key === "email" ? "var(--accent)" : "var(--hot)",
                        }}>
                          {ch.label[0]}
                        </div>
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{ch.label}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{ch.sent}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: ch.rateColor }}>{ch.rate}</div>
                    </div>
                    <div style={{ height: "5px", background: "rgba(255,255,255,0.04)", borderRadius: "99px", overflow: "hidden" }}>
                      <div style={{ width: ch.barW, height: "100%", borderRadius: "99px", background: ch.barColor, opacity: ch.key === "call" ? 0.6 : 1 }} />
                    </div>
                    {ch.best && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 7px", borderRadius: "99px", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", background: "rgba(16,185,129,0.12)", color: "var(--success)", alignSelf: "flex-start", marginTop: "1px" }}>
                        <StarIcon /> Best channel this period
                      </div>
                    )}
                  </div>
                  {i < arr.length - 1 && <div style={{ height: "1px", background: "var(--border)", marginTop: "14px" }} />}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Activity Section ── */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "14px", display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Header + summary stats */}
          <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.2px" }}>Recent Outreach Activity</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>Last 10 events — response window shows time from send to reply</div>
            </div>
            {/* Inline stats strip */}
            <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              {[
                { value: "91",     label: "Sent",         color: "var(--text-primary)" },
                { value: "37%",    label: "Reply Rate",   color: "var(--success)" },
                { value: "1h 42m", label: "Avg Response", color: "var(--text-primary)" },
                { value: "2",      label: "Bounced",      color: "var(--hot)" },
              ].map((stat, i, arr) => (
                <div key={stat.label} style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-end",
                  padding: "0 16px",
                  borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                  gap: "1px",
                }}>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: stat.color, letterSpacing: "-0.4px" }}>{stat.value}</div>
                  <div style={{ fontSize: "9px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Lead", "Channel", "Status", "Response Window", "Tier", "Score", "Sent"].map((h) => (
                  <th key={h} style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-muted)", textAlign: "left", padding: "10px 16px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", background: "rgba(255,255,255,0.01)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {THREADS.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  {/* Lead */}
                  <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "12px" }}>{t.name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>{t.address}</div>
                    {t.insight && (
                      <div style={{ ...s.insightTag, ...insightStyle(t.insight.kind) }}>{t.insight.text}</div>
                    )}
                  </td>
                  {/* Channel */}
                  <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                    <span style={{ ...s.badge, ...channelBadgeStyle(t.channel) }}>{t.channel}</span>
                  </td>
                  {/* Status */}
                  <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                    <span style={{ ...s.badge, ...statusBadgeStyle(t.status) }}>{statusLabel(t.status)}</span>
                  </td>
                  {/* Response window */}
                  <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                    <span style={{ fontSize: "11px", color: t.respFast ? "var(--success)" : "var(--text-muted)", fontWeight: t.respFast ? 600 : 400 }}>
                      {t.respWindow ?? "—"}
                    </span>
                  </td>
                  {/* Tier */}
                  <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                    <span style={{ ...s.tierChip, ...tierChipStyle(t.tier) }}>{t.tier}</span>
                  </td>
                  {/* Score */}
                  <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>{t.score}</span>
                  </td>
                  {/* Sent */}
                  <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t.ts}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

        </div>

      </div>
    </div>
  );
}