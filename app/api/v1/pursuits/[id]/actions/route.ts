import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const status = new URL(request.url).searchParams.get("status");

    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuit")
      .select("id")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (pursuitError) return errorResponse("Unable to load Pursuit", 500);
    if (!pursuit) return errorResponse("Pursuit not found", 404);

    let query = supabase
      .from("action")
      .select("id, execution_mode, intent_summary, intent_parameters, status, created_at, updated_at, terminal_at")
      .eq("owner_user_id", user.id)
      .eq("pursuit_id", id)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return errorResponse("Unable to load actions", 500);

    return NextResponse.json({ actions: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load actions";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
