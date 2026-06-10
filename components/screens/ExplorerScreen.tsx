// components/screens/ExplorerScreen.tsx
// Market Explorer v5 — real Leaflet map, Kankakee County
// MapPanel (real Leaflet) replaces MapCanvas (fake SVG) + hardcoded pins
// Everything else — sidebar, tabs, compare, saved, signals — untouched

"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";

// Leaflet touches window/document on import — must be client-only
const MapPanel = dynamic(() => import("../MapPanel"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = "hot" | "warm" | "nurture";
type Layer = "equity" | "dom" | "tenure" | "delinquency";
type SearchMode = "zip" | "city";
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
  tierRgb: string;
}

interface SavedMarket {
  zip: string;
  tier: Tier;
  alert: boolean;
  alertText: string;
}

// ─── Mock data (Kankakee ZIPs) ────────────────────────────────────────────────
// Wire to /api/explorer once ATTOM bulk data is ingested

const ZIPS: Record<string, ZipData> = {
  "60901": {
    name: "Kankakee, IL", tier: "hot", leads: 22, tierRgb: "239,68,68",
    stats: [
      { key: "Avg equity spread", val: "$74k",  delta: "+14% vs county", up: true  },
      { key: "Median AVM",        val: "$142k", delta: "-1% MoM",        up: false },
      { key: "Absentee owners",   val: "38%",   delta: "+7pp YoY",       up: true  },
      { key: "Tax delinquent",    val: "14%",   delta: "High signal",    up: true  },
      { key: "Avg hold yrs",      val: "15.1y", delta: "+2.3y vs avg",   up: true  },
      { key: "Days on market",    val: "34d",   delta: "Fast-moving",    up: true  },
    ],
    signals: {
      equity:      [{ l: "Equity pressure",   v: 91, c: "#ef4444" }, { l: "Tax delinquency",     v: 78, c: "#ef4444" }, { l: "Absentee rate",    v: 70, c: "#f59e0b" }, { l: "Owner tenure",    v: 82, c: "#f59e0b" }, { l: "Market velocity", v: 60, c: "#3b82f6" }],
      dom:         [{ l: "Avg days on market", v: 34, c: "#10b981" }, { l: "Price reductions",    v: 22, c: "#3b82f6" }, { l: "Absorption rate",  v: 70, c: "#f59e0b" }, { l: "Relisting rate",  v: 18, c: "#3b82f6" }, { l: "Months inventory",v: 40, c: "#f59e0b" }],
      tenure:      [{ l: "Avg hold period",    v: 85, c: "#8b5cf6" }, { l: "Long-term owners",   v: 72, c: "#8b5cf6" }, { l: "Recent turnover",  v: 18, c: "#3b82f6" }, { l: "Estate sales",    v: 20, c: "#f59e0b" }, { l: "Absentee tenure", v: 78, c: "#f59e0b" }],
      delinquency: [{ l: "Tax delinquency",    v: 78, c: "#ef4444" }, { l: "Multi-yr delinquent",v: 52, c: "#ef4444" }, { l: "Late payment rate",v: 60, c: "#f59e0b" }, { l: "Lien risk",       v: 48, c: "#f59e0b" }, { l: "Current rate",    v: 22, c: "#3b82f6" }],
    },
    brief: "60901 Kankakee city core has the highest concentration of absentee-owned, tax-delinquent properties in the county. Equity spreads are 14% above county average.",
    tags: ["Tax delinquent", "Absentee owners", "High equity", "Off-market potential"],
    topScore: { equity: 91, dom: 34, tenure: 85, delinquency: 78 },
  },
  "60914": {
    name: "Bourbonnais, IL", tier: "warm", leads: 14, tierRgb: "245,158,11",
    stats: [
      { key: "Avg equity spread", val: "$58k",  delta: "+8% vs county",  up: true  },
      { key: "Median AVM",        val: "$218k", delta: "+2% MoM",        up: true  },
      { key: "Absentee owners",   val: "24%",   delta: "Moderate",       up: false },
      { key: "Tax delinquent",    val: "5%",    delta: "Low signal",     up: false },
      { key: "Avg hold yrs",      val: "11.8y", delta: "Above avg",      up: true  },
      { key: "Days on market",    val: "42d",   delta: "Slowing",        up: false },
    ],
    signals: {
      equity:      [{ l: "Equity pressure",   v: 64, c: "#f59e0b" }, { l: "Tax delinquency",     v: 30, c: "#3b82f6" }, { l: "Absentee rate",    v: 46, c: "#f59e0b" }, { l: "Owner tenure",    v: 68, c: "#f59e0b" }, { l: "Market velocity", v: 44, c: "#3b82f6" }],
      dom:         [{ l: "Avg days on market", v: 42, c: "#f59e0b" }, { l: "Price reductions",    v: 20, c: "#3b82f6" }, { l: "Absorption rate",  v: 58, c: "#f59e0b" }, { l: "Relisting rate",  v: 16, c: "#3b82f6" }, { l: "Months inventory",v: 45, c: "#f59e0b" }],
      tenure:      [{ l: "Avg hold period",    v: 68, c: "#f59e0b" }, { l: "Long-term owners",   v: 52, c: "#f59e0b" }, { l: "Recent turnover",  v: 32, c: "#3b82f6" }, { l: "Estate sales",    v: 12, c: "#3b82f6" }, { l: "Absentee tenure", v: 56, c: "#f59e0b" }],
      delinquency: [{ l: "Tax delinquency",    v: 30, c: "#3b82f6" }, { l: "Multi-yr delinquent",v: 14, c: "#3b82f6" }, { l: "Late payment rate",v: 28, c: "#3b82f6" }, { l: "Lien risk",       v: 18, c: "#3b82f6" }, { l: "Current rate",    v: 72, c: "#10b981" }],
    },
    brief: "Bourbonnais is a steady WARM market. Long-tenure homeowners and solid equity spread make 60914 a reliable pipeline for off-market outreach.",
    tags: ["Long ownership", "Equity spread", "Moderate signal"],
    topScore: { equity: 64, dom: 42, tenure: 68, delinquency: 30 },
  },
  "60915": {
    name: "Bradley, IL", tier: "warm", leads: 11, tierRgb: "245,158,11",
    stats: [
      { key: "Avg equity spread", val: "$49k",  delta: "+4% vs county",  up: true  },
      { key: "Median AVM",        val: "$161k", delta: "Stable",         up: false },
      { key: "Absentee owners",   val: "29%",   delta: "+5pp YoY",       up: true  },
      { key: "Tax delinquent",    val: "9%",    delta: "Rising",         up: true  },
      { key: "Avg hold yrs",      val: "13.4y", delta: "Above avg",      up: true  },
      { key: "Days on market",    val: "48d",   delta: "Slow market",    up: false },
    ],
    signals: {
      equity:      [{ l: "Equity pressure",   v: 58, c: "#f59e0b" }, { l: "Tax delinquency",     v: 50, c: "#f59e0b" }, { l: "Absentee rate",    v: 54, c: "#f59e0b" }, { l: "Owner tenure",    v: 64, c: "#f59e0b" }, { l: "Market velocity", v: 32, c: "#6b7094" }],
      dom:         [{ l: "Avg days on market", v: 48, c: "#ef4444" }, { l: "Price reductions",    v: 28, c: "#f59e0b" }, { l: "Absorption rate",  v: 42, c: "#f59e0b" }, { l: "Relisting rate",  v: 24, c: "#f59e0b" }, { l: "Months inventory",v: 58, c: "#ef4444" }],
      tenure:      [{ l: "Avg hold period",    v: 64, c: "#f59e0b" }, { l: "Long-term owners",   v: 48, c: "#f59e0b" }, { l: "Recent turnover",  v: 28, c: "#3b82f6" }, { l: "Estate sales",    v: 16, c: "#f59e0b" }, { l: "Absentee tenure", v: 58, c: "#f59e0b" }],
      delinquency: [{ l: "Tax delinquency",    v: 50, c: "#f59e0b" }, { l: "Multi-yr delinquent",v: 30, c: "#f59e0b" }, { l: "Late payment rate",v: 42, c: "#f59e0b" }, { l: "Lien risk",       v: 34, c: "#f59e0b" }, { l: "Current rate",    v: 50, c: "#f59e0b" }],
    },
    brief: "Emerging signal cluster in Bradley — delinquency rising, absentee rate climbing. Watch this ZIP; it may escalate to HOT within 60 days.",
    tags: ["Rising delinquency", "Absentee owners", "Watch closely"],
    topScore: { equity: 58, dom: 48, tenure: 64, delinquency: 50 },
  },
  "60950": {
    name: "Manteno, IL", tier: "warm", leads: 9, tierRgb: "245,158,11",
    stats: [
      { key: "Avg equity spread", val: "$44k",  delta: "+3% vs county",  up: true  },
      { key: "Median AVM",        val: "$198k", delta: "+1% MoM",        up: true  },
      { key: "Absentee owners",   val: "21%",   delta: "Moderate",       up: false },
      { key: "Tax delinquent",    val: "4%",    delta: "Low",            up: false },
      { key: "Avg hold yrs",      val: "10.9y", delta: "Near avg",       up: false },
      { key: "Days on market",    val: "55d",   delta: "Slow market",    up: false },
    ],
    signals: {
      equity:      [{ l: "Equity pressure",   v: 50, c: "#f59e0b" }, { l: "Tax delinquency",     v: 24, c: "#3b82f6" }, { l: "Absentee rate",    v: 38, c: "#3b82f6" }, { l: "Owner tenure",    v: 55, c: "#f59e0b" }, { l: "Market velocity", v: 28, c: "#6b7094" }],
      dom:         [{ l: "Avg days on market", v: 55, c: "#ef4444" }, { l: "Price reductions",    v: 26, c: "#f59e0b" }, { l: "Absorption rate",  v: 38, c: "#3b82f6" }, { l: "Relisting rate",  v: 20, c: "#3b82f6" }, { l: "Months inventory",v: 62, c: "#ef4444" }],
      tenure:      [{ l: "Avg hold period",    v: 55, c: "#f59e0b" }, { l: "Long-term owners",   v: 42, c: "#f59e0b" }, { l: "Recent turnover",  v: 30, c: "#3b82f6" }, { l: "Estate sales",    v: 10, c: "#3b82f6" }, { l: "Absentee tenure", v: 48, c: "#f59e0b" }],
      delinquency: [{ l: "Tax delinquency",    v: 24, c: "#3b82f6" }, { l: "Multi-yr delinquent",v: 10, c: "#3b82f6" }, { l: "Late payment rate",v: 22, c: "#3b82f6" }, { l: "Lien risk",       v: 14, c: "#3b82f6" }, { l: "Current rate",    v: 76, c: "#10b981" }],
    },
    brief: "Manteno is a steady suburban market. Slow turnover and low delinquency make it a nurture-to-warm pipeline. Monitor for equity shifts as new development pushes AVM up.",
    tags: ["Slow turnover", "Suburban growth", "Moderate equity"],
    topScore: { equity: 50, dom: 55, tenure: 55, delinquency: 24 },
  },
  "60954": {
    name: "Momence, IL", tier: "hot", leads: 16, tierRgb: "239,68,68",
    stats: [
      { key: "Avg equity spread", val: "$68k",  delta: "+11% vs county", up: true  },
      { key: "Median AVM",        val: "$128k", delta: "-3% MoM",        up: false },
      { key: "Absentee owners",   val: "35%",   delta: "+8pp YoY",       up: true  },
      { key: "Tax delinquent",    val: "12%",   delta: "High signal",    up: true  },
      { key: "Avg hold yrs",      val: "16.2y", delta: "+3.4y vs avg",   up: true  },
      { key: "Days on market",    val: "29d",   delta: "Fast-moving",    up: true  },
    ],
    signals: {
      equity:      [{ l: "Equity pressure",   v: 86, c: "#ef4444" }, { l: "Tax delinquency",     v: 74, c: "#ef4444" }, { l: "Absentee rate",    v: 68, c: "#f59e0b" }, { l: "Owner tenure",    v: 84, c: "#f59e0b" }, { l: "Market velocity", v: 55, c: "#3b82f6" }],
      dom:         [{ l: "Avg days on market", v: 29, c: "#10b981" }, { l: "Price reductions",    v: 16, c: "#3b82f6" }, { l: "Absorption rate",  v: 76, c: "#f59e0b" }, { l: "Relisting rate",  v: 10, c: "#3b82f6" }, { l: "Months inventory",v: 32, c: "#f59e0b" }],
      tenure:      [{ l: "Avg hold period",    v: 84, c: "#8b5cf6" }, { l: "Long-term owners",   v: 70, c: "#8b5cf6" }, { l: "Recent turnover",  v: 16, c: "#3b82f6" }, { l: "Estate sales",    v: 18, c: "#f59e0b" }, { l: "Absentee tenure", v: 76, c: "#f59e0b" }],
      delinquency: [{ l: "Tax delinquency",    v: 74, c: "#ef4444" }, { l: "Multi-yr delinquent",v: 50, c: "#ef4444" }, { l: "Late payment rate",v: 56, c: "#f59e0b" }, { l: "Lien risk",       v: 44, c: "#f59e0b" }, { l: "Current rate",    v: 26, c: "#3b82f6" }],
    },
    brief: "Momence ranks #2 in the county for equity pressure. High absentee rate and long-tenure owners create strong off-market potential — prioritize outreach this week.",
    tags: ["Tax delinquent", "Absentee owners", "High equity", "Long tenure"],
    topScore: { equity: 86, dom: 29, tenure: 84, delinquency: 74 },
  },
  "60940": {
    name: "Grant Park, IL", tier: "nurture", leads: 5, tierRgb: "59,130,246",
    stats: [
      { key: "Avg equity spread", val: "$28k",  delta: "Near avg",       up: false },
      { key: "Median AVM",        val: "$245k", delta: "+4% MoM",        up: true  },
      { key: "Absentee owners",   val: "13%",   delta: "Low",            up: false },
      { key: "Tax delinquent",    val: "2%",    delta: "Very low",       up: false },
      { key: "Avg hold yrs",      val: "8.8y",  delta: "Below avg",      up: false },
      { key: "Days on market",    val: "22d",   delta: "Fast buyer mkt", up: true  },
    ],
    signals: {
      equity:      [{ l: "Equity pressure",   v: 30, c: "#3b82f6" }, { l: "Tax delinquency",     v: 12, c: "#6b7094" }, { l: "Absentee rate",    v: 24, c: "#3b82f6" }, { l: "Owner tenure",    v: 40, c: "#3b82f6" }, { l: "Market velocity", v: 78, c: "#10b981" }],
      dom:         [{ l: "Avg days on market", v: 22, c: "#10b981" }, { l: "Price reductions",    v: 6, c: "#10b981"  }, { l: "Absorption rate",  v: 84, c: "#10b981" }, { l: "Relisting rate",  v: 4, c: "#10b981"  }, { l: "Months inventory",v: 20, c: "#10b981" }],
      tenure:      [{ l: "Avg hold period",    v: 40, c: "#3b82f6" }, { l: "Long-term owners",   v: 30, c: "#3b82f6" }, { l: "Recent turnover",  v: 50, c: "#f59e0b" }, { l: "Estate sales",    v: 6, c: "#3b82f6"  }, { l: "Absentee tenure", v: 32, c: "#3b82f6" }],
      delinquency: [{ l: "Tax delinquency",    v: 12, c: "#10b981" }, { l: "Multi-yr delinquent",v: 4, c: "#10b981"  }, { l: "Late payment rate",v: 10, c: "#10b981" }, { l: "Lien risk",       v: 6, c: "#10b981"  }, { l: "Current rate",    v: 90, c: "#10b981" }],
    },
    brief: "Low seller-motivation signals in Grant Park. Strong buyer demand but owners aren't motivated to sell. Nurture queue only — re-evaluate in 90 days.",
    tags: ["Low signal", "Fast buyer market", "Nurture only"],
    topScore: { equity: 30, dom: 22, tenure: 40, delinquency: 12 },
  },
};

const INITIAL_SAVED: SavedMarket[] = [
  { zip: "60901", tier: "hot",  alert: true,  alertText: "4 new HOT leads" },
  { zip: "60914", tier: "warm", alert: false, alertText: "" },
  { zip: "60954", tier: "hot",  alert: true,  alertText: "Equity shift +9%" },
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

const SLOT_COLORS = ["#3b82f6", "#a855f7", "#10b981"] as const;

// ─── Icon helper ──────────────────────────────────────────────────────────────

function Ico({ d, size = 13, strokeWidth = 2.5 }: { d: string; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: "inline-block", verticalAlign: "-2px" }}>
      <path d={d} />
    </svg>
  );
}

const D = {
  search:   "M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  bars:     "M18 20V10M12 20V4M6 20v-6",
  bookmark: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
  bolt:     "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  star:     "M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z",
  chevron:  "M9 18l6-6-6-6",
  x:        "M18 6L6 18M6 6l12 12",
};

// ─── Sub-components (all unchanged from v4) ───────────────────────────────────

function SecLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 16px" }} />;
}

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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)" }}>{s.l}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: s.c, fontVariantNumeric: "tabular-nums", minWidth: 28, textAlign: "right" }}>{s.v}</span>
                <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600 }}>/100</span>
              </div>
            </div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.055)", borderRadius: 4, position: "relative", overflow: "visible" }}>
              <div style={{ height: "100%", width: `${Math.round(s.v / max * 100)}%`, background: s.c, borderRadius: 4 }} />
              <div style={{ position: "absolute", top: -3, left: `${tickPct}%`, width: 1.5, height: 14, background: "rgba(255,255,255,0.2)", borderRadius: 1 }} />
            </div>
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

function DetailPanel({ zip, layer, onAddCompare, onSave }: { zip: string; layer: Layer; onAddCompare: (zip: string) => void; onSave: (zip: string) => void }) {
  const d = ZIPS[zip];
  if (!d) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12, padding: 24, textAlign: "center", lineHeight: 1.7 }}>
      Click a ZIP on the map<br />to view its details here.
    </div>
  );
  const t = TC[d.tier];
  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "18px 16px 15px", borderBottom: "1px solid var(--border)", borderLeft: `3px solid ${t.color}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em", color: t.color }}>{zip}</span>
            <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 10, letterSpacing: ".05em", background: t.bg, color: t.color }}>{t.label}</span>
          </div>
          <button onClick={() => onAddCompare(zip)} style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-ui)" }}>
            + Compare
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 9 }}>{d.name}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {d.tags.map(tag => (
            <span key={tag} style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 9px", borderRadius: 4, background: t.bg, color: t.color, border: `1px solid ${t.color}33` }}>{tag}</span>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, padding: "18px 16px" }}>
        {d.stats.map(s => (
          <div key={s.key} style={{ background: "#151720", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 9, padding: 13 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>{s.key}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#d4d8e8", lineHeight: 1.15 }}>{s.val}</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, marginTop: 5, color: s.up ? "#10b981" : "#f87171" }}>{s.delta}</div>
          </div>
        ))}
      </div>
      <Divider />
      <div style={{ padding: "0 16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0 13px" }}>
          <SecLabel>Signal breakdown</SecLabel>
          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{LAYER_LABELS[layer].toLowerCase()}</span>
        </div>
        <SignalBars zip={zip} layer={layer} />
      </div>
      <Divider />
      <div style={{ margin: "0 16px 18px", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.18)", borderLeft: "3px solid var(--accent)", borderRadius: 8, padding: "14px 15px" }}>
        <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
          <Ico d={D.star} size={10} /> AI market brief
        </div>
        <div style={{ fontSize: 12, color: "#c4c8d8", lineHeight: 1.75 }}>
          {d.brief}{" "}
          <strong style={{ color: "var(--text-primary)", fontWeight: 700 }}>
            {d.leads} leads — {d.tier === "hot" ? "prioritize outreach this week." : d.tier === "warm" ? "follow up within the week." : "check back in 90 days."}
          </strong>
        </div>
      </div>
      <div style={{ padding: "14px 16px", display: "flex", gap: 8, flexShrink: 0, borderTop: "1px solid var(--border)", marginTop: "auto" }}>
        <button style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, fontWeight: 700, padding: "7px 14px", borderRadius: "var(--r-sm)", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontFamily: "var(--font-ui)" }}>
          <Ico d={D.bolt} size={11} /> View leads in Dashboard
        </button>
        <button onClick={() => onSave(zip)} style={{ fontSize: 11, fontWeight: 700, padding: "7px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-ui)", display: "flex", alignItems: "center", gap: 5 }}>
          <Ico d={D.bookmark} size={11} /> Save
        </button>
      </div>
    </div>
  );
}

function TopZipsPanel({ layer, onSelect }: { layer: Layer; onSelect: (zip: string) => void }) {
  const sorted = Object.entries(ZIPS).sort((a, b) => b[1].topScore[layer] - a[1].topScore[layer]);
  const max    = sorted[0][1].topScore[layer];
  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px 11px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div>
          <SecLabel>Top ZIPs</SecLabel>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>by {LAYER_LABELS[layer].toLowerCase()}</div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, background: "var(--accent-dim)", color: "var(--accent)", borderRadius: 10, padding: "2px 9px" }}>{sorted.length} ZIPs</span>
      </div>
      {sorted.map(([zip, d], i) => {
        const t = TC[d.tier];
        const s = d.topScore[layer];
        return (
          <div key={zip} onClick={() => onSelect(zip)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.025)"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: i === 0 ? t.color : "var(--text-muted)", width: 18, flexShrink: 0, textAlign: "center" }}>{i + 1}</div>
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
        <div style={{ fontSize: 11.5, color: "#8892a4", lineHeight: 1.6 }}>Switch the signal layer to re-rank ZIPs by a different market signal.</div>
      </div>
    </div>
  );
}

function ComparePanel({ compareList, layer, onRemove, onClear, onSelectZip }: { compareList: string[]; layer: Layer; onRemove: (zip: string) => void; onClear: () => void; onSelectZip: (zip: string) => void }) {
  const hasEnough = compareList.length >= 2;
  const scores    = compareList.map(z => ZIPS[z]?.topScore[layer] ?? 0);
  const winIdx    = scores.indexOf(Math.max(...scores));
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <SecLabel>Market comparison</SecLabel>
          <button onClick={onClear} style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-ui)" }}>Clear all</button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {compareList.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "4px 0" }}>Click ZIPs on the map or use + Compare in Detail view.</div>
          ) : (
            compareList.map((zip, i) => (
              <span key={zip} onClick={() => onRemove(zip)} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, padding: "3px 10px 3px 8px", borderRadius: 6, border: `1.5px solid ${SLOT_COLORS[i]}`, color: SLOT_COLORS[i], background: `${SLOT_COLORS[i]}18`, cursor: "pointer" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: SLOT_COLORS[i], display: "inline-block", flexShrink: 0 }} />
                {zip} — {ZIPS[zip]?.name}
                <span style={{ marginLeft: 2, opacity: .6 }}>×</span>
              </span>
            ))
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {!hasEnough ? (
          <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 12, lineHeight: 1.8 }}>
            <div style={{ fontSize: 28, marginBottom: 12, opacity: .3 }}>⇄</div>
            {compareList.length === 0 ? <>Add 2–3 ZIPs to compare<br />signals, stats, and market<br />position side by side.</> : <>Add one more ZIP to<br />start the comparison.</>}
          </div>
        ) : (
          <>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>Verdict — {LAYER_LABELS[layer]}</div>
              {compareList.map((zip, i) => {
                const d = ZIPS[zip]; if (!d) return null;
                const t = TC[d.tier]; const isWin = i === winIdx;
                return (
                  <div key={zip} style={{ background: "#151720", border: `${isWin ? "1.5px" : "1px"} solid ${isWin ? `${SLOT_COLORS[i]}55` : "rgba(255,255,255,0.07)"}`, borderRadius: 10, padding: "14px 15px", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: SLOT_COLORS[i], flexShrink: 0, display: "inline-block" }} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{zip}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: t.bg, color: t.color }}>{t.label}</span>
                      {isWin && <span style={{ fontSize: 9, fontWeight: 800, color: "#10b981", letterSpacing: ".06em", textTransform: "uppercase", marginLeft: "auto" }}>▲ Highest signal</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>{d.name} · {d.leads} leads · Score {scores[i]}</div>
                  </div>
                );
              })}
            </div>
            <Divider />
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>Key metrics</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-muted)", padding: "6px 8px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.06)", width: "38%" }}>Metric</th>
                    {compareList.map((zip, i) => <th key={zip} style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: SLOT_COLORS[i], padding: "6px 8px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{zip}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ZIPS[compareList[0]].stats.map((_, ki) => (
                    <tr key={ki}>
                      <td style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", padding: "9px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{ZIPS[compareList[0]].stats[ki].key}</td>
                      {compareList.map((zip, i) => { const s = ZIPS[zip].stats[ki]; return <td key={zip} style={{ fontSize: 11.5, fontWeight: 800, padding: "9px 8px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", color: s.up ? "#c0c5d8" : "#6b7094" }}>{s.val}<div style={{ fontSize: 8.5, fontWeight: 700, color: s.up ? "#10b981" : "#f87171", marginTop: 1 }}>{s.delta}</div></td>; })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Divider />
            <div style={{ padding: "14px 16px 20px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>Actions</div>
              {compareList.map((zip, i) => { const d = ZIPS[zip]; const t = TC[d.tier]; return (
                <div key={zip} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", marginBottom: 7, background: "#151720", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)", borderLeft: `3px solid ${SLOT_COLORS[i]}` }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#c0c5d8" }}>{zip} — {d.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{d.leads} leads · {t.label}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => onSelectZip(zip)} style={{ fontSize: 10, fontWeight: 700, padding: "5px 10px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-ui)" }}>Detail</button>
                    <button style={{ fontSize: 10, fontWeight: 700, padding: "5px 10px", borderRadius: 5, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontFamily: "var(--font-ui)" }}>Leads →</button>
                  </div>
                </div>
              ); })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SavedPanel({ saved, onSelect }: { saved: SavedMarket[]; onSelect: (zip: string) => void }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px 11px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <SecLabel>Saved markets</SecLabel>
        <span style={{ fontSize: 10, fontWeight: 700, background: "var(--accent-dim)", color: "var(--accent)", borderRadius: 10, padding: "2px 9px" }}>{saved.length} watching</span>
      </div>
      {saved.map(s => {
        const d = ZIPS[s.zip]; const t = TC[s.tier];
        return (
          <div key={s.zip} onClick={() => onSelect(s.zip)}
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
              {s.alert && <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 10, background: "var(--warm-dim)", color: "var(--warm)" }}>{s.alertText}</span>}
              <Ico d={D.chevron} size={12} strokeWidth={2} />
            </div>
          </div>
        );
      })}
      <div style={{ margin: "14px 16px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 8, padding: "11px 13px" }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--warm)", marginBottom: 4 }}>Alerts active</div>
        <div style={{ fontSize: 11.5, color: "#b8aa80", lineHeight: 1.65 }}>Notify when equity pressure shifts ≥ 10% or new HOT leads appear in watched ZIPs.</div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExplorerScreen() {
  const [layer,        setLayer]        = useState<Layer>("equity");
  const [searchInput,  setSearchInput]  = useState("");
  const [searchQuery,  setSearchQuery]  = useState("");   // committed on Enter / search icon click
  const [searchMode,   setSearchMode]   = useState<SearchMode>("zip");
  const [selectedZip,  setSelectedZip]  = useState<string>("60901");
  const [compareList,  setCompareList]  = useState<string[]>([]);
  const [compareMode,  setCompareMode]  = useState(false);
  const [activeTab,    setActiveTab]    = useState<SideTab>("detail");
  const [saved,        setSaved]        = useState<SavedMarket[]>(INITIAL_SAVED);

  const SEARCH_PH: Record<SearchMode, string> = {
    zip:  "Enter a ZIP code (e.g. 60901)…",
    city: "Enter a city name (e.g. Kankakee)…",
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleZipClick = useCallback((zip: string) => {
    if (compareMode) {
      setCompareList(prev => {
        if (prev.includes(zip)) return prev;
        return prev.length >= 3 ? [...prev.slice(1), zip] : [...prev, zip];
      });
      setActiveTab("compare");
    } else {
      setSelectedZip(zip);
      setActiveTab("detail");
    }
  }, [compareMode]);

  const handleAddCompare = useCallback((zip: string) => {
    setCompareList(prev => {
      if (prev.includes(zip)) return prev;
      return prev.length >= 3 ? [...prev.slice(1), zip] : [...prev, zip];
    });
    setActiveTab("compare");
  }, []);

  const handleRemoveCompare = useCallback((zip: string) => {
    setCompareList(prev => prev.filter(z => z !== zip));
  }, []);

  const handleClearCompare = useCallback(() => setCompareList([]), []);

  const handleToggleCompareMode = useCallback(() => {
    setCompareMode(prev => {
      const next = !prev;
      setActiveTab(next ? "compare" : "detail");
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

  const commitSearch = useCallback(() => {
    if (searchInput.trim()) setSearchQuery(searchInput.trim());
  }, [searchInput]);

  const hotCount    = Object.values(ZIPS).filter(z => z.tier === "hot").length;
  const warmCount   = Object.values(ZIPS).filter(z => z.tier === "warm").length;
  const nurtureCount= Object.values(ZIPS).filter(z => z.tier === "nurture").length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Topbar ── */}
      <div style={{ height: "var(--topbar-height)", minHeight: "var(--topbar-height)", display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", gap: 7, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.01em" }}>Market Explorer</span>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", marginLeft: 1 }}>Kankakee County</span>
        <div style={{ flex: 1 }} />
        <SecLabel>Signal layer</SecLabel>
        <div style={{ display: "flex", gap: 5 }}>
          {(["equity", "dom", "tenure", "delinquency"] as Layer[]).map(l => (
            <button key={l} onClick={() => setLayer(l)} style={{ fontSize: 10, fontWeight: 700, padding: "4px 11px", borderRadius: 20, border: layer === l ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.09)", background: layer === l ? "var(--accent-dim)" : "transparent", color: layer === l ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-ui)", transition: "all .12s", whiteSpace: "nowrap" }}>
              {LAYER_LABELS[l]}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 4px", flexShrink: 0 }} />
        <button onClick={handleToggleCompareMode} style={{ fontSize: 10.5, fontWeight: 700, padding: "5px 12px", borderRadius: "var(--r-sm)", border: compareMode ? "1px solid var(--accent)" : "1px solid var(--border-strong)", background: compareMode ? "rgba(59,130,246,0.15)" : "transparent", color: compareMode ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-ui)", display: "flex", alignItems: "center", gap: 5 }}>
          <Ico d={D.bars} size={12} /> {compareMode ? "Exit compare" : "Compare ZIPs"}
        </button>
        <button onClick={() => setActiveTab("saved")} style={{ fontSize: 10.5, fontWeight: 700, padding: "5px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-ui)", display: "flex", alignItems: "center", gap: 5 }}>
          <Ico d={D.bookmark} size={12} /> Saved
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Map ── */}
        <div style={{ flex: 1, position: "relative", background: "#0e1018", overflow: "hidden" }}>

          {/* Search shelf */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1000, background: "linear-gradient(180deg,rgba(11,13,17,0.97) 0%,rgba(11,13,17,0.82) 80%,transparent 100%)", padding: "14px 16px 22px" }}>
            <div style={{ background: "#13151b", border: "1px solid rgba(255,255,255,0.18)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
              {/* Input row */}
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 14px", height: 44, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <Ico d={D.search} size={15} strokeWidth={2.5} />
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && commitSearch()}
                  placeholder={SEARCH_PH[searchMode]}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-ui)" }}
                />
                {searchInput && (
                  <button onClick={() => { setSearchInput(""); setSearchQuery(""); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, display: "flex" }}>
                    <Ico d={D.x} size={13} strokeWidth={2} />
                  </button>
                )}
                <button onClick={commitSearch} style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 9px", borderRadius: 4, background: "var(--accent-dim)", color: "var(--accent)", border: "none", cursor: "pointer", fontFamily: "var(--font-ui)", letterSpacing: ".02em", flexShrink: 0 }}>
                  Search
                </button>
              </div>
              {/* Mode row */}
              <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 8px", height: 34 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "var(--text-muted)", whiteSpace: "nowrap" as const, padding: "0 8px" }}>Search by</span>
                <div style={{ width: 1, height: 14, background: "var(--border)", margin: "0 3px", flexShrink: 0 }} />
                {([{ mode: "zip" as SearchMode, label: "ZIP code" }, { mode: "city" as SearchMode, label: "City" }]).map(({ mode, label }) => (
                  <button key={mode} onClick={() => setSearchMode(mode)} style={{ fontSize: 10, fontWeight: 700, padding: "4px 11px", borderRadius: 6, background: searchMode === mode ? "var(--accent-dim)" : "transparent", border: "none", color: searchMode === mode ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", fontFamily: "var(--font-ui)", whiteSpace: "nowrap" }}>
                    {label}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 8, fontSize: 9.5, color: "var(--text-muted)" }}>
                  {[{ dot: "#ef4444", text: `${hotCount} HOT` }, { dot: "#f59e0b", text: `${warmCount} WARM` }, { dot: "#3b82f6", text: `${nurtureCount} NURTURE` }].map(m => (
                    <div key={m.text} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot }} />
                      <span>{m.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Real Leaflet map (replaces MapCanvas + pins) ── */}
          <MapPanel
            zips={ZIPS}
            layer={layer}
            selectedZip={selectedZip}
            compareList={compareList}
            compareMode={compareMode}
            searchQuery={searchQuery}
            onZipClick={handleZipClick}
          />

          {/* Legend */}
          <div style={{ position: "absolute", bottom: 58, left: 16, zIndex: 500, background: "rgba(11,13,17,0.93)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 1 }}>{LAYER_LABELS[layer]}</div>
            {[{ color: "#ef4444", label: "High — act now" }, { color: "#f59e0b", label: "Medium — follow up" }, { color: "#3b82f6", label: "Low — nurture" }].map(r => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: "var(--text-secondary)" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                {r.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Sidebar (100% unchanged) ── */}
        <div style={{ width: 360, minWidth: 360, borderLeft: "1px solid var(--border)", background: "var(--bg-base)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
            {(["detail", "top", "compare", "saved"] as SideTab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, fontSize: 10, fontWeight: 700, padding: "11px 0 12px", background: "transparent", border: "none", borderBottom: `2px solid ${activeTab === tab ? "var(--accent)" : "transparent"}`, color: activeTab === tab ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", fontFamily: "var(--font-ui)", letterSpacing: ".03em", textTransform: "uppercase" }}>
                {tab === "detail" ? "Detail" : tab === "top" ? "Top ZIPs" : tab === "compare" ? "Compare" : "Saved"}
              </button>
            ))}
          </div>

          {compareMode && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", background: "rgba(59,130,246,0.07)", borderBottom: "1px solid rgba(59,130,246,0.18)", flexShrink: 0 }}>
              <Ico d={D.bars} size={12} strokeWidth={2.5} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)" }}>Comparing</span>
              <div style={{ display: "flex", gap: 5, flex: 1 }}>
                {compareList.map((zip, i) => (
                  <button key={zip} onClick={() => handleRemoveCompare(zip)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "3px 8px 3px 7px", borderRadius: 6, border: `1.5px solid ${SLOT_COLORS[i]}`, background: `${SLOT_COLORS[i]}18`, color: SLOT_COLORS[i], cursor: "pointer", fontFamily: "var(--font-ui)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: SLOT_COLORS[i], display: "inline-block" }} />
                    {zip} <span style={{ opacity: .6 }}>×</span>
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Click ZIPs to add</span>
            </div>
          )}

          {activeTab === "detail"  && <DetailPanel  zip={selectedZip} layer={layer} onAddCompare={handleAddCompare} onSave={handleSaveZip} />}
          {activeTab === "top"     && <TopZipsPanel  layer={layer} onSelect={handleSelectFromSaved} />}
          {activeTab === "compare" && <ComparePanel  compareList={compareList} layer={layer} onRemove={handleRemoveCompare} onClear={handleClearCompare} onSelectZip={handleSelectFromSaved} />}
          {activeTab === "saved"   && <SavedPanel    saved={saved} onSelect={handleSelectFromSaved} />}
        </div>
      </div>
    </div>
  );
}