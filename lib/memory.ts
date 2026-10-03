import type { SupabaseClient } from "@supabase/supabase-js";
import {
  memoryContentMatches,
  nextConfirmationState,
  PROMOTION_THRESHOLD,
} from "./memory-core.ts";

export type MemoryProvenance =
  | "USER_REPORTED"
  | "OBSERVED"
  | "VERIFIED"
  | "SOURCE"
  | "MODEL_INFERENCE"
  | "SYSTEM_DERIVED";

export type MemoryType =
  | "FACT"
  | "CONSTRAINT"
  | "PREFERENCE"
  | "DECISION"
  | "COMMITMENT"
  | "EXPERIENCE"
  | "PATTERN"
  | "GOAL";

export type MemoryWrite = {
  ownerUserId: string;
  pursuitId?: string | null;
  memoryType: MemoryType;
  content: string;
  structuredDetail?: Record<string, unknown> | null;
  provenanceType: MemoryProvenance;
  provenance?: Record<string, unknown> | null;
  confidence?: number;
  importance?: number;
  sourceObservationId?: string | null;
  sourceClaimId?: string | null;
  sourceId?: string | null;
  status?: "CANDIDATE" | "ACTIVE";
  // Model-proposed replacement: the candidate updates or replaces these
  // existing memories. Only honored above SUPERSEDE_MIN_CONFIDENCE so a
  // tentative inference can never retire established state.
  revisesMemoryIds?: string[];
  // Dedupe guard for verbatim conversation memories: skip when this turn
  // already produced a memory (retry/exactly-once replay).
  dedupeTurnKey?: string;
};

export type MemoryRecordResult = {
  id: string;
  action: "created" | "confirmed" | "deduped" | "superseded";
  supersededMemoryIds?: string[];
};

// A model inference must be this confident before it may supersede an
// existing memory. Everything weaker is still recorded, as a candidate.
const SUPERSEDE_MIN_CONFIDENCE = 0.7;

export async function recordMemory(
  supabase: SupabaseClient,
  input: MemoryWrite,
): Promise<MemoryRecordResult | null> {
  const content = input.content.trim();
  if (!content) return null;

  if (input.dedupeTurnKey) {
    const { data: replayed } = await supabase
      .from("memory_item")
      .select("id")
      .eq("owner_user_id", input.ownerUserId)
      .eq("memory_type", input.memoryType)
      .contains("provenance", { turn_key: input.dedupeTurnKey })
      .limit(1)
      .maybeSingle();
    if (replayed?.id) return { id: replayed.id as string, action: "deduped" };
  }

  if (input.sourceObservationId) {
    const { data: existing } = await supabase
      .from("memory_item")
      .select("id")
      .eq("owner_user_id", input.ownerUserId)
      .eq("source_observation_id", input.sourceObservationId)
      .eq("memory_type", input.memoryType)
      .limit(1)
      .maybeSingle();
    if (existing?.id) return { id: existing.id as string, action: "deduped" };
  }

  if (input.sourceClaimId) {
    const { data: existing } = await supabase
      .from("memory_item")
      .select("id")
      .eq("owner_user_id", input.ownerUserId)
      .eq("source_claim_id", input.sourceClaimId)
      .eq("memory_type", input.memoryType)
      .limit(1)
      .maybeSingle();
    if (existing?.id) return { id: existing.id as string, action: "deduped" };
  }

  const confidence = Math.min(1, Math.max(0, input.confidence ?? 0.5));
  const importance = Math.min(1, Math.max(0, input.importance ?? 0.5));
  const revisingIds = [...new Set((input.revisesMemoryIds ?? []).filter(Boolean))];

  // A confident model proposal may explicitly replace memories the model was
  // shown and judged outdated. The replacement starts ACTIVE with a lineage
  // link; the superseded rows stay inspectable, never deleted.
  const canSupersede = revisingIds.length > 0 && confidence >= SUPERSEDE_MIN_CONFIDENCE;
  let supersededIds: string[] = [];
  if (canSupersede) {
    const { data: targets } = await supabase
      .from("memory_item")
      .select("id, status")
      .eq("owner_user_id", input.ownerUserId)
      .in("id", revisingIds)
      .in("status", ["ACTIVE", "CANDIDATE"]);
    supersededIds = (targets ?? []).map((row) => row.id as string);
  }

  // Repeating the same memory (the model or the user independently restating
  // known reality) strengthens it rather than duplicating it. Memories the
  // current write supersedes are excluded — replacement is not confirmation.
  const confirmExclude = new Set(supersededIds);
  const { data: sameTypeRows } = await supabase
    .from("memory_item")
    .select("id, content, status, confidence, importance")
    .eq("owner_user_id", input.ownerUserId)
    .eq("memory_type", input.memoryType)
    .in("status", ["CANDIDATE", "ACTIVE"])
    .eq("pursuit_id", input.pursuitId ?? null)
    .order("updated_at", { ascending: false })
    .limit(50);
  for (const row of sameTypeRows ?? []) {
    if (confirmExclude.has(row.id as string)) continue;
    if (!memoryContentMatches(row.content as string, content)) continue;
    const next = nextConfirmationState(
      {
        confidence: row.confidence as number,
        importance: row.importance as number,
        status: row.status as "CANDIDATE" | "ACTIVE",
      },
      { confidence, importance },
    );
    const { data: updated, error: updateError } = await supabase
      .from("memory_item")
      .update({
        confidence: next.confidence,
        importance: next.importance,
        status: next.status,
        last_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id as string)
      .eq("owner_user_id", input.ownerUserId)
      .select("id")
      .single();
    if (!updateError && updated?.id) return { id: updated.id as string, action: "confirmed" };
    break;
  }

  // Provenance decides the starting lifecycle: the model never writes truth
  // (candidates), while the user's own reports and verified adjudications are
  // reality statements from the authority and start ACTIVE.
  const defaultStatus = input.provenanceType === "MODEL_INFERENCE" ? "CANDIDATE" : "ACTIVE";
  const status =
    input.status ?? (supersededIds.length > 0 && confidence >= PROMOTION_THRESHOLD ? "ACTIVE" : defaultStatus);

  const { data, error } = await supabase
    .from("memory_item")
    .insert({
      owner_user_id: input.ownerUserId,
      pursuit_id: input.pursuitId ?? null,
      memory_scope: input.pursuitId ? "PURSUIT" : "USER",
      memory_type: input.memoryType,
      status,
      content: content.slice(0, 4000),
      structured_detail: input.structuredDetail ?? null,
      provenance_type: input.provenanceType,
      provenance: input.provenance ?? null,
      confidence,
      importance,
      last_confirmed_at:
        input.provenanceType === "VERIFIED" || status === "ACTIVE"
          ? new Date().toISOString()
          : null,
      source_observation_id: input.sourceObservationId ?? null,
      source_claim_id: input.sourceClaimId ?? null,
      source_id: input.sourceId ?? null,
      supersedes_memory_id: supersededIds.length > 0 ? supersededIds[0] : null,
    })
    .select("id")
    .single();

  if (error || !data) return null;

  if (supersededIds.length > 0) {
    const now = new Date().toISOString();
    await supabase
      .from("memory_item")
      .update({
        status: "SUPERSEDED",
        superseded_by_memory_id: data.id as string,
        stale_at: now,
        updated_at: now,
      })
      .in("id", supersededIds)
      .eq("owner_user_id", input.ownerUserId);
  }

  return { id: data.id as string, action: supersededIds.length > 0 ? "superseded" : "created", supersededMemoryIds: supersededIds };
}

// The user confirming a candidate is the authority upgrading a tentative
// inference with their own judgment. Provenance records who confirmed; the
// row never becomes VERIFIED — that status is reserved for adjudication.
export async function confirmMemory(
  supabase: SupabaseClient,
  input: { ownerUserId: string; memoryId: string },
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data: memory } = await supabase
    .from("memory_item")
    .select("id, status, confidence, provenance")
    .eq("id", input.memoryId)
    .eq("owner_user_id", input.ownerUserId)
    .maybeSingle();
  if (!memory) return false;

  const provenance = {
    ...(typeof memory.provenance === "object" && memory.provenance !== null ? memory.provenance : {}),
    confirmed_by_user: true,
    confirmed_by_user_at: now,
  };
  const { error } = await supabase
    .from("memory_item")
    .update({
      status: "ACTIVE",
      confidence: Math.max(0.9, memory.confidence as number),
      last_confirmed_at: now,
      updated_at: now,
      provenance,
    })
    .eq("id", input.memoryId)
    .eq("owner_user_id", input.ownerUserId);
  return !error;
}

// "Forget" is a soft delete: the row stays inspectable with a STALE status
// and a provenance record of the user's decision, but never reaches the
// model again. Hard deletion is available through the same API.
export async function forgetMemory(
  supabase: SupabaseClient,
  input: { ownerUserId: string; memoryId: string },
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data: memory } = await supabase
    .from("memory_item")
    .select("id, provenance")
    .eq("id", input.memoryId)
    .eq("owner_user_id", input.ownerUserId)
    .maybeSingle();
  if (!memory) return false;

  const provenance = {
    ...(typeof memory.provenance === "object" && memory.provenance !== null ? memory.provenance : {}),
    forgotten_by_user: true,
    forgotten_by_user_at: now,
  };
  const { error } = await supabase
    .from("memory_item")
    .update({ status: "STALE", stale_at: now, updated_at: now, provenance })
    .eq("id", input.memoryId)
    .eq("owner_user_id", input.ownerUserId);
  return !error;
}
