import { NextResponse } from "next/server";
import { runAdaptiveWorkController } from "@/lib/adaptive-model";
import { streamConversationTurn, type ConversationMessage, type ConversationStreamEvent } from "@/lib/model-gateway";
import { assembleAdaptiveSituation } from "@/lib/adaptive-situation";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { createConversationCommitter } from "@/lib/conversation-commit";
import { recordMemory } from "@/lib/memory";
import { processUniversalInput } from "@/lib/universal-input";
import { compileForSituation } from "@/lib/context-compiler";
import { recordSkillUsage } from "@/lib/skills";
import { recordFunnelEvent } from "@/lib/instrumentation";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { recordResourceUsage } from "@/lib/resource-control";

export const runtime = "nodejs";
// A full turn is TWO real model generations (the streamed ConversationTurn plus
// the adaptive work controller) and a slow free-tier provider can spend 45s on
// ONE provider attempt. 55s turned turn-3-class turns into hard
// FUNCTION_INVOCATION_TIMEOUT kills on Vercel. The platform clamps this to the
// plan maximum, so the larger value is safe everywhere.
export const maxDuration = 300;
// The route's own honest wall clock, below maxDuration so the turn degrades to
// an SSE error the client can show and retry instead of being killed mid-stream.
const TURN_DEADLINE_MS = envDeadlineMs();
function envDeadlineMs(): number {
  const raw = Number(process.env.STRYDE_TURN_DEADLINE_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 240_000;
}
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

    const { data: priorMessages, error: messagesError } = await supabase
      .from("conversation_message")
      .select("role, content, turn_key")
      .eq("session_id", sessionId)
      .eq("owner_user_id", user.id)
      .order("sequence_no", { ascending: false })
      .limit(17);
    if (messagesError) return errorResponse("Unable to load conversation history", 500);

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

    // priorMessages was read before the current turn was recorded, but a retry of this
    // turn_key already has its USER row persisted — exclude it so the model and the
    // adaptive controller each see this user message exactly once (the gateway and
    // conversationWithUser both append it separately).
    const conversation: ConversationMessage[] = (priorMessages ?? [])
      .filter((item) => item.turn_key !== turnKey)
      .reverse()
      .map((item) => ({
        role: item.role === "USER" ? "user" : "stryde",
        content: item.content,
      }));

    const universalInput = await processUniversalInput(
      supabase,
      user.id,
      id,
      message,
    );

    const situationResult = await assembleAdaptiveSituation(supabase, user.id, id);
    if (situationResult.error || !situationResult.situation) {
      return errorResponse(situationResult.error ?? "Unable to assemble adaptive Situation", 500);
    }

    // The Context Compiler turns the canonical Situation into a task-specific
    // packet for THIS turn. The model never sees the full situation replay;
    // the selection report is persisted so retrieval stays inspectable.
    const compiled = compileForSituation(situationResult.situation, { userMessage: message });
    // Skills that reached this turn's packet count as used: usage tracking is
    // how procedural memory proves it earns its retrieval slot.
    void recordSkillUsage(
      supabase,
      user.id,
      compiled.packet.skills.map((skill) => String(skill.id)),
    ).catch(() => {});
    // First turn on this pursuit is a funnel boundary, recorded once per
    // pursuit and fail-open. No content is attached — only the milestone.
    if (conversation.length === 0) {
      const { data: priorFirstTurn } = await supabase
        .from("funnel_event")
        .select("id")
        .eq("owner_user_id", user.id)
        .eq("pursuit_id", id)
        .eq("event_type", "FIRST_TURN")
        .limit(1)
        .maybeSingle();
      if (!priorFirstTurn) {
        void recordFunnelEvent(supabase, { ownerUserId: user.id, eventType: "FIRST_TURN", pursuitId: id });
      }
    }

    const conversationWithUser: ConversationMessage[] = [
      ...conversation,
      { role: "user", content: message },
    ];

    // Plan metering (server-side, mandatory): a turn costs one model_turn.
    // Exhaustion is an honest 429 before any generation runs; the metering
    // plane itself being down refuses the turn rather than serving unmetered.
    const trustedPlane = getSupabaseServiceClient();
    const { data: turnsAvailable, error: turnsError } = await trustedPlane
      .rpc("stryde_resource_available", { p_owner: user.id, p_resource: "model_turns" });
    if (turnsError) return errorResponse("Resource control is unavailable; turns are refused rather than unmetered", 503);
    if (turnsAvailable === 0) return errorResponse("Daily plan limit reached for model turns. Your plan resets tomorrow.", 429);

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: ConversationStreamEvent) => {
          if (event.type === "complete") return;
          controller.enqueue(encoder.encode(streamEvent(event)));
        };

        try {
          const turnSignal = AbortSignal.any([request.signal, AbortSignal.timeout(TURN_DEADLINE_MS)]);
          const result = await streamConversationTurn({
            pursuitTitle: pursuit.title ?? "Untitled pursuit",
            contextPacket: compiled.packet,
            conversation,
            userMessage: message,
            workingState: (session.working_state ?? null) as Parameters<typeof streamConversationTurn>[0]["workingState"],
          }, emit, turnSignal);

          let work = result.turn.work;
          let workModel = { provider: result.provider, model: result.model };

          if (session.working_state) {
            try {
              const adaptiveSituationResult = await assembleAdaptiveSituation(supabase, user.id, id);
              if (adaptiveSituationResult.error || !adaptiveSituationResult.situation) {
                throw new Error(adaptiveSituationResult.error ?? "Unable to assemble adaptive Situation");
              }

              // Recompile against the fresh situation: the adaptive
              // reassessment happens after the universal-input effects above
              // landed, so its packet may legitimately differ from the turn's.
              const adaptiveCompiled = compileForSituation(adaptiveSituationResult.situation, { userMessage: message });
              const adaptive = await runAdaptiveWorkController({
                pursuitTitle: pursuit.title ?? "Untitled pursuit",
                contextPacket: adaptiveCompiled.packet,
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

          // Conversation turns can propose a few durable, user-specific memories.
          // These are stored as MODEL_INFERENCE candidates, never as verified truth.
          // A confident candidate may explicitly supersede an existing memory the
          // model judged outdated; the lineage stays inspectable either way.
          for (const memoryCandidate of result.turn.memory_candidates) {
            await recordMemory(supabase, {
              ownerUserId: user.id,
              pursuitId: memoryCandidate.scope === "PURSUIT" ? id : null,
              memoryType: memoryCandidate.memory_type,
              content: memoryCandidate.content,
              confidence: Math.min(1, Math.max(0, memoryCandidate.confidence)),
              importance: Math.min(1, Math.max(0, memoryCandidate.importance)),
              provenanceType: "MODEL_INFERENCE",
              provenance: {
                source: "CONVERSATION_TURN",
                session_id: sessionId,
                turn_key: turnKey,
                provider: result.provider,
                model: result.model,
              },
              structuredDetail: {
                focus: result.turn.focus,
              },
              revisesMemoryIds: memoryCandidate.revises_memory_ids,
              status: "CANDIDATE",
            });
          }

          // Progress reports and settled decisions arrive from the authority
          // (the user), so they are preserved verbatim as USER_REPORTED memories
          // — unlike model paraphrases, which stay candidates. Exactly-once is
          // guaranteed by the turn key, so a replayed turn cannot double-record.
          if (result.turn.input_class === "PROGRESS" || result.turn.input_class === "DECISION") {
            await recordMemory(supabase, {
              ownerUserId: user.id,
              pursuitId: id,
              memoryType: result.turn.input_class === "PROGRESS" ? "EXPERIENCE" : "DECISION",
              content: message.slice(0, 4000),
              structuredDetail: { input_class: result.turn.input_class, focus: result.turn.focus },
              provenanceType: "USER_REPORTED",
              provenance: {
                source: "CONVERSATION_INPUT",
                session_id: sessionId,
                turn_key: turnKey,
              },
              confidence: 0.75,
              importance: result.turn.input_class === "DECISION" ? 0.8 : 0.65,
              dedupeTurnKey: turnKey,
            });
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
                  input_class: turn.input_class,
                  // A correction supersedes the working interpretation: keep the
                  // overridden state inspectable in the turn metadata instead of
                  // silently discarding it.
                  ...(turn.input_class === "CORRECTION" && session.working_state
                    ? { superseded_working_state: session.working_state }
                    : {}),
                  work: committedWork,
                  memory_candidates: result.turn.memory_candidates,
                  universal_input: universalInput,
                  context_selection: {
                    used_chars: compiled.report.used_chars,
                    budget_chars: compiled.report.budget_chars,
                    included: compiled.report.included,
                    dropped: compiled.report.dropped.slice(0, 50),
                    truncated: compiled.report.truncated.slice(0, 50),
                  },
                },
                p_working_state: committedWork,
              });
              if (error) throw new Error("Unable to save Stryde's response");
            },
          });
          await commit(result.turn, work);

          // Post-hoc metering of the turn. The turn is already committed and
          // its cost happened, so a metering failure must not fail the user;
          // exhaustion here just means this turn tipped the envelope.
          void recordResourceUsage(trustedPlane, {
            ownerUserId: user.id,
            pursuitId: id,
            resource: "model_turns",
            amount: 1,
            capabilityKey: "conversation.turn",
          }).catch(() => {});

          controller.enqueue(encoder.encode(streamEvent({
            type: "complete",
            turn: { ...result.turn, work },
            model: workModel,
          })));
          controller.close();
        } catch (error) {
          if (!request.signal.aborted) {
            const raw = error instanceof Error ? error.message : "Conversation failed";
            const message = raw === "Aborted"
              ? "This turn exceeded its time budget before the model finished. Your message is saved — send it again to retry."
              : raw;
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