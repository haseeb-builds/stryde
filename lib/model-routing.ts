// Task-aware model routing (Phase 12). The provider chain stays exactly as
// it is; routing only picks WHICH model a configured leg serves a task with.
// Profiles map task classes to optional per-class model overrides (env
// STRYDE_MODEL_FAST / STRYDE_MODEL_STRONG), so cheap mechanical
// transformations never consume premium reasoning and difficult synthesis
// can request a stronger model — while remaining fully provider-neutral:
// with no overrides configured, every task uses the leg's default model.
//
// Cost instrumentation stays in the resource plane (model_turns usage); the
// split exists so a future per-class meter can attribute premium spend to
// the operations that asked for it.

export type ModelTaskClass = "FAST" | "STRONG";

// Tasks that are routine structured transformations run FAST by default;
// tasks whose output is a decision or synthesized user-facing reasoning run
// STRONG. Anything unlisted runs STRONG (fail toward quality, not cost).
const FAST_TASKS = new Set([
  "stryde_source_adaptation",
  "stryde_model_proposal",
]);

export function taskClassFor(schemaName: string): ModelTaskClass {
  return FAST_TASKS.has(schemaName) ? "FAST" : "STRONG";
}

export function modelOverrideForTask(
  schemaName: string,
  env: NodeJS.ProcessEnv,
): string | undefined {
  const cls = taskClassFor(schemaName);
  const raw = cls === "FAST" ? env.STRYDE_MODEL_FAST : env.STRYDE_MODEL_STRONG;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}
