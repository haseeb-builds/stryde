import { NextResponse } from "next/server";
import { transitionRun, RUN_STAGES, type RunStage } from "@/lib/run";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase } = await requireAuthenticatedSupabase(
      request.headers.get("authorization"),
    );
    const { id } = await context.params;
    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null || !("to_stage" in body) || typeof body.to_stage !== "string") {
      return NextResponse.json({ error: "to_stage is required" }, { status: 400 });
    }
    if (!(RUN_STAGES as readonly string[]).includes(body.to_stage)) {
      return NextResponse.json({ error: "Invalid Run stage" }, { status: 400 });
    }

    const status = "status" in body && typeof body.status === "string" ? body.status : undefined;
    const failureReason = "failure_reason" in body && typeof body.failure_reason === "string" ? body.failure_reason : null;
    const run = await transitionRun(supabase, id, body.to_stage as RunStage, status, failureReason);

    return NextResponse.json({ run });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to transition Run";
    const status = /not found/i.test(message) ? 404 : /authentication|token/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
