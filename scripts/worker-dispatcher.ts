import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { assertWorkerToolBinding, parseWorkerJobArguments } from "../lib/worker-contract.ts";
import { getWorkerProvider, type WorkerResult } from "../lib/worker-gateway.ts";

// Load .env.local the same way the other repository scripts do. Without this
// the dispatcher aborts with a missing-credential error even when the local
// environment is fully configured, which made the worker plane look
// unreachable when it was only unconfigured-in-this-process.
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const localEnvPath = path.join(repoRoot, ".env.local");
if (fs.existsSync(localEnvPath)) {
  const fileEnv = Object.fromEntries(
    fs.readFileSync(localEnvPath, "utf8")
      .split(/\r?\n/).filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  for (const [k, v] of Object.entries(fileEnv)) if (!(k in process.env)) process.env[k] = v;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const workerId = process.env.STRYDE_WORKER_ID?.trim() || `stryde-worker-${process.pid}`;
const pollMs = Number.parseInt(process.env.STRYDE_WORKER_POLL_MS || "1000", 10);
const leaseSeconds = Math.min(900, Math.max(60, Number.parseInt(process.env.STRYDE_WORKER_LEASE_SECONDS || "600", 10)));
const maxRuntimeMs = Math.min(540_000, Math.max(5_000, Number.parseInt(process.env.STRYDE_WORKER_MAX_RUNTIME_MS || "300000", 10)));
const once = process.env.STRYDE_WORKER_ONCE === "1";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the worker dispatcher");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

type LeaseJob = {
  id: string;
  owner_user_id: string;
  action_id: string;
  tool_id: string;
  tool_version: string;
  frozen_arguments: unknown;
  idempotency_key: string;
};

function boundedResult(value: unknown): unknown {
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

// Exported for unit tests: an empty queue is a NULL composite row, not JS null.
export function leasedJobOrNull(data: unknown): LeaseJob | null {
  const row = data as Partial<LeaseJob> | null;
  if (!row || typeof row !== "object" || !row.id || typeof row.id !== "string") return null;
  return row as LeaseJob;
}

async function leaseJob(): Promise<LeaseJob | null> {
  const { data, error } = await supabase.rpc("stryde_lease_next_job", {
    p_worker_id: workerId,
    p_lease_seconds: leaseSeconds,
  });
  if (error) throw error;

  // `stryde_lease_next_job` is declared `returns public.job`, so Postgres always
  // hands back exactly one row. When the queue is empty that row is a
  // NULL composite, which arrives as an object whose fields are all null. It is
  // NOT a JavaScript null. Treating it as a job made the dispatcher call
  // stryde_start_attempt with a null job_id and fail with
  //   22P02 invalid input syntax for type uuid: "null"
  // on every poll, which looked like a broken worker plane and stalled every
  // queued job. An empty queue must be recognized as "no work", not as a job.
  const row = data as Partial<LeaseJob> | null;
  if (!row || typeof row !== "object" || !row.id || typeof row.id !== "string") return null;
  return row as LeaseJob;
}

async function finishAttempt(attemptId: string, status: "SUCCEEDED" | "FAILED" | "UNKNOWN", externalId: string | null, result: unknown, errorDetail: unknown = null) {
  const { error } = await supabase.rpc("stryde_finish_attempt", {
    p_attempt_id: attemptId,
    p_worker_id: workerId,
    p_result_status: status,
    p_external_correlation_id: externalId,
    p_mechanical_result: boundedResult(result),
    p_error_detail: errorDetail ? boundedResult(errorDetail) : null,
  });
  if (error) throw error;
}

async function recordAttemptObservation(attemptId: string) {
  const { error } = await supabase.rpc("stryde_record_attempt_observation", {
    p_attempt_id: attemptId,
    p_claim_id: null,
    p_relation_type: null,
  });
  if (error) throw error;
}

async function processJob(job: LeaseJob) {
  const { data: tool, error: toolError } = await supabase
    .from("tool")
    .select("id, tool_key, tool_version")
    .eq("id", job.tool_id)
    .eq("tool_version", job.tool_version)
    .maybeSingle();
  if (toolError) throw toolError;
  if (!tool) throw new Error("Leased Job references an unregistered tool");

  const args = parseWorkerJobArguments(job.frozen_arguments);
  assertWorkerToolBinding(tool.tool_key, tool.tool_version, args);

  const { data: action, error: actionError } = await supabase
    .from("action")
    .select("id, pursuit_id, execution_mode, status")
    .eq("id", job.action_id)
    .eq("owner_user_id", job.owner_user_id)
    .maybeSingle();
  if (actionError) throw actionError;
  if (!action || action.execution_mode !== "CONTROLLED") throw new Error("Worker Job is not bound to a CONTROLLED Action");

  const { data: attempt, error: attemptError } = await supabase.rpc("stryde_start_attempt", {
    p_job_id: job.id,
    p_worker_id: workerId,
  });
  if (attemptError) throw attemptError;
  const attemptId = (attempt as { id?: unknown } | null)?.id;
  if (typeof attemptId !== "string") throw new Error("Worker attempt was not created");

  const provider = getWorkerProvider(args.worker_type);
  let externalWorkId: string | null = null;
  const startedAt = Date.now();

  try {
    const submission = await provider.submit({
      pursuitId: action.pursuit_id,
      actionId: job.action_id,
      workerType: args.worker_type,
      instruction: args.instruction,
      context: args.context,
      idempotencyKey: args.idempotency_key || job.idempotency_key,
    });
    externalWorkId = submission.externalWorkId;

    while (Date.now() - startedAt < maxRuntimeMs) {
      const status = await provider.status(externalWorkId);
      if (status === "SUCCEEDED" || status === "FAILED") break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(pollMs, 5_000)));
    }

    const finalStatus = await provider.status(externalWorkId);
    if (finalStatus === "RUNNING" || finalStatus === "UNKNOWN") {
      await finishAttempt(attemptId, "UNKNOWN", externalWorkId, { external_work_id: externalWorkId, provider: args.worker_type }, { reason: "worker_timeout_or_unknown_state" });
      await recordAttemptObservation(attemptId);
      return;
    }

    let workerResult: WorkerResult;
    try {
      workerResult = await provider.result(externalWorkId);
    } catch (error) {
      await finishAttempt(attemptId, "UNKNOWN", externalWorkId, { external_work_id: externalWorkId, provider: args.worker_type }, { reason: "result_fetch_failed", message: error instanceof Error ? error.message : String(error) });
      await recordAttemptObservation(attemptId);
      return;
    }

    await finishAttempt(attemptId, workerResult.status, externalWorkId, {
      provider: workerResult.provider,
      external_work_id: workerResult.externalWorkId,
      result: boundedResult(workerResult.result),
      raw_result_reference: workerResult.rawResultReference ?? null,
    }, workerResult.status === "FAILED" ? { reason: "worker_reported_failure" } : null);
    await recordAttemptObservation(attemptId);
  } catch (error) {
    const detail = {
      reason: "worker_dispatch_failed",
      message: error instanceof Error ? error.message : String(error),
    };
    await finishAttempt(attemptId, "FAILED", externalWorkId, { provider: args.worker_type, external_work_id: externalWorkId }, detail);
    await recordAttemptObservation(attemptId);
  }
}

async function main() {
  if (!Number.isFinite(pollMs) || pollMs < 100) throw new Error("STRYDE_WORKER_POLL_MS must be at least 100ms");
  for (;;) {
    // A single bad lease or dispatch must never kill the dispatcher. A worker
    // plane that exits on the first transient database error stops processing
    // every remaining job, which reads as "the worker plane is broken". Report
    // the failure and keep the loop alive; jobs that need attention are
    // recovered by the reconcile path, not by a crashed process.
    let job: LeaseJob | null = null;
    try {
      job = await leaseJob();
    } catch (error) {
      console.error("[stryde-worker-dispatcher] lease failed:", error);
    }
    if (!job) {
      if (once) return;
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }
    try {
      await processJob(job);
    } catch (error) {
      console.error(`[stryde-worker-dispatcher] job ${job.id} failed:`, error);
    }
    if (once) return;
  }
}

main().catch((error) => {
  console.error("[stryde-worker-dispatcher]", error);
  process.exitCode = 1;
});
