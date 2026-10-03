// Pure memory semantics: normalization, confirmation, and retrieval ranking.
// No database access here — the write path (lib/memory.ts) and the situation
// assembler (lib/adaptive-situation.ts) call these so the rules stay testable.

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "has", "was",
  "were", "are", "but", "not", "you", "your", "his", "her", "its", "their",
  "they", "them", "she", "him", "who", "whom", "which", "what", "when", "where",
  "will", "would", "could", "should", "been", "being", "into", "onto", "about",
  "after", "before", "over", "under", "then", "than", "also", "just", "very",
  "more", "most", "some", "any", "all", "can", "did", "does", "done", "get",
  "got", "had", "how", "out", "per", "via", "yet", "nor", "too", "own", "same",
  "only", "than", "then", "once", "here", "there", "been",
]);

export const CONFIRMATION_STEP = 0.15;
export const CONFIRMATION_CAP = 0.95;
export const PROMOTION_THRESHOLD = 0.8;

export function normalizeMemoryKey(content: string): string {
  return content
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

export function tokenizeMemoryContent(content: string): string[] {
  return normalizeMemoryKey(content)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

// Two memories refer to the same thing when one normalized form equals the
// other, or when one contains the other and the contained one is long enough
// to carry meaning on its own. Containment covers "no dairy" vs "no dairy
// because of an allergy" without letting single-word fragments match everything.
const CONTAINMENT_MIN_TOKENS = 2;

export function memoryContentMatches(a: string, b: string): boolean {
  const keyA = normalizeMemoryKey(a);
  const keyB = normalizeMemoryKey(b);
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;
  if (keyA.includes(keyB) && keyB.split(" ").length >= CONTAINMENT_MIN_TOKENS) return true;
  if (keyB.includes(keyA) && keyA.split(" ").length >= CONTAINMENT_MIN_TOKENS) return true;
  return false;
}

export type MemoryConfirmationState = {
  confidence: number;
  importance: number;
  status: "CANDIDATE" | "ACTIVE";
};

// A repeated independent appearance of the same memory is evidence for it:
// raise confidence, keep the higher importance, and promote once confidence
// crosses the threshold. Confirmation can never push confidence to 1.0 —
// only VERIFIED provenance (adjudication) reaches 0.95.
export function nextConfirmationState(
  existing: MemoryConfirmationState,
  incoming: { confidence: number; importance: number },
): MemoryConfirmationState {
  const confidence = Math.min(
    CONFIRMATION_CAP,
    Math.max(existing.confidence + CONFIRMATION_STEP, incoming.confidence),
  );
  const importance = Math.max(existing.importance, incoming.importance);
  const status: MemoryConfirmationState["status"] =
    existing.status === "ACTIVE" || confidence >= PROMOTION_THRESHOLD ? "ACTIVE" : "CANDIDATE";
  return { confidence, importance, status };
}

export type MemoryRankContext = {
  objective?: string | null;
  bottleneck?: string | null;
  unknowns?: string[] | null;
  focus?: string | null;
};

type RankableMemory = {
  id: string;
  memory_scope?: string;
  memory_type: string;
  status: string;
  content: string;
  confidence: number;
  importance: number;
  updated_at: string;
  last_confirmed_at: string | null;
};

const CANDIDATE_STALENESS_HORIZON_DAYS = 14;
const ACTIVE_STALENESS_HORIZON_DAYS = 120;
const EXPERIENCE_STALE_DAYS = 90;
const EXPERIENCE_STALE_FACTOR = 0.6;

function recencyScore(memory: RankableMemory, now: Date): number {
  const reference = memory.last_confirmed_at ?? memory.updated_at;
  const days = Math.max(0, (now.getTime() - new Date(reference).getTime()) / 86_400_000);
  const horizon = memory.status === "CANDIDATE"
    ? CANDIDATE_STALENESS_HORIZON_DAYS
    : ACTIVE_STALENESS_HORIZON_DAYS;
  return Math.max(0, 1 - days / horizon);
}

function relevanceScore(memory: RankableMemory, contextTokens: string[]): number {
  if (!contextTokens.length) return 0;
  const memoryTokens = new Set(tokenizeMemoryContent(memory.content));
  if (!memoryTokens.size) return 0;
  let overlap = 0;
  for (const token of contextTokens) {
    if (memoryTokens.has(token)) overlap += 1;
  }
  return Math.min(1, overlap / contextTokens.length);
}

// Retrieval ranking for the canonical situation. Live memories only —
// STALE/CONTRADICTED/SUPERSEDED never reach the model as usable state.
export function rankMemories<T extends RankableMemory>(
  memories: T[],
  context: MemoryRankContext,
  now: Date,
  limits: { user?: number; pursuit?: number } = {},
): T[] {
  const live = memories.filter((memory) => memory.status === "ACTIVE" || memory.status === "CANDIDATE");
  const contextText = [context.objective, context.bottleneck, context.focus, ...(context.unknowns ?? [])]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
  const contextTokens = tokenizeMemoryContent(contextText);

  const scored = live.map((memory) => {
    // Relevance to what the pursuit is about right now carries the largest
    // single weight: a memory that bears on the current objective outranks a
    // generic-but-confident one for this turn, without erasing importance.
    let score =
      memory.importance * 0.3 +
      memory.confidence * 0.25 +
      recencyScore(memory, now) * 0.15 +
      relevanceScore(memory, contextTokens) * 0.3;
    const ageDays = (now.getTime() - new Date(memory.updated_at).getTime()) / 86_400_000;
    if (memory.memory_type === "EXPERIENCE" && ageDays > EXPERIENCE_STALE_DAYS) {
      score *= EXPERIENCE_STALE_FACTOR;
    }
    return { memory, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const userLimit = limits.user ?? 12;
  const pursuitLimit = limits.pursuit ?? 18;
  const picked: T[] = [];
  let userCount = 0;
  let pursuitCount = 0;
  for (const { memory } of scored) {
    if (memory.memory_scope === "USER") {
      if (userCount >= userLimit) continue;
      userCount += 1;
    } else {
      if (pursuitCount >= pursuitLimit) continue;
      pursuitCount += 1;
    }
    picked.push(memory);
  }
  return picked;
}
