import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(
      request.headers.get("authorization"),
    );
    const { id } = await context.params;

    const { data: run, error: runError } = await supabase
      .from("run")
      .select("id, owner_user_id, trigger_type, trigger_metadata, current_stage, status, failure_reason, resume_state, wait_state, version, created_at, updated_at, completed_at")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (runError) return NextResponse.json({ error: "Unable to load Run" }, { status: 500 });
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const { data: events, error: eventsError } = await supabase
      .from("event")
      .select("id, event_type, actor_type, actor_id, payload, occurred_at, created_at")
      .eq("run_id", id)
      .eq("owner_user_id", user.id)
      .order("occurred_at", { ascending: true });

    if (eventsError) return NextResponse.json({ error: "Unable to load Run events" }, { status: 500 });
    return NextResponse.json({ run, events: events ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message.includes("token") ? 401 : 500 });
  }
}
