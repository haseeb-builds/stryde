import { NextResponse } from "next/server";
import { runWorkController, type ConversationMessage } from "@/lib/model-gateway";
import { assembleSituation } from "@/lib/situation";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 55;

type RouteContext = { params: Promise<{ id: string }> };

type RequestBody = {
  session_id?: unknown;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const body = (await request.json()) as RequestBody;

    if (typeof body.session_id !== "string" || !body.session_id.trim()) {
      return errorResponse("session_id must be provided", 400);
    }

    const sessionId = body.session_id.trim();

    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuit")
      .select("id, title, status")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (pursuitError) return errorResponse("Unable to load Pursuit", 500);
    if (!pursuit) return errorResponse("Pursuit not found", 404);

    const { data: session, error: sessionError } = await supabase
      .from("conversation_session")
      .select("id, pursuit_id, title, status, working_state")
      .eq("id", sessionId)
      .eq("pursuit_id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (sessionError) return errorResponse("Unable to load conversation", 500);
    if (!session) return errorResponse("Conversation not found", 404);
    if (session.status !== "ACTIVE") return errorResponse("Conversation is archived. Start a new conversation to continue.", 409);

    const { data: messages, error: messageError } = await supabase
      .from("conversation_message")
      .select("role, content")
      .eq("session_id", sessionId)
      .eq("owner_user_id", user.id)
      .order("sequence_no", { ascending: false })
      .limit(16);
    if (messageError) return errorResponse("Unable to load conversation history", 500);

    const conversation: ConversationMessage[] = (messages ?? []).reverse().map((item) => ({
      role: item.role === "USER" ? "user" : "stryde",
      content: item.content,
    }));

    if (conversation.length === 0) {
      return errorResponse("There is no conversation to work from yet", 409);
    }

    const situationResult = await assembleSituation(supabase, user.id, id);
    if (situationResult.error || !situationResult.situation) {
      return errorResponse(situationResult.error ?? "Unable to assemble Situation", 500);
    }

    const result = await runWorkController({
      pursuitTitle: pursuit.title ?? "Untitled pursuit",
      situation: situationResult.situation,
      conversation,
      previousWorkingState: (session.working_state ?? null) as Parameters<typeof runWorkController>[0]["previousWorkingState"],
    });

    const { error: persistError } = await supabase
      .from("conversation_session")
      .update({
        working_state: result.workingState,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("owner_user_id", user.id);

    if (persistError) return errorResponse("Unable to persist Stryde's working state", 500);

    return NextResponse.json({
      working_state: result.workingState,
      model: { provider: result.provider, model: result.model },
    });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Request body must be valid JSON", 400);
    const message = error instanceof Error ? error.message : "Work Controller failed";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
