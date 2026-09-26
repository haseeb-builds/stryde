import { NextResponse } from "next/server";
import { validateAdaptiveWorkingState } from "@/lib/adaptive-work-controller";
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

    if (body.approved !== true) return errorResponse("Explicit approval is required to start the current Action", 400);
    if (typeof body.session_id !== "string" || !body.session_id.trim()) return errorResponse("session_id is required", 400);

    const sessionId = body.session_id.trim();
    const { data: session, error: sessionError } = await supabase
      .from("conversation_session")
      .select("id, pursuit_id, status, working_state")
      .eq("id", sessionId)
      .eq("pursuit_id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (sessionError) return errorResponse("Unable to load conversation", 500);
    if (!session) return errorResponse("Conversation not found", 404);
    if (session.status !== "ACTIVE") return errorResponse("Conversation is archived", 409);

    const workingState = validateAdaptiveWorkingState(session.working_state);
    if (!workingState.next_move || workingState.next_move.mode !== "CREATE_ACTION") {
      return errorResponse("The current move is not ready to become a human Action", 409);
    }

    const { data: existingAction, error: existingError } = await supabase
      .from("action")
      .select("id, intent_summary, status, execution_mode")
      .eq("owner_user_id", user.id)
      .eq("pursuit_id", id)
      .eq("execution_mode", "HUMAN")
      .eq("status", "IN_PROGRESS")
      .limit(1)
      .maybeSingle();

    if (existingError) return errorResponse("Unable to check active Actions", 500);
    if (existingAction) return NextResponse.json({ action: existingAction, already_active: true, working_state: workingState }, { status: 200 });

    const move = workingState.next_move;
    const { data, error } = await supabase.rpc("stryde_commit_intervention", {
      p_pursuit_id: id,
      p_intent_summary: move.title,
      p_intent_parameters: {
        source: "ADAPTIVE_WORK_CONTROLLER",
        session_id: sessionId,
        completion_condition: move.completion_condition,
        expected_change: move.expected_change,
      },
      p_execution_mode: "HUMAN",
      p_tool_id: null,
      p_tool_version: null,
      p_why: move.why,
      p_expected_result: move.expected_change,
      p_success_condition: move.completion_condition,
      p_reversibility: "User-controlled human action",
      p_authorization_rationale: "Explicit user approval of the current Stryde Action.",
    });

    if (error) {
      const message = error.message || "Unable to start Action";
      return errorResponse(message, /required|invalid|not found|terminal|execution/i.test(message) ? 400 : 500);
    }

    const nextWorkingState = {
      ...workingState,
      status: "WAITING_EXTERNAL" as const,
    };

    const { error: persistError } = await supabase
      .from("conversation_session")
      .update({ working_state: nextWorkingState, updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("owner_user_id", user.id);

    if (persistError) return errorResponse("Action started, but working-state persistence failed", 500);

    return NextResponse.json({ ...data, working_state: nextWorkingState }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Request body must be valid JSON", 400);
    const message = error instanceof Error ? error.message : "Unable to start Action";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
