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

    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuit")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (pursuitError) return NextResponse.json({ error: "Unable to load pursuit" }, { status: 500 });
    if (!pursuit) return NextResponse.json({ error: "Pursuit not found" }, { status: 404 });

    // Observations are anchored to actions via source_reference; ownership is
    // enforced by RLS on both tables.
    const { data: actions, error: actionsError } = await supabase
      .from("action")
      .select("id")
      .eq("pursuit_id", id);
    if (actionsError) return NextResponse.json({ error: "Unable to load actions" }, { status: 500 });

    const actionIds = (actions ?? []).map((a) => a.id);
    if (actionIds.length === 0) {
      return NextResponse.json({ observations: [] });
    }

    const { data: observations, error: observationsError } = await supabase
      .from("observation")
      .select("id, observation_kind, content, observed_at, source_type, source_reference")
      .in("source_reference", actionIds)
      .order("observed_at", { ascending: false });
    if (observationsError) {
      return NextResponse.json({ error: "Unable to load observations" }, { status: 500 });
    }

    void user;
    return NextResponse.json({ observations: observations ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message.toLowerCase().includes("token") ? 401 : 500 },
    );
  }
}
