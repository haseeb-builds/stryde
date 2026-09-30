import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
const ALLOWED_RELATIONS = new Set(["SUPPORTS", "CONTRADICTS", "VERIFIES"]);

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(
      request.headers.get("authorization"),
    );
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const observationId =
      "observation_id" in body && typeof body.observation_id === "string" ? body.observation_id : "";
    const relationType =
      "relation_type" in body && typeof body.relation_type === "string" ? body.relation_type : "";

    if (!observationId) {
      return NextResponse.json({ error: "observation_id is required" }, { status: 400 });
    }
    if (!ALLOWED_RELATIONS.has(relationType)) {
      return NextResponse.json(
        { error: "relation_type must be one of SUPPORTS, CONTRADICTS, VERIFIES" },
        { status: 400 },
      );
    }

    // Ownership is validated through the user's RLS-scoped client; the
    // epistemic transition itself runs on the trusted control plane.
    const { data: claim, error: claimError } = await supabase
      .from("claim")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (claimError) {
      return NextResponse.json({ error: "Unable to load claim" }, { status: 500 });
    }
    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }
    const { data: observation, error: observationError } = await supabase
      .from("observation")
      .select("id")
      .eq("id", observationId)
      .maybeSingle();
    if (observationError) {
      return NextResponse.json({ error: "Unable to load observation" }, { status: 500 });
    }
    if (!observation) {
      return NextResponse.json({ error: "Observation not found" }, { status: 404 });
    }

    const { data, error } = await getSupabaseServiceClient().rpc("stryde_link_claim_observation", {
      p_actor_id: user.id,
      p_claim_id: id,
      p_observation_id: observationId,
      p_relation_type: relationType,
    });
    if (error) {
      const message = error.message;
      const status = message.includes("not found")
        ? 404
        : message.includes("Invalid observation relation type")
          ? 400
          : message.includes("claim_observation_link")
            ? 409
            : 400;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ link: data }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      {
        status:
          message.toLowerCase().includes("token") || message.toLowerCase().includes("authentication")
            ? 401
            : 500,
      },
    );
  }
}
