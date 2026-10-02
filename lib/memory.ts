import type { SupabaseClient } from "@supabase/supabase-js";

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
};

export async function recordMemory(
  supabase: SupabaseClient,
  input: MemoryWrite,
): Promise<{ id: string } | null> {
  const content = input.content.trim();
  if (!content) return null;

  if (input.sourceObservationId) {
    const { data: existing } = await supabase
      .from("memory_item")
      .select("id")
      .eq("owner_user_id", input.ownerUserId)
      .eq("source_observation_id", input.sourceObservationId)
      .eq("memory_type", input.memoryType)
      .limit(1)
      .maybeSingle();
    if (existing?.id) return { id: existing.id as string };
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
    if (existing?.id) return { id: existing.id as string };
  }

  const { data, error } = await supabase
    .from("memory_item")
    .insert({
      owner_user_id: input.ownerUserId,
      pursuit_id: input.pursuitId ?? null,
      memory_scope: input.pursuitId ? "PURSUIT" : "USER",
      memory_type: input.memoryType,
      status: input.status ?? "CANDIDATE",
      content: content.slice(0, 4000),
      structured_detail: input.structuredDetail ?? null,
      provenance_type: input.provenanceType,
      provenance: input.provenance ?? null,
      confidence: input.confidence ?? 0.5,
      importance: input.importance ?? 0.5,
      last_confirmed_at:
        input.provenanceType === "VERIFIED"
          ? new Date().toISOString()
          : null,
      source_observation_id: input.sourceObservationId ?? null,
      source_claim_id: input.sourceClaimId ?? null,
      source_id: input.sourceId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return { id: data.id as string };
}