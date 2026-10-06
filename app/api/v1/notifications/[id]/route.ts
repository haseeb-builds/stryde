import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// Dismiss an in-app notification. Owner-scoped by RLS and the explicit filter.
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    if (action !== "dismiss") return NextResponse.json({ error: "action must be dismiss" }, { status: 400 });
    const { error } = await supabase
      .from("notification")
      .update({ status: "DISMISSED" })
      .eq("id", id)
      .eq("owner_user_id", user.id);
    if (error) return NextResponse.json({ error: "Unable to dismiss notification" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message.toLowerCase().includes("token") ? 401 : 500 });
  }
}
