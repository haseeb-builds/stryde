import { NextResponse } from "next/server";
import { finishAttempt } from "@/lib/execution-control";
import { requireWorkerSecret } from "@/lib/internal-worker-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const RESULT_STATUSES = new Set(["SUCCEEDED", "FAILED", "UNKNOWN"] as const);

export async function POST(request: Request) {
  try {
    requireWorkerSecret(request);
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const attemptId = "attempt_id" in body && typeof body.attempt_id === "string" ? body.attempt_id.trim() : "";
    const workerId = "worker_id" in body && typeof body.worker_id === "string" ? body.worker_id.trim() : "";
    const resultStatus = "result_status" in body && typeof body.result_status === "string" ? body.result_status : "";
    if (!attemptId || !workerId || !RESULT_STATUSES.has(resultStatus as "SUCCEEDED" | "FAILED" | "UNKNOWN")) {
      return NextResponse.json({ error: "attempt_id, worker_id and valid result_status are required" }, { status: 400 });
    }

    const mechanicalResult = "mechanical_result" in body && typeof body.mechanical_result === "object" && body.mechanical_result !== null
      ? body.mechanical_result as Record<string, unknown>
      : null;
    const errorDetail = "error_detail" in body && typeof body.error_detail === "object" && body.error_detail !== null
      ? body.error_detail as Record<string, unknown>
      : null;
    const externalCorrelationId = "external_correlation_id" in body && typeof body.external_correlation_id === "string"
      ? body.external_correlation_id
      : null;

    const attempt = await finishAttempt(getSupabaseServiceClient(), {
      attemptId,
      workerId,
      resultStatus: resultStatus as "SUCCEEDED" | "FAILED" | "UNKNOWN",
      externalCorrelationId,
      mechanicalResult,
      errorDetail,
    });
    return NextResponse.json({ attempt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Attempt finish failed";
    return NextResponse.json({ error: message }, { status: message.includes("authentication") || message.includes("Authentication") ? 401 : 500 });
  }
}
