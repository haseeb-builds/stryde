import { NextResponse } from "next/server";
import type { WorkingState } from "@/lib/work-controller";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

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
    if (!move || move.actor !== "WORKER" || !move.worker_type) {
      return errorResponse("The current next move is not ready for worker delegation", 409);
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

    return NextResponse.json({ delegated: true, ...data }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Request body must be valid JSON", 400);
    const message = error instanceof Error ? error.message : "Unable to delegate work";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
