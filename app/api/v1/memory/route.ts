import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Memory inspection: the constitution requires personalization to remain
// inspectable and controllable, so the raw lifecycle — including who/what
// produced each memory — is exposed to its owner only.
export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const pursuitParam = url.searchParams.get("pursuit_id");
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100) || 100));

    let query = supabase
      .from("memory_item")
      .select("id, memory_scope, memory_type, status, content, structured_detail, provenance_type, provenance, confidence, importance, first_seen_at, last_confirmed_at, stale_at, supersedes_memory_id, superseded_by_memory_id, source_observation_id, source_claim_id, source_id, created_at, updated_at")
      .eq("owner_user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (statusParam) query = query.eq("status", statusParam);
    if (pursuitParam) query = query.eq("pursuit_id", pursuitParam);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Unable to load memories" }, { status: 500 });
    return NextResponse.json({ memories: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message.toLowerCase().includes("token") || message.toLowerCase().includes("authentication") ? 401 : 500 },
    );
  }
}
