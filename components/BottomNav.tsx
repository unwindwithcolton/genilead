"use client";

import React from "react";
import { C, RADIUS } from "../lib/theme";

export type RootTab = "home" | "leads" | "appt";

interface Props {
  activeTab: RootTab;
  onTabChange: (tab: RootTab) => void;
  newLeadCount?: number;
  apptCount?: number;
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"
        stroke={active ? C.accent : C.sub}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? `${C.accent}22` : "none"}
      />
      <path
        d="M9 21V12h6v9"
        stroke={active ? C.accent : C.sub}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LeadsIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        stroke={active ? C.accent : C.sub}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="9" cy="7" r="4"
        stroke={active ? C.accent : C.sub}
        strokeWidth="1.8"
        fill={active ? `${C.accent}22` : "none"}
      />
      <path
        d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke={active ? C.accent : C.sub}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect
        x="3" y="4" width="18" height="18" rx="2"
        stroke={active ? C.success : C.sub}
        strokeWidth="1.8"
        fill={active ? `${C.success}22` : "none"}
      />
      <path
        d="M16 2v4M8 2v4M3 10h18"
        stroke={active ? C.success : C.sub}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="8" cy="16" r="1.2" fill={active ? C.success : C.sub} />
      <circle cx="12" cy="16" r="1.2" fill={active ? C.success : C.sub} />
      <circle cx="16" cy="16" r="1.2" fill={active ? C.success : C.sub} />
    </svg>
  );
}

export default function BottomNav({ activeTab, onTabChange, newLeadCount = 0, apptCount = 0 }: Props) {
  const tabs: {
    id: RootTab;
    label: string;
    badge?: number;
    badgeColor?: string;
    icon: (a: boolean) => React.ReactElement;
  }[] = [
    { id: "home",  label: "Home",  icon: (a) => <HomeIcon active={a} /> },
    { id: "leads", label: "Leads", badge: newLeadCount, badgeColor: C.accent, icon: (a) => <LeadsIcon active={a} /> },
    { id: "appt",  label: "Appt",  badge: apptCount,    badgeColor: C.success, icon: (a) => <CalendarIcon active={a} /> },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      zIndex: 80,
      background: C.s1,
      borderTop: `1px solid ${C.border}`,
      paddingBottom: "calc(env(safe-area-inset-bottom) + 4px)",
      display: "flex",
      
    }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(activeTab === tab.id ? "home" : tab.id)}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 4, padding: "10px 0",
              background: "none", border: "none", cursor: "pointer",
              position: "relative",
            }}
          >
            <div style={{ position: "relative" }}>
              {tab.icon(isActive)}
              {tab.badge !== undefined && tab.badge > 0 && (
                <div style={{
                  position: "absolute", top: -6, right: -10,
                  minWidth: 20, height: 20,
                  background: tab.badgeColor ?? C.accent,
                  border: `2px solid ${C.s1}`,
                  borderRadius: "9999px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "#fff",
                  padding: "0 4px",
                  boxShadow: `0 0 8px ${tab.badgeColor ?? C.accent}66`,
                }}>
                  {tab.badge > 99 ? "99+" : tab.badge}
                </div>
              )}
            </div>
            <span style={{
              fontSize: 11, fontWeight: isActive ? 700 : 500,
              color: isActive ? (tab.id === "appt" ? C.success : C.accent) : C.sub,
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}