// app/api/outreach/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

type OutreachChannel = "sms" | "email" | "call" | "skip";

type OutreachPayload = {
  listing_id: string;
  score_id:   string;
  channel:    OutreachChannel;
  body:       string;   // message text, call script, or "" for skip
  step:       number;   // sequence step at time of send
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function formatRelativeDate(date: Date): string {
  const diffMs   = Date.now() - date.getTime();
  const diffMin  = Math.floor(diffMs / 60_000);
  if (diffMin < 1)    return "Just now";
  if (diffMin < 60)   return `${diffMin}m ago`;
  const diffHrs  = Math.floor(diffMin / 60);
  if (diffHrs < 24)   return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json() as OutreachPayload;

  if (!body.listing_id || !body.channel) {
    return NextResponse.json(
      { error: "Missing required fields: listing_id, channel" },
      { status: 400 }
    );
  }

  const supabase = adminClient();
  const now      = new Date().toISOString();

  // ── 1. Write the outreach_log row ──────────────────────────────────────────
  const { error: insertError } = await supabase
    .from("outreach_log")
    .insert({
      listing_id:     body.listing_id,
      channel:        body.channel,
      message_type:   body.channel,
      draft:          body.body || null,
      // skips are logged for audit but don't get a sent_at
      sent_at:        body.channel === "skip" ? null : now,
      created_at:     now,
      consent_status: "unknown",   // FUB wire-up will populate real value later
    });

  if (insertError) {
    console.error("[api/outreach] insert error:", insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // ── 2. Query updated touch stats for this listing ──────────────────────────
  // Only count non-skip rows — those are real touches
  const { data: logRows, error: logError } = await supabase
    .from("outreach_log")
    .select("channel, sent_at, created_at")
    .eq("listing_id", body.listing_id)
    .neq("channel", "skip")
    .order("created_at", { ascending: false });

  if (logError) {
    console.error("[api/outreach] touch query error:", logError);
    // Non-fatal — return success with null stats, UI keeps existing values
    return NextResponse.json({
      ok:          true,
      touches:     null,
      lastContact: null,
      nextStep:    body.step + 1,
      newLogEntry: null,
    });
  }

  const touches     = logRows?.length ?? 0;
  const latestRow   = logRows?.[0];
  const latestDate  = latestRow?.sent_at ?? latestRow?.created_at ?? null;
  const lastContact = latestDate ? formatRelativeDate(new Date(latestDate)) : "—";

  // Build a compact log entry the UI can prepend to contactLog immediately
  const newLogEntry =
    body.channel === "skip"
      ? null
      : {
          channel: body.channel as "sms" | "email" | "call",
          title:
            body.channel === "call"
              ? "Call logged"
              : body.body
              ? body.body.slice(0, 60) + (body.body.length > 60 ? "…" : "")
              : `${body.channel.toUpperCase()} sent`,
          date: formatRelativeDate(new Date(now)),
        };

  return NextResponse.json({
    ok:          true,
    touches,
    lastContact,
    nextStep:    body.step + 1,
    newLogEntry,
  });
}