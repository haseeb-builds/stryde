import type { SupabaseClient } from "@supabase/supabase-js";

export const RUN_STAGES = [
  "INPUT",
  "CONTEXT_ASSEMBLY",
  "UNDERSTAND",
  "REASSESS",
  "DIAGNOSE",
  "SELECT_INTERVENTION",
  "PROPOSE",
  "VALIDATE",
  "AUTHORIZE",
  "COMMIT",
  "DONE",
  "FAILED",
  "WAITING",
] as const;

export type RunStage = (typeof RUN_STAGES)[number];

export type RunRecord = {
  id: string;
  owner_user_id: string;
  trigger_type: string;
  trigger_metadata: Record<string, unknown> | null;
  current_stage: RunStage;
  status: string;
  failure_reason?: string | null;
  resume_state?: Record<string, unknown> | null;
  wait_state?: Record<string, unknown> | null;
  version: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
};

export async function createRun(
  supabase: SupabaseClient,
  triggerType: string,
  triggerMetadata: Record<string, unknown> | null,
) {
  const { data, error } = await supabase.rpc("stryde_create_run", {
    p_trigger_type: triggerType,
    p_trigger_metadata: triggerMetadata,
  });
  if (error) throw new Error(error.message);
  return data as RunRecord;
}

export async function transitionRun(
  supabase: SupabaseClient,
  runId: string,
  toStage: RunStage,
  status?: string,
  failureReason?: string | null,
) {
  const { data, error } = await supabase.rpc("stryde_transition_run", {
    p_run_id: runId,
    p_to_stage: toStage,
    p_status: status ?? null,
    p_failure_reason: failureReason ?? null,
  });
  if (error) throw new Error(error.message);
  return data as RunRecord;
}

export async function advanceRun(
  supabase: SupabaseClient,
  runId: string,
  stages: readonly RunStage[],
) {
  let current: RunRecord | null = null;
  for (const stage of stages) {
    current = await transitionRun(supabase, runId, stage);
  }
  return current;
}
