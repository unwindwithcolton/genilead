// components/screens/ExplorerScreen.tsx
// Market Explorer v4 — map-first geographic intelligence
// Heatmap + ZIP pins + signal layers + compare mode + saved markets
// Static mock data throughout — wire to ATTOM API in a future session

"use client";

import { useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = "hot" | "warm" | "nurture";
type Layer = "equity" | "dom" | "tenure" | "delinquency";
type SearchMode = "zip" | "city" | "nbhd" | "polygon";
type SideTab = "detail" | "top" | "compare" | "saved";

interface ZipStat {
  key: string;
  val: string;
  delta: string;
  up: boolean;
}

interface ZipSignal {
  l: string;
  v: number;
  c: string;
}

interface ZipData {
  name: string;
  tier: Tier;
  leads: number;
  stats: ZipStat[];
  signals: Record<Layer, ZipSignal[]>;
  brief: string;
  tags: string[];
  topScore: Record<Layer, number>;
  pinLeft: string;
  pinTop: string;
  tierRgb: string; // for CSS custom property
}

interface SavedMarket {
  zip: string;
  tier: Tier;
  alert: boolean;
  alertText: string;
}

// ─── Static mock data ─────────────────────────────────────────────────────────
// Replace with ATTOM API calls once /api/explorer route exists

const ZIPS: Record<string, ZipData> = {
  "60302": {
    name: "Oak Park, IL", tier: "hot", leads: 18,
    pinLeft: "22.2%", pinTop: "52.9%", tierRgb: "239,68,68",
    stats: [
      { key: "Avg equity spread", val: "$84k",  delta: "+12% vs metro",  up: true  },
      { key: "Median AVM",        val: "$387k", delta: "-2% MoM",        up: false },
      { key: "Absentee owners",   val: "34%",   delta: "+6pp YoY",       up: true  },
      { key: "Tax delinquent",    val: "11%",   delta: "High signal",    up: true  },
      { key: "Avg hold yrs",      val: "14.2y", delta: "+1.8y vs avg",   up: true  },
      { key: "Days on market",    val: "28d",   delta: "Fast-moving",    up: true  },
    ],
    signals: {
      equity:      [{ l: "Equity pressure",   v: 88, c: "#ef4444" }, { l: "Tax delinquency",     v: 72, c: "#ef4444" }, { l: "Absentee rate",    v: 65, c: "#f59e0b" }, { l: "Owner tenure",    v: 80, c: "#f59e0b" }, { l: "Market velocity", v: 58, c: "#3b82f6" }],
      dom:         [{ l: "Avg days on market", v: 28, c: "#10b981" }, { l: "Price reductions",    v: 18, c: "#3b82f6" }, { l: "Absorption rate",  v: 74, c: "#f59e0b" }, { l: "Relisting rate",  v: 12, c: "#3b82f6" }, { l: "Months inventory",v: 35, c: "#f59e0b" }],
      tenure:      [{ l: "Avg hold period",    v: 82, c: "#8b5cf6" }, { l: "Long-term owners",   v: 68, c: "#8b5cf6" }, { l: "Recent turnover",  v: 22, c: "#3b82f6" }, { l: "Estate sales",    v: 14, c: "#f59e0b" }, { l: "Absentee tenure", v: 74, c: "#f59e0b" }],
      delinquency: [{ l: "Tax delinquency",    v: 72, c: "#ef4444" }, { l: "Multi-yr delinquent",v: 48, c: "#ef4444" }, { l: "Late payment rate",v: 55, c: "#f59e0b" }, { l: "Lien risk",       v: 42, c: "#f59e0b" }, { l: "Current rate",    v: 28, c: "#3b82f6" }],
    },
    brief: "60302 has the highest concentration of absentee-owned, tax-delinquent properties in your watched area. Equity spreads are 18% above metro average.",
    tags: ["Tax delinquent", "Absentee owners", "High equity", "Off-market potential"],
    topScore: { equity: 88, dom: 28, tenure: 82, delinquency: 72 },
  },
  "60201": {
    name: "Evanston, IL", tier: "warm", leads: 11,
    pinLeft: "59.3%", pinTop: "22.4%", tierRgb: "245,158,11",
    stats: [
      { key: "Avg equity spread", val: "$61k",  delta: "+6% vs metro", up: true  },
      { key: "Median AVM",        val: "$412k", delta: "+1% MoM",      up: true  },
      { key: "Absentee owners",   val: "22%",   delta: "Moderate",     up: false },
      { key: "Tax delinquent",    val: "5%",    delta: "Low signal",   up: false },
      { key: "Avg hold yrs",      val: "11.5y", delta: "Above avg",    up: true  },
      { key: "Days on market",    val: "41d",   delta: "Slowing",      up: false },
    ],
    signals: {
      equity:      [{ l: "Equity pressure",   v: 62, c: "#f59e0b" }, { l: "Tax delinquency",     v: 28, c: "#3b82f6" }, { l: "Absentee rate",    v: 44, c: "#f59e0b" }, { l: "Owner tenure",    v: 70, c: "#f59e0b" }, { l: "Market velocity", v: 40, c: "#3b82f6" }],
      dom:         [{ l: "Avg days on market", v: 41, c: "#f59e0b" }, { l: "Price reductions",    v: 24, c: "#f59e0b" }, { l: "Absorption rate",  v: 55, c: "#f59e0b" }, { l: "Relisting rate",  v: 20, c: "#f59e0b" }, { l: "Months inventory",v: 48, c: "#f59e0b" }],
      tenure:      [{ l: "Avg hold period",    v: 70, c: "#f59e0b" }, { l: "Long-term owners",   v: 55, c: "#f59e0b" }, { l: "Recent turnover",  v: 30, c: "#3b82f6" }, { l: "Estate sales",    v: 10, c: "#3b82f6" }, { l: "Absentee tenure", v: 58, c: "#f59e0b" }],
      delinquency: [{ l: "Tax delinquency",    v: 28, c: "#3b82f6" }, { l: "Multi-yr delinquent",v: 12, c: "#3b82f6" }, { l: "Late payment rate",v: 32, c: "#3b82f6" }, { l: "Lien risk",       v: 20, c: "#3b82f6" }, { l: "Current rate",    v: 70, c: "#10b981" }],
    },
    brief: "Solid WARM market. Long-tenure homeowners and moderate equity spread make 60201 a consistent nurture pipeline.",
    tags: ["Long ownership", "Equity spread", "Moderate signal"],
    topScore: { equity: 62, dom: 41, tenure: 70, delinquency: 28 },
  },
  "60804": {
    name: "Cicero, IL", tier: "warm", leads: 9,
    pinLeft: "36.8%", pinTop: "77.9%", tierRgb: "245,158,11",
    stats: [
      { key: "Avg equity spread", val: "$47k",  delta: "+3% vs metro", up: true  },
      { key: "Median AVM",        val: "$224k", delta: "Stable",       up: false },
      { key: "Absentee owners",   val: "28%",   delta: "+4pp YoY",     up: true  },
      { key: "Tax delinquent",    val: "8%",    delta: "Rising",       up: true  },
      { key: "Avg hold yrs",      val: "13.1y", delta: "Above avg",    up: true  },
      { key: "Days on market",    val: "52d",   delta: "Slow market",  up: false },
    ],
    signals: {
      equity:      [{ l: "Equity pressure",   v: 55, c: "#f59e0b" }, { l: "Tax delinquency",     v: 48, c: "#f59e0b" }, { l: "Absentee rate",    v: 52, c: "#f59e0b" }, { l: "Owner tenure",    v: 66, c: "#f59e0b" }, { l: "Market velocity", v: 30, c: "#6b7094" }],
      dom:         [{ l: "Avg days on market", v: 52, c: "#ef4444" }, { l: "Price reductions",    v: 30, c: "#f59e0b" }, { l: "Absorption rate",  v: 40, c: "#f59e0b" }, { l: "Relisting rate",  v: 28, c: "#f59e0b" }, { l: "Months inventory",v: 62, c: "#ef4444" }],
      tenure:      [{ l: "Avg hold period",    v: 66, c: "#f59e0b" }, { l: "Long-term owners",   v: 50, c: "#f59e0b" }, { l: "Recent turnover",  v: 25, c: "#3b82f6" }, { l: "Estate sales",    v: 18, c: "#f59e0b" }, { l: "Absentee tenure", v: 60, c: "#f59e0b" }],
      delinquency: [{ l: "Tax delinquency",    v: 48, c: "#f59e0b" }, { l: "Multi-yr delinquent",v: 28, c: "#f59e0b" }, { l: "Late payment rate",v: 44, c: "#f59e0b" }, { l: "Lien risk",       v: 36, c: "#f59e0b" }, { l: "Current rate",    v: 52, c: "#f59e0b" }],
    },
    brief: "Emerging signal cluster — delinquency rising, absentee rate increasing. Watch this ZIP before signals escalate to HOT.",
    tags: ["Rising delinquency", "Absentee owners", "Watch closely"],
    topScore: { equity: 55, dom: 52, tenure: 66, delinquency: 48 },
  },
  "60614": {
    name: "Lincoln Park, Chicago", tier: "nurture", leads: 6,
    pinLeft: "72.3%", pinTop: "51.7%", tierRgb: "59,130,246",
    stats: [
      { key: "Avg equity spread", val: "$29k",  delta: "Near avg",    up: false },
      { key: "Median AVM",        val: "$680k", delta: "+3% MoM",     up: true  },
      { key: "Absentee owners",   val: "14%",   delta: "Low",         up: false },
      { key: "Tax delinquent",    val: "2%",    delta: "Very low",    up: false },
      { key: "Avg hold yrs",      val: "8.4y",  delta: "Below avg",   up: false },
      { key: "Days on market",    val: "19d",   delta: "Very fast",   up: true  },
    ],
    signals: {
      equity:      [{ l: "Equity pressure",   v: 28, c: "#3b82f6" }, { l: "Tax delinquency",     v: 10, c: "#6b7094" }, { l: "Absentee rate",    v: 22, c: "#3b82f6" }, { l: "Owner tenure",    v: 38, c: "#3b82f6" }, { l: "Market velocity", v: 75, c: "#10b981" }],
      dom:         [{ l: "Avg days on market", v: 19, c: "#10b981" }, { l: "Price reductions",    v:  8, c: "#10b981" }, { l: "Absorption rate",  v: 88, c: "#10b981" }, { l: "Relisting rate",  v:  6, c: "#10b981" }, { l: "Months inventory",v: 18, c: "#10b981" }],
      tenure:      [{ l: "Avg hold period",    v: 38, c: "#3b82f6" }, { l: "Long-term owners",   v: 28, c: "#3b82f6" }, { l: "Recent turnover",  v: 52, c: "#f59e0b" }, { l: "Estate sales",    v:  8, c: "#3b82f6" }, { l: "Absentee tenure", v: 30, c: "#3b82f6" }],
      delinquency: [{ l: "Tax delinquency",    v: 10, c: "#10b981" }, { l: "Multi-yr delinquent",v:  4, c: "#10b981" }, { l: "Late payment rate",v: 12, c: "#10b981" }, { l: "Lien risk",       v:  8, c: "#10b981" }, { l: "Current rate",    v: 88, c: "#10b981" }],
    },
    brief: "Low seller-motivation signals but very active buyer market. Nurture queue only — check back in 90 days.",
    tags: ["Low signal", "Fast buyer market", "Nurture only"],
    topScore: { equity: 28, dom: 19, tenure: 38, delinquency: 10 },
  },
  "60402": {
    name: "Berwyn, IL", tier: "warm", leads: 7,
    pinLeft: "14.4%", pinTop: "79.5%", tierRgb: "245,158,11",
    stats: [
      { key: "Avg equity spread", val: "$52k",  delta: "+5% vs metro", up: true  },
      { key: "Median AVM",        val: "$261k", delta: "-1% MoM",      up: false },
      { key: "Absentee owners",   val: "25%",   delta: "Moderate",     up: false },
      { key: "Tax delinquent",    val: "7%",    delta: "Moderate",     up: false },
      { key: "Avg hold yrs",      val: "12.6y", delta: "Above avg",    up: true  },
      { key: "Days on market",    val: "38d",   delta: "Average",      up: false },
    ],
    signals: {
      equity:      [{ l: "Equity pressure",   v: 58, c: "#f59e0b" }, { l: "Tax delinquency",     v: 42, c: "#f59e0b" }, { l: "Absentee rate",    v: 48, c: "#f59e0b" }, { l: "Owner tenure",    v: 62, c: "#f59e0b" }, { l: "Market velocity", v: 45, c: "#3b82f6" }],
      dom:         [{ l: "Avg days on market", v: 38, c: "#f59e0b" }, { l: "Price reductions",    v: 22, c: "#3b82f6" }, { l: "Absorption rate",  v: 60, c: "#f59e0b" }, { l: "Relisting rate",  v: 18, c: "#3b82f6" }, { l: "Months inventory",v: 44, c: "#f59e0b" }],
      tenure:      [{ l: "Avg hold period",    v: 62, c: "#f59e0b" }, { l: "Long-term owners",   v: 48, c: "#f59e0b" }, { l: "Recent turnover",  v: 28, c: "#3b82f6" }, { l: "Estate sales",    v: 14, c: "#f59e0b" }, { l: "Absentee tenure", v: 54, c: "#f59e0b" }],
      delinquency: [{ l: "Tax delinquency",    v: 42, c: "#f59e0b" }, { l: "Multi-yr delinquent",v: 22, c: "#3b82f6" }, { l: "Late payment rate",v: 38, c: "#f59e0b" }, { l: "Lien risk",       v: 28, c: "#3b82f6" }, { l: "Current rate",    v: 58, c: "#f59e0b" }],
    },
    brief: "Solid mid-range market with long-tenure owners and rising absentee rate. Follow up this week.",
    tags: ["Long ownership", "Moderate equity", "Absentee owners"],
    topScore: { equity: 58, dom: 38, tenure: 62, delinquency: 42 },
  },
};

const INITIAL_SAVED: SavedMarket[] = [
  { zip: "60302", tier: "hot",  alert: true,  alertText: "3 new HOT leads" },
  { zip: "60201", tier: "warm", alert: false, alertText: "" },
  { zip: "60402", tier: "warm", alert: true,  alertText: "Equity shift +8%" },
];

// ─── Tier config ──────────────────────────────────────────────────────────────

const TC: Record<Tier, { bg: string; color: string; border: string; label: string }> = {
  hot:    { bg: "rgba(239,68,68,0.12)",    color: "#f87171",  border: "rgba(239,68,68,0.28)",    label: "HOT"     },
  warm:   { bg: "rgba(245,158,11,0.12)",   color: "#fbbf24",  border: "rgba(245,158,11,0.28)",   label: "WARM"    },
  nurture:{ bg: "rgba(255,255,255,0.06)",  color: "#6b7094",  border: "rgba(255,255,255,0.12)",  label: "NURTURE" },
};

const LAYER_LABELS: Record<Layer, string> = {
  equity:      "Equity pressure",
  dom:         "Days on market",
  tenure:      "Owner tenure",
  delinquency: "Tax delinquency",
};

// Slot colors for compare mode (up to 3 ZIPs)
const SLOT_COLORS = ["#3b82f6", "#a855f7", "#10b981"] as const;

// ─── Tiny icon helper — matches Sidebar.tsx pattern ──────────────────────────

function Ico({
  d, size = 13, strokeWidth = 2.5,
}: {
  d: string; size?: number; strokeWidth?: number;
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: "inline-block", verticalAlign: "-2px" }}
    >
      <path d={d} />
    </svg>
  );
}

const D = {
  search:  "M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  polygon: "M12 2l9 7-3.5 10.5h-11L3 9z",
  bars:    "M18 20V10M12 20V4M6 20v-6",
  bookmark:"M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
  bolt:    "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  star:    "M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z",
  x:       "M18 6L6 18M6 6l12 12",
  chevron: "M9 18l6-6-6-6",
  plus:    "M12 5v14M5 12h14",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SecLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em",
      textTransform: "uppercase", color: "var(--text-muted)", whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 16px" }} />;
}

// ─── Signal bars ──────────────────────────────────────────────────────────────

function SignalBars({ zip, layer }: { zip: string; layer: Layer }) {
  const d = ZIPS[zip];
  if (!d) return null;
  const sigs = d.signals[layer];
  const max  = Math.max(...sigs.map(s => s.v));

  return (
    <>
      {sigs.map((s, i) => {
        const rc = s.v >= 70 ? "#f87171" : s.v >= 50 ? "#fbbf24" : s.v >= 30 ? "#8892a4" : "#4a5068";
        const rl = s.v >= 70 ? "High confidence" : s.v >= 50 ? "Moderate" : s.v >= 30 ? "Low" : "Very low";
        const tickPct = Math.round(50 / max * 100);

        return (
          <div key={s.l} style={{ marginBottom: i < sigs.length - 1 ? 15 : 0 }}>
            {/* Label row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)" }}>{s.l}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: s.c, fontVariantNumeric: "tabular-nums", minWidth: 28, textAlign: "right" }}>{s.v}</span>
                <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600 }}>/100</span>
              </div>
            </div>
            {/* Bar track */}
            <div style={{ height: 8, background: "rgba(255,255,255,0.055)", borderRadius: 4, position: "relative", overflow: "visible" }}>
              <div style={{ height: "100%", width: `${Math.round(s.v / max * 100)}%`, background: s.c, borderRadius: 4 }} />
              {/* Metro avg tick */}
              <div style={{ position: "absolute", top: -3, left: `${tickPct}%`, width: 1.5, height: 14, background: "rgba(255,255,255,0.2)", borderRadius: 1 }} />
            </div>
            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: rc, flexShrink: 0 }} />
              <span style={{ color: rc, fontSize: 9 }}>{rl}</span>
              {i === 0 && <span style={{ color: "var(--text-muted)", fontSize: 9, marginLeft: 4 }}>— top signal</span>}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  zip, layer, onAddCompare, onSave,
}: {
  zip: string; layer: Layer;
  onAddCompare: (zip: string) => void;
  onSave: (zip: string) => void;
}) {
  const d  = ZIPS[zip];
  if (!d) return null;
  const t  = TC[d.tier];

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      {/* Header — left border color matches tier */}
      <div style={{
        padding: "18px 16px 15px",
        borderBottom: "1px solid var(--border)",
        borderLeft: `3px solid ${t.color}`,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em", color: t.color }}>{zip}</span>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 10,
              letterSpacing: ".05em", background: t.bg, color: t.color,
            }}>
              {t.label}
            </span>
          </div>
          <button
            onClick={() => onAddCompare(zip)}
            style={{
              fontSize: 10, fontWeight: 700, padding: "4px 10px",
              borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)",
              background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
              fontFamily: "var(--font-ui)",
            }}
          >
            + Compare
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 9 }}>{d.name}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {d.tags.map(tag => (
            <span key={tag} style={{
              fontSize: 9.5, fontWeight: 700, padding: "2px 9px",
              borderRadius: 4, background: t.bg, color: t.color,
              border: `1px solid ${t.color}33`,
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, padding: "18px 16px" }}>
        {d.stats.map(s => (
          <div key={s.key} style={{
            background: "#151720", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 9, padding: 13,
          }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>
              {s.key}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#d4d8e8", lineHeight: 1.15 }}>{s.val}</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, marginTop: 5, color: s.up ? "#10b981" : "#f87171" }}>{s.delta}</div>
          </div>
        ))}
      </div>

      <Divider />

      {/* Signal breakdown */}
      <div style={{ padding: "0 16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0 13px" }}>
          <SecLabel>Signal breakdown</SecLabel>
          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{LAYER_LABELS[layer].toLowerCase()}</span>
        </div>
        <SignalBars zip={zip} layer={layer} />
      </div>

      <Divider />

      {/* AI brief */}
      <div style={{
        margin: "0 16px 18px",
        background: "rgba(59,130,246,0.06)",
        border: "1px solid rgba(59,130,246,0.18)",
        borderLeft: "3px solid var(--accent)",
        borderRadius: 8, padding: "14px 15px",
      }}>
        <div style={{
          fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase",
          color: "var(--accent)", marginBottom: 6, display: "flex", alignItems: "center", gap: 5,
        }}>
          <Ico d={D.star} size={10} /> AI market brief
        </div>
        <div style={{ fontSize: 12, color: "#c4c8d8", lineHeight: 1.75 }}>
          {d.brief}{" "}
          <strong style={{ color: "var(--text-primary)", fontWeight: 700 }}>
            {d.leads} leads — {d.tier === "hot" ? "prioritize outreach this week." : d.tier === "warm" ? "follow up within the week." : "check back in 90 days."}
          </strong>
        </div>
      </div>

      {/* Action strip */}
      <div style={{ padding: "14px 16px", display: "flex", gap: 8, flexShrink: 0, borderTop: "1px solid var(--border)", marginTop: "auto" }}>
        <button style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          fontSize: 11, fontWeight: 700, padding: "7px 14px",
          borderRadius: "var(--r-sm)", border: "none",
          background: "var(--accent)", color: "#fff", cursor: "pointer",
          fontFamily: "var(--font-ui)",
        }}>
          <Ico d={D.bolt} size={11} /> View leads in Opportunities
        </button>
        <button
          onClick={() => onSave(zip)}
          style={{
            fontSize: 11, fontWeight: 700, padding: "7px 12px",
            borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)",
            background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
            fontFamily: "var(--font-ui)", display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <Ico d={D.bookmark} size={11} /> Save
        </button>
      </div>
    </div>
  );
}

// ─── Top ZIPs panel ───────────────────────────────────────────────────────────

function TopZipsPanel({
  layer, onSelect,
}: {
  layer: Layer; onSelect: (zip: string) => void;
}) {
  const sorted = Object.entries(ZIPS).sort((a, b) => b[1].topScore[layer] - a[1].topScore[layer]);
  const max    = sorted[0][1].topScore[layer];

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px 11px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div>
          <SecLabel>Top ZIPs</SecLabel>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>by {LAYER_LABELS[layer].toLowerCase()}</div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, background: "var(--accent-dim)", color: "var(--accent)", borderRadius: 10, padding: "2px 9px" }}>
          5 ZIPs
        </span>
      </div>

      {sorted.map(([zip, d], i) => {
        const t = TC[d.tier];
        const s = d.topScore[layer];
        return (
          <div
            key={zip}
            onClick={() => onSelect(zip)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              cursor: "pointer",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.025)"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: i === 0 ? t.color : "var(--text-muted)", width: 18, flexShrink: 0, textAlign: "center" }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#c0c5d8" }}>{zip}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 6 }}>{d.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: t.color }}>{s}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 4, background: t.bg, color: t.color }}>{t.label}</span>
                </div>
              </div>
              <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round(s / max * 100)}%`, background: t.color, borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{d.leads} leads</div>
            </div>
          </div>
        );
      })}

      <div style={{ margin: "14px 16px", background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.14)", borderRadius: 8, padding: "11px 13px" }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 4 }}>Tip</div>
        <div style={{ fontSize: 11.5, color: "#8892a4", lineHeight: 1.6 }}>Switch the signal layer in the topbar to re-rank by a different market signal.</div>
      </div>
    </div>
  );
}

// ─── Compare panel ────────────────────────────────────────────────────────────

function ComparePanel({
  compareList, layer, onRemove, onClear, onSelectZip,
}: {
  compareList: string[];
  layer: Layer;
  onRemove: (zip: string) => void;
  onClear: () => void;
  onSelectZip: (zip: string) => void;
}) {
  const hasEnough = compareList.length >= 2;
  const scores    = compareList.map(z => ZIPS[z]?.topScore[layer] ?? 0);
  const winIdx    = scores.indexOf(Math.max(...scores));

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <SecLabel>Market comparison</SecLabel>
          <button
            onClick={onClear}
            style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-ui)" }}
          >
            Clear all
          </button>
        </div>
        {/* Slot pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {compareList.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "4px 0" }}>
              Click ZIPs on the map or use + Compare in Detail view.
            </div>
          ) : (
            compareList.map((zip, i) => (
              <span
                key={zip}
                onClick={() => onRemove(zip)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 10.5, fontWeight: 700, padding: "3px 10px 3px 8px",
                  borderRadius: 6, border: `1.5px solid ${SLOT_COLORS[i]}`,
                  color: SLOT_COLORS[i], background: `${SLOT_COLORS[i]}18`, cursor: "pointer",
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: SLOT_COLORS[i], display: "inline-block", flexShrink: 0 }} />
                {zip} — {ZIPS[zip]?.name}
                <span style={{ marginLeft: 2, opacity: .6 }}>×</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {!hasEnough ? (
          <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 12, lineHeight: 1.8 }}>
            <div style={{ fontSize: 28, marginBottom: 12, opacity: .3 }}>⇄</div>
            {compareList.length === 0
              ? <>Add 2–3 ZIPs to compare<br />signals, stats, and market<br />position side by side.</>
              : <>Add one more ZIP to<br />start the comparison.</>
            }
          </div>
        ) : (
          <>
            {/* ── Verdict ── */}
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
                Verdict — {LAYER_LABELS[layer]}
              </div>
              {compareList.map((zip, i) => {
                const d  = ZIPS[zip]; if (!d) return null;
                const t  = TC[d.tier];
                const isWin = i === winIdx;
                return (
                  <div
                    key={zip}
                    style={{
                      background: "#151720",
                      border: `${isWin ? "1.5px" : "1px"} solid ${isWin ? `${SLOT_COLORS[i]}55` : "rgba(255,255,255,0.07)"}`,
                      borderRadius: 10, padding: "14px 15px", marginBottom: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: SLOT_COLORS[i], flexShrink: 0, display: "inline-block" }} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{zip}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: t.bg, color: t.color }}>{t.label}</span>
                      {isWin && <span style={{ fontSize: 9, fontWeight: 800, color: "#10b981", letterSpacing: ".06em", textTransform: "uppercase", marginLeft: "auto" }}>▲ Highest signal</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      {d.name} · {d.leads} leads · Score {scores[i]}
                    </div>
                  </div>
                );
              })}
            </div>

            <Divider />

            {/* ── Stats table ── */}
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
                Key metrics
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-muted)", padding: "6px 8px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.06)", width: "38%" }}>
                      Metric
                    </th>
                    {compareList.map((zip, i) => (
                      <th key={zip} style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: SLOT_COLORS[i], padding: "6px 8px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {zip}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ZIPS[compareList[0]].stats.map((_, ki) => (
                    <tr key={ki}>
                      <td style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", padding: "9px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        {ZIPS[compareList[0]].stats[ki].key}
                      </td>
                      {compareList.map((zip, i) => {
                        const s = ZIPS[zip].stats[ki];
                        return (
                          <td key={zip} style={{ fontSize: 11.5, fontWeight: 800, padding: "9px 8px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", color: s.up ? "#c0c5d8" : "#6b7094" }}>
                            {s.val}
                            <div style={{ fontSize: 8.5, fontWeight: 700, color: s.up ? "#10b981" : "#f87171", marginTop: 1 }}>{s.delta}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Divider />

            {/* ── Signal comparison ── */}
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
                Signal comparison — {LAYER_LABELS[layer]}
              </div>
              {ZIPS[compareList[0]].signals[layer].map((sig, si) => {
                const vals = compareList.map(z => ZIPS[z].signals[layer][si] ?? { l: sig.l, v: 0, c: "#6b7094" });
                const maxV = Math.max(...vals.map(v => v.v));
                return (
                  <div key={sig.l} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 7 }}>{sig.l}</div>
                    {vals.map((sv, zi) => (
                      <div key={zi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: SLOT_COLORS[zi], width: 42, flexShrink: 0, textAlign: "right" }}>{compareList[zi]}</div>
                        <div style={{ flex: 1, height: 7, background: "rgba(255,255,255,0.055)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${maxV > 0 ? Math.round(sv.v / maxV * 100) : 0}%`, background: SLOT_COLORS[zi], opacity: .85, borderRadius: 4 }} />
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: sv.c, width: 24, flexShrink: 0 }}>{sv.v}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            <Divider />

            {/* ── Actions ── */}
            <div style={{ padding: "14px 16px 20px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
                Actions
              </div>
              {compareList.map((zip, i) => {
                const d = ZIPS[zip]; const t = TC[d.tier];
                return (
                  <div
                    key={zip}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 12px", marginBottom: 7,
                      background: "#151720", borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderLeft: `3px solid ${SLOT_COLORS[i]}`,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#c0c5d8" }}>{zip} — {d.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{d.leads} leads · {t.label}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => onSelectZip(zip)}
                        style={{ fontSize: 10, fontWeight: 700, padding: "5px 10px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-ui)" }}
                      >
                        Detail
                      </button>
                      <button
                        style={{ fontSize: 10, fontWeight: 700, padding: "5px 10px", borderRadius: 5, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontFamily: "var(--font-ui)" }}
                      >
                        Leads →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Saved panel ──────────────────────────────────────────────────────────────

function SavedPanel({ saved, onSelect }: { saved: SavedMarket[]; onSelect: (zip: string) => void }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px 11px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <SecLabel>Saved markets</SecLabel>
        <span style={{ fontSize: 10, fontWeight: 700, background: "var(--accent-dim)", color: "var(--accent)", borderRadius: 10, padding: "2px 9px" }}>
          {saved.length} watching
        </span>
      </div>

      {saved.map(s => {
        const d = ZIPS[s.zip]; const t = TC[s.tier];
        return (
          <div
            key={s.zip}
            onClick={() => onSelect(s.zip)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.025)"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: t.color, boxShadow: `0 0 0 3px ${t.bg}`, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#c0c5d8" }}>{s.zip} — {d?.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{d?.leads} leads · {t.label}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {s.alert && (
                <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 10, background: "var(--warm-dim)", color: "var(--warm)" }}>
                  {s.alertText}
                </span>
              )}
              <Ico d={D.chevron} size={12} strokeWidth={2} />
            </div>
          </div>
        );
      })}

      <div style={{ margin: "14px 16px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 8, padding: "11px 13px" }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--warm)", marginBottom: 4 }}>Alerts active</div>
        <div style={{ fontSize: 11.5, color: "#b8aa80", lineHeight: 1.65 }}>
          Notify when equity pressure shifts ≥ 10% or new HOT leads appear in watched ZIPs.
        </div>
      </div>
    </div>
  );
}

// ─── Map SVG + heatmap ────────────────────────────────────────────────────────

function MapCanvas({ layer }: { layer: Layer }) {
  return (
    <svg
      viewBox="0 0 900 580"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <radialGradient id="gHot">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.36" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gWarm">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gWarm2">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gCool">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gPurple">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="900" height="580" fill="#0e1018" />

      {/* Road grid — arterials */}
      <g stroke="rgba(255,255,255,0.04)" strokeWidth="1.5" fill="none">
        {[96,192,288,384,480].map(y => <line key={y} x1="0" y1={y} x2="900" y2={y} />)}
        {[112,224,336,448,560,672,784].map(x => <line key={x} x1={x} y1="0" x2={x} y2="580" />)}
      </g>
      {/* Minor streets */}
      <g stroke="rgba(255,255,255,0.02)" strokeWidth="0.75" fill="none">
        {[48,144,240,336,432,528].map(y => <line key={y} x1="0" y1={y} x2="900" y2={y} />)}
        {[56,168,280,392,504,616,728,840].map(x => <line key={x} x1={x} y1="0" x2={x} y2="580" />)}
      </g>
      {/* Major arterials */}
      <g stroke="rgba(255,255,255,0.055)" strokeWidth="2" fill="none">
        <line x1="0" y1="290" x2="900" y2="290" />
        <line x1="448" y1="0" x2="448" y2="580" />
      </g>

      {/* Heatmap blobs — equity (default) */}
      {layer === "equity" && (
        <g>
          <ellipse cx="200" cy="307" rx="115" ry="95" fill="url(#gHot)" />
          <ellipse cx="200" cy="307" rx="52"  ry="43" fill="rgba(239,68,68,0.12)" />
          <ellipse cx="534" cy="130" rx="95"  ry="78" fill="url(#gWarm)" />
          <ellipse cx="331" cy="453" rx="80"  ry="66" fill="url(#gWarm2)" />
          <ellipse cx="651" cy="300" rx="82"  ry="68" fill="url(#gCool)" />
          <ellipse cx="130" cy="461" rx="65"  ry="52" fill="url(#gWarm2)" opacity="0.7" />
        </g>
      )}
      {layer === "tenure" && (
        <g>
          <ellipse cx="200" cy="307" rx="125" ry="105" fill="url(#gPurple)" />
          <ellipse cx="534" cy="130" rx="75"  ry="62"  fill="url(#gWarm2)" opacity="0.6" />
          <ellipse cx="331" cy="453" rx="95"  ry="78"  fill="url(#gPurple)" opacity="0.75" />
          <ellipse cx="651" cy="300" rx="60"  ry="50"  fill="url(#gCool)"   opacity="0.55" />
        </g>
      )}
      {layer === "dom" && (
        <g>
          <ellipse cx="331" cy="453" rx="108" ry="88" fill="url(#gHot)"   opacity="0.78" />
          <ellipse cx="651" cy="300" rx="100" ry="82" fill="url(#gWarm)" />
          <ellipse cx="130" cy="461" rx="78"  ry="62" fill="url(#gCool)"   opacity="0.85" />
          <ellipse cx="534" cy="130" rx="62"  ry="50" fill="url(#gWarm2)"  opacity="0.55" />
        </g>
      )}
      {layer === "delinquency" && (
        <g>
          <ellipse cx="200" cy="307" rx="98" ry="80" fill="url(#gHot)" />
          <ellipse cx="331" cy="453" rx="78" ry="62" fill="url(#gHot)"  opacity="0.6" />
          <ellipse cx="534" cy="130" rx="60" ry="48" fill="url(#gWarm)" opacity="0.5" />
        </g>
      )}

      {/* ZIP boundaries */}
      <polygon id="boundary-60302" points="148,234 252,234 270,258 270,360 248,380 148,380 130,358 130,258"
        fill="rgba(239,68,68,0.06)"   stroke="rgba(239,68,68,0.45)"   strokeWidth="1.5" strokeDasharray="5 4" />
      <polygon id="boundary-60201" points="480,68 588,68 606,90 606,170 584,192 480,192 462,170 462,90"
        fill="rgba(245,158,11,0.05)"  stroke="rgba(245,158,11,0.38)"  strokeWidth="1.5" strokeDasharray="5 4" />
      <polygon id="boundary-60804" points="280,388 384,388 400,408 400,500 380,518 280,518 262,498 262,410"
        fill="rgba(245,158,11,0.04)"  stroke="rgba(245,158,11,0.32)"  strokeWidth="1.5" strokeDasharray="5 4" />
      <polygon id="boundary-60614" points="600,240 704,240 720,262 720,342 700,360 600,360 582,340 582,262"
        fill="rgba(59,130,246,0.04)"  stroke="rgba(59,130,246,0.28)"  strokeWidth="1.5" strokeDasharray="5 4" />
      <polygon id="boundary-60402" points="78,408 182,408 198,428 198,498 178,514 78,514 62,496 62,428"
        fill="rgba(245,158,11,0.04)"  stroke="rgba(245,158,11,0.26)"  strokeWidth="1.5" strokeDasharray="5 4" />

      {/* Neighborhood labels */}
      <g fontFamily="Inter,-apple-system,sans-serif" fontSize="9" fontWeight="700"
        fill="rgba(255,255,255,0.18)" textAnchor="middle" letterSpacing="0.06em">
        <text x="200" y="262">OAK PARK</text>
        <text x="534" y="98">EVANSTON</text>
        <text x="331" y="416">CICERO</text>
        <text x="651" y="268">LINCOLN PARK</text>
        <text x="130" y="435">BERWYN</text>
        <text x="448" y="314" fill="rgba(255,255,255,0.07)">CHICAGO LOOP</text>
        <text x="750" y="130" fill="rgba(255,255,255,0.07)">ROGERS PARK</text>
      </g>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExplorerScreen() {
  const [layer,        setLayer]        = useState<Layer>("equity");
  const [searchMode,   setSearchMode]   = useState<SearchMode>("zip");
  const [selectedZip,  setSelectedZip]  = useState<string>("60302");
  const [compareList,  setCompareList]  = useState<string[]>([]);
  const [compareMode,  setCompareMode]  = useState(false);
  const [activeTab,    setActiveTab]    = useState<SideTab>("detail");
  const [saved,        setSaved]        = useState<SavedMarket[]>(INITIAL_SAVED);

  // Search mode placeholder map
  const SEARCH_PH: Record<SearchMode, string> = {
    zip:     "Enter a ZIP code (e.g. 60302)…",
    city:    "Enter a city name…",
    nbhd:    "Enter a neighborhood name…",
    polygon: "Click on the map to draw a polygon area…",
  };
  const SEARCH_BADGE: Record<SearchMode, string> = {
    zip: "ZIP", city: "City", nbhd: "Nbhd", polygon: "Area",
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handlePinClick = useCallback((zip: string) => {
    if (compareMode) {
      handleAddCompare(zip);
    } else {
      setSelectedZip(zip);
      setActiveTab("detail");
    }
  }, [compareMode]);

  const handleAddCompare = useCallback((zip: string) => {
    setCompareList(prev => {
      if (prev.includes(zip)) return prev;
      const next = prev.length >= 3 ? [...prev.slice(1), zip] : [...prev, zip];
      return next;
    });
    setActiveTab("compare");
  }, []);

  const handleRemoveCompare = useCallback((zip: string) => {
    setCompareList(prev => prev.filter(z => z !== zip));
  }, []);

  const handleClearCompare = useCallback(() => {
    setCompareList([]);
  }, []);

  const handleToggleCompareMode = useCallback(() => {
    setCompareMode(prev => {
      const next = !prev;
      if (next) setActiveTab("compare");
      else      setActiveTab("detail");
      return next;
    });
  }, []);

  const handleSaveZip = useCallback((zip: string) => {
    setSaved(prev => {
      if (prev.find(s => s.zip === zip)) return prev;
      return [...prev, { zip, tier: ZIPS[zip].tier, alert: false, alertText: "" }];
    });
    setActiveTab("saved");
  }, []);

  const handleSelectFromSaved = useCallback((zip: string) => {
    setSelectedZip(zip);
    setActiveTab("detail");
  }, []);

  const handleSelectFromTop = useCallback((zip: string) => {
    setSelectedZip(zip);
    setActiveTab("detail");
  }, []);

  // ── Tier config for the currently selected zip ───────────────────────────
  const selData = ZIPS[selectedZip];
  const selTier = selData ? TC[selData.tier] : TC.nurture;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Topbar ── */}
      <div style={{
        height: "var(--topbar-height)", minHeight: "var(--topbar-height)",
        display: "flex", alignItems: "center", padding: "0 20px",
        borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", gap: 7, flexShrink: 0,
      }}>
        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.01em" }}>Market Explorer</span>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", marginLeft: 1 }}>Chicago metro</span>
        <div style={{ flex: 1 }} />

        {/* Layer pills */}
        <SecLabel>Signal layer</SecLabel>
        <div style={{ display: "flex", gap: 5 }}>
          {(["equity", "dom", "tenure", "delinquency"] as Layer[]).map(l => (
            <button
              key={l}
              onClick={() => setLayer(l)}
              style={{
                fontSize: 10, fontWeight: 700, padding: "4px 11px", borderRadius: 20,
                border: layer === l ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.09)",
                background: layer === l ? "var(--accent-dim)" : "transparent",
                color: layer === l ? "var(--accent)" : "var(--text-secondary)",
                cursor: "pointer", fontFamily: "var(--font-ui)", transition: "all .12s", whiteSpace: "nowrap",
              }}
            >
              {LAYER_LABELS[l]}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 4px", flexShrink: 0 }} />

        {/* Compare toggle */}
        <button
          onClick={handleToggleCompareMode}
          style={{
            fontSize: 10.5, fontWeight: 700, padding: "5px 12px",
            borderRadius: "var(--r-sm)",
            border: compareMode ? "1px solid var(--accent)" : "1px solid var(--border-strong)",
            background: compareMode ? "rgba(59,130,246,0.15)" : "transparent",
            color: compareMode ? "var(--accent)" : "var(--text-secondary)",
            cursor: "pointer", fontFamily: "var(--font-ui)", display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <Ico d={D.bars} size={12} /> {compareMode ? "Exit compare" : "Compare ZIPs"}
        </button>

        <button
          onClick={() => setActiveTab("saved")}
          style={{ fontSize: 10.5, fontWeight: 700, padding: "5px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-ui)", display: "flex", alignItems: "center", gap: 5 }}
        >
          <Ico d={D.bookmark} size={12} /> Saved
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Map ── */}
        <div style={{ flex: 1, position: "relative", background: "#0e1018", overflow: "hidden" }}>

          {/* Search shelf — primary control surface */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, zIndex: 30,
            background: "linear-gradient(180deg,rgba(11,13,17,0.97) 0%,rgba(11,13,17,0.82) 80%,transparent 100%)",
            padding: "14px 16px 22px",
          }}>
            <div style={{
              background: "#13151b",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
            }}>
              {/* Input row */}
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 14px", height: 44, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <Ico d={D.search} size={15} strokeWidth={2.5} />
                <input
                  type="text"
                  placeholder={SEARCH_PH[searchMode]}
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-ui)",
                  }}
                />
                <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 9px", borderRadius: 4, background: "var(--accent-dim)", color: "var(--accent)", flexShrink: 0, letterSpacing: ".02em" }}>
                  {SEARCH_BADGE[searchMode]}
                </span>
                <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", flexShrink: 0 }}>
                  ⌘K
                </span>
              </div>
              {/* Mode row */}
              <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 8px", height: 34 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "var(--text-muted)", whiteSpace: "nowrap" as const, padding: "0 8px" }}>Explore by</span>
                <div style={{ width: 1, height: 14, background: "var(--border)", margin: "0 3px", flexShrink: 0 }} />
                {([
                  { mode: "zip"     as SearchMode, label: "ZIP code"     },
                  { mode: "city"    as SearchMode, label: "City"          },
                  { mode: "nbhd"    as SearchMode, label: "Neighborhood"  },
                  { mode: "polygon" as SearchMode, label: "Draw area", icon: true },
                ] as { mode: SearchMode; label: string; icon?: boolean }[]).map(({ mode, label, icon }) => (
                  <button
                    key={mode}
                    onClick={() => setSearchMode(mode)}
                    style={{
                      fontSize: 10, fontWeight: 700, padding: "4px 11px",
                      borderRadius: 6, background: searchMode === mode ? "var(--accent-dim)" : "transparent",
                      border: "none", color: searchMode === mode ? "var(--accent)" : "var(--text-muted)",
                      cursor: "pointer", fontFamily: "var(--font-ui)",
                      display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
                    }}
                  >
                    {icon && <Ico d={D.polygon} size={10} />} {label}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 8, fontSize: 9.5, color: "var(--text-muted)" }}>
                  {[{ dot: "#ef4444", text: "1 HOT" }, { dot: "#f59e0b", text: "3 WARM" }, { dot: "#3b82f6", text: "1 NURTURE" }].map(m => (
                    <div key={m.text} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot }} />
                      <span>{m.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Map canvas */}
          <MapCanvas layer={layer} />

          {/* ZIP pins */}
          {Object.entries(ZIPS).map(([zip, d]) => {
            const t         = TC[d.tier];
            const isSelected = zip === selectedZip && !compareMode;
            const cmpIdx    = compareList.indexOf(zip);
            const inCompare = cmpIdx !== -1;

            return (
              <div
                key={zip}
                onClick={() => handlePinClick(zip)}
                style={{
                  position: "absolute",
                  left: d.pinLeft, top: d.pinTop,
                  transform: "translate(-50%,-50%)",
                  cursor: "pointer",
                  zIndex: isSelected ? 10 : 5,
                  transition: "transform .15s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = "translate(-50%,-50%) scale(1.06)"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = "translate(-50%,-50%)"}
              >
                {/* Compare slot badge */}
                {inCompare && (
                  <div style={{
                    position: "absolute", top: -6, right: -6,
                    width: 16, height: 16, borderRadius: "50%",
                    background: SLOT_COLORS[cmpIdx], color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, fontWeight: 800,
                    border: "1.5px solid #0b0d11", zIndex: 2,
                  }}>
                    {cmpIdx + 1}
                  </div>
                )}

                <div style={{
                  background: isSelected ? "#1a2032" : "#1a1d26",
                  borderRadius: 8,
                  padding: "8px 12px",
                  textAlign: "center",
                  boxShadow: isSelected
                    ? `0 0 0 2px ${t.color}, 0 0 0 6px rgba(${d.tierRgb},0.10)`
                    : inCompare
                      ? `0 0 0 2px ${SLOT_COLORS[cmpIdx]}`
                      : "0 2px 14px rgba(0,0,0,0.5)",
                  transition: "all .15s",
                  border: `1.5px solid ${isSelected ? t.color : inCompare ? SLOT_COLORS[cmpIdx] : t.border}`,
                }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "-.01em", color: isSelected ? t.color : t.color }}>
                    {zip}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, marginTop: 2, letterSpacing: ".02em", color: t.color }}>
                    {d.tier === "hot" ? "HOT" : d.tier === "warm" ? "WARM" : "NURTURE"} · {d.leads} leads
                  </div>
                </div>
              </div>
            );
          })}

          {/* Legend */}
          <div style={{
            position: "absolute", bottom: 58, left: 16,
            background: "rgba(11,13,17,0.93)", border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)", padding: "10px 14px",
            display: "flex", flexDirection: "column", gap: 7,
          }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 1 }}>
              {LAYER_LABELS[layer]}
            </div>
            {[{ color: "#ef4444", label: "High — act now" }, { color: "#f59e0b", label: "Medium — follow up" }, { color: "#3b82f6", label: "Low — nurture" }].map(r => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: "var(--text-secondary)" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                {r.label}
              </div>
            ))}
          </div>

          {/* Map controls */}
          <div style={{ position: "absolute", bottom: 14, right: 16, display: "flex", gap: 6 }}>
            {["+", "−", "⊙"].map((lbl, i) => (
              <div key={i} style={{
                width: 32, height: 32, background: "#13151b",
                border: "1px solid var(--border-strong)", borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "var(--text-secondary)",
                fontSize: i === 2 ? 12 : 17, userSelect: "none",
              }}>
                {lbl}
              </div>
            ))}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div style={{
          width: 360, minWidth: 360,
          borderLeft: "1px solid var(--border)",
          background: "var(--bg-base)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
            {(["detail", "top", "compare", "saved"] as SideTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, fontSize: 10, fontWeight: 700,
                  padding: "11px 0 12px", background: "transparent", border: "none",
                  borderBottom: `2px solid ${activeTab === tab ? "var(--accent)" : "transparent"}`,
                  color: activeTab === tab ? "var(--accent)" : "var(--text-muted)",
                  cursor: "pointer", fontFamily: "var(--font-ui)",
                  letterSpacing: ".03em", textTransform: "uppercase",
                }}
              >
                {tab === "detail" ? "Detail" : tab === "top" ? "Top ZIPs" : tab === "compare" ? "Compare" : "Saved"}
              </button>
            ))}
          </div>

          {/* Compare mode active bar */}
          {compareMode && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 16px",
              background: "rgba(59,130,246,0.07)",
              borderBottom: "1px solid rgba(59,130,246,0.18)",
              flexShrink: 0,
            }}>
              <Ico d={D.bars} size={12} strokeWidth={2.5} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)" }}>Comparing</span>
              <div style={{ display: "flex", gap: 5, flex: 1 }}>
                {compareList.map((zip, i) => (
                  <button
                    key={zip}
                    onClick={() => handleRemoveCompare(zip)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      fontSize: 10, fontWeight: 700,
                      padding: "3px 8px 3px 7px",
                      borderRadius: 6,
                      border: `1.5px solid ${SLOT_COLORS[i]}`,
                      background: `${SLOT_COLORS[i]}18`,
                      color: SLOT_COLORS[i], cursor: "pointer",
                      fontFamily: "var(--font-ui)",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: SLOT_COLORS[i], display: "inline-block" }} />
                    {zip} <span style={{ opacity: .6 }}>×</span>
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Click ZIPs to add</span>
            </div>
          )}

          {/* Panel bodies */}
          {activeTab === "detail" && (
            <DetailPanel
              zip={selectedZip}
              layer={layer}
              onAddCompare={handleAddCompare}
              onSave={handleSaveZip}
            />
          )}
          {activeTab === "top" && (
            <TopZipsPanel layer={layer} onSelect={handleSelectFromTop} />
          )}
          {activeTab === "compare" && (
            <ComparePanel
              compareList={compareList}
              layer={layer}
              onRemove={handleRemoveCompare}
              onClear={handleClearCompare}
              onSelectZip={handleSelectFromSaved}
            />
          )}
          {activeTab === "saved" && (
            <SavedPanel saved={saved} onSelect={handleSelectFromSaved} />
          )}
        </div>
      </div>
    </div>
  );
}