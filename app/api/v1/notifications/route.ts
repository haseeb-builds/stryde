import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { deliverPendingNotifications, recordNotification } from "@/lib/notifications";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 60;

// Notifications (Phase 11): the user's inbox. Recording is deduplicated by
// the (owner, channel, dedupe_key) unique constraint; in-app delivery is the
// row itself. External channels stay honestly PENDING until configured.
export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
    let query = supabase
      .from("notification")
      .select("id, pursuit_id, channel, priority, title, body, link_path, status, delivered_at, created_at")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Unable to load notifications" }, { status: 500 });
    return NextResponse.json({ notifications: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message.toLowerCase().includes("token") ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const body = await request.json() as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const text = typeof body.body === "string" ? body.body.trim() : "";
    const dedupeKey = typeof body.dedupe_key === "string" ? body.dedupe_key : "";
    if (!title || !text || !dedupeKey) return NextResponse.json({ error: "title, body and dedupe_key are required" }, { status: 400 });

    // Server-side delivery: record on the trusted plane so the dedupe constraint
    // and future external channels apply uniformly, then run in-app delivery.
    const service = getSupabaseServiceClient();
    const recorded = await recordNotification(service, {
      ownerUserId: user.id,
      pursuitId: typeof body.pursuit_id === "string" ? body.pursuit_id : null,
      title,
      body: text,
      linkPath: typeof body.link_path === "string" ? body.link_path : null,
      priority: body.priority === "HIGH" || body.priority === "URGENT" || body.priority === "LOW" ? body.priority : "NORMAL",
      dedupeKey,
    });
    await deliverPendingNotifications(service, process.env, 25);
    const { count } = await supabase
      .from("notification")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", user.id)
      .eq("status", "PENDING");
    return NextResponse.json({ recorded: recorded.recorded, pending: count ?? 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message.toLowerCase().includes("token") ? 401 : 500 });
  }
}
