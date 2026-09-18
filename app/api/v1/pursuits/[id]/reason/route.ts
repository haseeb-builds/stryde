import { NextResponse } from "next/server";
import { runModelProposal } from "@/lib/model-gateway";
import { buildReasoningPrompt, runReasoningKernel } from "@/lib/orchestration";
import { createRun, transitionRun } from "@/lib/run";
import { assembleSituation } from "@/lib/situation";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;
type RouteContext = { params: Promise<{ id: string }> };

type RequestBody = { input?: unknown; model_proposal?: unknown };

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
    const input = typeof requestBody.input === "string"
      ? { text: requestBody.input, pursuit_id: id }
      : requestBody.input && typeof requestBody.input === "object"
        ? requestBody.input as { text?: unknown; pursuit_id?: unknown }
        : null;

    if (!input || typeof input.text !== "string" || input.text.trim().length === 0) {
      return NextResponse.json({ error: "input must be a non-empty string or { text: string }" }, { status: 400 });
    }

    const normalizedInput = { text: input.text.trim(), pursuit_id: typeof input.pursuit_id === "string" ? input.pursuit_id : id };
    if (normalizedInput.pursuit_id !== id) {
      return NextResponse.json({ error: "pursuit_id must match route id" }, { status: 400 });
    }

    const run = await createRun(supabase, "PURSUIT_REASON", { pursuit_id: id, input_text: normalizedInput.text });
    runId = run.id;

    await transitionRun(supabase, run.id, "CONTEXT_ASSEMBLY");
    await transitionRun(supabase, run.id, "UNDERSTAND");
    const reassessed = await transitionRun(supabase, run.id, "REASSESS");

    const situationResult = await assembleSituation(supabase, user.id, id);
    if (situationResult.error || !situationResult.situation) {
      await transitionRun(supabase, run.id, "FAILED", "FAILED", situationResult.error ?? "Unable to assemble situation");
      return NextResponse.json({ error: situationResult.error ?? "Unable to assemble situation", run_id: run.id }, { status: 500 });
    }

    const prompt = buildReasoningPrompt(normalizedInput, situationResult.situation);
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
