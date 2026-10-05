import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { proposeSkill } from "@/lib/skills";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Skills are procedural memory, inspectable by their owner. The list is the
// calm surface: any status filter, capped at 50 like other lists.
export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const pursuitId = url.searchParams.get("pursuit_id");

    let query = supabase
      .from("skill")
      .select("id, pursuit_id, title, description, procedure, status, version, provenance, security_scan, usage_count, last_used_at, created_at, updated_at")
      .eq("owner_user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (status) query = query.eq("status", status);
    if (pursuitId) query = query.eq("pursuit_id", pursuitId);

    const { data, error } = await query;
    if (error) return errorResponse("Unable to load skills", 500);
    return NextResponse.json({ skills: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}

// Proposing a skill runs the security scan; the verdict decides the lifecycle
// landing (ACTIVE for clean, PROPOSED for flagged, REJECTED for blocked) and
// is stored either way.
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) return errorResponse("Request body must be an object", 400);
    const record = body as Record<string, unknown>;
    if (typeof record.title !== "string" || !record.title.trim()) return errorResponse("title is required", 400);
    if (record.procedure === undefined) return errorResponse("procedure is required", 400);

    try {
      const result = await proposeSkill(supabase, user.id, {
        title: record.title,
        description: typeof record.description === "string" ? record.description : null,
        procedure: record.procedure,
        pursuitId: typeof record.pursuit_id === "string" ? record.pursuit_id : null,
        provenance: {
          origin: "USER",
          ...(typeof record.pursuit_id === "string" ? { pursuit_id: record.pursuit_id } : {}),
        },
      });
      return NextResponse.json(
        {
          skill: result.skill,
          scan: { verdict: result.scan.verdict, findings: result.scan.findings },
          refused: result.refused,
          requires_approval: result.requiresApproval,
        },
        { status: result.refused ? 422 : 201 },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to propose the skill";
      return errorResponse(message, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
