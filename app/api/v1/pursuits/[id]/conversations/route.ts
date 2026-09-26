import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuit")
      .select("id")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (pursuitError) return NextResponse.json({ error: "Unable to load Pursuit" }, { status: 500 });
    if (!pursuit) return NextResponse.json({ error: "Pursuit not found" }, { status: 404 });

    const { data: sessions, error } = await supabase
      .from("conversation_session")
      .select("id, pursuit_id, title, status, working_state, created_at, updated_at")
      .eq("pursuit_id", id)
      .eq("owner_user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: "Unable to load conversations" }, { status: 500 });
    return NextResponse.json({ sessions: sessions ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load conversations";
    return NextResponse.json({ error: message }, { status: message.includes("token") ? 401 : 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuit")
      .select("id")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (pursuitError) return NextResponse.json({ error: "Unable to load Pursuit" }, { status: 500 });
    if (!pursuit) return NextResponse.json({ error: "Pursuit not found" }, { status: 404 });

    const { data: session, error: createError } = await supabase.rpc("stryde_create_conversation_session", { p_pursuit_id: id });
    if (createError) return NextResponse.json({ error: "Unable to start a new conversation" }, { status: 500 });
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start a new conversation";
    return NextResponse.json({ error: message }, { status: message.includes("token") ? 401 : 500 });
  }
}
