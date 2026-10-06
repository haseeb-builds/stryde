import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Triggers (Phase 9): user-declared schedules and watches. A trigger names
// what should happen; it never carries authority. Enqueued jobs still pass
// through the same CONTROLLED-plane authorization and resource reservation
// as user-initiated work.
const TRIGGER_KINDS = ["ONE_TIME", "RECURRING", "EVENT", "STATE", "MONITOR"] as const;

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { data, error } = await supabase
      .from("trigger")
      .select("id, pursuit_id, name, trigger_kind, condition, action, status, last_fired_at, next_fire_at, max_fires, fire_count, created_at, updated_at")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: "Unable to load triggers" }, { status: 500 });
    return NextResponse.json({ triggers: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message.toLowerCase().includes("token") ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const body = await request.json() as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
    const kind = typeof body.trigger_kind === "string" && (TRIGGER_KINDS as readonly string[]).includes(body.trigger_kind) ? body.trigger_kind : null;
    if (!name || !kind) return NextResponse.json({ error: "name and trigger_kind are required" }, { status: 400 });
    if (typeof body.condition !== "object" || body.condition === null) return NextResponse.json({ error: "condition object is required" }, { status: 400 });
    if (typeof body.action !== "object" || body.action === null) return NextResponse.json({ error: "action object is required" }, { status: 400 });

    if (body.pursuit_id !== undefined && body.pursuit_id !== null) {
      if (typeof body.pursuit_id !== "string") return NextResponse.json({ error: "pursuit_id must be a string" }, { status: 400 });
      const { data: pursuit } = await supabase.from("pursuit").select("id").eq("id", body.pursuit_id).eq("owner_user_id", user.id).maybeSingle();
      if (!pursuit) return NextResponse.json({ error: "Pursuit not found" }, { status: 404 });
    }

    const { data: trigger, error } = await supabase
      .from("trigger")
      .insert({
        owner_user_id: user.id,
        pursuit_id: typeof body.pursuit_id === "string" ? body.pursuit_id : null,
        name,
        trigger_kind: kind,
        condition: body.condition,
        action: body.action,
        max_fires: typeof body.max_fires === "number" && Number.isInteger(body.max_fires) && body.max_fires > 0 ? body.max_fires : null,
        next_fire_at: typeof body.fire_at === "string" ? body.fire_at : null,
      })
      .select("id, name, trigger_kind, status, created_at")
      .single();
    if (error || !trigger) return NextResponse.json({ error: "Unable to create trigger" }, { status: 500 });
    return NextResponse.json({ trigger }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message.toLowerCase().includes("token") ? 401 : 500 });
  }
}
