import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { FUNNEL_EVENT_TYPES } from "@/lib/instrumentation";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Client-originated funnel events (SIGNUP, PAID_CTA_CLICK). Server paths
// record their own milestones; this endpoint exists for events that only the
// browser knows about. Events are counters with scope — no content is
// accepted, and anything beyond the declared fields is discarded.
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) return errorResponse("Request body must be an object", 400);
    const record = body as Record<string, unknown>;
    const eventType = record.event_type;
    if (eventType !== "SIGNUP" && eventType !== "PAID_CTA_CLICK") {
      return errorResponse("event_type must be SIGNUP or PAID_CTA_CLICK", 400);
    }

    const { error } = await supabase.from("funnel_event").insert({
      owner_user_id: user.id,
      event_type: eventType,
      metadata: {},
    });
    if (error) {
      console.error("[events] client event insert failed:", error.message);
      return errorResponse("Unable to record the event", 500);
    }
    return NextResponse.json({ recorded: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}

// The owner's own funnel, queryable: counts per event type over the last 30
// days and all time. No prompt content exists anywhere in this table.
export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const { data, error } = await supabase
      .from("funnel_event")
      .select("event_type, created_at")
      .eq("owner_user_id", user.id);
    if (error) return errorResponse("Unable to load events", 500);

    const counts: Record<string, number> = {};
    const recent: Record<string, number> = {};
    for (const type of FUNNEL_EVENT_TYPES) {
      counts[type] = 0;
      recent[type] = 0;
    }
    for (const row of data ?? []) {
      const type = String(row.event_type);
      if (!(type in counts)) continue;
      counts[type] += 1;
      if (new Date(String(row.created_at)).toISOString() >= since) recent[type] += 1;
    }
    return NextResponse.json({ counts, last_30_days: recent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
