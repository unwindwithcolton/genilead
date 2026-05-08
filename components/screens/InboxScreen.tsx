"use client";
import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type Priority = "p1" | "p2" | "p3" | "p4";
type UrgencyVariant = "red" | "amber" | "blue" | "dim";
type ChannelType = "portal" | "email" | "sms" | "call" | "note";
type Direction = "in" | "out" | "none";

interface Thread {
  id: string;
  name: string;
  time: string;
  priority: Priority;
  urgencyLabel: string;
  urgencyVariant: UrgencyVariant;
  snippet: string;
  source: string;
  unread?: boolean;
}

interface TimelineEvent {
  id: string;
  channel: ChannelType;
  direction: Direction;
  label: string;
  ts: string;
  content: string;
}

// ── Static data ────────────────────────────────────────────────────────────
const THREADS: Thread[] = [
  { id: "marcus",  name: "Marcus Webb",   time: "9m ago",  priority: "p1", urgencyVariant: "red",   urgencyLabel: "⚠ Reply overdue · HOT",         snippet: "Re-engaged after 3 days — Oak Park 3BR inquiry",        source: "Zillow · SMS",         unread: true },
  { id: "priya",   name: "Priya Nair",    time: "34m ago", priority: "p1", urgencyVariant: "red",   urgencyLabel: "⚠ Reply overdue · Pre-approved",  snippet: "Wants to schedule a call after reviewing comps",        source: "FUB · Email",          unread: true },
  { id: "derek",   name: "Derek Solano",  time: "2h ago",  priority: "p2", urgencyVariant: "amber", urgencyLabel: "Follow-up due",                   snippet: "Asking about availability for showings this week",      source: "Realtor.com · Email" },
  { id: "angela",  name: "Angela Frost",  time: "5h ago",  priority: "p2", urgencyVariant: "amber", urgencyLabel: "Voicemail · WARM",                snippet: "Called in, left voicemail — callback requested",        source: "FUB · Call" },
  { id: "tom",     name: "Tom Hirano",    time: "1d ago",  priority: "p3", urgencyVariant: "blue",  urgencyLabel: "Nurture",                         snippet: "Checking for new Oak Park listings",                    source: "FUB · SMS" },
  { id: "sandra",  name: "Sandra Kim",    time: "2d ago",  priority: "p4", urgencyVariant: "dim",   urgencyLabel: "Info request",                    snippet: "Property tax question on 402 Maple Ave",               source: "FUB · Email" },
];

const TIMELINE: TimelineEvent[] = [
  { id: "e1", channel: "portal", direction: "in",   label: "Zillow inquiry", ts: "May 4, 9:12 AM",  content: '"Looking for 3BR under $420k in Oak Park, flexible on closing timeline."' },
  { id: "e2", channel: "email",  direction: "out",  label: "Email",          ts: "May 4, 2:30 PM",  content: "Sent intro + 3 comps in Oak Park. Invited to schedule a call." },
  { id: "e3", channel: "note",   direction: "none", label: "Note",           ts: "May 5, 11:00 AM", content: "Pre-approval confirmed at $400k. Lender: First Midwest. Flexible close." },
  { id: "e4", channel: "sms",    direction: "in",   label: "SMS",            ts: "Today, 9:41 AM",  content: '"Still available? Wanted to circle back on those Oak Park listings."' },
];

const DRAFTS: Record<string, string> = {
  SMS:         "Hey Marcus! Yes, still here — those Oak Park properties are moving fast. Are you free for a quick call today or tomorrow to narrow down which ones fit best?",
  Email:       "Hi Marcus,\n\nGreat to hear from you — yes, absolutely still available. I have a few Oak Park properties I'd love to walk you through. Are you free for a 15-min call this week?\n\nBest,",
  "Call script": "Opener: 'Hey Marcus, this is [Name] — glad you reached back out!'\n\nKey points:\n• 3 new comps since last week\n• One off-market at $395k — matches criteria exactly\n• Confirm pre-approval still active at $400k\n\nClose: 'Can we schedule a showing this weekend?'",
};

// ── Colour helpers (all values from globals.css tokens or v3 mockup) ───────
const PRIORITY_COLORS: Record<Priority, string> = {
  p1: "var(--hot)",
  p2: "var(--warm)",
  p3: "var(--accent)",
  p4: "rgba(255,255,255,.1)",
};

const URGENCY_STYLES: Record<UrgencyVariant, { bg: string; color: string }> = {
  red:   { bg: "var(--hot-dim)",                    color: "var(--hot)" },
  amber: { bg: "var(--warm-dim)",                   color: "var(--warm)" },
  blue:  { bg: "var(--accent-dim)",                 color: "var(--accent)" },
  dim:   { bg: "rgba(255,255,255,.06)",              color: "var(--text-secondary)" },
};

const CHANNEL_STYLES: Record<ChannelType, { bg: string; color: string; border: string }> = {
  portal: { bg: "rgba(139,92,246,.15)", color: "#8b5cf6", border: "rgba(139,92,246,.28)" },
  email:  { bg: "rgba(59,130,246,.12)", color: "var(--accent)", border: "rgba(59,130,246,.22)" },
  sms:    { bg: "rgba(16,185,129,.14)", color: "var(--success)", border: "rgba(16,185,129,.25)" },
  call:   { bg: "var(--warm-dim)",      color: "var(--warm)",    border: "rgba(245,158,11,.22)" },
  note:   { bg: "rgba(255,255,255,.06)",color: "var(--text-muted)", border: "rgba(255,255,255,.1)" },
};

const CHANNEL_LABEL_COLORS: Record<ChannelType, string> = {
  portal: "#8b5cf6",
  email:  "var(--accent)",
  sms:    "var(--success)",
  call:   "var(--warm)",
  note:   "var(--text-muted)",
};

// ── Inline SVG icons ───────────────────────────────────────────────────────
function IcoHome()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function IcoMail()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>; }
function IcoSms()     { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
function IcoPhone()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.77 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>; }
function IcoNote()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>; }
function IcoStar()    { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/></svg>; }
function IcoAlert()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>; }
function IcoClock()   { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IcoRefresh() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>; }
function IcoList()    { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>; }
function IcoArrow()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>; }

const CHANNEL_ICONS: Record<ChannelType, React.ReactElement> = {
  portal: <IcoHome />,
  email:  <IcoMail />,
  sms:    <IcoSms />,
  call:   <IcoPhone />,
  note:   <IcoNote />,
};

// ── Sub-components ─────────────────────────────────────────────────────────

function ThreadRow({ thread, selected, onClick }: { thread: Thread; selected: boolean; onClick: () => void }) {
  const urg = URGENCY_STYLES[thread.urgencyVariant];
  return (
    <div
      onClick={onClick}
      style={{
        padding: "13px 18px 13px 22px",
        borderBottom: "1px solid rgba(255,255,255,.05)",
        cursor: "pointer",
        position: "relative",
        background: selected ? "rgba(59,130,246,.07)" : undefined,
        boxShadow: selected ? "inset 0 0 0 1px rgba(59,130,246,.22), inset 4px 0 0 0 var(--accent)" : undefined,
        transition: "background .12s",
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,.025)"; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = ""; }}
    >
      {/* Priority bar — only shown when not selected (selected uses inset shadow) */}
      {!selected && (
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: "0 2px 2px 0", background: PRIORITY_COLORS[thread.priority] }} />
      )}

      {/* Row top */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {thread.unread && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />}
          <span style={{ fontSize: 13, fontWeight: 700, color: "#eceef5" }}>{thread.name}</span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>{thread.time}</span>
      </div>

      {/* Urgency chip */}
      <div style={{ marginBottom: 5 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: ".04em", padding: "2px 8px", borderRadius: 10, background: urg.bg, color: urg.color }}>
          {thread.urgencyLabel}
        </span>
      </div>

      {/* Snippet */}
      <div style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.4 }}>
        {thread.snippet}
      </div>

      {/* Source */}
      <div style={{ marginTop: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "#4a5068" }}>{thread.source}</span>
      </div>
    </div>
  );
}

function TimelineEventRow({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const ch = CHANNEL_STYLES[event.channel];
  const isInbound  = event.direction === "in";
  const isOutbound = event.direction === "out";
  const isNote     = event.channel === "note";

  const bubbleStyle: React.CSSProperties = isNote ? {
    background: "transparent",
    border: "1px dashed rgba(255,255,255,.1)",
    color: "#5a6278",
    fontStyle: "italic",
    fontSize: 12,
    borderRadius: 8,
    padding: "10px 13px",
    lineHeight: 1.65,
  } : isInbound ? {
    background: "#1e2338",
    border: "1px solid rgba(59,130,246,.25)",
    borderLeft: "3px solid rgba(59,130,246,.5)",
    color: "#d8ddf0",
    borderRadius: 8,
    borderTopLeftRadius: 3,
    padding: "10px 13px",
    fontSize: 12.5,
    lineHeight: 1.65,
  } : {
    background: "#181b24",
    border: "1px solid rgba(255,255,255,.07)",
    color: "#7a8399",
    borderRadius: 8,
    borderTopLeftRadius: 3,
    padding: "10px 13px",
    fontSize: 12.5,
    lineHeight: 1.65,
  };

  return (
    <div style={{ display: "flex", gap: 13, marginBottom: isLast ? 0 : 22, marginTop: isInbound ? 4 : 0 }}>
      {/* Icon column */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: ch.bg, color: ch.color, border: `1px solid ${ch.border}`, flexShrink: 0 }}>
          {CHANNEL_ICONS[event.channel]}
        </div>
        {!isLast && <div style={{ width: 1, flex: 1, background: "rgba(255,255,255,.06)", marginTop: 5, minHeight: 12 }} />}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: CHANNEL_LABEL_COLORS[event.channel] }}>
              {event.label}
            </span>
            {event.direction !== "none" && (
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", padding: "1px 6px", borderRadius: 6, background: isInbound ? "rgba(16,185,129,.1)" : "rgba(255,255,255,.06)", color: isInbound ? "var(--success)" : "#5a6278" }}>
                {isInbound ? "Inbound" : "Outbound"}
              </span>
            )}
          </div>
          <span style={{ fontSize: 10, color: "#4a5068", fontWeight: 600 }}>{event.ts}</span>
        </div>
        <div style={bubbleStyle}>{event.content}</div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function InboxScreen() {
  const [selectedId, setSelectedId]   = useState("marcus");
  const [activeSort, setActiveSort]   = useState("Reply priority");
  const [activeTab, setActiveTab]     = useState("SMS");
  const [draft, setDraft]             = useState(DRAFTS["SMS"]);
  const [regenerating, setRegenerating] = useState(false);

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    setDraft(DRAFTS[tab] ?? "");
  }

  function handleRegenerate() {
    setRegenerating(true);
    setDraft("");
    setTimeout(() => {
      setRegenerating(false);
      setDraft("Marcus, good timing — I just flagged a new Oak Park listing this morning, 3BR at $399k, off-market. Want me to send details? I have slots at 2pm or 4pm today.");
    }, 800);
  }

  const sortOptions = ["Reply priority", "Newest", "Unread"];

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", background: "var(--bg-base)", fontFamily: "var(--font-ui)" }}>

      {/* ══ LEFT RAIL ══ */}
      <div style={{ width: 320, minWidth: 320, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--bg-base)" }}>

        {/* Header */}
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", letterSpacing: ".03em" }}>Lead Inbox</span>
            <span style={{ fontSize: 10, fontWeight: 700, background: "var(--hot-dim)", color: "var(--hot)", border: "1px solid var(--hot-border)", borderRadius: 10, padding: "2px 8px" }}>4 urgent</span>
          </div>
          {/* Sort pills */}
          <div style={{ display: "flex", gap: 6 }}>
            {sortOptions.map(opt => {
              const isAmber = opt === "Reply priority";
              const active  = activeSort === opt;
              return (
                <span
                  key={opt}
                  onClick={() => setActiveSort(opt)}
                  style={{
                    fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
                    padding: "3px 10px", borderRadius: 20, cursor: "pointer", userSelect: "none",
                    border: active
                      ? `1px solid ${isAmber ? "var(--warm)" : "rgba(255,255,255,.18)"}`
                      : `1px dashed ${isAmber ? "rgba(245,158,11,.4)" : "rgba(255,255,255,.12)"}`,
                    color: isAmber ? "var(--warm)" : "var(--text-secondary)",
                    background: active ? (isAmber ? "var(--warm-dim)" : "rgba(255,255,255,.06)") : "transparent",
                  }}
                >
                  {opt}
                </span>
              );
            })}
          </div>
        </div>

        {/* Thread list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {THREADS.map(t => (
            <ThreadRow key={t.id} thread={t} selected={selectedId === t.id} onClick={() => setSelectedId(t.id)} />
          ))}
        </div>
      </div>

      {/* ══ MIDDLE ══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-surface)", borderRight: "1px solid var(--border)", minWidth: 0 }}>

        {/* Header */}
        <div style={{ padding: "15px 20px 13px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 5 }}>Marcus Webb</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", padding: "2px 9px", borderRadius: 10, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(59,130,246,.2)" }}>Active buyer</span>
            <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 600 }}>Assigned: You</span>
            <span style={{ fontSize: 10.5, color: "var(--hot)", fontWeight: 700 }}>· 3d without reply</span>
          </div>
        </div>

        {/* ── Banner hierarchy ── */}

        {/* 1. AI Brief — primary */}
        <div style={{ margin: "14px 20px 0", background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.2)", borderLeft: "3px solid var(--accent)", borderRadius: 8, padding: "12px 15px" }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <IcoStar /> AI conversation brief
          </div>
          <div style={{ fontSize: 12.5, color: "#c8cde0", lineHeight: 1.7 }}>
            Marcus inquired via Zillow 4 days ago about 3BR under $420k in Oak Park. Pre-approved at $400k. Responded once to your email, then went quiet — this text is his second reach-out.{" "}
            <strong style={{ color: "var(--text-primary)", fontWeight: 700 }}>High intent signal.</strong> Respond within the hour or risk losing the window.
          </div>
        </div>

        {/* 2. Urgency strip — secondary, low profile */}
        <div style={{ margin: "8px 20px 0", background: "rgba(239,68,68,.05)", border: "1px solid rgba(239,68,68,.18)", borderLeft: "3px solid var(--hot)", borderRadius: 6, padding: "6px 11px", fontSize: 11, fontWeight: 700, color: "var(--hot)", letterSpacing: ".02em", display: "flex", alignItems: "center", gap: 7 }}>
          <IcoAlert /> Reply window closing — last outreach 3 days ago, lead re-engaged
        </div>

        {/* 3. Customer signal — tertiary, inline only */}
        <div style={{ margin: "7px 20px 0", display: "flex", alignItems: "center", gap: 7, padding: "5px 0 5px 11px", borderLeft: "2px solid rgba(16,185,129,.3)" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#6b9e8f", fontWeight: 600 }}>
            Last signal: <span style={{ color: "#8fdcc7", fontWeight: 700 }}>"Still available? Wanted to circle back"</span> · SMS · Today 9:41 AM
          </span>
        </div>

        {/* Timeline */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 8px" }}>
          {TIMELINE.map((ev, i) => (
            <TimelineEventRow key={ev.id} event={ev} isLast={i === TIMELINE.length - 1} />
          ))}
        </div>

        {/* ── Composer ── */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,.09)", background: "#0f1117" }}>
          {/* Composer header — tabs + AI badge */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 18px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            <div style={{ display: "flex", gap: 0 }}>
              {["SMS", "Email", "Call script"].map(tab => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  style={{
                    fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
                    padding: "6px 14px 8px", cursor: "pointer", userSelect: "none",
                    color: activeTab === tab ? "var(--accent)" : "var(--text-muted)",
                    background: "transparent", border: "none",
                    borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                    fontFamily: "var(--font-ui)", transition: "color .1s, border-color .1s",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(59,130,246,.22)", borderRadius: 10, padding: "3px 9px", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
              <IcoStar /> AI draft — edit before sending
            </span>
          </div>

          {/* Composer body */}
          <div style={{ padding: "12px 18px 14px" }}>
            <textarea
              value={regenerating ? "" : draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={regenerating ? "Regenerating…" : ""}
              style={{
                width: "100%", background: "#1c1f2a",
                border: "1px solid rgba(255,255,255,.11)", borderRadius: 8,
                padding: "11px 14px", fontSize: 13, color: "#d4d9ee",
                fontFamily: "var(--font-ui)", resize: "none", height: 76,
                lineHeight: 1.6, outline: "none", marginBottom: 11,
                transition: "border-color .15s, background .15s",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(59,130,246,.45)"; e.currentTarget.style.background = "#1f2232"; }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,.11)"; e.currentTarget.style.background = "#1c1f2a"; }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 7 }}>
                {[{ label: "Regenerate", icon: <IcoRefresh />, action: handleRegenerate }, { label: "Templates", icon: <IcoList />, action: () => {} }].map(btn => (
                  <button
                    key={btn.label}
                    onClick={btn.action}
                    style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".04em", background: "transparent", border: "1px solid rgba(255,255,255,.1)", color: "var(--text-muted)", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontFamily: "var(--font-ui)", display: "flex", alignItems: "center", gap: 5, transition: "background .1s, color .1s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.05)"; e.currentTarget.style.color = "#c0c5d8"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
                  >
                    {btn.icon} {btn.label}
                  </button>
                ))}
              </div>
              <button
                style={{ fontSize: 12, fontWeight: 700, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 7, padding: "8px 22px", cursor: "pointer", fontFamily: "var(--font-ui)", letterSpacing: ".03em", boxShadow: "0 1px 8px rgba(59,130,246,.3)", transition: "opacity .15s" }}
                onMouseEnter={e => (e.currentTarget.style.opacity = ".9")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                {activeTab === "SMS" ? "Send SMS" : activeTab === "Email" ? "Send Email" : "Copy Script"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══ RIGHT RAIL ══ */}
      <div style={{ width: 272, minWidth: 272, background: "var(--bg-base)", display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* Next task hero */}
        <div style={{ margin: "14px 15px 0", background: "rgba(245,158,11,.07)", border: "1px solid rgba(245,158,11,.22)", borderLeft: "3px solid var(--warm)", borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--warm)", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <IcoClock /> Next task · Today
          </div>
          <div style={{ fontSize: 12, color: "#e4c97a", fontWeight: 600, lineHeight: 1.55 }}>
            Reply to SMS and offer two call times. Hot window — don't let it go another day.
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,.06)", margin: "13px 15px" }} />

        {/* Lead memory */}
        <div style={{ padding: "0 15px 12px" }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 9 }}>Lead memory</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
            {[
              { key: "Price",       val: "$380–420k",               full: false, color: undefined },
              { key: "Beds",        val: "3BR min",                  full: false, color: undefined },
              { key: "Areas",       val: "Oak Park, River Forest",   full: true,  color: undefined },
              { key: "Pre-approved",val: "$400k ✓",                  full: false, color: "var(--success)" },
              { key: "Urgency",     val: "High",                     full: false, color: "var(--hot)" },
              { key: "Timeline",    val: "Flexible close · Zillow",  full: true,  color: undefined },
            ].map(cell => (
              <div key={cell.key} style={{ gridColumn: cell.full ? "1 / -1" : undefined, background: "#151720", border: "1px solid rgba(255,255,255,.07)", borderRadius: 7, padding: "8px 10px" }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-muted)", marginBottom: 3, letterSpacing: ".04em", textTransform: "uppercase" }}>{cell.key}</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: cell.color ?? "#c0c5d8", lineHeight: 1.3 }}>{cell.val}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,.06)", margin: "0 15px 13px" }} />

        {/* Talking points */}
        <div style={{ padding: "0 15px 12px" }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 9 }}>Talking points</div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--hot)", marginBottom: 6 }}>Watch out</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
            {["HOA fees", "School district"].map(t => (
              <span key={t} style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 6, padding: "3px 10px", background: "rgba(239,68,68,.1)", color: "var(--hot)" }}>{t}</span>
            ))}
          </div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--success)", marginBottom: 6 }}>Push on</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {["Off-market", "Garage", "Quiet street"].map(t => (
              <span key={t} style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 6, padding: "3px 10px", background: "rgba(16,185,129,.1)", color: "var(--success)" }}>{t}</span>
            ))}
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,.06)", margin: "0 15px 13px" }} />

        {/* Touchpoints */}
        <div style={{ padding: "0 15px 12px" }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 9 }}>Touchpoints</div>
          {[
            { key: "Total events", val: "4",          color: undefined },
            { key: "Outbound",     val: "1 email",    color: undefined },
            { key: "Inbound",      val: "2 messages", color: undefined },
            { key: "Last reply",   val: "3d ago",     color: "var(--hot)" },
          ].map(row => (
            <div key={row.key} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>{row.key}</span>
              <span style={{ fontSize: 11.5, color: row.color ?? "#c0c5d8", fontWeight: 700 }}>{row.val}</span>
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,.06)", margin: "0 15px 13px" }} />

        {/* Handoff */}
        <div style={{ padding: "0 15px 14px" }}>
          <button
            style={{ width: "100%", background: "transparent", border: "1px solid rgba(255,255,255,.1)", borderRadius: 7, padding: "9px 0", fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)", cursor: "pointer", letterSpacing: ".03em", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "var(--font-ui)", transition: "background .1s, color .1s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.04)"; e.currentTarget.style.color = "#c0c5d8"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            <IcoArrow /> Hand off with context
          </button>
        </div>

      </div>
    </div>
  );
}