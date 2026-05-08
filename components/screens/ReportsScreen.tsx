// components/screens/ReportsScreen.tsx
"use client";

export default function ReportsScreen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: "var(--topbar-height)", minHeight: "var(--topbar-height)", display: "flex", alignItems: "center", padding: "0 28px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        <div style={{ fontSize: "15px", fontWeight: "600", letterSpacing: "-0.3px" }}>Reports</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
        <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-secondary)" }}>Reports</div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", maxWidth: "280px", textAlign: "center", lineHeight: 1.6 }}>Coming in a future session.</div>
      </div>
    </div>
  );
}