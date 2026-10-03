import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { confirmMemory, forgetMemory } from "@/lib/memory";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// The user controls their memory: confirm promotes a candidate to active
// reality, forget retires it (soft), delete removes it outright. Every path
// is owner-scoped twice — by RLS and by the explicit owner filter.
export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }
    const action = "action" in body && typeof body.action === "string" ? body.action : "";
    if (action !== "confirm" && action !== "forget") {
      return NextResponse.json({ error: "action must be confirm or forget" }, { status: 400 });
    }

    const ok = action === "confirm"
      ? await confirmMemory(supabase, { ownerUserId: user.id, memoryId: id })
      : await forgetMemory(supabase, { ownerUserId: user.id, memoryId: id });
    if (!ok) return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message.toLowerCase().includes("token") || message.toLowerCase().includes("authentication") ? 401 : 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const { error } = await supabase
      .from("memory_item")
      .delete()
      .eq("id", id)
      .eq("owner_user_id", user.id);
    if (error) return NextResponse.json({ error: "Unable to delete memory" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message.toLowerCase().includes("token") || message.toLowerCase().includes("authentication") ? 401 : 500 },
    );
  }
}
