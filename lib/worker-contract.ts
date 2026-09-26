import type { WorkerType } from "@/lib/worker-gateway";

const MAX_INSTRUCTION = 12_000;
const MAX_KEY = 500;

export type WorkerJobArguments = {
  worker_type: WorkerType;
  instruction: string;
  context: Record<string, unknown>;
  idempotency_key: string;
};

function requireText(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") throw new Error(field + " must be a string");
  const trimmed = value.trim();
  if (!trimmed) throw new Error(field + " must be non-empty");
  if (trimmed.length > max) throw new Error(field + " exceeds maximum length");
  return trimmed;
}

export function parseWorkerJobArguments(value: unknown): WorkerJobArguments {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Worker job arguments must be an object");
  }

  const record = value as Record<string, unknown>;
  const workerType = record.worker_type;
  if (workerType !== "HERMES" && workerType !== "OPENCODE") {
    throw new Error("worker_type must be HERMES or OPENCODE");
  }

  const context = record.context;
  if (typeof context !== "object" || context === null || Array.isArray(context)) {
    throw new Error("worker context must be an object");
  }

  return {
    worker_type: workerType,
    instruction: requireText(record.instruction, "instruction", MAX_INSTRUCTION),
    context: context as Record<string, unknown>,
    idempotency_key: requireText(record.idempotency_key, "idempotency_key", MAX_KEY),
  };
}

export function workerTypeForToolKey(toolKey: unknown): WorkerType {
  if (toolKey === "worker.hermes") return "HERMES";
  if (toolKey === "worker.opencode") return "OPENCODE";
  throw new Error("Unsupported worker tool");
}

export function assertWorkerToolBinding(toolKey: unknown, toolVersion: unknown, args: WorkerJobArguments) {
  if (toolVersion !== "v1") throw new Error("Unsupported worker tool version");
  if (workerTypeForToolKey(toolKey) !== args.worker_type) {
    throw new Error("Worker tool and worker_type do not match");
  }
}
