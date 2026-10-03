import { NextResponse } from "next/server";
import { runAdaptiveWorkController } from "@/lib/adaptive-model";
import { assembleAdaptiveSituation } from "@/lib/adaptive-situation";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { executeWebResearch } from "@/lib/research-execution";

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
  // Captured as soon as the persisted state is read so an unexpected provider
  // failure can be reported without inventing replacement state.
  let degradedWorkingState: unknown = null;
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
    if (session.status !== "ACTIVE") {
      return errorResponse("Conversation is archived. Start a new conversation to continue.", 409);
    }

    degradedWorkingState = session.working_state ?? null;

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

    if (conversation.length === 0) {
      return errorResponse("There is no conversation to work from yet", 409);
    }

    const situationResult = await assembleAdaptiveSituation(supabase, user.id, id);
    if (situationResult.error || !situationResult.situation) {
      return errorResponse(situationResult.error ?? "Unable to assemble adaptive Situation", 500);
    }

    let result = await runAdaptiveWorkController({
      pursuitTitle: pursuit.title ?? "Untitled pursuit",
      situation: situationResult.situation,
      conversation,
      previousWorkingState: (session.working_state ?? null) as Parameters<typeof runAdaptiveWorkController>[0]["previousWorkingState"],
    });

    let autonomousResearch: {
      query: string;
      provider: string;
      results: unknown[];
      observation_id: string | null;
    } | null = null;

    const researchMove = result.workingState.next_move;
    if (
      researchMove &&
      researchMove.mode === "RESEARCH_WEB" &&
      researchMove.actor === "STRYDE" &&
      situationResult.situation.capabilities.web_search
    ) {
      try {
        const execution = await executeWebResearch(
          supabase,
          user.id,
          id,
          researchMove.title,
        );
        autonomousResearch = execution;

        const refreshedSituation = await assembleAdaptiveSituation(supabase, user.id, id);
        if (!refreshedSituation.error && refreshedSituation.situation) {
          result = await runAdaptiveWorkController({
            pursuitTitle: pursuit.title ?? "Untitled pursuit",
            situation: refreshedSituation.situation,
            conversation,
            previousWorkingState: result.workingState,
          });
        }
      } catch (error) {
        autonomousResearch = {
          query: researchMove.title,
          provider: "unavailable",
          results: [],
          observation_id: null,
        };
        result = {
          ...result,
          workingState: {
            ...result.workingState,
            status: "STALLED",
            understanding: "Stryde identified a research bottleneck but could not complete the research pass.",
            bottleneck: error instanceof Error ? error.message : "Web research is temporarily unavailable.",
            next_move: {
              ...researchMove,
              mode: "ASK_USER",
              actor: "HUMAN",
              worker_type: null,
              title: "Choose whether to provide a source or continue later.",
              why: "The needed research capability was unavailable.",
              expected_change: "Provide evidence manually or retry when research is available.",
              stryde_can_do: "Retry the research when the capability is available.",
              user_needs_to_do: "Provide a source only if you already have one; otherwise you can return later.",
              completion_condition: "The research question is resolved or intentionally deferred.",
            },
          },
        };
      }
    }

    const { error: persistError } = await supabase
      .from("conversation_session")
      .update({
        working_state: result.workingState,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("owner_user_id", user.id);

    if (persistError) return errorResponse("Unable to persist Stryde's working state", 500);

    const { data: activeAction, error: activeActionError } = await supabase
      .from("action")
      .select("id, execution_mode, intent_summary, status, created_at, updated_at")
      .eq("owner_user_id", user.id)
      .eq("pursuit_id", id)
      .eq("status", "IN_PROGRESS")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeActionError) return errorResponse("Unable to load active Action", 500);

    return NextResponse.json({
      working_state: result.workingState,
      active_action: activeAction ?? null,
      model: { provider: result.provider, model: result.model },
      autonomous_research: autonomousResearch,
    });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Request body must be valid JSON", 400);
    const message = error instanceof Error ? error.message : "Adaptive Work Controller failed";
    if (message.includes("token")) return errorResponse(message, 401);
    // A provider-side failure (quota, transient 5xx, an out-of-contract model
    // reply) must not read as a lost state change or a lost user request. The
    // previously persisted working state is still the truth, so report the
    // failure explicitly and hand back that state unchanged. Stryde never
    // substitutes a fabricated next move for a real one.
    return NextResponse.json(
      {
        error: message,
        working_state: degradedWorkingState,
        degraded: true,
      },
      { status: 503 },
    );
  }
}