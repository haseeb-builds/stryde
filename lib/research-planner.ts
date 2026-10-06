// Adaptive research planner (Phases 7-8 of the capability platform).
//
// The planner is deliberately mechanical and provider-neutral: it decides
// WHETHER a research round is worth executing and WHICH capability lane is
// the cheapest sufficient path, given the remaining budget and the evidence
// already in the pursuit. Model judgment stays where it belongs (the
// situation/adaptation layer); the planner never dumps raw source text into
// model context and never treats a provider failure as evidence absence.
//
// Evidence graph semantics implemented here:
// - duplicate content (same content hash) is one piece of evidence;
// - syndicated content (same hash, different URI) is flagged as shared
//   primary source, so source-count confidence never inflates.
import type { ResearchExecution } from "./research-execution.ts";

export type PlannerDecision =
  | { decision: "PROCEED"; operations: PlannedOperation[] }
  | { decision: "STOP_BUDGET"; reason: string }
  | { decision: "STOP_SUFFICIENT"; reason: string };

export type PlannedOperation = {
  capabilityKey: string;
  rationale: string;
  estimatedCost: Record<string, number>;
};

export type PlannerInput = {
  // Remaining units per metered resource (trusted plane). null = unlimited.
  remaining: Record<string, number | null>;
  // Lanes actually configured in this runtime.
  availableLanes: string[];
  // Evidence already accumulated for the uncertainty being probed.
  priorEvidenceCount: number;
  priorContradictions: number;
  maxRounds?: number;
};

const SUFFICIENT_EVIDENCE = 3;
const MAX_DEFAULT_ROUNDS = 5;

export function planResearchRound(input: PlannerInput): PlannerDecision {
  const maxRounds = input.maxRounds ?? MAX_DEFAULT_ROUNDS;
  if (input.priorEvidenceCount >= SUFFICIENT_EVIDENCE && input.priorContradictions === 0) {
    return { decision: "STOP_SUFFICIENT", reason: `${input.priorEvidenceCount} independent corroborating results already cover this uncertainty` };
  }
  if (input.priorEvidenceCount >= maxRounds) {
    return { decision: "STOP_SUFFICIENT", reason: `round budget reached (${maxRounds}) without full corroboration; further search is unlikely to discriminate` };
  }
  if (input.availableLanes.length === 0) {
    return { decision: "STOP_BUDGET", reason: "no research lane is configured in this runtime" };
  }
  // Reserve the cheapest sufficient lane: search first, extraction only if
  // the search lane is absent. Never fan out to every provider per question.
  const lane = input.availableLanes.includes("research.web_search") ? "research.web_search" : input.availableLanes[0];
  const cost: Record<string, number> = lane === "research.web_search"
    ? { research_rounds: 1, source_discovery: 5 }
    : { research_rounds: 1 };
  for (const [resource, amount] of Object.entries(cost)) {
    const remaining = input.remaining[resource];
    if (remaining !== undefined && remaining !== null && amount > remaining) {
      return { decision: "STOP_BUDGET", reason: `${resource} exhausted for this plan window` };
    }
  }
  return {
    decision: "PROCEED",
    operations: [{ capabilityKey: lane, rationale: "cheapest sufficient discovery lane for this uncertainty", estimatedCost: cost }],
  };
}

export type SourceNovelty = "NOVEL" | "DUPLICATE" | "SYNDICATED";

export type ClassifiedResult = {
  url: string;
  novelty: SourceNovelty;
  // For DUPLICATE/SYNDICATED: the canonical URI already holding this content.
  canonicalUri: string | null;
};

// Classify search results against prior pursuit sources by content hash.
// Two different URIs with the same content are one piece of evidence
// (syndication), not two.
export function classifyResults(
  results: Array<{ url?: string; content_sha256?: string | null }>,
  knownSources: Array<{ uri: string; content_sha256: string | null }>,
): ClassifiedResult[] {
  const byHash = new Map<string, string>();
  for (const source of knownSources) {
    if (source.content_sha256) byHash.set(source.content_sha256, source.uri);
  }
  const seen = new Map<string, string>();
  const out: ClassifiedResult[] = [];
  for (const result of results) {
    const url = result.url ?? "";
    if (!url) continue;
    const canonicalUri = result.content_sha256
      ? byHash.get(result.content_sha256) ?? seen.get(result.content_sha256) ?? null
      : seen.get("__self__" + url) ?? null;
    let novelty: SourceNovelty = "NOVEL";
    if (result.content_sha256 && canonicalUri && canonicalUri !== url) novelty = "SYNDICATED";
    else if (result.content_sha256 && canonicalUri && canonicalUri === url) novelty = "DUPLICATE";
    else if (knownSources.some((s) => s.uri === url)) novelty = "DUPLICATE";
    if (result.content_sha256 && !seen.has(result.content_sha256)) seen.set(result.content_sha256, url);
    out.push({ url, novelty, canonicalUri });
  }
  return out;
}

export type ResearchReceipt = {
  query: string;
  planner: PlannerDecision;
  execution: ResearchExecution | null;
  novelty: { novel: number; duplicate: number; syndicated: number };
  stoppedBecause: string | null;
};

// Compile a bounded research receipt: counts and provenance, never raw source
// dumps. This is the object the situation layer consumes.
export function buildResearchReceipt(input: {
  query: string;
  planner: PlannerDecision;
  execution: ResearchExecution | null;
  classified: ClassifiedResult[];
}): ResearchReceipt {
  const novelty = { novel: 0, duplicate: 0, syndicated: 0 };
  for (const c of input.classified) {
    if (c.novelty === "NOVEL") novelty.novel += 1;
    else if (c.novelty === "DUPLICATE") novelty.duplicate += 1;
    else novelty.syndicated += 1;
  }
  return {
    query: input.query,
    planner: input.planner,
    execution: input.execution,
    novelty,
    stoppedBecause: input.planner.decision === "PROCEED" ? null : input.planner.reason,
  };
}
