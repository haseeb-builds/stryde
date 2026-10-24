import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { isWorkerDispatchAuthorized, runWorkerDispatchBatch } from "@/lib/worker-dispatch-runner";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const workerSecretHeader = request.headers.get("x-stryde-worker-secret");

  if (!isWorkerDispatchAuthorized(authHeader, workerSecretHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const workerId = `stryde-cron-dispatcher-${Date.now()}`;

  const result = await runWorkerDispatchBatch(supabase, workerId);

  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return POST(request);
}
