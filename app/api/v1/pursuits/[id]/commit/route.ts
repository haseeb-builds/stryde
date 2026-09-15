import { NextResponse } from "next/server";
import { transitionRun } from "@/lib/run";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

type CommitBody = {
  approved?: unknown;
  run_id?: unknown;
  intent_summary?: unknown;
  intent_parameters?: unknown;
  execution_mode?: unknown;
  tool_id?: unknown;
  tool_version?: unknown;
  why?: unknown;
  expected_result?: unknown;
  success_condition?: unknown;
  reversibility?: unknown;
  authorization_rationale?: unknown;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function optionalString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error("Expected a string");
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error("String exceeds maximum length");
  return trimmed || null;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id: pursuitId } = await context.params;

    let body: CommitBody;
    try {
      body = (await request.json()) as CommitBody;
    } catch {
      return errorResponse("Request body must be valid JSON", 400);
    }

    if (body.approved !== true) return errorResponse("Explicit approval is required to commit an intervention", 400);
    const runId = typeof body.run_id === "string" && body.run_id.trim() ? body.run_id.trim() : null;

    if (runId) {
      const { data: run, error: runError } = await supabase
        .from("run")
        .select("id, owner_user_id, current_stage, status, trigger_metadata")
        .eq("id", runId)
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (runError) return errorResponse("Unable to load Run", 500);
      if (!run) return errorResponse("Run not found", 404);
      const metadata = run.trigger_metadata && typeof run.trigger_metadata === "object"
        ? run.trigger_metadata as Record<string, unknown>
        : null;
      if (metadata?.pursuit_id !== pursuitId) return errorResponse("Run does not belong to this Pursuit", 400);
      if (run.current_stage !== "AUTHORIZE" || run.status !== "RUNNING") {
        return errorResponse("Run is not awaiting authorization", 400);
      }
    }

    const intentSummary = optionalString(body.intent_summary, 2000);
    if (!intentSummary) return errorResponse("intent_summary is required", 400);

    const executionMode = optionalString(body.execution_mode, 32);
    if (executionMode !== "HUMAN" && executionMode !== "CONTROLLED") {
      return errorResponse("execution_mode must be HUMAN or CONTROLLED", 400);
    }

    if (
      body.intent_parameters !== undefined &&
      body.intent_parameters !== null &&
      (typeof body.intent_parameters !== "object" || Array.isArray(body.intent_parameters))
    ) {
      return errorResponse("intent_parameters must be a JSON object", 400);
    }

    const toolId = optionalString(body.tool_id, 100);
    const toolVersion = optionalString(body.tool_version, 200);
    if (executionMode === "CONTROLLED" && (!toolId || !toolVersion)) {
      return errorResponse("CONTROLLED execution requires tool_id and tool_version", 400);
    }
    if (executionMode === "HUMAN" && (toolId || toolVersion)) {
      return errorResponse("HUMAN execution must not include tool binding", 400);
    }

    const { data, error } = await supabase.rpc("stryde_commit_intervention", {
      p_pursuit_id: pursuitId,
      p_intent_summary: intentSummary,
      p_intent_parameters: body.intent_parameters ?? {},
      p_execution_mode: executionMode,
      p_tool_id: toolId,
      p_tool_version: toolVersion,
      p_why: optionalString(body.why, 4000),
      p_expected_result: optionalString(body.expected_result, 4000),
      p_success_condition: optionalString(body.success_condition, 4000),
      p_reversibility: optionalString(body.reversibility, 1000),
      p_authorization_rationale: optionalString(body.authorization_rationale, 4000),
    });

    if (error) {
      const message = error.message || "Unable to commit intervention";
      const clientError = /required|invalid|not found|registered|grant|terminal|execution|tool/i.test(message);
      return errorResponse(clientError ? message : "Unable to commit intervention", clientError ? 400 : 500);
    }

    if (runId) {
      try {
        const committed = await transitionRun(supabase, runId, "COMMIT");
        const done = await transitionRun(supabase, runId, "DONE");
        return NextResponse.json({ committed: true, ...data, run: done, prior_run: committed }, { status: 201 });
      } catch {
        return NextResponse.json({ committed: true, ...data, run_transition_warning: "Action committed but Run closure requires reconciliation", run_id: runId }, { status: 201 });
      }
    }

    return NextResponse.json({ committed: true, ...data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to commit intervention";
    if (message.includes("token")) return errorResponse(message, 401);
    if (/Expected a string|String exceeds/.test(message)) return errorResponse(message, 400);
    return errorResponse(message, 500);
  }
}
