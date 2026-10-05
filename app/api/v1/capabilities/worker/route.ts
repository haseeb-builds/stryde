// User-facing control over worker capability availability.
//
// Authority is NEVER self-granted by the client: this route only renews or
// provisions a grant that is explicitly attributed to the authenticated user
// and is always time-bounded, revocable, and tool-scoped. It exists so the user
// can see and control how long Stryde may delegate to a worker (constitution:
// autonomous work must have clear duration and escalation boundaries), not as a
// way for the application to widen its own authority. Every CONTROLLED commit
// still requires its own explicit approval decision.
import { NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const GRANT_TTL_HOURS = 24;

type WorkerType = "HERMES" | "OPENCODE";

type GrantRow = {
  id: string;
  tool_id: string;
  expires_at: string | null;
  tool: { tool_key: string; tool_version: string } | { tool_key: string; tool_version: string }[] | null;
};

function toolKeyFor(workerType: WorkerType) {
  return workerType === "HERMES" ? "worker.hermes" : "worker.opencode";
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isUnrestrictedUnexpired(grant: GrantRow, now: number) {
  if (grant.expires_at && new Date(grant.expires_at).getTime() <= now) return false;
  const tool = Array.isArray(grant.tool) ? grant.tool[0] : grant.tool;
  return tool?.tool_key === "worker.hermes" || tool?.tool_key === "worker.opencode";
}

async function loadActiveGrants(supabase: Awaited<ReturnType<typeof requireAuthenticatedSupabase>>["supabase"], userId: string) {
  const { data, error } = await supabase
    .from("capability_grant")
    .select("id, tool_id, expires_at, tool:tool_id(tool_key, tool_version)")
    .eq("owner_user_id", userId)
    .is("revoked_at", null)
    .order("granted_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("Unable to load worker capability");
  const now = Date.now();
  return (data as unknown as GrantRow[]).filter((grant) => isUnrestrictedUnexpired(grant, now));
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const grants = await loadActiveGrants(supabase, user.id);
    const workerTypes = grants.map((grant) => {
      const tool = Array.isArray(grant.tool) ? grant.tool[0] : grant.tool;
      return tool?.tool_key === "worker.opencode" ? "OPENCODE" : "HERMES";
    });
    const expiresAt = grants
      .map((grant) => grant.expires_at)
      .filter((value): value is string => typeof value === "string")
      .sort()[0] ?? null;
    return NextResponse.json({ active: grants.length > 0, worker_types: workerTypes, expires_at: expiresAt }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load worker capability";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const body = (await request.json()) as Record<string, unknown>;
    if (body.approved !== true) return errorResponse("Explicit approval is required to enable worker delegation", 400);
    if (body.worker_type !== "HERMES" && body.worker_type !== "OPENCODE") {
      return errorResponse("worker_type must be HERMES or OPENCODE", 400);
    }
    const workerType = body.worker_type as WorkerType;

    const { data: tool, error: toolError } = await supabase
      .from("tool")
      .select("id, tool_key, tool_version")
      .eq("tool_key", toolKeyFor(workerType))
      .eq("tool_version", "v1")
      .maybeSingle();
    if (toolError) return errorResponse("Unable to load worker capability", 500);
    if (!tool) return errorResponse("Worker capability is not registered", 409);

    const grants = await loadActiveGrants(supabase, user.id);
    const existing = grants.find((grant) => grant.tool_id === tool.id);
    const expiresAt = new Date(Date.now() + GRANT_TTL_HOURS * 3_600_000).toISOString();

    if (existing) {
      const { error: updateError } = await supabase
        .from("capability_grant")
        .update({ expires_at: expiresAt, revoked_at: null })
        .eq("id", existing.id)
        .eq("owner_user_id", user.id);
      if (updateError) return errorResponse("Unable to renew worker capability", 500);

      const { data: event, error: eventError } = await supabase
        .from("event")
        .insert({
          owner_user_id: user.id,
          entity_type: "CAPABILITY_GRANT",
          entity_id: existing.id,
          event_type: "CAPABILITY_RENEWED",
          actor_type: "USER",
          actor_id: user.id,
          payload: { capability_grant_id: existing.id, tool_id: tool.id, tool_version: tool.tool_version, expires_at: expiresAt },
        })
        .select("id")
        .single();
      if (eventError) return errorResponse("Unable to record capability renewal", 500);

      return NextResponse.json({ active: true, worker_type: workerType, expires_at: expiresAt, renewed: true, event_id: event.id }, { status: 200 });
    }

    // The capability decision is user-scoped, but the decision table demands a
    // pursuit context: attribute it to the user's most recent pursuit — the
    // place the delegation will actually operate. With no pursuit at all there
    // is nothing to attribute, and an unattributable authority grant must be
    // refused, not silently recorded.
    const { data: contextPursuit } = await supabase
      .from("pursuit")
      .select("id")
      .eq("owner_user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!contextPursuit) return errorResponse("Create a Pursuit before enabling worker delegation", 409);

    const { data: decision, error: decisionError } = await supabase
      .from("decision")
      .insert({
        owner_user_id: user.id,
        pursuit_id: contextPursuit.id,
        kind: "STRATEGIC",
        status: "RESOLVED",
        resolution_actor_type: "USER",
        resolution_actor_id: user.id,
        resolution_rationale: `User explicitly enabled ${workerType} worker delegation for ${GRANT_TTL_HOURS} hours.`,
        resolved_at: new Date().toISOString(),
        structured_context: { capability: "WORKER_DELEGATION", worker_type: workerType, tool_id: tool.id, tool_version: tool.tool_version, ttl_hours: GRANT_TTL_HOURS },
      })
      .select("id")
      .single();
    if (decisionError || !decision) return errorResponse("Unable to record the capability decision", 500);

    const { data: grant, error: grantError } = await supabase
      .from("capability_grant")
      .insert({
        owner_user_id: user.id,
        tool_id: tool.id,
        scope_constraints: {},
        target_constraints: {},
        granted_at: new Date().toISOString(),
        expires_at: expiresAt,
        source_decision_id: decision.id,
      })
      .select("id")
      .single();
    if (grantError || !grant) return errorResponse("Unable to provision worker capability", 500);

    const { data: option, error: optionError } = await supabase
      .from("decision_option")
      .insert({
        decision_id: decision.id,
        owner_user_id: user.id,
        label: `Enable ${workerType} worker delegation`,
        description: `Grants Stryde bounded authority to delegate work to the ${workerType} worker for ${GRANT_TTL_HOURS} hours.`,
        structured_parameters: { capability_grant_id: grant.id, tool_id: tool.id, tool_version: tool.tool_version },
      })
      .select("id")
      .single();
    if (optionError || !option) return errorResponse("Unable to record the capability choice", 500);

    const { error: chosenError } = await supabase
      .from("decision")
      .update({ chosen_option_id: option.id })
      .eq("id", decision.id)
      .eq("owner_user_id", user.id);
    if (chosenError) return errorResponse("Unable to finalize the capability decision", 500);

    const { data: event, error: eventError } = await supabase
      .from("event")
      .insert({
        owner_user_id: user.id,
        entity_type: "CAPABILITY_GRANT",
        entity_id: grant.id,
        event_type: "CAPABILITY_GRANTED",
        actor_type: "USER",
        actor_id: user.id,
        payload: { capability_grant_id: grant.id, decision_id: decision.id, tool_id: tool.id, tool_version: tool.tool_version, expires_at: expiresAt },
      })
      .select("id")
      .single();
    if (eventError) return errorResponse("Unable to record capability grant", 500);

    return NextResponse.json({ active: true, worker_type: workerType, expires_at: expiresAt, renewed: false, decision_id: decision.id, grant_id: grant.id, event_id: event.id }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Request body must be valid JSON", 400);
    const message = error instanceof Error ? error.message : "Unable to enable worker capability";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
