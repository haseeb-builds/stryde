import { NextResponse } from "next/server";
import { runConversationTurn, type ConversationMessage } from "@/lib/model-gateway";
import { assembleSituation } from "@/lib/situation";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 55;
type RouteContext = { params: Promise<{ id: string }> };

type RequestBody = {
  message?: unknown;
  session_id?: unknown;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function sessionTitle(content: string) {
  const text = content.replace(/\s+/g, " ").trim();
  return text.length > 72 ? `${text.slice(0, 69)}…` : text;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const body = (await request.json()) as RequestBody;
    if (typeof body.message !== "string" || !body.message.trim()) return errorResponse("message must be a non-empty string", 400);
    if (typeof body.session_id !== "string" || !body.session_id.trim()) return errorResponse("session_id must be provided", 400);

    const message = body.message.trim().slice(0, 8000);
    const sessionId = body.session_id;

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
      .select("id, pursuit_id, title, status")
      .eq("id", sessionId)
      .eq("pursuit_id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (sessionError) return errorResponse("Unable to load conversation", 500);
    if (!session) return errorResponse("Conversation not found", 404);
    if (session.status !== "ACTIVE") return errorResponse("This conversation is archived. Start a new conversation to continue.", 409);

    const { data: priorMessages, error: messagesError } = await supabase
      .from("conversation_message")
      .select("role, content")
      .eq("session_id", sessionId)
      .eq("owner_user_id", user.id)
      .order("sequence_no", { ascending: false })
      .limit(16);
    if (messagesError) return errorResponse("Unable to load conversation history", 500);

    const conversation: ConversationMessage[] = (priorMessages ?? []).reverse().map((item) => ({
      role: item.role === "USER" ? "user" : "stryde",
      content: item.content,
    }));

    const { data: latestMessage, error: latestError } = await supabase
      .from("conversation_message")
      .select("sequence_no")
      .eq("session_id", sessionId)
      .order("sequence_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) return errorResponse("Unable to prepare conversation message", 500);
    const sequenceNo = typeof latestMessage?.sequence_no === "number" ? latestMessage.sequence_no + 1 : 1;

    const { error: insertUserError } = await supabase
      .from("conversation_message")
      .insert({ session_id: sessionId, owner_user_id: user.id, role: "USER", content: message, sequence_no: sequenceNo });
    if (insertUserError) return errorResponse("Unable to save your message", 500);

    const { error: touchError } = await supabase
      .from("conversation_session")
      .update({ updated_at: new Date().toISOString(), ...(sequenceNo === 1 && !session.title ? { title: sessionTitle(message) } : {}) })
      .eq("id", sessionId)
      .eq("owner_user_id", user.id);
    if (touchError) return errorResponse("Unable to update conversation", 500);

    const situationResult = await assembleSituation(supabase, user.id, id);
    if (situationResult.error || !situationResult.situation) return errorResponse(situationResult.error ?? "Unable to assemble Situation", 500);

    const result = await runConversationTurn({
      pursuitTitle: pursuit.title ?? "Untitled pursuit",
      situation: situationResult.situation,
      conversation,
      userMessage: message,
    });

    const { error: insertAssistantError } = await supabase
      .from("conversation_message")
      .insert({
        session_id: sessionId,
        owner_user_id: user.id,
        role: "STRYDE",
        content: result.turn.message,
        sequence_no: sequenceNo + 1,
        metadata: {
          question: result.turn.question,
          options: result.turn.options,
          ready_for_reasoning: result.turn.ready_for_reasoning,
          focus: result.turn.focus,
        },
      });
    if (insertAssistantError) return errorResponse("Unable to save Stryde's response", 500);

    await supabase
      .from("conversation_session")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("owner_user_id", user.id);

    return NextResponse.json({
      turn: result.turn,
      model: { provider: result.provider, model: result.model },
    });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Request body must be valid JSON", 400);
    const message = error instanceof Error ? error.message : "Conversation failed";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
