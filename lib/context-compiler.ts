// The Context Compiler: Stryde's first-class context subsystem.
//
// The problem it exists to prevent: a canonical Situation contains everything
// knowable about a pursuit — sources, adaptations, dozens of observations,
// episodic history, ranked memories, worker capabilities. Replaying all of it
// into every model turn makes downstream models worse exactly when the pursuit
// gets richer. This module turns one Situation plus one task into a
// task-specific context packet:
//
//   - relevance-ranked selection (task tokens + recency + importance/goal fit);
//   - hard budget on serialized size, dropping the lowest-value items first;
//   - compression of bulky fields with recoverable originals (everything
//     dropped or truncated still lives in the canonical store);
//   - a selection report explaining every inclusion, truncation, and drop, so
//     context selection is inspectable and debuggable rather than magic.
//
// Stryde still owns canonical state. The packet is a projection, never truth:
// nothing here writes back, and the situation it reads from is unchanged.
import type { AdaptiveSituation } from "@/lib/adaptive-situation";

export const CONTEXT_BUDGET_CHARS = 24_000;
const MAX_MEMORIES = 10;
const MAX_SOURCES = 8;
const MAX_OBSERVATIONS = 10;
const MAX_EPISODES = 4;
const MAX_ADAPTATIONS = 4;
const OBSERVATION_PREVIEW_CHARS = 500;
const ADAPTATION_SUMMARY_CHARS = 900;
const EPISODE_EXCERPT_CHARS = 400;

export type SelectionReason =
  | "GOAL_MATCH"
  | "TASK_MATCH"
  | "RECENT"
  | "HIGH_IMPORTANCE"
  | "LATEST_VERSION"
  | "ACTIVE_STATE";

export type CompiledItem = {
  kind: "memory" | "source" | "adaptation" | "observation" | "episode";
  id: string;
  reasons: SelectionReason[];
  score: number;
  compressed: boolean;
};

export type SelectionReport = {
  budget_chars: number;
  used_chars: number;
  included: CompiledItem[];
  dropped: Array<{ kind: CompiledItem["kind"]; id: string; why: string }>;
  truncated: Array<{ kind: CompiledItem["kind"]; id: string }>;
};

export type ContextPacket = {
  pursuit: {
    title: string | null;
    objective: string | null;
    status: string | null;
  };
  canonical_state: {
    claims: unknown[];
    working_state_note: string | null;
  };
  memories: Array<Record<string, unknown>>;
  sources: Array<Record<string, unknown>>;
  source_adaptations: Array<Record<string, unknown>>;
  observations: Array<Record<string, unknown>>;
  episodic_memory: Array<Record<string, unknown>>;
  worker_capabilities: AdaptiveSituation["worker_capabilities"];
  capabilities: AdaptiveSituation["capabilities"];
};

const STOPWORDS = new Set([  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "is", "are", "was",
  "be", "been", "it", "this", "that", "i", "my", "me", "we", "our", "you", "your", "at", "as", "by",
  "from", "about", "what", "how", "why", "do", "does", "did", "will", "would", "can", "could", "should",
]);

export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const match of text.toLowerCase().match(/[a-z0-9\u00c0-\u024f]+/g) ?? []) {
    if (match.length > 2 && !STOPWORDS.has(match)) tokens.add(match);
  }
  return tokens;
}

function overlap(tokens: Set<string>, text: string): number {
  if (tokens.size === 0) return 0;
  const itemTokens = tokenize(text);
  let hits = 0;
  for (const token of itemTokens) if (tokens.has(token)) hits += 1;
  return hits / Math.max(4, itemTokens.size);
}

function recencyScore(timestamp: string | null | undefined, now: Date): number {
  if (!timestamp) return 0.5;
  const ageDays = Math.max(0, (now.getTime() - new Date(timestamp).getTime())) / 86_400_000;
  return 1 / (1 + ageDays / 7);
}

function truncate(text: unknown, max: number): { text: string; compressed: boolean } {
  const value = typeof text === "string" ? text : text == null ? "" : JSON.stringify(text);
  if (value.length <= max) return { text: value, compressed: false };
  return { text: `${value.slice(0, max)}…[truncated; recoverable from source record]`, compressed: true };
}

export type CompiledContext = {
  packet: ContextPacket;
  report: SelectionReport;
};

export function compileContext(
  situation: AdaptiveSituation,
  task: { userMessage: string; focus: string | null; objective: string | null },
  now: Date = new Date(),
  budgetChars: number = CONTEXT_BUDGET_CHARS,
): CompiledContext {
  const dropped: SelectionReport["dropped"] = [];
  const truncated: SelectionReport["truncated"] = [];
  const included: CompiledItem[] = [];

  const taskTokens = tokenize(`${task.userMessage} ${task.focus ?? ""} ${task.objective ?? ""}`);
  const objectiveTokens = tokenize(task.objective ?? "");

  const reasonsFor = (scoredText: string, timestamp: string | null | undefined, importance: number): SelectionReason[] => {
    const reasons: SelectionReason[] = [];
    if (overlap(taskTokens, scoredText) > 0.1) reasons.push("TASK_MATCH");
    if (overlap(objectiveTokens, scoredText) > 0.1) reasons.push("GOAL_MATCH");
    if (recencyScore(timestamp, now) > 0.7) reasons.push("RECENT");
    if (importance >= 0.7) reasons.push("HIGH_IMPORTANCE");
    if (reasons.length === 0) reasons.push("ACTIVE_STATE");
    return reasons;
  };

  // --- Memories: the situation already ranks them by importance, confidence,
  // recency, and relevance; the compiler applies the task-aware cap and only
  // keeps ACTIVE/CANDIDATE items (dead memories never reach a packet).
  const memories = situation.memories
    .filter((memory) => memory.status === "ACTIVE" || memory.status === "CANDIDATE")
    .slice(0, MAX_MEMORIES);
  for (const memory of situation.memories.slice(MAX_MEMORIES)) {
    dropped.push({ kind: "memory", id: memory.id, why: "beyond the memory cap for this packet" });
  }

  // --- Sources: lightweight facts only (content stays in the store); ranked by
  // goal/task relevance and recency.
  const sourceItems = situation.sources.map((source) => {
    const record = source as Record<string, unknown>;
    const text = `${String(record.title ?? "")} ${String(record.uri ?? "")}`;
    const score = overlap(taskTokens, text) * 2 + overlap(objectiveTokens, text) + recencyScore(record.created_at as string, now);
    return { record, score, reasons: reasonsFor(text, record.created_at as string, 0.5) };
  });
  const sourcesSelected = sourceItems.sort((a, b) => b.score - a.score).slice(0, MAX_SOURCES);
  for (const item of sourceItems.slice(MAX_SOURCES)) {
    dropped.push({ kind: "source", id: String(item.record.id ?? "?"), why: "lower relevance than the selected sources" });
  }

  // --- Adaptations: latest version per source only (supersession by version).
  const adaptationsBySource = new Map<string, Record<string, unknown>>();
  const supersededBySource = new Map<string, Record<string, unknown>>();
  for (const adaptation of situation.source_adaptations as Array<Record<string, unknown>>) {
    const sourceId = String(adaptation.source_id ?? "?");
    const existing = adaptationsBySource.get(sourceId);
    if (!existing) {
      adaptationsBySource.set(sourceId, adaptation);
      continue;
    }
    if (Number(adaptation.version ?? 0) > Number(existing.version ?? 0)) {
      supersededBySource.set(sourceId, existing);
      adaptationsBySource.set(sourceId, adaptation);
    } else {
      supersededBySource.set(sourceId, adaptation);
    }
  }
  const adaptationItems = [...adaptationsBySource.values()]
    .map((record) => {
      const text = `${String(record.summary ?? "")} ${JSON.stringify(record.gaps ?? "")} ${JSON.stringify(record.conflicts ?? "")}`;
      const score = overlap(taskTokens, text) * 2 + overlap(objectiveTokens, text) + recencyScore(record.created_at as string, now);
      return { record, score, reasons: reasonsFor(text, record.created_at as string, 0.6) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ADAPTATIONS);
  for (const [, record] of adaptationsBySource) {
    if (!adaptationItems.some((item) => item.record === record)) {
      dropped.push({ kind: "adaptation", id: String(record.id ?? "?"), why: "lower relevance than the selected adaptations" });
    }
  }
  for (const [, record] of supersededBySource) {
    dropped.push({ kind: "adaptation", id: String(record.id ?? "?"), why: "superseded by a newer version for its source" });
  }

  // --- Observations: relevance + recency, each compressed to a preview.
  const observationItems = (situation.observations as Array<Record<string, unknown>>)
    .map((record) => {
      const text = `${JSON.stringify(record.content ?? "")} ${String(record.source_uri ?? "")}`;
      const score = overlap(taskTokens, text) * 2 + overlap(objectiveTokens, text) + recencyScore(record.observed_at as string, now);
      return { record, score, reasons: reasonsFor(text, record.observed_at as string, 0.5) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_OBSERVATIONS);
  for (const item of (situation.observations as Array<Record<string, unknown>>).slice(MAX_OBSERVATIONS)) {
    dropped.push({ kind: "observation", id: String(item.id ?? "?"), why: "beyond the observation cap for this packet" });
  }

  // --- Episodic history: recent sessions, compressed to excerpts.
  const episodeItems = situation.episodic_memory.slice(0, MAX_EPISODES);
  for (const episode of situation.episodic_memory.slice(MAX_EPISODES)) {
    dropped.push({ kind: "episode", id: episode.session_id, why: "beyond the episodic cap for this packet" });
  }

  // --- Budget: assemble compressed records, then drop lowest-scored bulky
  // items until the serialized packet fits.
  type Section = { kind: CompiledItem["kind"]; id: string; score: number; reasons: SelectionReason[]; compressed: boolean; record: Record<string, unknown> };
  let sections: Section[] = [];

  for (const memory of memories) {
    sections.push({
      kind: "memory", id: memory.id, score: 3 + memory.importance, // memories are the most valuable context
      reasons: reasonsFor(memory.content, memory.updated_at, memory.importance),
      compressed: false,
      record: memory as unknown as Record<string, unknown>,
    });
  }
  for (const item of sourcesSelected) {
    const preview = truncate(item.record.title, 200);
    if (preview.compressed) truncated.push({ kind: "source", id: String(item.record.id ?? "?") });
    sections.push({
      kind: "source", id: String(item.record.id ?? "?"), score: 1 + item.score,
      reasons: item.reasons, compressed: preview.compressed,
      record: {
        id: item.record.id, source_kind: item.record.source_kind, uri: item.record.uri,
        title: preview.text, fetch_status: item.record.fetch_status, created_at: item.record.created_at,
      },
    });
  }
  for (const item of adaptationItems) {
    const summary = truncate(item.record.summary, ADAPTATION_SUMMARY_CHARS);
    if (summary.compressed) truncated.push({ kind: "adaptation", id: String(item.record.id ?? "?") });
    sections.push({
      kind: "adaptation", id: String(item.record.id ?? "?"), score: 1.5 + item.score,
      reasons: item.reasons, compressed: summary.compressed,
      record: {
        id: item.record.id, source_id: item.record.source_id, version: item.record.version, status: item.record.status,
        summary: summary.text, gaps: item.record.gaps, conflicts: item.record.conflicts,
        adapted_strategy: item.record.adapted_strategy, created_at: item.record.created_at,
      },
    });
  }
  for (const item of observationItems) {
    const content = truncate(item.record.content, OBSERVATION_PREVIEW_CHARS);
    if (content.compressed) truncated.push({ kind: "observation", id: String(item.record.id ?? "?") });
    sections.push({
      kind: "observation", id: String(item.record.id ?? "?"), score: 1 + item.score,
      reasons: item.reasons, compressed: content.compressed,
      record: {
        id: item.record.id, observation_kind: item.record.observation_kind, observed_at: item.record.observed_at,
        source_type: item.record.source_type, content: content.text,
      },
    });
  }
  for (const episode of episodeItems) {
    const user = truncate(episode.latest_user_message, EPISODE_EXCERPT_CHARS);
    const stryde = truncate(episode.latest_stryde_message, EPISODE_EXCERPT_CHARS);
    sections.push({
      kind: "episode", id: episode.session_id, score: 0.5 + recencyScore(episode.updated_at, now),
      reasons: reasonsFor(`${episode.title ?? ""} ${episode.latest_user_message ?? ""}`, episode.updated_at, 0.4),
      compressed: user.compressed || stryde.compressed,
      record: {
        session_id: episode.session_id, title: episode.title, status: episode.status, updated_at: episode.updated_at,
        latest_user_message: user.text, latest_stryde_message: stryde.text,
      },
    });
  }

  const packetShell = (): ContextPacket => ({
    pursuit: {
      title: (situation.pursuit as { title?: string | null } | undefined)?.title ?? null,
      objective: task.objective,
      status: (situation.pursuit as { status?: string | null } | undefined)?.status ?? null,
    },
    canonical_state: {
      claims: situation.claims,
      working_state_note: null,
    },
    memories: [],
    sources: [],
    source_adaptations: [],
    observations: [],
    episodic_memory: [],
    worker_capabilities: situation.worker_capabilities,
    capabilities: situation.capabilities,
  });

  const packet = packetShell();
  const fill = () => {
    packet.memories = sections.filter((s) => s.kind === "memory").map((s) => s.record);
    packet.sources = sections.filter((s) => s.kind === "source").map((s) => s.record);
    packet.source_adaptations = sections.filter((s) => s.kind === "adaptation").map((s) => s.record);
    packet.observations = sections.filter((s) => s.kind === "observation").map((s) => s.record);
    packet.episodic_memory = sections.filter((s) => s.kind === "episode").map((s) => s.record);
  };
  fill();

  const usedChars = () => JSON.stringify(packet).length;
  let used = usedChars();
  if (used > budgetChars) {
    // Drop lowest-scored, bulkiest sections until under budget. Observations
    // and episodes go first; memories last (highest value density).
    const dropOrder: Record<Section["kind"], number> = { observation: 0, episode: 1, adaptation: 2, source: 3, memory: 4 };
    sections = [...sections].sort((a, b) =>
      dropOrder[a.kind] - dropOrder[b.kind] || a.score - b.score);
    while (used > budgetChars && sections.length > 0) {
      const victim = sections.shift()!;
      dropped.push({ kind: victim.kind, id: victim.id, why: "packet exceeded its context budget" });
      fill();
      used = usedChars();
    }
  }
  included.push(...sections.map((s) => ({ kind: s.kind, id: s.id, reasons: s.reasons, score: Math.round(s.score * 100) / 100, compressed: s.compressed })));

  return {
    packet,
    report: {
      budget_chars: budgetChars,
      used_chars: used,
      included,
      dropped,
      truncated,
    },
  };
}

// Convenience wrapper for route call sites: derives the objective from the
// situation's objective claim so every caller compiles with the same task shape.
export function compileForSituation(
  situation: AdaptiveSituation,
  task: { userMessage: string; focus?: string | null },
  now: Date = new Date(),
  budgetChars: number = CONTEXT_BUDGET_CHARS,
): CompiledContext {
  const pursuitRow = situation.pursuit as { title?: string | null; objective_claim_id?: string | null } | undefined;
  const objectiveClaim = (situation.claims as Array<{ id?: unknown; content?: unknown }>).find(
    (claim) => claim && typeof claim === "object" && claim.id === pursuitRow?.objective_claim_id,
  );
  const objective = typeof objectiveClaim?.content === "string" ? objectiveClaim.content : null;
  return compileContext(situation, { userMessage: task.userMessage, focus: task.focus ?? null, objective }, now, budgetChars);
}
