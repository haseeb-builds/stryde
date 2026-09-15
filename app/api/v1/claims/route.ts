import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const claimStatuses = new Set([
  "REPORTED",
  "OBSERVED",
  "VERIFIED",
  "CONTRADICTED",
  "UNVERIFIABLE",
]);

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(
      request.headers.get("authorization"),
    );

    const url = new URL(request.url);
    const pursuitId = url.searchParams.get("pursuit_id");
    const status = url.searchParams.get("epistemic_status");

    if (status && !claimStatuses.has(status)) {
      return errorResponse("Invalid epistemic status", 400);
    }

    let query = supabase
      .from("claim")
      .select(
        "id, scope, pursuit_id, kind, content, structured_detail, structured_detail_schema_version, epistemic_status, supersedes_claim_id, superseded_by_claim_id, created_at, updated_at",
      )
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false });

    if (pursuitId) query = query.eq("pursuit_id", pursuitId);
    if (status) query = query.eq("epistemic_status", status);

    const { data, error } = await query;
    if (error) return errorResponse("Unable to load claims", 500);

    return NextResponse.json({ claims: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAuthenticatedSupabase(
      request.headers.get("authorization"),
    );

    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return errorResponse("Request body must be an object", 400);
    }

    if (
      !("scope" in body) ||
      typeof body.scope !== "string" ||
      !("kind" in body) ||
      typeof body.kind !== "string" ||
      !("content" in body) ||
      typeof body.content !== "string"
    ) {
      return errorResponse("scope, kind, and content are required", 400);
    }

    if (body.scope !== "USER" && body.scope !== "PURSUIT") {
      return errorResponse("Invalid Claim scope", 400);
    }

    const pursuitId =
      "pursuit_id" in body && typeof body.pursuit_id === "string"
        ? body.pursuit_id
        : null;
    const structuredDetail =
      "structured_detail" in body ? body.structured_detail : null;
    const schemaVersion =
      "structured_detail_schema_version" in body &&
      typeof body.structured_detail_schema_version === "number"
        ? body.structured_detail_schema_version
        : null;
    const supersedesClaimId =
      "supersedes_claim_id" in body &&
      typeof body.supersedes_claim_id === "string"
        ? body.supersedes_claim_id
        : null;

    const { data, error } = await supabase.rpc("stryde_create_claim", {
      p_scope: body.scope,
      p_kind: body.kind,
      p_content: body.content,
      p_pursuit_id: pursuitId,
      p_structured_detail: structuredDetail,
      p_structured_detail_schema_version: schemaVersion,
      p_supersedes_claim_id: supersedesClaimId,
    });

    if (error) return errorResponse("Unable to create claim", 500);
    return NextResponse.json({ claim: data }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return errorResponse("Request body must be valid JSON", 400);
    }

    const message = error instanceof Error ? error.message : "Unauthorized";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
