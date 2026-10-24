import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reconcileExpiredJob } from "./execution-control.ts";
import { assertWorkerToolBinding, parseWorkerJobArguments } from "./worker-contract.ts";
import { getWorkerProvider, type WorkerResult, type WorkerType } from "./worker-gateway.ts";

export const LEASE_SECONDS = 120;
export const BATCH_LIMIT = 5;

export function isWorkerDispatchAuthorized(
  authHeader: string | null,
  headerSecret: string | null,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const cronSecret = env.CRON_SECRET;
  const workerSecret = env.STRYDE_WORKER_SECRET;

  // Check Bearer token (Vercel Cron)
  if (cronSecret && authHeader?.startsWith("Bearer ")) {
    const provided = authHeader.slice("Bearer ".length);
    const expectedBuf = Buffer.from(cronSecret, "utf8");
    const providedBuf = Buffer.from(provided, "utf8");
    if (expectedBuf.length === providedBuf.length && timingSafeEqual(expectedBuf, providedBuf)) {
      return true;
    }
  }

  // Check x-stryde-worker-secret header (Internal dispatch trigger)
  if (workerSecret && headerSecret) {
    const expectedBuf = Buffer.from(workerSecret, "utf8");
    const providedBuf = Buffer.from(headerSecret, "utf8");
    if (expectedBuf.length === providedBuf.length && timingSafeEqual(expectedBuf, providedBuf)) {
      return true;
    }
  }

  // In development without secrets configured, allow internal invocation
  if (env.NODE_ENV === "development" && !cronSecret && !workerSecret) {
    return true;
  }

  return false;
}

export type LeasedJobRow = {
  id: string;
  owner_user_id: string;
  action_id: string;
  tool_id: string;
  tool_version: string;
  frozen_arguments: unknown;
  idempotency_key: string;
};

export function boundedResult(value: unknown): unknown {
  try {
    const serialized = JSON.stringify(value ?? null);
    if (serialized.length <= 200_000) return value ?? null;
    return {
      truncated: true,
      preview: serialized.slice(0, 195_000),
      original_size_bytes: Buffer.byteLength(serialized, "utf8"),
    };
  } catch {
    return { truncated: true, preview: String(value).slice(0, 195_000) };
  }
}

export async function reconcileExpiredJobsBatch(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("job")
    .select("id")
    .in("status", ["DISPATCHING", "AWAITING_CALLBACK"])
    .lt("lease_expires_at", new Date().toISOString())
    .limit(20);

  if (error || !data) return 0;
  let count = 0;
  for (const row of data) {
    try {
      await reconcileExpiredJob(supabase, row.id);
      count += 1;
    } catch (err) {
      console.warn(`[worker-dispatch-runner] reconcile error for job ${row.id}:`, err);
    }
  }
  return count;
}

export async function executeSingleWorkerJob(
  supabase: SupabaseClient,
  job: LeasedJobRow,
  workerId: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<{
  jobId: string;
  status: "SUCCEEDED" | "FAILED" | "UNKNOWN" | "UNCONFIGURED";
}> {
  const { data: tool, error: toolError } = await supabase
    .from("tool")
    .select("id, tool_key, tool_version")
    .eq("id", job.tool_id)
    .eq("tool_version", job.tool_version)
    .maybeSingle();

  if (toolError || !tool) {
    throw new Error("Job references unregistered tool");
  }

  const args = parseWorkerJobArguments(job.frozen_arguments);
  assertWorkerToolBinding(tool.tool_key, tool.tool_version, args);

  const { data: action, error: actionError } = await supabase
    .from("action")
    .select("id, pursuit_id, execution_mode, status")
    .eq("id", job.action_id)
    .eq("owner_user_id", job.owner_user_id)
    .maybeSingle();

  if (actionError || !action || action.execution_mode !== "CONTROLLED") {
    throw new Error("Job is not bound to a valid CONTROLLED Action");
  }

  const { data: attempt, error: attemptError } = await supabase.rpc("stryde_start_attempt", {
    p_job_id: job.id,
    p_worker_id: workerId,
  });

  if (attemptError || !attempt) {
    throw new Error("Could not create execution attempt");
  }

  const attemptId = (attempt as { id?: string }).id;
  if (!attemptId) throw new Error("Attempt id missing from RPC");

  // Determine if worker provider is configured
  let provider;
  try {
    provider = getWorkerProvider(args.worker_type as WorkerType, env);
  } catch {
    // Worker runtime URL is not configured in this environment
    await supabase.rpc("stryde_finish_attempt", {
      p_attempt_id: attemptId,
      p_worker_id: workerId,
      p_result_status: "UNKNOWN",
      p_external_correlation_id: null,
      p_mechanical_result: { reason: "worker_runner_unconfigured", worker_type: args.worker_type },
      p_error_detail: { message: `Worker runtime ${args.worker_type} is not configured in environment.` },
    });
    await supabase.rpc("stryde_record_attempt_observation", {
      p_attempt_id: attemptId,
      p_claim_id: null,
      p_relation_type: null,
    });
    return { jobId: job.id, status: "UNCONFIGURED" };
  }

  try {
    const submission = await provider.submit({
      pursuitId: action.pursuit_id,
      actionId: job.action_id,
      workerType: args.worker_type as WorkerType,
      instruction: args.instruction,
      context: args.context,
      idempotencyKey: args.idempotency_key || job.idempotency_key,
    });

    // Wait bounded time within serverless limit (max 15s in cron loop)
    const started = Date.now();
    let currentStatus = await provider.status(submission.externalWorkId);
    while (currentStatus === "RUNNING" && Date.now() - started < 15_000) {
      await new Promise((r) => setTimeout(r, 1000));
      currentStatus = await provider.status(submission.externalWorkId);
    }

    if (currentStatus === "RUNNING") {
      // Still in progress externally — attempt remains open or in progress
      return { jobId: job.id, status: "UNKNOWN" };
    }

    const workerResult: WorkerResult = await provider.result(submission.externalWorkId);

    await supabase.rpc("stryde_finish_attempt", {
      p_attempt_id: attemptId,
      p_worker_id: workerId,
      p_result_status: workerResult.status,
      p_external_correlation_id: workerResult.externalWorkId,
      p_mechanical_result: boundedResult(workerResult.result),
      p_error_detail: workerResult.status === "FAILED" ? { reason: "worker_reported_failure" } : null,
    });

    await supabase.rpc("stryde_record_attempt_observation", {
      p_attempt_id: attemptId,
      p_claim_id: null,
      p_relation_type: null,
    });

    return { jobId: job.id, status: workerResult.status };
  } catch (execError) {
    const message = execError instanceof Error ? execError.message : String(execError);
    await supabase.rpc("stryde_finish_attempt", {
      p_attempt_id: attemptId,
      p_worker_id: workerId,
      p_result_status: "FAILED",
      p_external_correlation_id: null,
      p_mechanical_result: { error: message },
      p_error_detail: { message },
    });
    await supabase.rpc("stryde_record_attempt_observation", {
      p_attempt_id: attemptId,
      p_claim_id: null,
      p_relation_type: null,
    });
    return { jobId: job.id, status: "FAILED" };
  }
}

export async function runWorkerDispatchBatch(
  supabase: SupabaseClient,
  workerId: string,
  limit = BATCH_LIMIT,
  env: NodeJS.ProcessEnv = process.env
): Promise<{
  workerId: string;
  reconciledExpiredCount: number;
  dispatchedCount: number;
  processed: Array<{ jobId: string; status: string }>;
}> {
  const reconciled = await reconcileExpiredJobsBatch(supabase);
  const processed: Array<{ jobId: string; status: string }> = [];

  for (let i = 0; i < limit; i++) {
    const { data: rawJob, error: leaseError } = await supabase.rpc("stryde_lease_next_job", {
      p_worker_id: workerId,
      p_lease_seconds: LEASE_SECONDS,
    });

    if (leaseError) {
      console.error("[worker-dispatch-runner] lease error:", leaseError);
      break;
    }

    const job = rawJob as Partial<LeasedJobRow> | null;
    if (!job || typeof job !== "object" || !job.id || typeof job.id !== "string") {
      // Empty queue
      break;
    }

    try {
      const outcome = await executeSingleWorkerJob(supabase, job as LeasedJobRow, workerId, env);
      processed.push(outcome);
    } catch (err) {
      console.error(`[worker-dispatch-runner] job ${job.id} failed:`, err);
      processed.push({ jobId: job.id, status: "ERROR" });
    }
  }

  return {
    workerId,
    reconciledExpiredCount: reconciled,
    dispatchedCount: processed.length,
    processed,
  };
}
