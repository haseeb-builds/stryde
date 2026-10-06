import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Artifacts (Phase 10): durable, versioned pursuit outputs. The user reads
// and creates through their own RLS-scoped client; revision goes through the
// append-only RPC so history is never edited in place.
export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const url = new URL(request.url);
    const pursuitParam = url.searchParams.get("pursuit_id");
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
    let query = supabase
      .from("artifact")
      .select("id, pursuit_id, run_id, action_id, mime_type, artifact_type, title, version, provenance, verification_state, superseded_by, created_at, updated_at")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (pursuitParam) query = query.eq("pursuit_id", pursuitParam);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Unable to load artifacts" }, { status: 500 });
    return NextResponse.json({ artifacts: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message.toLowerCase().includes("token") ? 401 : 500 });
  }
}

const MIME_TYPES = ["text/markdown", "text/plain", "application/json", "text/csv"] as const;
const ARTIFACT_TYPES = ["DOCUMENT", "RESEARCH_DOSSIER", "CODE", "DATA", "REPORT"] as const;

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const body = await request.json() as Record<string, unknown>;
    const pursuitId = typeof body.pursuit_id === "string" ? body.pursuit_id : "";
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 300) : "";
    const content = typeof body.content === "string" ? body.content : "";
    const mime = typeof body.mime_type === "string" && (MIME_TYPES as readonly string[]).includes(body.mime_type) ? body.mime_type : "text/markdown";
    const artifactType = typeof body.artifact_type === "string" && (ARTIFACT_TYPES as readonly string[]).includes(body.artifact_type) ? body.artifact_type : "DOCUMENT";
    if (!pursuitId || !title || !content) return NextResponse.json({ error: "pursuit_id, title and content are required" }, { status: 400 });
    if (content.length > 400_000) return NextResponse.json({ error: "content exceeds the 400k character artifact limit" }, { status: 413 });

    const { data: pursuit } = await supabase.from("pursuit").select("id").eq("id", pursuitId).eq("owner_user_id", user.id).maybeSingle();
    if (!pursuit) return NextResponse.json({ error: "Pursuit not found" }, { status: 404 });

    const { data: artifact, error } = await supabase
      .from("artifact")
      .insert({
        owner_user_id: user.id,
        pursuit_id: pursuitId,
        content_text: content,
        mime_type: mime,
        artifact_type: artifactType,
        title,
        provenance: typeof body.provenance === "object" && body.provenance !== null ? body.provenance : { source: "USER" },
      })
      .select("id, title, version, artifact_type, mime_type, created_at")
      .single();
    if (error || !artifact) return NextResponse.json({ error: "Unable to create artifact" }, { status: 500 });
    return NextResponse.json({ artifact }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message.toLowerCase().includes("token") ? 401 : 500 });
  }
}
