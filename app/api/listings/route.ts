import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { mapListing, mapListingScore } from "../../../lib/supabase";
import type { ScoredListing } from "../../../types";

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── Auth: verify session via SSR client ─────────────────────────────────────
  const cookieStore = await cookies();

  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Read-only in route handler — silently ignore
          void cookiesToSet;
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Fetch user's active zip codes ───────────────────────────────────────────
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: searchRows, error: searchError } = await serviceClient
    .from("user_searches")
    .select("zip_codes")
    .eq("user_id", user.id)
    .eq("active", true);

  if (searchError) {
    console.error("[listings] search error:", searchError);
    return NextResponse.json(
      { error: "Failed to load user searches", detail: searchError.message },
      { status: 500 }
    );
  }

  const zipCodes: string[] = [
    ...new Set(
      (searchRows ?? []).flatMap((row) => row.zip_codes as string[])
    ),
  ];

  if (zipCodes.length === 0) {
    return NextResponse.json({ listings: [] });
  }

  // ── Fetch listings + latest score ────────────────────────────────────────────
  const { data: rows, error: listingsError } = await serviceClient
    .from("listings")
    .select(
      `
      *,
      listing_scores (
        id,
        listing_id,
        score,
        confidence_score,
        temperature,
        opportunity_type,
        reason_codes,
        evidence_summary,
        freshness_warnings,
        recommended_action,
        requires_human_review,
        disallowed_data_flags,
        outreach_sms,
        outreach_email,
        prompt_version,
        scored_at
      )
    `
    )
    .in("zip", zipCodes)
    .order("created_at", { ascending: false });

  if (listingsError) {
    console.error("[listings] error:", listingsError);
    return NextResponse.json(
      { error: "Failed to load listings", detail: listingsError.message },
      { status: 500 }
    );
  }

  // ── Map rows → typed ScoredListing ──────────────────────────────────────────
  const listings: ScoredListing[] = (rows ?? []).map((row) => {
    const listing = mapListing(row);

    // listing_scores is an array — pick the most recent one
    const scoreRows: unknown[] = row.listing_scores ?? [];
    const latestScoreRow =
      scoreRows.length > 0
        ? (scoreRows as Array<Record<string, unknown>>).sort(
            (a, b) =>
              new Date(b.scored_at as string).getTime() -
              new Date(a.scored_at as string).getTime()
          )[0]
        : null;

    return {
      ...listing,
      latest_score: latestScoreRow
        ? mapListingScore(latestScoreRow)
        : null,
    };
  });

  // Sort: scored listings first (by score DESC), then unscored
  listings.sort((a, b) => {
    const aScore = a.latest_score?.score ?? -1;
    const bScore = b.latest_score?.score ?? -1;
    return bScore - aScore;
  });

  return NextResponse.json({ listings });
}