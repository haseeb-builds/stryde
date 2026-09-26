import { NextResponse } from "next/server";
import { runAdaptiveWorkController } from "@/lib/adaptive-model";
import { assembleAdaptiveSituation } from "@/lib/adaptive-situation";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 55;

type RouteContext = { params: Promise<{ id: string; actionId: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id, actionId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    if (typeof body.session_id !== "string" || !body.session_id.trim()) return errorResponse("session_id is required", 400);
    if (body.terminal_status !== "COMPLETED" && body.terminal_status !== "FAILED" && body.terminal_status !== "CANCELLED") {
      return errorResponse("terminal_status must be COMPLETED, FAILED, or CANCELLED", 400);
    }

    const result = body.result === undefined ? {} : body.result;
    if (typeof result !== "object" || result === null || Array.isArray(result)) {
      return errorResponse("result must be a JSON object", 400);
    }
    const note = body.note === undefined || body.note === null ? null : typeof body.note === "string" ? body.note.trim().slice(0, 4000) : null;

    const sessionId = body.session_id.trim();
    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuit")
      .select("id, title")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (pursuitError) return errorResponse("Unable to load Pursuit", 500);
    if (!pursuit) return errorResponse("Pursuit not found", 404);

    const { data: session, error: sessionError } = await supabase
      .from("conversation_session")
      .select("id, status, working_state")
      .eq("id", sessionId)
      .eq("pursuit_id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (sessionError) return errorResponse("Unable to load conversation", 500);
    if (!session) return errorResponse("Conversation not found", 404);
    if (session.status !== "ACTIVE") return errorResponse("Conversation is archived", 409);

    const { data: completion, error: completionError } = await supabase.rpc("stryde_complete_human_action", {
      p_action_id: actionId,
      p_terminal_status: body.terminal_status,
      p_result: result,
      p_note: note,
    });
    if (completionError) {
      const message = completionError.message || "Unable to record Action result";
      return errorResponse(message, /authentication|not found|only HUMAN|not in progress|invalid/i.test(message) ? 400 : 500);
    }

    const situationResult = await assembleAdaptiveSituation(supabase, user.id, id);
    if (situationResult.error || !situationResult.situation) return errorResponse(situationResult.error ?? "Unable to assemble updated Situation", 500);

    const { data: messages, error: messageError } = await supabase
      .from("conversation_message")
      .select("role, content")
      .eq("session_id", sessionId)
      .eq("owner_user_id", user.id)
      .order("sequence_no", { ascending: false })
      .limit(16);
    if (messageError) return errorResponse("Unable to load conversation history", 500);

    const conversation = (messages ?? []).reverse().map((item) => ({
      role: item.role === "USER" ? "user" as const : "stryde" as const,
      content: item.content,
    }));

    const resultState = await runAdaptiveWorkController({
      pursuitTitle: pursuit.title ?? "Untitled pursuit",
      situation: situationResult.situation,
      conversation,
      previousWorkingState: (session.working_state ?? null) as Parameters<typeof runAdaptiveWorkController>[0]["previousWorkingState"],
    });

    const { error: persistError } = await supabase
      .from("conversation_session")
      .update({ working_state: resultState.workingState, updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("owner_user_id", user.id);

    if (persistError) return errorResponse("Action was recorded, but the next move could not be persisted", 500);

    return NextResponse.json({
      completion,
      working_state: resultState.workingState,
      model: { provider: resultState.provider, model: resultState.model },
    }, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Request body must be valid JSON", 400);
    const message = error instanceof Error ? error.message : "Unable to record Action result";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
