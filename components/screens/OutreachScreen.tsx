"use client";
import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type Tier = "HOT" | "WARM" | "COLD";
type ChannelChip = "SMS" | "Email" | "Call";
type UrgencyState = "overdue" | "due" | "upcoming";
type ComposerTab = "SMS" | "Email" | "Call script";
type FilterPill = "All" | "Overdue" | "Due today" | "Upcoming";

interface QueueLead {
  id: string;
  name: string;
  tier: Tier;
  channel: ChannelChip;
  urgencyState: UrgencyState;
  urgencyText: string;
  touches: number;
  source: string;
  lastContact: string;
  unread?: boolean;
  // center panel
  address: string;
  ask: string;
  consentOk: boolean;
  aiSignals: string[];
  aiOpening: string;
  drafts: Record<ComposerTab, string>;
  sequenceName: string;
  sequenceTotal: number;
  sequenceStep: number;
  // right rail
  touchStats: { touches: number; lastContact: string; replies: number };
  contactLog: { channel: "sms" | "email" | "call"; title: string; date: string }[];
  talkingPush: string;
  talkingWatch: string;
  whyNow: string;
  scores: { label: string; value: number; color: string }[];
}

// ── Static data ────────────────────────────────────────────────────────────
const LEADS: QueueLead[] = [
  {
    id: "marcus",
    name: "Marcus Webb",
    tier: "HOT",
    channel: "SMS",
    urgencyState: "overdue",
    urgencyText: "Follow-up overdue 2d",
    touches: 3,
    source: "Zillow",
    lastContact: "4d ago",
    unread: true,
    address: "1847 Elmwood Dr",
    ask: "$485k ask",
    consentOk: true,
    aiSignals: ["3× Elmwood views", "Lease ends Jun 30", "No reply in 2d", "Pre-approved $500k"],
    aiOpening: '"Marcus — saw you viewed Elmwood again yesterday. I have 2 similar homes in your range coming off market this week. Worth a quick call?"',
    drafts: {
      SMS: "Hey Marcus, this is [Your Name] from [Agency]. Noticed you've been keeping an eye on 1847 Elmwood — I have two similar listings coming available this week in the $460–490k range. Want me to send details? Takes 2 min to look over.",
      Email: "Hi Marcus,\n\nWanted to reach out — I've been tracking a couple of listings in the $460–490k range that match what you were looking at on Elmwood. Both just became available this week.\n\nWorth a quick 10-min call to see if either fits? Happy to work around your schedule.\n\nBest,\n[Your Name]",
      "Call script": "Opener: 'Hey Marcus, [Your Name] here — I saw you were looking at Elmwood again and wanted to reach out directly.'\n\nKey points:\n• 2 similar listings just came available in the $460–490k range\n• One is off-market — won't hit Zillow\n• Pre-approval still active at $500k — good timing\n\nClose: 'Could we jump on a quick call this week to walk through them?'",
    },
    sequenceName: "Hot buyer — 7-step",
    sequenceTotal: 7,
    sequenceStep: 3,
    touchStats: { touches: 3, lastContact: "4d", replies: 0 },
    contactLog: [
      { channel: "sms",   title: "SMS — intro + listing link",  date: "4 days ago · no reply" },
      { channel: "email", title: "Email — market update",        date: "3 days ago · opened, no reply" },
      { channel: "call",  title: "Call — no answer, VM left",    date: "2 days ago" },
    ],
    talkingPush:  "Pre-approved $500k. Motivated — lease ends June 30. Viewed same address 3×.",
    talkingWatch: "Partner not yet aligned on neighborhood. No response to last 2 outreaches.",
    whyNow: "Viewed listing 3× in 6 days. Pre-approval on file. Lease window closing. Score jumped 12pts this week.",
    scores: [
      { label: "Opportunity", value: 82, color: "var(--accent)" },
      { label: "Intent",      value: 74, color: "var(--accent)" },
      { label: "Fit",         value: 61, color: "#8892a4" },
      { label: "Contact risk",value: 40, color: "var(--warm)" },
    ],
  },
  {
    id: "priya",
    name: "Priya Anand",
    tier: "HOT",
    channel: "Email",
    urgencyState: "overdue",
    urgencyText: "First reply overdue",
    touches: 1,
    source: "Direct",
    lastContact: "1d ago",
    address: "309 Birchwood Ln",
    ask: "$520k ask",
    consentOk: true,
    aiSignals: ["First-time buyer", "No prior contact", "Inquiry 1d ago"],
    aiOpening: '"Priya — thanks for reaching out about Birchwood. I have 3 similar properties in that range I\'d love to walk you through. When works for a quick call?"',
    drafts: {
      SMS: "Hi Priya, this is [Your Name] from [Agency]. Thanks for your inquiry on Birchwood — I have a couple of similar properties I think you'd love. Can we jump on a quick call this week?",
      Email: "Hi Priya,\n\nThank you for your inquiry — great to hear from you. I have 3 properties in the $500–530k range that match your criteria closely, including one just listed.\n\nWould love to walk you through them on a quick call. Any availability this week?\n\nBest,\n[Your Name]",
      "Call script": "Opener: 'Hi Priya, [Your Name] calling — you reached out about 309 Birchwood yesterday.'\n\nKey points:\n• 3 similar homes in the $500–530k range\n• One just listed — not yet on major portals\n• Happy to answer any questions about the area\n\nClose: 'Are you free for a 10-min call this week?'",
    },
    sequenceName: "New inquiry — 5-step",
    sequenceTotal: 5,
    sequenceStep: 1,
    touchStats: { touches: 1, lastContact: "1d", replies: 0 },
    contactLog: [
      { channel: "email", title: "Email — inquiry received", date: "1 day ago · unread" },
    ],
    talkingPush:  "First-time buyer, motivated. Inquiry was specific — knows the address.",
    talkingWatch: "No prior relationship. First contact — keep it warm, not pushy.",
    whyNow: "Fresh inquiry, 1 day old. No reply yet. First-contact window is closing fast.",
    scores: [
      { label: "Opportunity", value: 71, color: "var(--accent)" },
      { label: "Intent",      value: 68, color: "var(--accent)" },
      { label: "Fit",         value: 55, color: "#8892a4" },
      { label: "Contact risk",value: 20, color: "var(--warm)" },
    ],
  },
  {
    id: "okafor",
    name: "Tom & Lisa Okafor",
    tier: "WARM",
    channel: "SMS",
    urgencyState: "due",
    urgencyText: "Sequence step 3 — due today",
    touches: 5,
    source: "Referral",
    lastContact: "8d ago",
    address: "Multiple areas",
    ask: "$380–420k range",
    consentOk: true,
    aiSignals: ["Step 3 of 7", "Referral lead", "5 prior touches", "No reply in 8d"],
    aiOpening: '"Tom and Lisa — just wanted to check in. A couple of homes in your price range came up this week that match what you mentioned. Happy to send details?"',
    drafts: {
      SMS: "Hey Tom and Lisa, [Your Name] here — just checking in. A couple of properties in the $380–420k range came up this week that I think fit what you're looking for. Want me to send details?",
      Email: "Hi Tom and Lisa,\n\nHope you're well — wanted to reach out with a couple of listings that just came up in your range. Both match the criteria you mentioned and are worth a look.\n\nHappy to set up showings if anything catches your eye.\n\nBest,\n[Your Name]",
      "Call script": "Opener: 'Hey Tom, [Your Name] — just following up with a couple of new listings in your range.'\n\nKey points:\n• 2 new listings this week, $385k and $410k\n• Both in the neighbourhoods you mentioned\n• One has a showing slot Saturday morning\n\nClose: 'Want me to book you in for Saturday?'",
    },
    sequenceName: "Warm buyer — 7-step",
    sequenceTotal: 7,
    sequenceStep: 3,
    touchStats: { touches: 5, lastContact: "8d", replies: 1 },
    contactLog: [
      { channel: "sms",   title: "SMS — listing recommendations", date: "8 days ago · no reply" },
      { channel: "email", title: "Email — neighbourhood guide",    date: "12 days ago · opened" },
      { channel: "call",  title: "Call — spoke 5 min",            date: "15 days ago" },
    ],
    talkingPush:  "Referral from trusted source. Actively searching — budget is firm at $420k.",
    talkingWatch: "Going quiet after initial engagement. May be shopping other agents.",
    whyNow: "Sequence step 3 due. Last meaningful contact 15 days ago. Risk of going cold.",
    scores: [
      { label: "Opportunity", value: 63, color: "var(--accent)" },
      { label: "Intent",      value: 58, color: "#8892a4" },
      { label: "Fit",         value: 70, color: "var(--accent)" },
      { label: "Contact risk",value: 55, color: "var(--warm)" },
    ],
  },
  {
    id: "dana",
    name: "Dana Kowalski",
    tier: "WARM",
    channel: "Email",
    urgencyState: "due",
    urgencyText: "Check-in due today",
    touches: 2,
    source: "Realtor.com",
    lastContact: "5d ago",
    address: "Westside area",
    ask: "$440k range",
    consentOk: true,
    aiSignals: ["Realtor.com lead", "2 touches", "5d quiet"],
    aiOpening: '"Dana — checking in to see if anything on your end has changed. I have a few Westside listings I haven\'t shared yet that might be worth a look."',
    drafts: {
      SMS: "Hi Dana, [Your Name] here — just checking in. I have a few Westside listings I haven't shared yet in the $440k range. Anything changed on your end?",
      Email: "Hi Dana,\n\nJust wanted to check in — a few new Westside listings have come up since we last spoke that I think are worth a look.\n\nLet me know if you'd like me to send them over or set up a call.\n\nBest,\n[Your Name]",
      "Call script": "Opener: 'Hi Dana, [Your Name] — just a quick check-in, wanted to see how your search is going.'\n\nKey points:\n• A few new Westside listings in your range\n• Market moving fast — good time to be active\n• Happy to schedule showings\n\nClose: 'Want me to send the listings over by email?'",
    },
    sequenceName: "Warm buyer — 7-step",
    sequenceTotal: 7,
    sequenceStep: 2,
    touchStats: { touches: 2, lastContact: "5d", replies: 0 },
    contactLog: [
      { channel: "email", title: "Email — intro + listings",    date: "5 days ago · no reply" },
      { channel: "sms",   title: "SMS — quick check-in",        date: "8 days ago · no reply" },
    ],
    talkingPush:  "Realtor.com inquiry — actively browsing. Budget confirmed at $440k.",
    talkingWatch: "Two messages with no reply. May need a different channel or timing.",
    whyNow: "Check-in step due. Two unanswered messages — risk of disengagement if skipped.",
    scores: [
      { label: "Opportunity", value: 55, color: "#8892a4" },
      { label: "Intent",      value: 49, color: "#8892a4" },
      { label: "Fit",         value: 62, color: "var(--accent)" },
      { label: "Contact risk",value: 60, color: "var(--warm)" },
    ],
  },
  {
    id: "james",
    name: "James Ellery",
    tier: "COLD",
    channel: "SMS",
    urgencyState: "upcoming",
    urgencyText: "First contact — due tomorrow",
    touches: 0,
    source: "MLS alert",
    lastContact: "2d ago",
    address: "Northside",
    ask: "$310k range",
    consentOk: true,
    aiSignals: ["New lead", "0 touches", "MLS alert trigger"],
    aiOpening: '"Hi James — I noticed you set up an alert for Northside properties. I have a couple coming up that aren\'t listed yet. Worth a quick look?"',
    drafts: {
      SMS: "Hi James, [Your Name] from [Agency] here. I saw you set up an MLS alert for Northside — I have a couple of properties coming up that aren't listed yet. Interested?",
      Email: "Hi James,\n\nI noticed your MLS alert for Northside properties — great timing. I have a couple of listings coming up this week that haven't hit the portals yet.\n\nHappy to share details if you're still actively looking.\n\nBest,\n[Your Name]",
      "Call script": "Opener: 'Hi James, [Your Name] calling — I saw your MLS alert for Northside and wanted to reach out.'\n\nKey points:\n• 2 off-market listings in the $300–320k range\n• Both in your alert area\n• Happy to answer any questions\n\nClose: 'Can I send you the details by text or email?'",
    },
    sequenceName: "Cold intro — 5-step",
    sequenceTotal: 5,
    sequenceStep: 1,
    touchStats: { touches: 0, lastContact: "—", replies: 0 },
    contactLog: [],
    talkingPush:  "MLS alert set — actively browsing. Budget in range for current inventory.",
    talkingWatch: "Cold lead, no prior contact. Keep first message short and low-pressure.",
    whyNow: "New MLS-triggered lead. First contact window opens tomorrow — act early.",
    scores: [
      { label: "Opportunity", value: 44, color: "#8892a4" },
      { label: "Intent",      value: 38, color: "#8892a4" },
      { label: "Fit",         value: 50, color: "#8892a4" },
      { label: "Contact risk",value: 10, color: "var(--success)" },
    ],
  },
  {
    id: "sofia",
    name: "Sofia Reyes",
    tier: "COLD",
    channel: "Email",
    urgencyState: "upcoming",
    urgencyText: "Re-engagement — due in 3d",
    touches: 7,
    source: "Old pipeline",
    lastContact: "22d ago",
    address: "South Loop",
    ask: "$395k range",
    consentOk: false,
    aiSignals: ["Inactive 22d", "7 prior touches", "Re-engagement step"],
    aiOpening: '"Sofia — it\'s been a little while. A few South Loop listings just came up in your range. Happy to share if you\'re still looking."',
    drafts: {
      SMS: "Hi Sofia, [Your Name] here — it's been a little while. A couple of South Loop listings just came up in the $395k range. Still actively looking?",
      Email: "Hi Sofia,\n\nHope you're doing well — it's been a while since we last connected. A few South Loop properties just came up in your range that I thought might be worth sharing.\n\nNo pressure — just wanted to check in and see if you're still in the market.\n\nBest,\n[Your Name]",
      "Call script": "Opener: 'Hi Sofia, [Your Name] — I know it's been a while, just wanted to check in.'\n\nKey points:\n• A couple of new South Loop listings in your range\n• Market has shifted since we last spoke — more inventory now\n• Low-pressure — just want to make sure you have the info\n\nClose: 'Would it be okay if I sent you the details by email?'",
    },
    sequenceName: "Re-engagement — 3-step",
    sequenceTotal: 3,
    sequenceStep: 1,
    touchStats: { touches: 7, lastContact: "22d", replies: 2 },
    contactLog: [
      { channel: "email", title: "Email — follow-up #3",  date: "22 days ago · no reply" },
      { channel: "sms",   title: "SMS — check-in",        date: "28 days ago · no reply" },
      { channel: "call",  title: "Call — spoke briefly",  date: "35 days ago" },
    ],
    talkingPush:  "Previously engaged — replied twice in earlier touches. Knows the brand.",
    talkingWatch: "22-day silence. Consent status flagged — confirm opt-in before SMS.",
    whyNow: "Re-engagement sequence starts in 3 days. Low effort, high upside if she's still active.",
    scores: [
      { label: "Opportunity", value: 38, color: "#8892a4" },
      { label: "Intent",      value: 31, color: "#8892a4" },
      { label: "Fit",         value: 45, color: "#8892a4" },
      { label: "Contact risk",value: 72, color: "var(--hot)" },
    ],
  },
];

const TEMPLATES = [
  { channel: "SMS",   name: "Price drop alert — buyer",   desc: "Personalised alert when a watched listing drops in price" },
  { channel: "SMS",   name: "New listing match",           desc: "Surfaces a new match based on their saved search criteria" },
  { channel: "Email", name: "Re-engagement (90d+)",        desc: "Low-pressure check-in for leads quiet for 3+ months" },
  { channel: "Email", name: "Referral ask — past client",  desc: "Warm ask after a successful close or positive interaction" },
];

// Sequence steps for display — derived from sequenceStep / sequenceTotal
function buildSteps(step: number, total: number): { label: string; state: "done" | "now" | "future" }[] {
  const labels = ["D1 SMS", "D2 Email", "D4 SMS", "D6 Call", "D9 Email", "D12 SMS", "D14 Email"];
  return Array.from({ length: total }, (_, i) => ({
    label: labels[i] ?? `Step ${i + 1}`,
    state: i < step - 1 ? "done" : i === step - 1 ? "now" : "future",
  }));
}

// ── Colour helpers ─────────────────────────────────────────────────────────
const TIER_STYLES: Record<Tier, { bg: string; color: string; border: string }> = {
  HOT:  { bg: "rgba(239,68,68,0.14)",   color: "#f87171", border: "rgba(239,68,68,0.3)"   },
  WARM: { bg: "rgba(245,158,11,0.12)",  color: "#fbbf24", border: "rgba(245,158,11,0.28)" },
  COLD: { bg: "rgba(107,114,128,0.1)",  color: "#9ca3af", border: "rgba(107,114,128,0.2)" },
};

const CH_CHIP_STYLES: Record<ChannelChip, { bg: string; color: string; border: string }> = {
  SMS:   { bg: "rgba(16,185,129,0.1)",  color: "#34d399", border: "rgba(16,185,129,0.22)" },
  Email: { bg: "rgba(59,130,246,0.1)",  color: "#60a5fa", border: "rgba(59,130,246,0.22)" },
  Call:  { bg: "rgba(245,158,11,0.1)",  color: "#fbbf24", border: "rgba(245,158,11,0.2)"  },
};

const URGENCY_COLOR: Record<UrgencyState, string> = {
  overdue:  "#f87171",
  due:      "#fbbf24",
  upcoming: "var(--text-muted)",
};

const LOG_ICON_STYLES: Record<"sms" | "email" | "call", { bg: string; color: string; label: string }> = {
  sms:   { bg: "rgba(16,185,129,0.12)", color: "#34d399", label: "S" },
  email: { bg: "rgba(59,130,246,0.12)", color: "#60a5fa", label: "E" },
  call:  { bg: "rgba(245,158,11,0.10)", color: "#fbbf24", label: "C" },
};

// ── Inline SVG icons ───────────────────────────────────────────────────────
function IcoStar() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path d="M5.5 1L6.8 4.2H10L7.4 6.3 8.3 9.5 5.5 7.6 2.7 9.5 3.6 6.3 1 4.2H4.2L5.5 1Z" fill="#60a5fa" />
    </svg>
  );
}
function IcoRegen() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M8.5 5A3.5 3.5 0 1 1 5 1.5M8.5 1.5v3h-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IcoCheck() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5.5" stroke="#34d399" strokeWidth="1" />
      <path d="M3.5 6l1.6 1.6L8.5 4" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IcoNow() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5.5" stroke="#3b82f6" strokeWidth="1.5" />
      <circle cx="6" cy="6" r="2" fill="#3b82f6" />
    </svg>
  );
}
function IcoInfo() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <circle cx="5" cy="5" r="4.5" stroke="#6b7094" strokeWidth="1" />
      <path d="M5 4.5v3M5 3.2v.4" stroke="#6b7094" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
function IcoConsentOk() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <circle cx="5" cy="5" r="4.5" stroke="#34d399" strokeWidth="1" />
      <path d="M3 5l1.3 1.3L7 3.5" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IcoConsentNo() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <circle cx="5" cy="5" r="4.5" stroke="#f87171" strokeWidth="1" />
      <path d="M3.5 3.5l3 3M6.5 3.5l-3 3" stroke="#f87171" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function IcoPushUp() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M5 8V2M5 2L2.5 4.5M5 2L7.5 4.5" stroke="#34d399" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IcoWarn() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M5 2v3.5M5 7.2v.4" stroke="#f87171" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="5" cy="5" r="4.5" stroke="#f87171" strokeWidth="1" />
    </svg>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function QueueRow({ lead, selected, onClick }: { lead: QueueLead; selected: boolean; onClick: () => void }) {
  const tier = TIER_STYLES[lead.tier];
  const ch   = CH_CHIP_STYLES[lead.channel];
  return (
    <div
      onClick={onClick}
      style={{
        padding: "11px 12px 11px 15px",
        borderLeft: `3px solid ${selected ? "var(--accent)" : "transparent"}`,
        borderBottom: "1px solid rgba(255,255,255,0.035)",
        cursor: "pointer",
        background: selected ? "rgba(59,130,246,0.07)" : undefined,
        boxShadow: selected ? "inset 0 0 0 1px rgba(59,130,246,0.18)" : undefined,
        transition: "background .12s",
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.025)"; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = ""; }}
    >
      {/* Row top — tier badge + name + unread dot */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 3, letterSpacing: "0.3px", flexShrink: 0, background: tier.bg, color: tier.color, border: `1px solid ${tier.border}` }}>
          {lead.tier}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text-primary)" }}>
          {lead.name}
        </span>
        {lead.unread && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />}
      </div>

      {/* Urgency row — channel chip + urgency text */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 3, letterSpacing: "0.2px", flexShrink: 0, background: ch.bg, color: ch.color, border: `1px solid ${ch.border}` }}>
          {lead.channel}
        </span>
        <span style={{ fontSize: 11, color: URGENCY_COLOR[lead.urgencyState], whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {lead.urgencyText}
        </span>
      </div>

      {/* Meta */}
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {lead.touches} {lead.touches === 1 ? "touch" : "touches"} · {lead.source} · {lead.lastContact}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function OutreachScreen() {
  const [selectedId, setSelectedId]   = useState<string>(LEADS[0].id);
  const [activeFilter, setActiveFilter] = useState<FilterPill>("All");
  const [activeTab, setActiveTab]     = useState<ComposerTab>("SMS");
  const [draft, setDraft]             = useState<string>(LEADS[0].drafts["SMS"]);
  const [regenerating, setRegenerating] = useState(false);
  const [hoveredTemplate, setHoveredTemplate] = useState<number | null>(null);

  const lead = LEADS.find(l => l.id === selectedId) ?? LEADS[0];
  const steps = buildSteps(lead.sequenceStep, lead.sequenceTotal);

  const filters: FilterPill[] = ["All", "Overdue", "Due today", "Upcoming"];

  const filteredLeads = LEADS.filter(l => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Overdue")   return l.urgencyState === "overdue";
    if (activeFilter === "Due today") return l.urgencyState === "due";
    if (activeFilter === "Upcoming")  return l.urgencyState === "upcoming";
    return true;
  });

  function handleSelectLead(l: QueueLead) {
    setSelectedId(l.id);
    setActiveTab("SMS");
    setDraft(l.drafts["SMS"]);
    setRegenerating(false);
  }

  function handleTabChange(tab: ComposerTab) {
    setActiveTab(tab);
    setDraft(lead.drafts[tab] ?? "");
  }

  function handleRegenerate() {
    setRegenerating(true);
    setDraft("");
    setTimeout(() => {
      setRegenerating(false);
      setDraft(lead.aiOpening.replace(/^"|"$/g, ""));
    }, 800);
  }

  function handleUseTemplate(t: typeof TEMPLATES[0]) {
    const tab: ComposerTab = t.channel === "SMS" ? "SMS" : "Email";
    setActiveTab(tab);
    setDraft(`[${t.name}] ${lead.drafts[tab]}`);
  }

  const sendLabel =
    activeTab === "SMS"          ? `Send SMS — log to CRM` :
    activeTab === "Email"        ? `Send Email — log to CRM` :
    `Copy script`;

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", background: "var(--bg-base)", fontFamily: "var(--font-ui)" }}>

      {/* ══ LEFT RAIL ══ */}
      <div style={{ width: 272, minWidth: 272, background: "var(--bg-surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>

        {/* Head */}
        <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.3px", marginBottom: 10 }}>
            Draft queue{" "}
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>{filteredLeads.length} leads</span>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {filters.map(f => (
              <span
                key={f}
                onClick={() => setActiveFilter(f)}
                style={{
                  padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                  cursor: "pointer", userSelect: "none",
                  border: activeFilter === f ? "1px solid rgba(59,130,246,0.35)" : "1px solid rgba(255,255,255,0.1)",
                  color: activeFilter === f ? "#60a5fa" : "var(--text-secondary)",
                  background: activeFilter === f ? "rgba(59,130,246,0.12)" : "transparent",
                  transition: "background .1s",
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Queue */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredLeads.map(l => (
            <QueueRow key={l.id} lead={l} selected={selectedId === l.id} onClick={() => handleSelectLead(l)} />
          ))}
        </div>
      </div>

      {/* ══ CENTER ══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-base)", minWidth: 0 }}>

        {/* Contact identity header */}
        <div style={{ padding: "13px 20px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "var(--bg-surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            {/* Avatar */}
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(59,130,246,0.14)", border: "1px solid rgba(59,130,246,0.28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#60a5fa", flexShrink: 0, letterSpacing: "-0.5px" }}>
              {lead.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.4px", color: "var(--text-primary)" }}>{lead.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: TIER_STYLES[lead.tier].color, letterSpacing: "0.3px" }}>{lead.tier}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· {lead.address} · {lead.ask}</span>
              </div>
            </div>
          </div>
          {/* Consent badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "4px 9px", borderRadius: 5, flexShrink: 0, background: lead.consentOk ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: lead.consentOk ? "1px solid rgba(16,185,129,0.22)" : "1px solid rgba(239,68,68,0.22)", color: lead.consentOk ? "#34d399" : "#f87171" }}>
            {lead.consentOk ? <IcoConsentOk /> : <IcoConsentNo />}
            {lead.consentOk ? "SMS & email opted in" : "Consent not confirmed"}
          </div>
        </div>

        {/* AI zone — full-bleed distinct bg */}
        <div style={{ background: "#0e1320", borderBottom: "1px solid rgba(59,130,246,0.15)", padding: "12px 18px", flexShrink: 0 }}>
          <div style={{ background: "#111827", borderRadius: "var(--r-md)", border: "1px solid rgba(59,130,246,0.24)", borderLeft: "3px solid var(--accent)", padding: "11px 14px 12px" }}>
            {/* AI card head */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, letterSpacing: "0.6px", color: "#60a5fa", textTransform: "uppercase" }}>
                <IcoStar /> AI recommended opening
              </div>
              <button
                onClick={handleRegenerate}
                style={{ fontSize: 10, color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", fontFamily: "var(--font-ui)", transition: "color .1s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-secondary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <IcoRegen /> Regenerate
              </button>
            </div>
            {/* Signal pills */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
              {lead.aiSignals.map(s => (
                <span key={s} style={{ fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 3, background: "rgba(59,130,246,0.1)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.18)" }}>
                  {s}
                </span>
              ))}
            </div>
            {/* Quote */}
            <div style={{ fontSize: 12.5, color: "#d4d8e8", lineHeight: 1.65, fontStyle: "italic", borderLeft: "2px solid rgba(59,130,246,0.35)", paddingLeft: 10 }}>
              {lead.aiOpening}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", padding: "0 18px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--bg-surface)" }}>
          {(["SMS", "Email", "Call script"] as ComposerTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              style={{ padding: "9px 14px", fontSize: 12, fontWeight: 500, color: activeTab === tab ? "#60a5fa" : "var(--text-muted)", background: "transparent", border: "none", borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent", cursor: "pointer", fontFamily: "var(--font-ui)", transition: "color .1s" }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Composer body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 0, background: "var(--bg-base)" }}>

          {/* Draft card */}
          <div style={{ background: "var(--bg-card)", borderRadius: "var(--r-md)", border: "1px solid var(--border-strong)", marginBottom: 8, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 13px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", color: "#60a5fa", textTransform: "uppercase" }}>AI draft — edit before sending</span>
              <div style={{ display: "flex", gap: 6 }}>
                {["Use opening line", "Clear"].map(a => (
                  <button
                    key={a}
                    onClick={() => {
                      if (a === "Use opening line") setDraft(lead.aiOpening.replace(/^"|"$/g, ""));
                      if (a === "Clear") setDraft("");
                    }}
                    style={{ fontSize: 10, color: "var(--text-muted)", cursor: "pointer", padding: "1px 6px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", fontFamily: "var(--font-ui)", transition: "color .1s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--text-secondary)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={regenerating ? "" : draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={regenerating ? "Regenerating…" : ""}
              style={{ width: "100%", background: "transparent", border: "none", padding: "10px 14px 14px", fontSize: 13, color: "#e0e4f0", fontFamily: "var(--font-ui)", resize: "none", height: 100, lineHeight: 1.75, outline: "none" }}
            />
          </div>

          {/* Sequence divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 8px" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.5px", color: "var(--text-muted)", textTransform: "uppercase" }}>Sequence</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
          </div>

          {/* Sequence group */}
          <div style={{ background: "var(--bg-surface)", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", padding: "10px 12px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{lead.sequenceName}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>Step {lead.sequenceStep} of {lead.sequenceTotal}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {i > 0 && <div style={{ width: 12, height: 1, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, whiteSpace: "nowrap", color: s.state === "done" ? "#34d399" : s.state === "now" ? "#60a5fa" : "#3a3f55", fontWeight: s.state === "now" ? 600 : 400 }}>
                    {s.state === "done" && <IcoCheck />}
                    {s.state === "now"  && <IcoNow />}
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Templates divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 8px" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.5px", color: "var(--text-muted)", textTransform: "uppercase" }}>Templates</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
          </div>

          {/* Templates card */}
          <div style={{ background: "var(--bg-surface)", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px 8px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", color: "var(--text-muted)", textTransform: "uppercase" }}>Swap template</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{TEMPLATES.length} available</span>
            </div>
            {TEMPLATES.map((t, i) => (
              <div
                key={i}
                onClick={() => handleUseTemplate(t)}
                onMouseEnter={() => setHoveredTemplate(i)}
                onMouseLeave={() => setHoveredTemplate(null)}
                style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", borderBottom: i < TEMPLATES.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", cursor: "pointer", background: hoveredTemplate === i ? "var(--bg-card-hover)" : "transparent", transition: "background .1s" }}
              >
                {/* Channel icon */}
                <div style={{ width: 28, height: 28, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, marginTop: 1, background: t.channel === "SMS" ? "rgba(16,185,129,0.1)" : "rgba(59,130,246,0.1)", color: t.channel === "SMS" ? "#34d399" : "#60a5fa", border: t.channel === "SMS" ? "1px solid rgba(16,185,129,0.18)" : "1px solid rgba(59,130,246,0.18)" }}>
                  {t.channel === "SMS" ? "S" : "E"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.desc}</div>
                </div>
                <div style={{ fontSize: 10, color: "#60a5fa", opacity: hoveredTemplate === i ? 1 : 0, transition: "opacity .1s", padding: "2px 7px", borderRadius: 3, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.08)", whiteSpace: "nowrap", flexShrink: 0, alignSelf: "center" }}>
                  Use →
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Actions zone */}
        <div style={{ flexShrink: 0, background: "#161921", borderTop: "1px solid var(--border-strong)", padding: "13px 18px" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {["Skip", "Log call"].map(label => (
              <button
                key={label}
                style={{ padding: "9px 16px", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 500, cursor: "pointer", background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", fontFamily: "var(--font-ui)", transition: "background .1s, color .1s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-card-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-card)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              >
                {label}
              </button>
            ))}
            <button
              style={{ flex: 1, padding: "9px 16px", borderRadius: "var(--r-sm)", fontSize: 13, fontWeight: 600, letterSpacing: "-0.2px", cursor: "pointer", background: "var(--accent)", color: "#fff", border: "none", fontFamily: "var(--font-ui)", boxShadow: "0 1px 12px rgba(59,130,246,0.3)", transition: "background .1s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}
            >
              {sendLabel}
            </button>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <IcoInfo /> Sending will log to FUB and advance the sequence to step {lead.sequenceStep + 1}
          </div>
        </div>

      </div>

      {/* ══ RIGHT RAIL ══ */}
      <div style={{ width: 252, minWidth: 252, background: "var(--bg-surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* Touch stats */}
        <div style={{ padding: "13px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.6px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 9 }}>Touch history</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { num: String(lead.touchStats.touches), lbl: "touches"     },
              { num: lead.touchStats.lastContact,     lbl: "last contact"},
              { num: String(lead.touchStats.replies), lbl: "replies"     },
            ].map(box => (
              <div key={box.lbl} style={{ flex: 1, background: "var(--bg-card)", borderRadius: "var(--r-sm)", padding: "8px 6px 7px", textAlign: "center", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{box.num}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{box.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact log */}
        <div style={{ padding: "13px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.6px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 9 }}>Contact log</div>
          {lead.contactLog.length === 0 && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>No contact yet</div>
          )}
          {lead.contactLog.map((entry, i) => {
            const ico = LOG_ICON_STYLES[entry.channel];
            return (
              <div key={i} style={{ display: "flex", gap: 8, padding: "5px 0", alignItems: "flex-start" }}>
                <div style={{ width: 22, height: 22, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1, background: ico.bg, color: ico.color }}>
                  {ico.label}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#c8cfe0", lineHeight: 1.4 }}>{entry.title}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{entry.date}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Talking points */}
        <div style={{ borderBottom: "1px solid var(--border)", background: "#0d1019" }}>
          <div style={{ padding: "12px 14px 8px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.6px", color: "var(--text-muted)", textTransform: "uppercase" }}>Talking points</div>
          </div>
          {/* Push on */}
          <div style={{ margin: "0 14px 8px", borderRadius: "var(--r-sm)", padding: "10px 12px", background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "#34d399", marginBottom: 6 }}>
              <IcoPushUp /> Push on
            </div>
            <div style={{ fontSize: 12, color: "#c8cfe0", lineHeight: 1.55 }}>{lead.talkingPush}</div>
          </div>
          {/* Watch out */}
          <div style={{ margin: "0 14px 10px", borderRadius: "var(--r-sm)", padding: "10px 12px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "#f87171", marginBottom: 6 }}>
              <IcoWarn /> Watch out
            </div>
            <div style={{ fontSize: 12, color: "#c8cfe0", lineHeight: 1.55 }}>{lead.talkingWatch}</div>
          </div>
          {/* Why this lead now */}
          <div style={{ margin: "0 14px 12px", padding: "9px 11px", borderRadius: "var(--r-sm)", background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.14)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", color: "#60a5fa", textTransform: "uppercase", marginBottom: 5 }}>Why this lead now</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>{lead.whyNow}</div>
          </div>
        </div>

        {/* Lead score */}
        <div style={{ padding: "13px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.6px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 9 }}>Lead score</div>
          {lead.scores.map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", minWidth: 80 }}>{s.label}</div>
              <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${s.value}%`, height: 4, borderRadius: 2, background: s.color }} />
              </div>
              <div style={{ fontSize: 10, color: s.color === "var(--text-secondary)" ? "var(--text-muted)" : s.color, minWidth: 20, textAlign: "right" }}>{s.value}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}