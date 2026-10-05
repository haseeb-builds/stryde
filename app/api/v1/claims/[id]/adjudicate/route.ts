import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { recordFunnelEvent } from "@/lib/instrumentation";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { recordMemory } from "@/lib/memory";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
const ALLOWED_STATUSES = new Set(["VERIFIED", "CONTRADICTED", "UNVERIFIABLE"]);

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

    // Ownership and evidence-link checks run through the user's RLS-scoped
    // client; the epistemic transition itself runs on the trusted control
    // plane (stryde_validate_semantics rejects user-role status changes).
    const { data: claim, error: claimError } = await supabase
      .from("claim")
      .select("id, scope, pursuit_id, kind, content")
      .eq("id", id)
      .maybeSingle();
    if (claimError) {
      return NextResponse.json({ error: "Unable to load claim" }, { status: 500 });
    }
    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }
    if (observationId) {
      const { data: link, error: linkError } = await supabase
        .from("claim_observation_link")
        .select("claim_id, observation_id")
        .eq("claim_id", id)
        .eq("observation_id", observationId)
        .maybeSingle();
      if (linkError) {
        return NextResponse.json({ error: "Unable to load observation link" }, { status: 500 });
      }
      if (!link) {
        return NextResponse.json({ error: "Observation is not linked to this Claim" }, { status: 400 });
      }
    }

    const { data, error } = await getSupabaseServiceClient().rpc("stryde_adjudicate_claim", {
      p_actor_id: user.id,
      p_claim_id: id,
      p_to_status: toStatus,
      p_reason: reason,
      p_observation_id: observationId,
    });
    if (error) {
      const status = error.message.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }

    if (toStatus === "VERIFIED") {
      void recordFunnelEvent(supabase, { ownerUserId: user.id, eventType: "VERIFIED_OUTCOME", pursuitId: claim.pursuit_id });
      const memoryType = claim.kind === "OUTCOME" ? "EXPERIENCE" : "FACT";
      await recordMemory(supabase, {
        ownerUserId: user.id,
        pursuitId: claim.scope === "PURSUIT" ? claim.pursuit_id : null,
        memoryType,
        content: claim.content,
        structuredDetail: {
          claim_kind: claim.kind,
          adjudication_reason: reason,
        },
        provenanceType: "VERIFIED",
        provenance: {
          source: "CLAIM_ADJUDICATION",
          claim_id: id,
        },
        confidence: 0.95,
        importance: 0.85,
        sourceClaimId: id,
        sourceObservationId: observationId,
        status: "ACTIVE",
      });
    } else if (toStatus === "CONTRADICTED") {
      await supabase
        .from("memory_item")
        .update({
          status: "CONTRADICTED",
          stale_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("owner_user_id", user.id)
        .eq("source_claim_id", id);
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