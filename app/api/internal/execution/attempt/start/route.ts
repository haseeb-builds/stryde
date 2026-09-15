import { NextResponse } from "next/server";
import { startAttempt } from "@/lib/execution-control";
import { requireWorkerSecret } from "@/lib/internal-worker-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireWorkerSecret(request);
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }
    const jobId = "job_id" in body && typeof body.job_id === "string" ? body.job_id.trim() : "";
    const workerId = "worker_id" in body && typeof body.worker_id === "string" ? body.worker_id.trim() : "";
    if (!jobId || !workerId) return NextResponse.json({ error: "job_id and worker_id are required" }, { status: 400 });

    const attempt = await startAttempt(getSupabaseServiceClient(), jobId, workerId);
    return NextResponse.json({ attempt }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Attempt start failed";
    return NextResponse.json({ error: message }, { status: message.includes("authentication") || message.includes("Authentication") ? 401 : 500 });
  }
}
