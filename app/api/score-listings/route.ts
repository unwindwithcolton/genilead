import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import {
  SCORE_LISTING_PROMPT,
  PROMPT_VERSION,
} from "../../../lib/aiPrompts";
import { mapListing } from "../../../lib/supabase";
import type { Listing } from "../../../types";

// ─── Config ───────────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const RESCORE_AFTER_DAYS = 7;
const AI_MODEL = "claude-sonnet-4-5";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScoreResult = {
  listing_id: string;
  status: "scored" | "error";
  score?: number;
  temperature?: string;
  error?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Derive freshness warnings before sending to AI.
 * These are objective staleness flags based on timestamps.
 */
function computeFreshnessWarnings(listing: Listing): string[] {
  const warnings: string[] = [];
  const now = Date.now();
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

  if (!listing.avm_value) {
    warnings.push("avm_value is missing");
  }

  if (!listing.list_price) {
    warnings.push("list_price is missing");
  }

  if (listing.last_source_updated) {
    const age = now - new Date(listing.last_source_updated).getTime();
    if (age > NINETY_DAYS) {
      warnings.push("last_source_updated is older than 90 days");
    }
  } else {
    warnings.push("last_source_updated is unknown");
  }

  if (listing.last_sold_date) {
    const yearsSinceSold =
      (now - new Date(listing.last_sold_date).getTime()) /
      (365.25 * 24 * 60 * 60 * 1000);
    if (yearsSinceSold > 5) {
      warnings.push("last_sold_date is more than 5 years ago");
    }
  }

  return warnings;
}

/**
 * Run async jobs with bounded concurrency.
 * At most `limit` workers process items at a time. Returns results in
 * the SAME ORDER as the input items (regardless of finish order).
 */
async function runWithConcurrency<TItem, TResult>(
  items: TItem[],
  limit: number,
  worker: (item: TItem) => Promise<TResult>
): Promise<TResult[]> {
  const results: TResult[] = new Array(items.length);
  let nextIndex = 0;

  // One "lane" — keeps grabbing the next item until the queue is empty.
  async function lane() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  }

  // Spin up `limit` lanes and wait for all of them to drain.
  const lanes = Array.from({ length: Math.min(limit, items.length) }, lane);
  await Promise.all(lanes);

  return results;
}

/**
 * Score one listing end-to-end: build prompt, call Claude, parse, write to DB.
 * Always resolves with a ScoreResult — never throws — so a single failure
 * can't take down a parallel batch.
 */
async function scoreOneListing(
  listing: Listing,
  supabase: ReturnType<typeof adminClient>,
  anthropic: Anthropic
): Promise<ScoreResult> {
  try {
    const freshnessWarnings = computeFreshnessWarnings(listing);
    const prompt = SCORE_LISTING_PROMPT(listing, freshnessWarnings);

    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    const scoreRow = {
      listing_id: listing.id,
      score: Number(parsed.opportunity_score),
      confidence_score: Number(parsed.confidence_score),
      temperature: parsed.temperature,
      opportunity_type: parsed.opportunity_type ?? null,
      reason_codes: parsed.reason_codes ?? [],
      evidence_summary: parsed.evidence_summary ?? null,
      freshness_warnings: parsed.freshness_warnings ?? freshnessWarnings,
      recommended_action: parsed.recommended_action ?? null,
      requires_human_review: Boolean(parsed.requires_human_review),
      disallowed_data_flags: parsed.disallowed_or_missing_data_flags ?? [],
      outreach_sms: parsed.outreach_sms ?? null,
      outreach_email: parsed.outreach_email ?? null,
      prompt_version: PROMPT_VERSION,
      scored_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from("listing_scores")
      .insert(scoreRow);

    if (insertError) throw new Error(insertError.message);

    return {
      listing_id: listing.id,
      status: "scored",
      score: scoreRow.score,
      temperature: scoreRow.temperature,
    };
  } catch (err) {
    console.error(`[score-listings] listing=${listing.id} error:`, err);
    return {
      listing_id: listing.id,
      status: "error",
      error: String(err),
    };
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = adminClient();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const startedAt = Date.now();

  // ── Fetch listings due for scoring ──────────────────────────────────────────
  const cutoff = new Date(
    Date.now() - RESCORE_AFTER_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // Get listings with no score OR score older than cutoff
  const { data: listingRows, error: fetchError } = await supabase
    .from("listings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(50); // batch cap per run to stay within API limits

  if (fetchError) {
    return NextResponse.json(
      { error: "Failed to fetch listings", detail: fetchError.message },
      { status: 500 }
    );
  }

  const listings: Listing[] = (listingRows ?? []).map(mapListing);

  if (listings.length === 0) {
    return NextResponse.json({
      message: "No listings require scoring",
      total_duration_ms: Date.now() - startedAt,
    });
  }

  // ── Score listings in parallel (max 5 in flight) ───────────────────────────
  const CONCURRENCY = 5;
  const results = await runWithConcurrency(listings, CONCURRENCY, (listing) =>
    scoreOneListing(listing, supabase, anthropic)
    );
  

  return NextResponse.json({
    total_duration_ms: Date.now() - startedAt,
    listings_processed: listings.length,
    results,
  });
}