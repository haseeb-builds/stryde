export const ACTOR_TYPES = ["HUMAN", "STRYDE", "WORKER", "CONTROLLED_TOOL"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const WORKER_TYPES = ["HERMES", "OPENCODE", "BROWSER"] as const;
export type WorkerType = (typeof WORKER_TYPES)[number];

export function normalizeWorkerType(actor: ActorType, value: unknown): WorkerType | null {
  if (actor !== "WORKER") return null;
  // Membership in WORKER_TYPES is the single source of truth; a hardcoded list
  // here drifted from the gateway's own set.
  return typeof value === "string" && (WORKER_TYPES as readonly string[]).includes(value) ? (value as WorkerType) : null;
}

export function defaultActorForWorkMode(mode: string): ActorType {
  if (mode === "CREATE_ACTION" || mode === "ASK_USER") return "HUMAN";
  if (mode === "EXECUTE_TOOL") return "CONTROLLED_TOOL";
  return "STRYDE";
}

export function normalizeActor(mode: string, actor: unknown): ActorType {
  return typeof actor === "string" && ACTOR_TYPES.includes(actor as ActorType)
    ? (actor as ActorType)
    : defaultActorForWorkMode(mode);
}
