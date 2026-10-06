import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// Pause, resume, or cancel a trigger. Owner-scoped; state-only changes.
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    const next = action === "pause" ? "PAUSED" : action === "resume" ? "ACTIVE" : action === "cancel" ? "CANCELLED" : null;
    if (!next) return NextResponse.json({ error: "action must be pause, resume or cancel" }, { status: 400 });
    const { data, error } = await supabase
      .from("trigger")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .select("id, status")
      .single();
    if (error || !data) return NextResponse.json({ error: "Unable to update trigger" }, { status: 404 });
    return NextResponse.json({ trigger: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message.toLowerCase().includes("token") ? 401 : 500 });
  }
}
