import { NextResponse } from "next/server";
import { runAdaptiveWorkController } from "@/lib/adaptive-model";
import { fallbackHumanObservation, interpretHumanActionReport } from "@/lib/human-observation";
import { assembleAdaptiveSituation } from "@/lib/adaptive-situation";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { recordMemory } from "@/lib/memory";

export const runtime = "nodejs";
export const maxDuration = 55;

type RouteContext = { params: Promise<{ id: string; actionId: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type StoredObservation = {
  id: string;
  content?: {
    result?: {
      interpretation?: {
        user_claims?: unknown;
      };
    };
  } | null;
};

function normalizeUserClaims(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const claims: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const claim = item.trim();
    if (!claim || claim.length > 2_000 || seen.has(claim)) continue;
    seen.add(claim);
    claims.push(claim);
  }
  return claims;
}

async function syncObservedUserClaims(input: {
  supabase: Awaited<ReturnType<typeof requireAuthenticatedSupabase>>["supabase"];
  userId: string;
  pursuitId: string;
  observationId: string;
  claims: string[];
}): Promise<{ created: number; warnings: string[] }> {
  let created = 0;
  const warnings: string[] = [];

  for (const claimContent of normalizeUserClaims(input.claims)) {
    try {
      const { data: existing, error: existingError } = await input.supabase
        .from("claim")
        .select("id")
        .eq("owner_user_id", input.userId)
        .eq("pursuit_id", input.pursuitId)
        .eq("content", claimContent)
        .limit(1)
        .maybeSingle();
      if (existingError) throw new Error("Unable to inspect existing claim");

      let claimId = existing?.id as string | undefined;
      if (!claimId) {
        const { data, error } = await input.supabase.rpc("stryde_create_claim", {
          p_scope: "PURSUIT",
          p_kind: "OUTCOME",
          p_content: claimContent,
          p_pursuit_id: input.pursuitId,
        });
        if (error || !data?.id) throw new Error(error?.message || "Unable to create claim");
        claimId = data.id as string;
        created += 1;
      }

      const { error: linkError } = await input.supabase.rpc("stryde_link_claim_observation", {
        p_claim_id: claimId,
        p_observation_id: input.observationId,
        p_relation_type: "SUPPORTS",
      });
      if (linkError && !/duplicate|already exists/i.test(linkError.message)) {
        throw new Error(linkError.message || "Unable to link claim evidence");
      }
    } catch (error) {
      const prefix = claimContent.slice(0, 120) + (claimContent.length > 120 ? "…" : "");
      const message = error instanceof Error ? error.message : "claim sync failed";
      warnings.push(prefix + ": " + message);
    }
  }

  return { created, warnings };
}
function buildActionCompletionMessage(
  observation: ReturnType<typeof fallbackHumanObservation>,
  workingState: Awaited<ReturnType<typeof runAdaptiveWorkController>>["workingState"],
): string {
  const next = workingState.next_move;
  const followUp = observation.suggested_follow_up;
  return [
    "Got it. I recorded what happened and treated it as user-reported evidence, not verified fact.",
    observation.summary,
    next ? `Next, ${next.title.toLowerCase()}.` : "There is no safe next move yet.",
    followUp ? `One thing would materially help: ${followUp}` : "",
  ].filter(Boolean).join("\n\n");
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
    if (body.turn_key !== undefined && (typeof body.turn_key !== "string" || !body.turn_key.trim())) {
      return errorResponse("turn_key must be a non-empty string when provided", 400);
    }

    const legacyResult = body.result === undefined ? null : body.result;
    if (legacyResult !== null && (typeof legacyResult !== "object" || Array.isArray(legacyResult))) {
      return errorResponse("result must be a JSON object", 400);
    }
    const note = body.note === undefined || body.note === null ? null : typeof body.note === "string" ? body.note.trim().slice(0, 4000) : null;
    const legacyObject = legacyResult && typeof legacyResult === "object" && !Array.isArray(legacyResult)
      ? legacyResult as Record<string, unknown>
      : null;
    const report = typeof body.report === "string"
      ? body.report.trim().slice(0, 12000)
      : typeof legacyObject?.text === "string"
        ? legacyObject.text.trim().slice(0, 12000)
        : legacyResult
          ? JSON.stringify(legacyResult).slice(0, 12000)
          : "";
    if (!report) return errorResponse("report is required; tell Stryde what happened", 400);

    const terminalStatus = body.terminal_status as "COMPLETED" | "FAILED" | "CANCELLED";
    const turnKey = typeof body.turn_key === "string" && body.turn_key.trim() ? body.turn_key.trim() : crypto.randomUUID();
    const sessionId = body.session_id.trim();
    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuit")
      .select("id, title")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (pursuitError) return errorResponse("Unable to load Pursuit", 500);
    if (!pursuit) return errorResponse("Pursuit not found", 404);

    const { data: action, error: actionError } = await supabase
      .from("action")
      .select("id, pursuit_id, execution_mode, status, intent_summary")
      .eq("id", actionId)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (actionError) return errorResponse("Unable to load Action", 500);
    if (!action || action.pursuit_id !== id) return errorResponse("Action not found for this Pursuit", 404);

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

    const { data: recorded, error: recordError } = await supabase.rpc("stryde_record_conversation_user_input", {
      p_session_id: sessionId,
      p_turn_key: turnKey,
      p_content: report,
    });
    if (recordError) return errorResponse("Unable to save your Action report", 500);
    const existingAssistant = recorded?.assistant as { content?: string; metadata?: Record<string, unknown> } | null;
    if (existingAssistant?.content) {
      const { data: storedObservations } = await supabase
        .from("observation")
        .select("id, content")
        .eq("owner_user_id", user.id)
        .eq("observation_kind", "HUMAN_ACTION_RESULT")
        .eq("source_reference", actionId)
        .order("observed_at", { ascending: false })
        .limit(1);

      const storedObservation = (storedObservations?.[0] ?? null) as StoredObservation | null;
      const storedClaims = normalizeUserClaims(storedObservation?.content?.result?.interpretation?.user_claims);
      const claimSync = storedObservation && storedClaims.length
        ? await syncObservedUserClaims({
            supabase,
            userId: user.id,
            pursuitId: id,
            observationId: storedObservation.id,
            claims: storedClaims,
          })
        : { created: 0, warnings: [] };

      return NextResponse.json({
        already_recorded: true,
        assistant_message: existingAssistant.content,
        metadata: existingAssistant.metadata ?? {},
        working_state: session.working_state ?? null,
        auto_claims: claimSync,
      }, { status: 200 });
    }

    const situationBeforeResult = await assembleAdaptiveSituation(supabase, user.id, id);
    if (situationBeforeResult.error || !situationBeforeResult.situation) {
      return errorResponse(situationBeforeResult.error ?? "Unable to assemble current Situation", 500);
    }

    const { data: priorMessages, error: messageError } = await supabase
      .from("conversation_message")
      .select("role, content, turn_key")
      .eq("session_id", sessionId)
      .eq("owner_user_id", user.id)
      .order("sequence_no", { ascending: false })
      .limit(17);
    if (messageError) return errorResponse("Unable to load conversation history", 500);

    // priorMessages was read after the report was recorded; exclude this turn's own
    // row so the report reaches the interpreter once (via REPORT:) while the adaptive
    // controller still sees it appended as the latest conversation message.
    const conversationBeforeResult = (priorMessages ?? [])
      .filter((item) => item.turn_key !== turnKey)
      .reverse()
      .map((item) => ({
        role: item.role === "USER" ? "user" as const : "stryde" as const,
        content: item.content,
      }));

    let observation = fallbackHumanObservation({ report, terminalStatus });
    let interpretationMeta: { provider: string; model: string } | null = null;
    try {
      const interpreted = await interpretHumanActionReport({
        pursuitTitle: pursuit.title ?? "Untitled pursuit",
        actionSummary: action.intent_summary,
        terminalStatus,
        report,
        situation: situationBeforeResult.situation,
        conversation: conversationBeforeResult,
      });
      observation = interpreted.observation;
      interpretationMeta = { provider: interpreted.provider, model: interpreted.model };
    } catch {
      // The action must remain recordable even when the model is unavailable.
    }

    const completionResult = {
      raw_report: report,
      interpretation: observation,
      ...(legacyResult ? { legacy_result: legacyResult } : {}),
    };

    const { data: completion, error: completionError } = await supabase.rpc("stryde_complete_human_action", {
      p_action_id: actionId,
      p_terminal_status: terminalStatus,
      p_result: completionResult,
      p_note: note,
    });
    if (completionError) {
      const message = completionError.message || "Unable to record Action result";
      return errorResponse(message, /authentication|not found|only HUMAN|not in progress|invalid/i.test(message) ? 400 : 500);
    }

    const completedObservationId = typeof completion?.observation?.id === "string" ? completion.observation.id : null;
    const interpretedUserClaims = normalizeUserClaims(observation.user_claims);
    const claimSync = completedObservationId && interpretedUserClaims.length
      ? await syncObservedUserClaims({
          supabase,
          userId: user.id,
          pursuitId: id,
          observationId: completedObservationId,
          claims: interpretedUserClaims,
        })
      : { created: 0, warnings: [] };

    const memory = completedObservationId
      ? await recordMemory(supabase, {
          ownerUserId: user.id,
          pursuitId: id,
          memoryType: "EXPERIENCE",
          content: observation.what_happened,
          structuredDetail: {
            summary: observation.summary,
            evidence: observation.evidence,
            uncertainties: observation.uncertainties,
            blockers: observation.blockers,
            implications: observation.implications,
            terminal_status: terminalStatus,
          },
          provenanceType: "USER_REPORTED",
          provenance: {
            source: "HUMAN_ACTION_RESULT",
            action_id: actionId,
          },
          confidence: 0.6,
          importance: observation.blockers.length > 0 ? 0.85 : 0.7,
          sourceObservationId: completedObservationId,
        })
      : null;

    const situationResult = await assembleAdaptiveSituation(supabase, user.id, id);
    if (situationResult.error || !situationResult.situation) return errorResponse(situationResult.error ?? "Unable to assemble updated Situation", 500);

    const conversation = [...conversationBeforeResult, { role: "user" as const, content: report }];

    let nextWorkingState = session.working_state as Parameters<typeof runAdaptiveWorkController>[0]["previousWorkingState"];
    let modelMeta: { provider: string; model: string } | null = null;

    try {
      const resultState = await runAdaptiveWorkController({
        pursuitTitle: pursuit.title ?? "Untitled pursuit",
        situation: situationResult.situation,
        conversation,
        previousWorkingState: nextWorkingState,
      });
      nextWorkingState = resultState.workingState;
      modelMeta = { provider: resultState.provider, model: resultState.model };
    } catch {
      nextWorkingState = {
        ...(nextWorkingState ?? {
          version: 1,
          objective: null,
          understanding: "The Action result was recorded, but Stryde could not reassess the pursuit.",
          known: [],
          unknowns: [],
          bottleneck: "Adaptive reassessment is temporarily unavailable.",
        }),
        status: "STALLED",
        next_move: null,
        understanding: "The Action result was recorded. Stryde could not safely compute the next move, so it left the pursuit stalled rather than inventing one.",
        bottleneck: "Adaptive reassessment is temporarily unavailable.",
      };
    }

    const { error: persistError } = await supabase
      .from("conversation_session")
      .update({ working_state: nextWorkingState, updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("owner_user_id", user.id);

    if (persistError) return errorResponse("Action was recorded, but the next move could not be persisted", 500);

    const assistantMessage = buildActionCompletionMessage(observation, nextWorkingState);
    const metadata = {
      question: observation.suggested_follow_up,
      options: [],
      ready_for_reasoning: true,
      focus: "ACTION_REPORT",
      work: nextWorkingState,
      observation_interpretation: observation,
      ...(interpretationMeta ? { observation_model: interpretationMeta } : {}),
      ...(modelMeta ? { work_model: modelMeta } : {}),
      auto_claims: claimSync,
      memory: memory ? { id: memory.id } : null,
    };

    const { data: committedTurn, error: commitTurnError } = await supabase.rpc("stryde_commit_conversation_turn", {
      p_session_id: sessionId,
      p_turn_key: turnKey,
      p_content: assistantMessage,
      p_metadata: metadata,
      p_working_state: nextWorkingState,
    });
    if (commitTurnError) return errorResponse("Action was recorded, but the conversation response could not be saved", 500);

    return NextResponse.json({
      completion,
      working_state: nextWorkingState,
      assistant_message: assistantMessage,
      metadata,
      committed_turn: committedTurn,
      observation_interpretation: observation,
      ...(interpretationMeta ? { observation_model: interpretationMeta } : {}),
      ...(modelMeta ? { model: modelMeta } : {}),
      auto_claims: claimSync,
      memory: memory ? { id: memory.id } : null,
    }, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("Request body must be valid JSON", 400);
    const message = error instanceof Error ? error.message : "Unable to record Action result";
    return errorResponse(message, message.includes("token") ? 401 : 500);
  }
}