import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

// Artifact detail + append-only revision. A revision creates a NEW version
// row and supersedes the old one; the previous artifact is never mutated.
export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const { data: artifact, error } = await supabase
      .from("artifact")
      .select("*")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Unable to load artifact" }, { status: 500 });
    if (!artifact) return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    return NextResponse.json({ artifact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message.toLowerCase().includes("token") ? 401 : 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const content = typeof body.content === "string" ? body.content : "";
    if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });
    if (content.length > 400_000) return NextResponse.json({ error: "content exceeds the 400k character artifact limit" }, { status: 413 });

    const { data: newId, error } = await supabase.rpc("stryde_revise_artifact", {
      p_artifact: id,
      p_content: content,
      p_actor: user.id,
    });
    if (error) {
      const conflict = error.message.includes("superseded") || error.message.includes("not found");
      return NextResponse.json({ error: error.message }, { status: conflict ? 409 : 500 });
    }
    return NextResponse.json({ artifact_id: newId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message.toLowerCase().includes("token") ? 401 : 500 });
  }
}
