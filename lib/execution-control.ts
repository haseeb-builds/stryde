import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkerJob = Record<string, unknown> | null;

export async function leaseNextJob(
  supabase: SupabaseClient,
  workerId: string,
  leaseSeconds = 60,
) {
  const { data, error } = await supabase.rpc("stryde_lease_next_job", {
    p_worker_id: workerId,
    p_lease_seconds: leaseSeconds,
  });
  if (error) throw new Error(error.message);
  return data as WorkerJob;
}

export async function startAttempt(
  supabase: SupabaseClient,
  jobId: string,
  workerId: string,
) {
  const { data, error } = await supabase.rpc("stryde_start_attempt", {
    p_job_id: jobId,
    p_worker_id: workerId,
  });
  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}

export async function finishAttempt(
  supabase: SupabaseClient,
  input: {
    attemptId: string;
    workerId: string;
    resultStatus: "SUCCEEDED" | "FAILED" | "UNKNOWN";
    externalCorrelationId?: string | null;
    mechanicalResult?: Record<string, unknown> | null;
    errorDetail?: Record<string, unknown> | null;
  },
) {
  const { data, error } = await supabase.rpc("stryde_finish_attempt", {
    p_attempt_id: input.attemptId,
    p_worker_id: input.workerId,
    p_result_status: input.resultStatus,
    p_external_correlation_id: input.externalCorrelationId ?? null,
    p_mechanical_result: input.mechanicalResult ?? null,
    p_error_detail: input.errorDetail ?? null,
  });
  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}

export async function reconcileExpiredJob(
  supabase: SupabaseClient,
  jobId: string,
) {
  const { data, error } = await supabase.rpc("stryde_reconcile_expired_job", {
    p_job_id: jobId,
  });
  if (error) throw new Error(error.message);
  return data as WorkerJob;
}
