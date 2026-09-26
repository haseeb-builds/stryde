export const ACTOR_TYPES = ["HUMAN", "STRYDE", "WORKER", "CONTROLLED_TOOL"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const WORKER_TYPES = ["HERMES", "OPENCODE"] as const;
export type WorkerType = (typeof WORKER_TYPES)[number];

export function normalizeWorkerType(actor: ActorType, value: unknown): WorkerType | null {
  if (actor !== "WORKER") return null;
  return value === "HERMES" || value === "OPENCODE" ? value : null;
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
