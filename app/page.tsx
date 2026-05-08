// app/page.tsx
// Main app shell — auth gate, sidebar nav, screen routing
// Uses createClient() factory pattern from lib/supabase.ts

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

import LoginScreen from "@/components/LoginScreen";
import Sidebar, { type Tab } from "@/components/Sidebar";
import DashboardScreen from "@/components/screens/DashboardScreen";
import OpportunitiesScreen from "@/components/screens/OpportunitiesScreen";
import InboxScreen from "@/components/screens/InboxScreen";
import PipelineScreen from "@/components/screens/PipelineScreen";
import ExplorerScreen from "@/components/screens/ExplorerScreen";
import OutreachScreen from "@/components/screens/OutreachScreen";
import ReportsScreen from "@/components/screens/ReportsScreen";
import SettingsScreen from "@/components/screens/SettingsScreen";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [hotCount, setHotCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch HOT count for sidebar badge
  useEffect(() => {
    if (!session) return;
    const supabase = createClient();

    async function fetchHotCount() {
      const { data } = await supabase
        .from("listing_scores")
        .select("id")
        .eq("temperature", "HOT");
      setHotCount(data?.length ?? 0);
    }

    fetchHotCount();
  }, [session]);

  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-base)",
          color: "var(--text-muted)",
          fontSize: "13px",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.04em",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  function handleSignOut() {
    createClient().auth.signOut();
  }

  const screenMap: Record<Tab, React.ReactNode> = {
    dashboard:     <DashboardScreen onNavigate={setActiveTab} />,
    opportunities: <OpportunitiesScreen />,
    inbox:         <InboxScreen />,
    pipeline:      <PipelineScreen />,
    explorer:      <ExplorerScreen />,
    outreach:      <OutreachScreen />,
    reports:       <ReportsScreen />,
    settings:      <SettingsScreen />,
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hotCount={hotCount}
        userEmail={session.user.email}
        onSignOut={handleSignOut}
      />
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--bg-base)",
        }}
      >
        {screenMap[activeTab]}
      </main>
    </div>
  );
}