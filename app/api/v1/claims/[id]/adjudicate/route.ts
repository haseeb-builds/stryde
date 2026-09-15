import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
const ALLOWED_STATUSES = new Set(["VERIFIED", "CONTRADICTED", "UNVERIFIABLE"]);

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase } = await requireAuthenticatedSupabase(
      request.headers.get("authorization"),
    );
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const toStatus = "to_status" in body && typeof body.to_status === "string" ? body.to_status : "";
    const reason = "reason" in body && typeof body.reason === "string" ? body.reason.trim() : "";
    const observationId =
      "observation_id" in body && typeof body.observation_id === "string"
        ? body.observation_id
        : null;

    if (!ALLOWED_STATUSES.has(toStatus)) {
      return NextResponse.json({ error: "Invalid adjudication status" }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("stryde_adjudicate_claim", {
      p_claim_id: id,
      p_to_status: toStatus,
      p_reason: reason,
      p_observation_id: observationId,
    });
    if (error) {
      const status = error.message.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ claim: data });
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
