// components/Sidebar.tsx
// Desktop sidebar — "Geni" white, "Lead" blue
// No lucide-react. Inline SVG icons only.

"use client";

export type Tab =
  | "dashboard"
  | "scored_leads"
  | "opportunities"
  | "inbox"
  | "pipeline"
  | "explorer"
  | "outreach"
  | "reports"
  | "settings";

function Icon({ d, size = 17 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  home:     "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  target:   "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  inbox:    "M22 12h-6l-2 3H10l-2-3H2 M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  kanban:   "M3 3h18v18H3z M9 3v18 M15 3v18",
  map:      "M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z M13 13l6 6",
  send:     "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
  chart:    "M18 20V10 M12 20V4 M6 20v-6",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  logout:   "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
};

const NAV_ITEMS: { tab: Tab; label: string; iconKey: keyof typeof ICONS }[] = [
  { tab: "dashboard",     label: "Dashboard",       iconKey: "home"    },
  { tab: "scored_leads",  label: "Scored Leads",    iconKey: "target"  },
  { tab: "outreach",      label: "Outreach",        iconKey: "send"    },
  { tab: "inbox",         label: "Lead inbox",      iconKey: "inbox"   },
  { tab: "pipeline",      label: "Pipeline",        iconKey: "kanban"  },
  { tab: "explorer",      label: "Market explorer", iconKey: "map"     },
  { tab: "reports",       label: "Reports",         iconKey: "chart"   },
];

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hotCount?: number;
  onSignOut?: () => void;
  userEmail?: string;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  hotCount = 0,
  onSignOut,
  userEmail,
}: SidebarProps) {
  return (
    <aside
      style={{
        width: "var(--sidebar-width)",
        minWidth: "var(--sidebar-width)",
        height: "100vh",
        // Glass base — nearly clear so plasma bleeds through
        background: "rgba(12,14,20,0.38)",
        backdropFilter: "blur(28px) saturate(1.6) brightness(1.08)",
        WebkitBackdropFilter: "blur(28px) saturate(1.6) brightness(1.08)",
        // Right edge — the brightest specular line (light hitting the glass edge)
        borderRight: "1px solid rgba(255,255,255,0.22)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: "relative",
        zIndex: 2,
        // Lens effect — brighter at edges, recedes in center (magnification illusion)
        // Plus top specular highlight and left inner reflection
        boxShadow: `
          inset 1px 0 0 rgba(255,255,255,0.06),
          inset -1px 0 0 rgba(255,255,255,0.18),
          inset 0 1px 0 rgba(255,255,255,0.15),
          inset 0 -1px 0 rgba(255,255,255,0.06)
        `,
      }}
    >
      {/* Lens gradient layer — mimics glass edge magnification */}
      <div style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        background: `
          radial-gradient(ellipse at 0% 50%, rgba(255,255,255,0.055) 0%, transparent 60%),
          radial-gradient(ellipse at 100% 50%, rgba(255,255,255,0.07) 0%, transparent 55%),
          radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 50%),
          linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 15%, transparent 85%, rgba(255,255,255,0.025) 100%)
        `,
      }} />
      {/* Ensure all sidebar content sits above the lens layer */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Logo */}
      <div
        style={{
          padding: "20px 20px 18px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div
          style={{
            width: "30px",
            height: "30px",
            background: "var(--accent)",
            borderRadius: "var(--r-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: "600",
            color: "#fff",
            flexShrink: 0,
            letterSpacing: "-0.5px",
          }}
        >
          GL
        </div>
        <span style={{ fontSize: "16px", fontWeight: "600", letterSpacing: "-0.4px" }}>
          <span style={{ color: "#f0f2f7" }}>Geni</span>
          <span style={{ color: "var(--accent)" }}>Lead</span>
        </span>
      </div>

      {/* Nav */}
      <nav
        style={{
          flex: 1,
          padding: "12px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            fontWeight: "500",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            padding: "4px 8px 8px",
          }}
        >
          Main
        </div>

        {NAV_ITEMS.map(({ tab, label, iconKey }) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "9px 10px",
                borderRadius: "var(--r-md)",
                border: "none",
                background: isActive ? "var(--accent-dim)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: isActive ? "500" : "400",
                fontSize: "13.5px",
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                }
              }}
            >
              <Icon d={ICONS[iconKey]} />
              <span style={{ flex: 1 }}>{label}</span>
              {tab === "dashboard" && hotCount > 0 && (
                <span
                  style={{
                    background: "var(--hot)",
                    color: "#fff",
                    fontSize: "10px",
                    fontWeight: "600",
                    padding: "2px 6px",
                    borderRadius: "20px",
                    fontFamily: "var(--font-mono)",
                    minWidth: "20px",
                    textAlign: "center",
                  }}
                >
                  {hotCount}
                </span>
              )}
            </button>
          );
        })}

        <div
          style={{
            fontSize: "10px",
            fontWeight: "500",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            padding: "12px 8px 8px",
            marginTop: "4px",
            borderTop: "1px solid var(--border)",
          }}
        >
          Admin
        </div>

        <button
          onClick={() => onTabChange("settings")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "9px 10px",
            borderRadius: "var(--r-md)",
            border: "none",
            background: activeTab === "settings" ? "var(--accent-dim)" : "transparent",
            color: activeTab === "settings" ? "var(--accent)" : "var(--text-secondary)",
            fontWeight: activeTab === "settings" ? "500" : "400",
            fontSize: "13.5px",
            width: "100%",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <Icon d={ICONS.settings} />
          <span>Settings</span>
        </button>
      </nav>

      {/* User row */}
      <div style={{ padding: "12px 10px", borderTop: "1px solid var(--border)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 10px",
            borderRadius: "var(--r-md)",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "var(--accent-dim)",
              border: "1px solid var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              fontWeight: "600",
              color: "var(--accent)",
              flexShrink: 0,
            }}
          >
            {userEmail ? userEmail.slice(0, 2).toUpperCase() : "GL"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "500",
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {userEmail ?? "Agent"}
            </div>
            <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              zip 90210
            </div>
          </div>
          {onSignOut && (
            <button
              onClick={onSignOut}
              title="Sign out"
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                padding: "4px",
                borderRadius: "var(--r-sm)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Icon d={ICONS.logout} size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
    </aside>
  );
}