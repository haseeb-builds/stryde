import { NextResponse } from "next/server";
import { reconcileExpiredJob } from "@/lib/execution-control";
import { requireWorkerSecret } from "@/lib/internal-worker-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireWorkerSecret(request);
    const body: unknown = await request.json();
    const jobId = typeof body === "object" && body !== null && "job_id" in body && typeof body.job_id === "string"
      ? body.job_id.trim()
      : "";
    if (!jobId) return NextResponse.json({ error: "job_id is required" }, { status: 400 });

    const job = await reconcileExpiredJob(getSupabaseServiceClient(), jobId);
    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job reconciliation failed";
    return NextResponse.json({ error: message }, { status: message.includes("authentication") || message.includes("Authentication") ? 401 : 500 });
  }
}
