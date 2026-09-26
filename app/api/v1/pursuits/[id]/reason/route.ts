import { NextResponse } from "next/server";
import { runModelProposal } from "@/lib/model-gateway";
import { buildReasoningPrompt, runReasoningKernel } from "@/lib/orchestration";
import { createRun, transitionRun } from "@/lib/run";
import { assembleSituation } from "@/lib/situation";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 55;
type RouteContext = { params: Promise<{ id: string }> };

type RequestBody = { session_id?: unknown; instruction?: unknown; model_proposal?: unknown };

export async function POST(request: Request, context: RouteContext) {
  let supabaseForRecovery: Awaited<ReturnType<typeof requireAuthenticatedSupabase>>["supabase"] | null = null;
  let runId: string | null = null;
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(request.headers.get("authorization"));
    supabaseForRecovery = supabase;
    const { id } = await context.params;
    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const requestBody = body as RequestBody;
    if (requestBody.model_proposal !== undefined) {
      const developmentInputAllowed =
        process.env.NODE_ENV !== "production" &&
        process.env.STRYDE_ALLOW_DEVELOPMENT_MODEL_INPUT === "true";
      if (!developmentInputAllowed) {
        return NextResponse.json({ error: "model_proposal is only available in explicitly enabled development environments" }, { status: 403 });
      }
    }

    if (typeof requestBody.session_id !== "string" || !requestBody.session_id.trim()) {
      return NextResponse.json({ error: "session_id must be provided" }, { status: 400 });
    }
    if (requestBody.instruction !== undefined && (typeof requestBody.instruction !== "string" || requestBody.instruction.trim().length > 2_000)) {
      return NextResponse.json({ error: "instruction must be a string of at most 2000 characters" }, { status: 400 });
    }

    const sessionId = requestBody.session_id.trim();
    const { data: session, error: sessionError } = await supabase
      .from("conversation_session")
      .select("id, pursuit_id, status")
      .eq("id", sessionId)
      .eq("pursuit_id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (sessionError) return NextResponse.json({ error: "Unable to load conversation" }, { status: 500 });
    if (!session) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    const { data: priorMessages, error: messagesError } = await supabase
      .from("conversation_message")
      .select("role, content")
      .eq("session_id", sessionId)
      .eq("owner_user_id", user.id)
      .order("sequence_no", { ascending: true })
      .limit(16);
    if (messagesError) return NextResponse.json({ error: "Unable to load conversation history" }, { status: 500 });

    const conversation = (priorMessages ?? []).map((item) => ({
      role: item.role === "USER" ? "user" as const : "stryde" as const,
      content: item.content,
    }));

    const latestUserMessage = [...conversation].reverse().find((item) => item.role === "user")?.content;
    const normalizedInput = {
      text: (typeof requestBody.instruction === "string" && requestBody.instruction.trim())
        ? requestBody.instruction.trim()
        : latestUserMessage?.trim() || "Reassess the current situation and determine the next useful intervention.",
      pursuit_id: id,
    };

    const run = await createRun(supabase, "PURSUIT_REASON", {
      pursuit_id: id,
      session_id: sessionId,
      input_text: normalizedInput.text,
    });
    runId = run.id;

    await transitionRun(supabase, run.id, "CONTEXT_ASSEMBLY");
    await transitionRun(supabase, run.id, "UNDERSTAND");
    const reassessed = await transitionRun(supabase, run.id, "REASSESS");

    const situationResult = await assembleSituation(supabase, user.id, id);
    if (situationResult.error || !situationResult.situation) {
      await transitionRun(supabase, run.id, "FAILED", "FAILED", situationResult.error ?? "Unable to assemble situation");
      return NextResponse.json({ error: situationResult.error ?? "Unable to assemble situation", run_id: run.id }, { status: 500 });
    }

    const prompt = buildReasoningPrompt(normalizedInput, situationResult.situation, conversation);
    const modelResult = requestBody.model_proposal !== undefined
      ? { proposal: requestBody.model_proposal, provider: "development", model: "supplied" }
      : await runModelProposal(prompt);

    const result = runReasoningKernel(
      normalizedInput,
      situationResult.situation,
      modelResult.proposal,
    );
    for (const stage of result.stages.slice(4)) {
      await transitionRun(supabase, run.id, stage);
    }

    let finalRun = null;
    if (!result.intervention && result.proposed_response) {
      finalRun = await transitionRun(supabase, run.id, "DONE");
    }

    return NextResponse.json({
      run_id: run.id,
      run: finalRun,
      reasoning: result,
      model: { provider: modelResult.provider, model: modelResult.model },
      ...(requestBody.model_proposal === undefined ? {} : { development_model_input: true }),
      reassessed_run: reassessed,
    });
  } catch (error) {
    if (runId && supabaseForRecovery) {
      try {
        const { data: currentRun } = await supabaseForRecovery
          .from("run")
          .select("current_stage, status")
          .eq("id", runId)
          .maybeSingle();
        if (currentRun && currentRun.status !== "SUCCEEDED" && currentRun.status !== "FAILED" && currentRun.current_stage !== "FAILED") {
          await transitionRun(
            supabaseForRecovery,
            runId,
            "FAILED",
            "FAILED",
            error instanceof Error ? error.message : "Reasoning failed",
          );
        }
      } catch {
        // Preserve the original error if lifecycle recovery also fails.
      }
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON", ...(runId ? { run_id: runId } : {}) }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message, ...(runId ? { run_id: runId } : {}) }, { status: message.includes("token") ? 401 : 500 });
  }
}
