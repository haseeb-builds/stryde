import { NextResponse } from "next/server";
import { leaseNextJob } from "@/lib/execution-control";
import { requireWorkerSecret } from "@/lib/internal-worker-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireWorkerSecret(request);
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || !("worker_id" in body)) {
      return NextResponse.json({ error: "worker_id is required" }, { status: 400 });
    }
    const workerId = typeof body.worker_id === "string" ? body.worker_id.trim() : "";
    if (!workerId) return NextResponse.json({ error: "worker_id is required" }, { status: 400 });

    const leaseSeconds = "lease_seconds" in body && typeof body.lease_seconds === "number"
      ? body.lease_seconds
      : 60;

    const job = await leaseNextJob(getSupabaseServiceClient(), workerId, leaseSeconds);
    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Execution lease failed";
    const status = message.includes("authentication") || message.includes("Authentication") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
