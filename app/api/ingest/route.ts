import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AttomAdapter } from "../../../lib/adapters/attom";
import type { RawListing } from "../../../lib/adapters/types";

// ─── Config ───────────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1_000; // exponential: 1s, 2s, 4s

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with exponential-backoff retry.
 * The AttomAdapter handles the actual HTTP call; this wraps a single-zip
 * adapter call with retries.
 */
async function fetchWithRetry(
  adapter: AttomAdapter,
  zip: string
): Promise<{ listings: RawListing[]; error: string | null }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const listings = await adapter.fetch([zip]);
      return { listings, error: null };
    } catch (err) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      console.warn(
        `[ingest] zip=${zip} attempt ${attempt + 1} failed, retrying in ${delay}ms`,
        err
      );
      if (attempt < MAX_RETRIES - 1) await sleep(delay);
    }
  }
  return {
    listings: [],
    error: `Failed after ${MAX_RETRIES} attempts`,
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  console.log("[ingest] POST hit");
  const secret = req.headers.get("x-cron-secret");
  console.log("[ingest] secret match:", secret === CRON_SECRET);
  if (!secret || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = crypto.randomUUID();
  const supabase = adminClient();
  const adapter = new AttomAdapter();
  console.log("[ingest] ATTOM_API_KEY set:", !!process.env.ATTOM_API_KEY);
  const startedAt = Date.now();

  // ── Resolve zip codes ────────────────────────────────────────────────────────
  let zipCodes: string[];

  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body?.zipCodes) && body.zipCodes.length > 0) {
      zipCodes = body.zipCodes;
    } else {
      // Fall back to all active user_searches
      const { data, error } = await supabase
        .from("user_searches")
        .select("zip_codes")
        .eq("active", true);

      if (error) throw error;

      const allZips = (data ?? []).flatMap((row) => row.zip_codes as string[]);
      zipCodes = [...new Set(allZips)]; // deduplicate
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to resolve zip codes", detail: String(err) },
      { status: 500 }
    );
  }

  if (zipCodes.length === 0) {
    return NextResponse.json({ message: "No zip codes to process", runId });
  }

  // ── Process each zip ─────────────────────────────────────────────────────────
  const summary: Array<{
    zip: string;
    status: string;
    records_in: number;
    records_saved: number;
    error: string | null;
    duration_ms: number;
  }> = [];

  for (const zip of zipCodes) {
    const zipStart = Date.now();
    const { listings, error: fetchError } = await fetchWithRetry(adapter, zip);

    let recordsSaved = 0;
    let upsertError: string | null = null;

    if (listings.length > 0) {
      const rows = listings.map((l) => ({
        source: l.source,
        source_id: l.source_id,
        address: l.address ?? null,
        zip: l.zip,
        city: l.city ?? null,
        state: l.state ?? null,
        beds: l.beds ?? null,
        baths: l.baths ?? null,
        sqft: l.sqft ?? null,
        list_price: l.list_price ?? null,
        avm_value: l.avm_value ?? null,
        days_on_market: l.days_on_market ?? null,
        price_cuts: l.price_cuts ?? 0,
        last_sold_price: l.last_sold_price ?? null,
        last_sold_date: l.last_sold_date ?? null,
        owner_type: l.owner_type ?? null,
        tax_delinquent: l.tax_delinquent ?? false,
        last_source_updated: l.last_source_updated ?? null,
        last_synced_at: new Date().toISOString(),
        raw_data: l.raw_data ?? null,
        updated_at: new Date().toISOString(),
      }));

      const { error: dbError, count } = await supabase
        .from("listings")
        .upsert(rows, {
          onConflict: "source,source_id",
          count: "exact",
        });

      if (dbError) {
        upsertError = dbError.message;
      } else {
        recordsSaved = count ?? rows.length;
      }
    }

    const duration_ms = Date.now() - zipStart;
    const status = fetchError
      ? "error"
      : upsertError
        ? "db_error"
        : "success";

    const logEntry = {
      run_id: runId,
      source: adapter.name,
      zip,
      status,
      records_in: listings.length,
      records_saved: recordsSaved,
      error: fetchError ?? upsertError,
      duration_ms,
    };

    await supabase.from("ingest_log").insert(logEntry);

    summary.push({
      zip,
      status,
      records_in: listings.length,
      records_saved: recordsSaved,
      error: fetchError ?? upsertError,
      duration_ms,
    });
  }

  return NextResponse.json({
    runId,
    total_duration_ms: Date.now() - startedAt,
    zips_processed: zipCodes.length,
    summary,
  });
}