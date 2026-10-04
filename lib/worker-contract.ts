import { WORKER_TYPES, type WorkerType } from "./worker-gateway.ts";

function isKnownWorkerType(value: unknown): value is WorkerType {
  return typeof value === "string" && (WORKER_TYPES as readonly string[]).includes(value);
}

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
  // Membership in WORKER_TYPES is the single source of truth for which worker
  // types exist, so this validation cannot drift from the gateway's own list.
  if (!isKnownWorkerType(workerType)) {
    throw new Error(`worker_type must be one of ${WORKER_TYPES.join(", ")}`);
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

// A worker tool key is derived from the worker type: "worker." + the type in
// lower case. Deriving it means a newly declared worker type is automatically
// addressable by tool key with no edit here (and no Hermes-specific branch).
export function workerToolKey(type: WorkerType): string {
  return `worker.${type.toLowerCase()}`;
}

export function workerTypeForToolKey(toolKey: unknown): WorkerType {
  if (typeof toolKey !== "string") throw new Error("Unsupported worker tool");
  const match = WORKER_TYPES.find((type) => workerToolKey(type) === toolKey);
  if (!match) throw new Error("Unsupported worker tool");
  return match;
}

export function assertWorkerToolBinding(toolKey: unknown, toolVersion: unknown, args: WorkerJobArguments) {
  if (toolVersion !== "v1") throw new Error("Unsupported worker tool version");
  if (workerTypeForToolKey(toolKey) !== args.worker_type) {
    throw new Error("Worker tool and worker_type do not match");
  }
}
