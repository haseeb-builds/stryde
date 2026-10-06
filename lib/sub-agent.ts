// Task-local sub-agents (Phase 13). Stryde does NOT introduce a generic
// agent framework: a sub-agent is a CONTROLLED worker execution with an
// explicit, frozen scope. This module defines the spec and its validation;
// execution still goes through the existing worker gateway, lease, attempt,
// and observation plane. Sub-agent output is untrusted result data until
// verified — the same epistemics as every other worker result.
import { WORKER_TYPES } from "./actor.ts";

export type SubAgentSpec = {
  // One bounded objective, phrased as a completion condition reality can
  // contradict (an artifact on disk, a fetchable URL, a readable state).
  objective: string;
  completionCondition: string;
  workerType: (typeof WORKER_TYPES)[number];
  // Scoped tools and skills: the sub-agent sees only what it needs.
  allowedTools: string[];
  allowedSkillIds: string[];
  // Resource budget, reserved through the normal resource plane.
  budget: { resource: string; expected: number }[];
  timeoutMs: number;
  // The expected shape of the worker's result payload.
  outputSchema: Record<string, unknown> | null;
  // Traceability: the parent run/action that spawned this sub-agent.
  parentRunId: string | null;
  parentActionId: string | null;
  // Output trust classification: always untrusted at birth.
  trustClassification: "UNTRUSTED_RESULT_DATA";
};

const MAX_TIMEOUT_MS = 15 * 60_000;
const MAX_TOOLS = 8;
const MAX_BUDGET_ENTRIES = 6;

export function validateSubAgentSpec(value: unknown): { valid: boolean; issues: string[]; spec: SubAgentSpec | null } {
  const issues: string[] = [];
  if (typeof value !== "object" || value === null) {
    return { valid: false, issues: ["spec must be an object"], spec: null };
  }
  const v = value as Record<string, unknown>;
  const objective = typeof v.objective === "string" ? v.objective.trim() : "";
  const completion = typeof v.completion_condition === "string" ? v.completion_condition.trim() : "";
  const workerTypeRaw = typeof v.worker_type === "string" ? v.worker_type.trim().toUpperCase() : "";
  const workerType = workerTypeRaw as SubAgentSpec["workerType"];
  if (!objective) issues.push("objective is required");
  if (objective.length > 4000) issues.push("objective must be a bounded task, not an open-ended mission");
  if (!completion) issues.push("completion_condition is required (reality-judgeable, not agent-judged)");
  if (!WORKER_TYPES.includes(workerType)) issues.push(`worker_type must be one of ${WORKER_TYPES.join("/")}`);

  const allowedTools = Array.isArray(v.allowed_tools) ? v.allowed_tools.filter((t): t is string => typeof t === "string") : [];
  if (allowedTools.length === 0) issues.push("at least one scoped tool is required (least privilege)");
  if (allowedTools.length > MAX_TOOLS) issues.push(`tool scope exceeds ${MAX_TOOLS}`);

  const allowedSkillIds = Array.isArray(v.allowed_skill_ids) ? v.allowed_skill_ids.filter((t): t is string => typeof t === "string") : [];

  const rawBudget = Array.isArray(v.budget) ? v.budget : [];
  const budget = rawBudget
    .filter((b): b is { resource: string; expected: number } =>
      typeof b === "object" && b !== null && typeof (b as { resource?: unknown }).resource === "string" && typeof (b as { expected?: unknown }).expected === "number")
    .slice(0, MAX_BUDGET_ENTRIES);
  if (budget.length === 0) issues.push("a resource budget is required for every sub-agent");

  const timeoutMs = typeof v.timeout_ms === "number" ? v.timeout_ms : 0;
  if (!(timeoutMs > 0 && timeoutMs <= MAX_TIMEOUT_MS)) issues.push(`timeout_ms must be between 1 and ${MAX_TIMEOUT_MS}`);

  if (issues.length > 0) return { valid: false, issues, spec: null };
  return {
    valid: true,
    issues,
    spec: {
      objective,
      completionCondition: completion,
      workerType,
      allowedTools,
      allowedSkillIds,
      budget,
      timeoutMs,
      outputSchema: (typeof v.output_schema === "object" && v.output_schema !== null ? v.output_schema : null) as Record<string, unknown> | null,
      parentRunId: typeof v.parent_run_id === "string" ? v.parent_run_id : null,
      parentActionId: typeof v.parent_action_id === "string" ? v.parent_action_id : null,
      trustClassification: "UNTRUSTED_RESULT_DATA",
    },
  };
}
