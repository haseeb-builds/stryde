import { NextResponse } from "next/server";
import { buildReasoningPrompt, runReasoningKernel } from "@/lib/orchestration";
import { assembleSituation } from "@/lib/situation";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type RequestBody = {
  input?: unknown;
  model_proposal?: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireAuthenticatedSupabase(
      request.headers.get("authorization"),
    );
    const { id } = await context.params;
    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const requestBody = body as RequestBody;
    const input =
      typeof requestBody.input === "string"
        ? { text: requestBody.input, pursuit_id: id }
        : requestBody.input && typeof requestBody.input === "object"
          ? requestBody.input as { text?: unknown; pursuit_id?: unknown }
          : null;

    if (!input || typeof input.text !== "string") {
      return NextResponse.json({ error: "input must be a non-empty string or { text: string }" }, { status: 400 });
    }

    const normalizedInput = {
      text: input.text,
      pursuit_id: typeof input.pursuit_id === "string" ? input.pursuit_id : id,
    };

    if (normalizedInput.pursuit_id !== id) {
      return NextResponse.json({ error: "pursuit_id must match route id" }, { status: 400 });
    }

    const situationResult = await assembleSituation(supabase, user.id, id);
    if (situationResult.error || !situationResult.situation) {
      return NextResponse.json(
        { error: situationResult.error ?? "Unable to assemble situation" },
        { status: situationResult.error === "Pursuit not found" ? 404 : 500 },
      );
    }

    if (requestBody.model_proposal === undefined) {
      return NextResponse.json({
        status: "MODEL_INPUT_REQUIRED",
        prompt: buildReasoningPrompt(normalizedInput, situationResult.situation),
        situation_generated_at: situationResult.situation.generated_at,
      });
    }

    const result = runReasoningKernel(
      normalizedInput,
      situationResult.situation,
      requestBody.model_proposal,
    );

    return NextResponse.json({ reasoning: result });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message.includes("token") ? 401 : 400 },
    );
  }
}
