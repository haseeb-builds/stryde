import { NextResponse } from "next/server";
import type { WorkingState } from "@/lib/work-controller";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { checkWorkerDelegation, loadAutonomyPolicy } from "@/lib/autonomy-policy";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

type Body = { session_id?: unknown; approved?: unknown };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id: pursuitId } = await context.params;
    const body = (await request.json()) as Body;
    if (body.approved !== true) return errorResponse("Explicit approval is required to delegate work", 400);
    if (typeof body.session_id !== "string" || !body.session_id.trim()) return errorResponse("session_id is required", 400);

    const sessionId = body.session_id.trim();
    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuit").select("id,title,status").eq("id", pursuitId).eq("owner_user_id", user.id).maybeSingle();
    if (pursuitError) return errorResponse("Unable to load Pursuit", 500);
    if (!pursuit) return errorResponse("Pursuit not found", 404);

    const { data: session, error: sessionError } = await supabase
      .from("conversation_session")
      .select("id,status,working_state")
      .eq("id", sessionId).eq("pursuit_id", pursuitId).eq("owner_user_id", user.id).maybeSingle();
    if (sessionError) return errorResponse("Unable to load conversation", 500);
    if (!session || session.status !== "ACTIVE") return errorResponse("Active conversation not found", 409);

    const workingState = session.working_state as WorkingState | null;
    const move = workingState?.next_move;
    if (!workingState || !move || move.actor !== "WORKER" || !move.worker_type) {
      return errorResponse("The current next move is not ready for worker delegation", 409);
    }

    // The user's autonomy policy governs what may be delegated at all. It can
    // only refuse — it never approves. Explicit per-action approval (checked
    // above) remains mandatory regardless of what the policy allows.
    const policy = await loadAutonomyPolicy(supabase, user.id);
    const delegation = checkWorkerDelegation(policy, move.worker_type);
    if (!delegation.allowed) {
      return errorResponse(delegation.reason ?? "Worker delegation is not enabled", 403);
    }

    // Guard against double-delegation. A CONTROLLED Action that is still running
    // means work for this pursuit is already in flight. Without this check a
    // second approval (a double tap, a retried request, or simply the user
    // approving again while waiting) committed a brand new Action and Job, so
    // the same work could be executed twice with two independent worker runs.
    // Waiting on external reality is not a second decision to make.
    const { data: activeControlled, error: activeError } = await supabase
      .from("action")
      .select("id, intent_summary, status, execution_mode")
      .eq("owner_user_id", user.id)
      .eq("pursuit_id", pursuitId)
      .eq("execution_mode", "CONTROLLED")
      .eq("status", "IN_PROGRESS")
      .limit(1)
      .maybeSingle();
    if (activeError) return errorResponse("Unable to check for in-flight delegated work", 500);
    if (activeControlled) {
      return errorResponse("Delegated work is already in flight for this Pursuit", 409);
    }

    const toolKey = move.worker_type === "HERMES" ? "worker.hermes" : "worker.opencode";
    const { data: tool, error: toolError } = await supabase
      .from("tool").select("id,tool_key,tool_version").eq("tool_key", toolKey).eq("tool_version", "v1").maybeSingle();
    if (toolError) return errorResponse("Unable to load worker capability", 500);
    if (!tool) return errorResponse("Worker capability is not registered", 409);

    const idempotencyKey = crypto.randomUUID();
    const instruction = [
      move.title,
      `Why: ${move.why}`,
      `Expected change: ${move.expected_change}`,
      `Completion condition: ${move.completion_condition}`,
    ].join("\n\n");
    const intentParameters = {
      worker_type: move.worker_type,
      instruction,
      context: {
        pursuit_id: pursuitId,
        pursuit_title: pursuit.title ?? null,
        session_id: sessionId,
        objective: workingState?.objective ?? null,
        understanding: workingState?.understanding ?? "",
        known: workingState?.known ?? [],
        unknowns: workingState?.unknowns ?? [],
        bottleneck: workingState?.bottleneck ?? null,
      },
      idempotency_key: idempotencyKey,
    };

    const { data, error } = await supabase.rpc("stryde_commit_intervention", {
      p_pursuit_id: pursuitId,
      p_intent_summary: move.title,
      p_intent_parameters: intentParameters,
      p_execution_mode: "CONTROLLED",
      p_tool_id: tool.id,
      p_tool_version: tool.tool_version,
      p_why: move.why,
      p_expected_result: move.expected_change,
      p_success_condition: move.completion_condition,
      p_reversibility: "NON_SIDE_EFFECTING_BY_DEFAULT",
      p_authorization_rationale: "User explicitly approved delegation from the current Next Move.",
    });
    if (error) {
      const message = error.message || "Unable to delegate work";
      const clientError = /required|invalid|not found|registered|grant|terminal|execution|tool/i.test(message);
      return errorResponse(clientError ? message : "Unable to delegate work", clientError ? 400 : 500);
    }

    // Delegation hands work to an external executor, so the pursuit is now
    // waiting on reality rather than holding a move it can act on. Persisting
    // this is what lets the UI and the next turn say "waiting on the worker"
    // instead of re-offering a move that is already in flight. Without it the
    // session kept claiming a pending next move after the job was committed,
    // and a second delegation could be attempted against work already running.
    const waitingWorkingState: WorkingState = {
      ...workingState,
      status: "WAITING_EXTERNAL",
    };
    const { error: persistError } = await supabase
      .from("conversation_session")
      .update({ working_state: waitingWorkingState, updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("owner_user_id", user.id);
    if (persistError) {
      return errorResponse("Delegation committed, but working-state persistence failed", 500);
    }

    return NextResponse.json({ delegated: true, ...data, working_state: waitingWorkingState }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Request body must be valid JSON", 400);
    const message = error instanceof Error ? error.message : "Unable to delegate work";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
