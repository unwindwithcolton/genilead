"use client";

import { useState } from "react";
import { createClient } from "../lib/supabase";
import type { ScoredListing, Temperature } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$" + n.toLocaleString();
}

function formatDom(days: number | null | undefined): string {
  if (days == null) return "—";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function avmDelta(
  listPrice: number | null | undefined,
  avmValue: number | null | undefined
): string | null {
  if (!listPrice || !avmValue) return null;
  const pct = ((listPrice - avmValue) / avmValue) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}% vs AVM`;
}

const TEMP_STYLES: Record<Temperature, { bg: string; text: string; label: string }> = {
  hot: {
    bg: "bg-orange-500/15 border-orange-500/40",
    text: "text-orange-400",
    label: "🔥 HOT",
  },
  warm: {
    bg: "bg-yellow-500/15 border-yellow-500/40",
    text: "text-yellow-400",
    label: "☀️ WARM",
  },
  cold: {
    bg: "bg-blue-500/10 border-blue-500/30",
    text: "text-blue-400",
    label: "❄️ COLD",
  },
};

// ─── Copy button ──────────────────────────────────────────────────────────────
// Small self-contained button that shows "Copied!" for 2s after click.
// Uses the Clipboard API — supported in all modern browsers.

interface CopyButtonProps {
  text: string;
  label: string;
}

function CopyButton({ text, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      // Reset after 2 seconds — setTimeout is a side effect (runs outside render)
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard without user gesture
      console.error("Clipboard write failed");
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`
        text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all
        ${copied
          ? "bg-green-500/20 border-green-500/40 text-green-400"
          : "bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover,#555)]"
        }
      `}
    >
      {copied ? "✓ Copied!" : label}
    </button>
  );
}

// ─── FUB push button ──────────────────────────────────────────────────────────

type FubStatus = "idle" | "loading" | "success" | "error";

interface FubButtonProps {
  listing: ScoredListing;
}

function FubButton({ listing }: FubButtonProps) {
  const [status, setStatus] = useState<FubStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handlePush() {
    setStatus("loading");
    setErrorMsg(null);

    try {
      // Get the current session token to authenticate the API call
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch("/api/fub-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ listing }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(String(err));
    }
  }

  if (status === "success") {
    return (
      <div className="text-xs text-green-400 font-semibold px-3 py-1.5">
        ✓ Sent to Follow Up Boss
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handlePush}
        disabled={status === "loading"}
        className={`
          text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all
          ${status === "loading"
            ? "opacity-50 cursor-not-allowed bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-muted)]"
            : "bg-blue-500/15 border-blue-500/40 text-blue-400 hover:bg-blue-500/25"
          }
        `}
      >
        {status === "loading" ? "Sending…" : "📤 Send to Follow Up Boss"}
      </button>
      {status === "error" && errorMsg && (
        <p className="text-[10px] text-red-400/80">{errorMsg}</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ListingCardProps {
  listing: ScoredListing;
}

export default function ListingCard({ listing }: ListingCardProps) {
  const score = listing.latest_score;
  const temp = score?.temperature ?? "cold";
  const tempStyle = TEMP_STYLES[temp];
  const [outreachOpen, setOutreachOpen] = useState(false);

  const delta = avmDelta(listing.list_price, listing.avm_value);

  // Build the full email copy string — subject + body in one clipboard paste
  const emailCopyText = score?.outreach_email
    ? `Subject: ${score.outreach_email.subject}\n\n${score.outreach_email.body}`
    : null;

  return (
    <article
      className={`
        rounded-xl border p-4 space-y-3 transition-all
        bg-[var(--color-surface)] border-[var(--color-border)]
        hover:border-[var(--color-border-hover,#555)] hover:shadow-md
      `}
    >
      {/* ── Header row ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--color-text)] truncate leading-tight">
            {listing.address ?? "Address unavailable"}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {[listing.city, listing.state, listing.zip].filter(Boolean).join(", ")}
          </p>
        </div>

        {score && (
          <span
            className={`
              shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border
              ${tempStyle.bg} ${tempStyle.text}
            `}
          >
            {tempStyle.label}
          </span>
        )}
      </div>

      {/* ── Score row ────────────────────────────────────────────────────────── */}
      {score && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-black text-[var(--color-text)]">
              {score.score}
            </span>
            <span className="text-[var(--color-text-muted)] text-xs">/100</span>
          </div>
          <div className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
            {score.confidence_score}% confidence
          </div>
          {score.opportunity_type && (
            <div className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)] capitalize">
              {score.opportunity_type.replace(/_/g, " ")}
            </div>
          )}
        </div>
      )}

      {/* ── Price + AVM row ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        <span className="font-semibold text-[var(--color-text)]">
          {formatPrice(listing.list_price)}
        </span>
        {listing.avm_value && (
          <span className="text-[var(--color-text-muted)]">
            AVM {formatPrice(listing.avm_value)}
          </span>
        )}
        {delta && (
          <span
            className={`text-xs font-medium ${
              listing.list_price! < listing.avm_value!
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            {delta}
          </span>
        )}
      </div>

      {/* ── Property details row ─────────────────────────────────────────────── */}
      <div className="flex gap-3 text-xs text-[var(--color-text-muted)] flex-wrap">
        {listing.beds != null && <span>{listing.beds} bd</span>}
        {listing.baths != null && <span>{listing.baths} ba</span>}
        {listing.sqft != null && <span>{listing.sqft.toLocaleString()} sqft</span>}
        <span>{formatDom(listing.days_on_market)} on market</span>
        {listing.tax_delinquent && (
          <span className="text-orange-400 font-medium">⚠ Tax delinquent</span>
        )}
        {(listing.price_cuts ?? 0) > 0 && (
          <span className="text-yellow-400 font-medium">
            {listing.price_cuts} price cut{listing.price_cuts !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Reason codes ─────────────────────────────────────────────────────── */}
      {score && score.reason_codes.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {score.reason_codes.slice(0, 3).map((code) => (
            <span
              key={code}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
            >
              {code}
            </span>
          ))}
        </div>
      )}

      {/* ── Freshness warning ────────────────────────────────────────────────── */}
      {score && score.freshness_warnings.length > 0 && (
        <p className="text-[10px] text-yellow-500/70 italic">
          ⚠ {score.freshness_warnings[0]}
        </p>
      )}

      {/* ── Human review flag ────────────────────────────────────────────────── */}
      {score?.requires_human_review && (
        <p className="text-[10px] text-red-400/80 font-medium">
          🚩 Requires human review
        </p>
      )}

      {/* ── Outreach section ─────────────────────────────────────────────────── */}
      {score?.outreach_sms && (
        <div className="pt-1 border-t border-[var(--color-border)]">
          <button
            onClick={() => setOutreachOpen((o) => !o)}
            className="w-full text-xs font-semibold py-2 px-3 rounded-lg
              bg-[var(--color-accent,#3b82f6)] text-white
              hover:opacity-90 active:scale-95 transition-all"
          >
            {outreachOpen ? "Hide outreach draft" : "📲 View outreach draft"}
          </button>

          {outreachOpen && (
            <div className="mt-2 space-y-2 text-xs">
              {/* SMS block */}
              {score.outreach_sms && (
                <div className="p-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[var(--color-text-muted)] font-medium">SMS</p>
                    <CopyButton text={score.outreach_sms} label="Copy SMS" />
                  </div>
                  <p className="text-[var(--color-text)] leading-relaxed">
                    {score.outreach_sms}
                  </p>
                </div>
              )}

              {/* Email block */}
              {score.outreach_email && emailCopyText && (
                <div className="p-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[var(--color-text-muted)] font-medium">Email</p>
                    <CopyButton text={emailCopyText} label="Copy Email" />
                  </div>
                  <p className="text-[var(--color-text)] font-semibold">
                    {score.outreach_email.subject}
                  </p>
                  <p className="text-[var(--color-text-muted)] mt-1 leading-relaxed whitespace-pre-wrap">
                    {score.outreach_email.body}
                  </p>
                </div>
              )}

              {/* FUB push */}
              <div className="pt-1">
                <FubButton listing={listing} />
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}