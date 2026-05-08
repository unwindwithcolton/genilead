// components/screens/PipelineScreen.tsx
// Pipeline — Kanban board, v3 design
// Active zone (New → Appt Set) left, passive zone (Nurture / Closed / Dead) right
// Card states: act-now (breach / warn / moving / winning) vs waiting vs archived
// Health strip: active funnel percentages + outcome percentages
// Static mock data — wire to DB when pipeline_leads table exists

"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CardState = "breach" | "warn" | "moving" | "winning" | "waiting" | "archived";
type ChipVariant = "red" | "amber" | "blue" | "green" | "dim";
type Tier = "hot" | "warm" | "cool" | "green";
type Stage =
  | "new"
  | "contacted"
  | "replied"
  | "qualified"
  | "appt_set"
  | "nurture"
  | "closed"
  | "dead";

interface Chip {
  label: string;
  variant: ChipVariant;
}

interface PipelineCard {
  id: string;
  stage: Stage;
  address: string;
  city: string;
  score: number;
  scoreTier: Tier;
  stateLine: string;
  stateTag?: { label: string; color: string };
  chips: Chip[];
  ageDays: number | string;
  ageVariant: "ok" | "warn" | "breach" | "green";
  action: string;
  actionVariant: "overdue" | "due" | "ok" | "green" | "blue";
  cardState: CardState;
}

// ─── Static mock data ─────────────────────────────────────────────────────────

const CARDS: PipelineCard[] = [
  // NEW
  {
    id: "c1", stage: "new",
    address: "1124 Marilyn Dr", city: "Beverly Hills",
    score: 78, scoreTier: "hot",
    stateLine: "Tax delinquent + absentee",
    stateTag: { label: "● HOT", color: "#f87171" },
    chips: [{ label: "Tax delinquent", variant: "red" }, { label: "Absentee", variant: "red" }, { label: "High equity", variant: "amber" }],
    ageDays: "SLA today", ageVariant: "breach",
    action: "Call now →", actionVariant: "overdue",
    cardState: "breach",
  },
  {
    id: "c2", stage: "new",
    address: "707 N Oakhurst Dr", city: "Beverly Hills",
    score: 78, scoreTier: "hot",
    stateLine: "Tax delinquent + equity spread",
    stateTag: { label: "● HOT", color: "#f87171" },
    chips: [{ label: "Tax delinquent", variant: "red" }, { label: "High equity", variant: "amber" }],
    ageDays: "SLA today", ageVariant: "breach",
    action: "Call now →", actionVariant: "overdue",
    cardState: "breach",
  },
  {
    id: "c3", stage: "new",
    address: "502 N Alta Dr", city: "Beverly Hills",
    score: 58, scoreTier: "warm",
    stateLine: "Absentee + off-market",
    stateTag: { label: "● WARM", color: "#fbbf24" },
    chips: [{ label: "Absentee", variant: "amber" }, { label: "Equity spread", variant: "blue" }],
    ageDays: "Day 1", ageVariant: "ok",
    action: "Text today", actionVariant: "due",
    cardState: "waiting",
  },
  // CONTACTED
  {
    id: "c4", stage: "contacted",
    address: "1369 N Beverly Dr", city: "Beverly Hills",
    score: 52, scoreTier: "warm",
    stateLine: "No reply · 4 days stale",
    chips: [{ label: "AVM appreciation", variant: "blue" }, { label: "Owner-occupied", variant: "dim" }],
    ageDays: "4 days", ageVariant: "breach",
    action: "Follow up now →", actionVariant: "overdue",
    cardState: "breach",
  },
  {
    id: "c5", stage: "contacted",
    address: "800 N Linden Dr", city: "Beverly Hills",
    score: 48, scoreTier: "warm",
    stateLine: "Email sent · no reply",
    chips: [{ label: "Equity position", variant: "blue" }, { label: "No listing", variant: "dim" }],
    ageDays: "3 days", ageVariant: "warn",
    action: "Follow up today", actionVariant: "due",
    cardState: "warn",
  },
  {
    id: "c6", stage: "contacted",
    address: "1075 Wallace Rdg", city: "Beverly Hills",
    score: 52, scoreTier: "warm",
    stateLine: "SMS sent · awaiting reply",
    chips: [{ label: "Absentee owner", variant: "amber" }, { label: "No listing", variant: "dim" }],
    ageDays: "Day 2", ageVariant: "ok",
    action: "Call tomorrow", actionVariant: "ok",
    cardState: "waiting",
  },
  // REPLIED
  {
    id: "c7", stage: "replied",
    address: "3183 Abington Dr", city: "Beverly Hills",
    score: 71, scoreTier: "hot",
    stateLine: "Replied via SMS today",
    stateTag: { label: "● HOT", color: "#f87171" },
    chips: [{ label: "Tax delinquent", variant: "red" }, { label: "High equity", variant: "amber" }],
    ageDays: "Day 1", ageVariant: "ok",
    action: "Qualify today →", actionVariant: "blue",
    cardState: "moving",
  },
  {
    id: "c8", stage: "replied",
    address: "420 N Maple Dr", city: "Beverly Hills",
    score: 55, scoreTier: "warm",
    stateLine: "Email reply · interested",
    chips: [{ label: "Off-market", variant: "blue" }, { label: "Long hold", variant: "dim" }],
    ageDays: "Day 3", ageVariant: "ok",
    action: "Schedule call", actionVariant: "ok",
    cardState: "waiting",
  },
  // QUALIFIED
  {
    id: "c9", stage: "qualified",
    address: "612 N Bedford Dr", city: "Beverly Hills",
    score: 82, scoreTier: "hot",
    stateLine: "Price confirmed · motivated seller",
    chips: [{ label: "Motivated seller", variant: "red" }, { label: "High equity", variant: "amber" }],
    ageDays: "Day 5", ageVariant: "ok",
    action: "Set appointment →", actionVariant: "blue",
    cardState: "moving",
  },
  {
    id: "c10", stage: "qualified",
    address: "918 Whittier Dr", city: "Beverly Hills",
    score: 61, scoreTier: "warm",
    stateLine: "Wants cash offer · going cold",
    chips: [{ label: "Equity spread", variant: "blue" }, { label: "7 days stale", variant: "amber" }],
    ageDays: "7 days", ageVariant: "warn",
    action: "Follow up today", actionVariant: "due",
    cardState: "warn",
  },
  // APPT SET
  {
    id: "c11", stage: "appt_set",
    address: "224 S Reeves Dr", city: "Beverly Hills",
    score: 88, scoreTier: "hot",
    stateLine: "Appt May 10 · 2 days away",
    stateTag: { label: "● Appt May 10", color: "#10b981" },
    chips: [{ label: "Motivated seller", variant: "red" }, { label: "Confirmed", variant: "green" }],
    ageDays: "In 2 days", ageVariant: "green",
    action: "Confirm + prep →", actionVariant: "green",
    cardState: "winning",
  },
  {
    id: "c12", stage: "appt_set",
    address: "710 N Elm Dr", city: "Beverly Hills",
    score: 67, scoreTier: "warm",
    stateLine: "Appt May 12 · 4 days away",
    stateTag: { label: "● Appt May 12", color: "#10b981" },
    chips: [{ label: "Off-market", variant: "blue" }, { label: "Set", variant: "green" }],
    ageDays: "In 4 days", ageVariant: "green",
    action: "Prep offer", actionVariant: "green",
    cardState: "winning",
  },
  // NURTURE
  {
    id: "c13", stage: "nurture",
    address: "3400 Strathmore", city: "Beverly Hills",
    score: 38, scoreTier: "cool",
    stateLine: "Not ready · watching market",
    chips: [{ label: "Long hold", variant: "dim" }, { label: "Low equity", variant: "dim" }],
    ageDays: "14 days", ageVariant: "ok",
    action: "Check June", actionVariant: "ok",
    cardState: "archived",
  },
  {
    id: "c14", stage: "nurture",
    address: "505 N Canon Dr", city: "Beverly Hills",
    score: 42, scoreTier: "cool",
    stateLine: "Watching market · low urgency",
    chips: [{ label: "Owner-occupied", variant: "dim" }],
    ageDays: "21 days", ageVariant: "ok",
    action: "Monthly touch", actionVariant: "ok",
    cardState: "archived",
  },
  // CLOSED
  {
    id: "c15", stage: "closed",
    address: "1880 Carla Ridge", city: "Closed May 2",
    score: 91, scoreTier: "green",
    stateLine: "$1.85M · 18 days total",
    chips: [{ label: "Won ✓", variant: "green" }],
    ageDays: "18 days", ageVariant: "green",
    action: "Closed", actionVariant: "green",
    cardState: "archived",
  },
  // DEAD
  {
    id: "c16", stage: "dead",
    address: "244 S Rexford Dr", city: "Beverly Hills",
    score: 44, scoreTier: "cool",
    stateLine: "Unresponsive · 14 days",
    chips: [{ label: "No response", variant: "dim" }],
    ageDays: "14 days", ageVariant: "ok",
    action: "Archived", actionVariant: "ok",
    cardState: "archived",
  },
];

// ─── Funnel data ──────────────────────────────────────────────────────────────

const ACTIVE_FUNNEL = [
  { key: "new",       label: "New",       pct: 100, count: 3, color: "#3b82f6", pctColor: "#5a6080"  },
  { key: "contacted", label: "Contacted", pct: 62,  count: 3, color: "#f59e0b", pctColor: "#f59e0b"  },
  { key: "replied",   label: "Replied",   pct: 38,  count: 2, color: "#f59e0b", pctColor: "#f59e0b"  },
  { key: "qualified", label: "Qualified", pct: 24,  count: 2, color: "#3b82f6", pctColor: "#5a6080"  },
  { key: "appt_set",  label: "Appt Set",  pct: 18,  count: 2, color: "#10b981", pctColor: "#10b981"  },
];

const PASSIVE_FUNNEL = [
  { key: "nurture", label: "Nurture", pct: 0,  count: 2, color: "#252836", pctColor: "#252836"  },
  { key: "closed",  label: "Closed",  pct: 11, count: 1, color: "#10b981", pctColor: "#10b981"  },
  { key: "dead",    label: "Dead",    pct: 8,  count: 1, color: "#ef4444", pctColor: "#ef4444"  },
];

// ─── Style helpers ────────────────────────────────────────────────────────────

function cardBg(state: CardState): React.CSSProperties {
  switch (state) {
    case "breach":   return { background: "linear-gradient(96deg, rgba(239,68,68,0.06) 0%, #13151b 60%)", border: "1px solid rgba(239,68,68,0.2)", borderLeft: "3px solid #ef4444" };
    case "warn":     return { background: "linear-gradient(96deg, rgba(245,158,11,0.04) 0%, #13151b 60%)", border: "1px solid rgba(255,255,255,0.08)", borderLeft: "3px solid #f59e0b" };
    case "moving":   return { background: "linear-gradient(96deg, rgba(59,130,246,0.04) 0%, #13151b 60%)", border: "1px solid rgba(255,255,255,0.08)", borderLeft: "3px solid #3b82f6" };
    case "winning":  return { background: "linear-gradient(96deg, rgba(16,185,129,0.05) 0%, #13151b 60%)", border: "1px solid rgba(255,255,255,0.08)", borderLeft: "3px solid #10b981" };
    case "waiting":  return { background: "#0f1117", border: "1px solid rgba(255,255,255,0.05)", borderLeft: "3px solid #151820" };
    case "archived": return { background: "#0d0f14", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "3px solid #131620", opacity: 0.55 };
  }
}

function addrColor(state: CardState): string {
  if (state === "archived") return "#3a3f58";
  if (state === "waiting")  return "#6b7094";
  return "#dde0ec";
}

function stateLineColor(state: CardState): string {
  if (state === "archived") return "#2e3350";
  if (state === "waiting")  return "#3a3f58";
  return "#5a6080";
}

const CHIP_STYLES: Record<ChipVariant, React.CSSProperties> = {
  red:   { background: "rgba(239,68,68,0.10)",  color: "#f87171", border: "1px solid rgba(239,68,68,0.15)"  },
  amber: { background: "rgba(245,158,11,0.08)",  color: "#fbbf24", border: "1px solid rgba(245,158,11,0.14)"  },
  blue:  { background: "rgba(59,130,246,0.08)",  color: "#60a5fa", border: "1px solid rgba(59,130,246,0.14)"  },
  green: { background: "rgba(16,185,129,0.08)",  color: "#10b981", border: "1px solid rgba(16,185,129,0.14)"  },
  dim:   { background: "#111318",                color: "#252836", border: "1px solid #161a22"                },
};

const SCORE_COLOR: Record<Tier, string> = {
  hot:   "#f87171",
  warm:  "#fbbf24",
  cool:  "#3a3f58",
  green: "#10b981",
};

const AGE_STYLES: Record<string, React.CSSProperties> = {
  ok:     { background: "#111318",                    color: "#2e3350", border: "1px solid #161a22"                },
  warn:   { background: "rgba(245,158,11,0.07)",      color: "#d97706", border: "1px solid rgba(245,158,11,0.15)"  },
  breach: { background: "rgba(239,68,68,0.09)",       color: "#f87171", border: "1px solid rgba(239,68,68,0.18)"  },
  green:  { background: "rgba(16,185,129,0.07)",      color: "#10b981", border: "1px solid rgba(16,185,129,0.15)" },
};

const ACTION_COLOR: Record<string, string> = {
  overdue: "#f87171",
  due:     "#fbbf24",
  ok:      "#2e3350",
  green:   "#10b981",
  blue:    "#60a5fa",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PipelineCard({ card }: { card: PipelineCard }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 10,
        padding: "13px 14px 11px",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        filter: hovered ? "brightness(1.08)" : "brightness(1)",
        transition: "filter 0.12s",
        ...cardBg(card.cardState),
      }}
    >
      {/* Row 1: who */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: addrColor(card.cardState), lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {card.address}
          </div>
          <div style={{ fontSize: 10, color: "#2e3350", marginTop: 1 }}>{card.city}</div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: SCORE_COLOR[card.scoreTier], lineHeight: 1, flexShrink: 0 }}>
          {card.score}
        </div>
      </div>

      {/* Row 2: state line */}
      <div style={{ fontSize: 10.5, color: stateLineColor(card.cardState), marginBottom: 8, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {card.stateTag && (
          <span style={{ color: card.stateTag.color, fontWeight: 700, marginRight: 4 }}>{card.stateTag.label}</span>
        )}
        {card.stateTag ? `· ${card.stateLine}` : card.stateLine}
      </div>

      {/* Row 3: chips */}
      <div style={{ display: "flex", gap: 4, marginBottom: 9, overflow: "hidden" }}>
        {card.chips.map((chip) => (
          <span key={chip.label} style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0, ...CHIP_STYLES[chip.variant] }}>
            {chip.label}
          </span>
        ))}
      </div>

      {/* Row 4: age + action */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 9, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 4, flexShrink: 0, ...AGE_STYLES[card.ageVariant] }}>
          {card.ageVariant === "breach" ? `⚠ ${card.ageDays}` : String(card.ageDays)}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, marginLeft: "auto", whiteSpace: "nowrap", color: ACTION_COLOR[card.actionVariant] }}>
          {card.action}
        </span>
      </div>
    </div>
  );
}

function AddButton() {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "transparent",
        border: `1px dashed ${hovered ? "#252836" : "#161a22"}`,
        borderRadius: 9, padding: 9, textAlign: "center",
        fontSize: 10, fontWeight: 600,
        color: hovered ? "#3a3f58" : "#1e2230",
        cursor: "pointer", width: "100%",
        fontFamily: "var(--font-ui)",
        transition: "all 0.1s",
      }}
    >
      + Add lead
    </button>
  );
}

function ColHead({ title, isActive, badge, badgeVariant, slaBreach }: {
  title: string;
  isActive: boolean;
  badge: number;
  badgeVariant: "hot" | "warm" | "green" | "dim";
  slaBreach?: boolean;
}) {
  const badgeStyles: Record<string, React.CSSProperties> = {
    hot:   { background: "rgba(239,68,68,0.12)",  color: "#f87171"  },
    warm:  { background: "rgba(245,158,11,0.09)", color: "#fbbf24"  },
    green: { background: "rgba(16,185,129,0.10)", color: "#10b981"  },
    dim:   { background: "#1a1d26",               color: "#2e3350"  },
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 2px 9px", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 1 }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: isActive ? "#6b7094" : "#252836" }}>
        {title}
      </span>
      {slaBreach && (
        <span style={{ fontSize: 9, fontWeight: 800, color: "#ef4444", background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.18)", padding: "1px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>
          1 breach
        </span>
      )}
      <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 20, marginLeft: "auto", ...badgeStyles[badgeVariant] }}>
        {badge}
      </span>
    </div>
  );
}

function FunnelItem({ item, showArrow }: { item: typeof ACTIVE_FUNNEL[0]; showArrow: boolean }) {
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "0 14px", borderRight: showArrow ? "none" : undefined }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3a3f58" }}>{item.label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
          <span style={{ fontSize: 14, fontWeight: 800, lineHeight: 1, color: item.pctColor }}>{item.pct > 0 ? `${item.pct}%` : "—"}</span>
          <span style={{ fontSize: 10, color: "#2e3350", fontWeight: 600 }}>{item.count}</span>
        </div>
        <div style={{ height: 2, width: 52, background: "#1a1d26", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${item.pct}%`, background: item.color, borderRadius: 2 }} />
        </div>
      </div>
      {showArrow && <div style={{ fontSize: 11, color: "#1e2230", alignSelf: "center", padding: "0 2px", flexShrink: 0 }}>›</div>}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PipelineScreen() {
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const cardsFor = (stage: Stage) => CARDS.filter((c) => c.stage === stage);

  const slaCount = CARDS.filter((c) => c.ageVariant === "breach").length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <div style={{
        height: "var(--topbar-height)", minHeight: "var(--topbar-height)",
        display: "flex", alignItems: "center", padding: "0 24px", gap: 12,
        borderBottom: "1px solid var(--border)", background: "var(--bg-surface)",
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>Pipeline</div>
        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", background: "var(--bg-card)", padding: "2px 9px", borderRadius: 20 }}>
          {CARDS.filter(c => !["closed","dead"].includes(c.stage)).length} active
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7 }}>
          {/* View toggle */}
          <TopBtn label="Kanban" active={view === "kanban"} onClick={() => setView("kanban")} />
          <TopBtn label="List"   active={view === "list"}   onClick={() => setView("list")}   />
          <div style={{ width: 1, height: 18, background: "var(--border)" }} />
          {/* SLA warning */}
          {slaCount > 0 && (
            <button style={{
              fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 6,
              border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.07)",
              color: "#ef4444", cursor: "pointer", fontFamily: "var(--font-ui)",
            }}>
              ⚠ {slaCount} SLA {slaCount === 1 ? "breach" : "breaches"}
            </button>
          )}
          <TopBtn label="Sort ↓" />
          <div style={{ width: 1, height: 18, background: "var(--border)" }} />
          <button style={{
            fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 6,
            border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.06)",
            color: "#10b981", cursor: "pointer", fontFamily: "var(--font-ui)",
          }}>
            + Add lead
          </button>
        </div>
      </div>

      {/* ── Board health strip ─────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, borderBottom: "1px solid var(--border)", background: "#0d0f15", display: "flex", alignItems: "stretch" }}>
        {/* Active funnel */}
        <div style={{ display: "flex", flex: 1, padding: "10px 20px 10px 24px", gap: 0, borderRight: "1px solid rgba(255,255,255,0.10)" }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2e3350", alignSelf: "center", marginRight: 14, flexShrink: 0, whiteSpace: "nowrap" }}>
            Active funnel
          </div>
          {ACTIVE_FUNNEL.map((item, i) => (
            <FunnelItem key={item.key} item={item} showArrow={i < ACTIVE_FUNNEL.length - 1} />
          ))}
        </div>
        {/* Passive outcomes */}
        <div style={{ display: "flex", padding: "10px 24px 10px 16px", gap: 0, opacity: 0.5 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#1e2230", alignSelf: "center", marginRight: 14, flexShrink: 0, whiteSpace: "nowrap" }}>
            Outcomes
          </div>
          {PASSIVE_FUNNEL.map((item, i) => (
            <FunnelItem key={item.key} item={item} showArrow={i < PASSIVE_FUNNEL.length - 1} />
          ))}
        </div>
      </div>

      {/* ── Kanban board ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden", padding: "14px 20px", display: "flex", gap: 0, alignItems: "flex-start" }}>

        {/* ACTIVE ZONE */}
        <div style={{ display: "flex", gap: 12, paddingRight: 16, borderRight: "2px solid rgba(255,255,255,0.06)" }}>
          {/* NEW */}
          <KanbanCol width={230}>
            <ColHead title="New" isActive badge={cardsFor("new").length} badgeVariant="hot" />
            {cardsFor("new").map(c => <PipelineCard key={c.id} card={c} />)}
            <AddButton />
          </KanbanCol>

          {/* CONTACTED */}
          <KanbanCol width={230}>
            <ColHead title="Contacted" isActive badge={cardsFor("contacted").length} badgeVariant="warm" slaBreach />
            {cardsFor("contacted").map(c => <PipelineCard key={c.id} card={c} />)}
          </KanbanCol>

          {/* REPLIED */}
          <KanbanCol width={230}>
            <ColHead title="Replied" isActive badge={cardsFor("replied").length} badgeVariant="dim" />
            {cardsFor("replied").map(c => <PipelineCard key={c.id} card={c} />)}
            <AddButton />
          </KanbanCol>

          {/* QUALIFIED */}
          <KanbanCol width={230}>
            <ColHead title="Qualified" isActive badge={cardsFor("qualified").length} badgeVariant="dim" />
            {cardsFor("qualified").map(c => <PipelineCard key={c.id} card={c} />)}
            <AddButton />
          </KanbanCol>

          {/* APPT SET */}
          <KanbanCol width={230}>
            <ColHead title="Appt Set" isActive badge={cardsFor("appt_set").length} badgeVariant="green" />
            {cardsFor("appt_set").map(c => <PipelineCard key={c.id} card={c} />)}
            <AddButton />
          </KanbanCol>
        </div>

        {/* Zone label */}
        <div style={{
          fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
          writingMode: "vertical-rl", textOrientation: "mixed",
          color: "#1e2232", alignSelf: "stretch", display: "flex", alignItems: "center",
          padding: "0 7px", flexShrink: 0,
        }}>
          storage
        </div>

        {/* PASSIVE ZONE */}
        <div style={{ display: "flex", gap: 12, paddingLeft: 16, opacity: 0.5 }}>
          {/* NURTURE */}
          <KanbanCol width={185}>
            <ColHead title="Nurture" isActive={false} badge={cardsFor("nurture").length} badgeVariant="dim" />
            {cardsFor("nurture").map(c => <PipelineCard key={c.id} card={c} />)}
          </KanbanCol>

          {/* CLOSED */}
          <KanbanCol width={185}>
            <ColHead title="Closed" isActive={false} badge={cardsFor("closed").length} badgeVariant="green" />
            {cardsFor("closed").map(c => <PipelineCard key={c.id} card={c} />)}
          </KanbanCol>

          {/* DEAD */}
          <KanbanCol width={185}>
            <ColHead title="Dead" isActive={false} badge={cardsFor("dead").length} badgeVariant="dim" />
            {cardsFor("dead").map(c => <PipelineCard key={c.id} card={c} />)}
          </KanbanCol>
        </div>

      </div>
    </div>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function KanbanCol({ children, width }: { children: React.ReactNode; width: number }) {
  return (
    <div style={{ width, minWidth: width, display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
      {children}
    </div>
  );
}

function TopBtn({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 6,
        border: active ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.1)",
        background: active ? "rgba(59,130,246,0.1)" : hovered ? "rgba(255,255,255,0.04)" : "transparent",
        color: active ? "#3b82f6" : "var(--text-muted)",
        cursor: "pointer", fontFamily: "var(--font-ui)",
        transition: "background 0.1s",
      }}
    >
      {label}
    </button>
  );
}