import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    if (typeof body.content !== "string" || !body.content.trim()) return errorResponse("content is required", 400);
    const content = body.content.trim().slice(0, 2000);
    const sourceId = body.source_id === undefined || body.source_id === null ? null : typeof body.source_id === "string" ? body.source_id.trim() : null;

    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuit")
      .select("id, objective_claim_id")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (pursuitError) return errorResponse("Unable to load Pursuit", 500);
    if (!pursuit) return errorResponse("Pursuit not found", 404);

    if (sourceId) {
      const { data: source, error: sourceError } = await supabase
        .from("pursuit_source")
        .select("id")
        .eq("id", sourceId)
        .eq("owner_user_id", user.id)
        .eq("pursuit_id", id)
        .maybeSingle();
      if (sourceError) return errorResponse("Unable to validate source", 500);
      if (!source) return errorResponse("Source not found for this Pursuit", 404);
    }

    const { data: citations, error: citationError } = sourceId
      ? await supabase.from("pursuit_source_citation").select("id, source_id, source_content_sha256, locator, basis").eq("source_id", sourceId).eq("pursuit_id", id).order("created_at", { ascending: true })
      : { data: [], error: null };
    if (citationError) return errorResponse("Unable to load source lineage", 500);

    const { data: claim, error: claimError } = await supabase.rpc("stryde_create_claim", {
      p_scope: "PURSUIT",
      p_kind: "OBJECTIVE",
      p_content: content,
      p_pursuit_id: id,
      p_structured_detail: {
        origin: "USER_CONFIRMED",
        source_id: sourceId,
        source_citation_ids: (citations ?? []).map((citation) => citation.id),
      },
      p_structured_detail_schema_version: 1,
      p_supersedes_claim_id: pursuit.objective_claim_id ?? null,
    });

    if (claimError || !claim) return errorResponse(claimError?.message || "Unable to create Objective Claim", 400);

    const { data: updatedPursuit, error: setError } = await supabase.rpc("stryde_set_objective_claim", {
      p_pursuit_id: id,
      p_claim_id: claim.id,
    });
    if (setError || !updatedPursuit) return errorResponse(setError?.message || "Unable to bind Objective Claim", 500);

    return NextResponse.json({ claim, pursuit: updatedPursuit }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Request body must be valid JSON", 400);
    const message = error instanceof Error ? error.message : "Unable to set objective";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
