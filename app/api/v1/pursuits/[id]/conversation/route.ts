import { NextResponse } from "next/server";
import { runAdaptiveWorkController } from "@/lib/adaptive-model";
import { streamConversationTurn, type ConversationMessage, type ConversationStreamEvent } from "@/lib/model-gateway";
import { assembleAdaptiveSituation } from "@/lib/adaptive-situation";
import { assembleSituation } from "@/lib/situation";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { createConversationCommitter } from "@/lib/conversation-commit";

export const runtime = "nodejs";
export const maxDuration = 55;
type RouteContext = { params: Promise<{ id: string }> };

type RequestBody = {
  message?: unknown;
  session_id?: unknown;
  turn_key?: unknown;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function streamEvent(event: unknown) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    const { id } = await context.params;
    const body = (await request.json()) as RequestBody;
    if (typeof body.message !== "string" || !body.message.trim()) return errorResponse("message must be a non-empty string", 400);
    if (typeof body.session_id !== "string" || !body.session_id.trim()) return errorResponse("session_id must be provided", 400);
    if (typeof body.turn_key !== "string" || !body.turn_key.trim()) return errorResponse("turn_key must be provided", 400);

    const message = body.message.trim().slice(0, 8000);
    const sessionId = body.session_id;
    const turnKey = body.turn_key;

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
    if (session.status !== "ACTIVE") return errorResponse("This conversation is archived. Start a new conversation to continue.", 409);

    const { data: recorded, error: recordError } = await supabase.rpc("stryde_record_conversation_user_input", {
      p_session_id: sessionId,
      p_turn_key: turnKey,
      p_content: message,
    });
    if (recordError) return errorResponse("Unable to save your message", 500);
    const existingAssistant = recorded?.assistant as { content?: string; metadata?: Record<string, unknown> } | null;
    if (existingAssistant?.content) {
      const metadata = existingAssistant.metadata ?? {};
      const turn = { message: existingAssistant.content, ...metadata };
      return new Response(`${streamEvent({ type: "complete", turn, model: metadata.model ?? null })}`, {
        headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
      });
    }

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

    const situationResult = await assembleSituation(supabase, user.id, id);
    if (situationResult.error || !situationResult.situation) {
      return errorResponse(situationResult.error ?? "Unable to assemble Situation", 500);
    }

    const conversationWithUser: ConversationMessage[] = [
      ...conversation,
      { role: "user", content: message },
    ];

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: ConversationStreamEvent) => {
          if (event.type === "complete") return;
          controller.enqueue(encoder.encode(streamEvent(event)));
        };

        try {
          const result = await streamConversationTurn({
            pursuitTitle: pursuit.title ?? "Untitled pursuit",
            situation: situationResult.situation,
            conversation,
            userMessage: message,
            workingState: (session.working_state ?? null) as Parameters<typeof streamConversationTurn>[0]["workingState"],
          }, emit, request.signal);

          let work = result.turn.work;
          let workModel = { provider: result.provider, model: result.model };

          if (session.working_state) {
            try {
              const adaptiveSituationResult = await assembleAdaptiveSituation(supabase, user.id, id);
              if (adaptiveSituationResult.error || !adaptiveSituationResult.situation) {
                throw new Error(adaptiveSituationResult.error ?? "Unable to assemble adaptive Situation");
              }

              const adaptive = await runAdaptiveWorkController({
                pursuitTitle: pursuit.title ?? "Untitled pursuit",
                situation: adaptiveSituationResult.situation,
                conversation: conversationWithUser,
                previousWorkingState: session.working_state as Parameters<typeof runAdaptiveWorkController>[0]["previousWorkingState"],
              });
              work = adaptive.workingState;
              workModel = { provider: adaptive.provider, model: adaptive.model };
            } catch {
              // Preserve the last safe working state rather than failing the user's conversation
              // because adaptive reassessment was temporarily unavailable.
              work = session.working_state as Parameters<typeof runAdaptiveWorkController>[0]["previousWorkingState"] & {};
            }
          }

          // Sole assistant commit point, after the stream and structured turn validation.
          const commit = createConversationCommitter({
            commit: async (turn, committedWork) => {
              const { error } = await supabase.rpc("stryde_commit_conversation_turn", {
                p_session_id: sessionId,
                p_turn_key: turnKey,
                p_content: turn.message,
                p_metadata: {
                  question: turn.question,
                  options: turn.options,
                  ready_for_reasoning: turn.ready_for_reasoning,
                  focus: turn.focus,
                  work: committedWork,
                },
                p_working_state: committedWork,
              });
              if (error) throw new Error("Unable to save Stryde's response");
            },
          });
          await commit(result.turn, work);

          controller.enqueue(encoder.encode(streamEvent({
            type: "complete",
            turn: { ...result.turn, work },
            model: workModel,
          })));
          controller.close();
        } catch (error) {
          if (!request.signal.aborted) {
            const message = error instanceof Error ? error.message : "Conversation failed";
            controller.enqueue(encoder.encode(streamEvent({ type: "error", message })));
          }
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Request body must be valid JSON", 400);
    const message = error instanceof Error ? error.message : "Conversation failed";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}
