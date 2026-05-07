import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pushListingToFub } from "../../../lib/followupboss";
import type { ScoredListing } from "../../../types";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  // ── Auth — must be a logged-in user ────────────────────────────────────────
  const supabase = adminClient();

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let listing: ScoredListing;
  try {
    const body = await req.json();
    listing = body.listing;
    if (!listing?.id) throw new Error("Missing listing");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // ── Push to FUB ────────────────────────────────────────────────────────────
  const result = await pushListingToFub(listing);

  // ── Log to outreach_log regardless of FUB result ──────────────────────────
  // This gives us an audit trail even if FUB isn't configured yet
  await supabase.from("outreach_log").insert({
    listing_id: listing.id,
    user_id: user.id,
    channel: "fub_push",
    status: result.success ? "sent" : "failed",
    error: result.error ?? null,
    metadata: { fub_event_id: result.fubEventId ?? null },
    created_at: new Date().toISOString(),
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ success: true, fubEventId: result.fubEventId });
}