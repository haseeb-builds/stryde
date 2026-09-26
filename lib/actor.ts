export const ACTOR_TYPES = ["HUMAN", "STRYDE", "WORKER", "CONTROLLED_TOOL"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

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
