"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase";
import type { ScoredListing } from "../types";
import ListingCard from "../components/ListingCard";
import BottomNav, { type RootTab } from "../components/BottomNav";

import dynamic from "next/dynamic";
const LoginScreen = dynamic(() => import("../components/LoginScreen"), {
  ssr: false,
});

type Session = Awaited<
  ReturnType<ReturnType<typeof createClient>["auth"]["getSession"]>
>["data"]["session"];

// ─── Placeholder screens ──────────────────────────────────────────────────────

function LeadsScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-8">
      <p className="text-5xl mb-4">📋</p>
      <p className="text-[var(--color-text)] font-semibold text-lg">Leads Pipeline</p>
      <p className="text-[var(--color-text-muted)] text-sm mt-2">
        Full leads management coming next session.
      </p>
    </div>
  );
}

function ApptScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-8">
      <p className="text-5xl mb-4">📅</p>
      <p className="text-[var(--color-text)] font-semibold text-lg">Appointments</p>
      <p className="text-[var(--color-text-muted)] text-sm mt-2">
        Appointment scheduling coming next session.
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<ScoredListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RootTab>("home");

  const supabase = createClient();

  // ── Auth listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch listings once authed ─────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;

    setListingsLoading(true);
    setError(null);

    fetch("/api/listings")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setListings(json.listings ?? []);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setListingsLoading(false));
  }, [session]);

  // ── Derived counts for nav badges ─────────────────────────────────────────
  // hotCount = number of HOT listings — drives the Leads badge
  const hotCount = listings.filter((l) => l.temperature === "hot").length;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg)]">
        <div className="text-[var(--color-text-muted)] text-sm tracking-widest animate-pulse">
          LOADING…
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight text-[var(--color-text)]">
          GeniLead
        </h1>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* Tab body */}
      <section className="px-4 pt-4 space-y-3">
        {activeTab === "home" && (
          <>
            {listingsLoading && (
              <p className="text-center text-[var(--color-text-muted)] text-sm py-12 animate-pulse">
                Fetching listings…
              </p>
            )}

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            {!listingsLoading && !error && listings.length === 0 && (
              <div className="text-center py-20 text-[var(--color-text-muted)] text-sm">
                <p className="text-4xl mb-3">🏚️</p>
                <p>No listings found for your zip codes.</p>
                <p className="mt-1 text-xs">Run the ingest job to pull fresh data.</p>
              </div>
            )}

            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </>
        )}

        {activeTab === "leads" && <LeadsScreen />}
        {activeTab === "appt" && <ApptScreen />}
      </section>

      {/* Bottom nav — always visible when authed */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        newLeadCount={hotCount}
      />
    </main>
  );
}