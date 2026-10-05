import type { SupabaseClient } from "@supabase/supabase-js";
import { assembleSituation, type Situation } from "@/lib/situation";
import { rankMemories } from "@/lib/memory-core";
import { WORKER_TYPES, type WorkerType } from "@/lib/actor";
import { workerToolKey } from "@/lib/worker-contract";
import { loadAgentSelection, resolvePreferredWorkers, type AgentSelection } from "@/lib/agent-selection";

export type MemoryEpisode = {
  session_id: string;
  title: string | null;
  status: string;
  updated_at: string;
  latest_user_message: string | null;
  latest_stryde_message: string | null;
};

export type WorkerCapability = {
  worker_type: WorkerType;
  tool_id: string;
  tool_version: string;
};

export type SituationCapabilities = {
  web_search: boolean;
};

export type MemoryItem = {
  id: string;
  memory_scope: "USER" | "PURSUIT";
  memory_type: string;
  status: string;
  content: string;
  structured_detail: unknown;
  provenance_type: string;
  provenance: unknown;
  confidence: number;
  importance: number;
  first_seen_at: string;
  last_confirmed_at: string | null;
  stale_at: string | null;
  source_observation_id: string | null;
  source_claim_id: string | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentSelectionInfo = AgentSelection & {
  allowed_workers: WorkerType[];
  note: string | null;
};

export type SkillContextItem = {
  id: string;
  title: string;
  description: string | null;
  procedure: unknown;
  version: number;
  usage_count: number;
  last_used_at: string | null;
  updated_at: string;
};

export type AdaptiveSituation = Situation & {
  sources: unknown[];
  source_adaptations: unknown[];
  observations: unknown[];
  episodic_memory: MemoryEpisode[];
  memories: MemoryItem[];
  worker_capabilities: WorkerCapability[];
  capabilities: SituationCapabilities;
  agent_selection: AgentSelectionInfo;
  skills: SkillContextItem[];
};

export async function assembleAdaptiveSituation(
  supabase: SupabaseClient,
  ownerUserId: string,
  pursuitId: string,
): Promise<{ situation: AdaptiveSituation | null; error: string | null }> {
  const base = await assembleSituation(supabase, ownerUserId, pursuitId);
  if (base.error || !base.situation) return { situation: null, error: base.error ?? "Unable to assemble Situation" };

  const [sourcesResult, actionsResult, observationsResult, sessionsResult, workerGrantsResult, userMemoriesResult, pursuitMemoriesResult, skillsResult] = await Promise.all([
    supabase
      .from("pursuit_source")
      .select("id, source_kind, uri, title, content_type, fetch_status, content_sha256, source_metadata, content_text, created_at, updated_at")
      .eq("owner_user_id", ownerUserId)
      .eq("pursuit_id", pursuitId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("action")
      .select("id")
      .eq("owner_user_id", ownerUserId)
      .eq("pursuit_id", pursuitId)
      .limit(50),
    supabase
      .from("observation")
      .select("id, observation_kind, content, observed_at, source_type, source_reference, source_uri, source_metadata, created_at")
      .eq("owner_user_id", ownerUserId)
      .order("observed_at", { ascending: false })
      .limit(100),
    supabase
      .from("conversation_session")
      .select("id, title, status, updated_at")
      .eq("owner_user_id", ownerUserId)
      .eq("pursuit_id", pursuitId)
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("capability_grant")
      .select("tool_id, expires_at, revoked_at, tool:tool_id(tool_key, tool_version)")
      .eq("owner_user_id", ownerUserId)
      .is("revoked_at", null),
    supabase
      .from("memory_item")
      .select("id, memory_scope, memory_type, status, content, structured_detail, provenance_type, provenance, confidence, importance, first_seen_at, last_confirmed_at, stale_at, source_observation_id, source_claim_id, source_id, created_at, updated_at")
      .eq("owner_user_id", ownerUserId)
      .is("pursuit_id", null)
      .in("status", ["ACTIVE", "CANDIDATE"])
      .order("importance", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("memory_item")
      .select("id, memory_scope, memory_type, status, content, structured_detail, provenance_type, provenance, confidence, importance, first_seen_at, last_confirmed_at, stale_at, source_observation_id, source_claim_id, source_id, created_at, updated_at")
      .eq("owner_user_id", ownerUserId)
      .eq("pursuit_id", pursuitId)
      .in("status", ["ACTIVE", "CANDIDATE"])
      .order("importance", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase
      .from("skill")
      .select("id, pursuit_id, title, description, procedure, version, usage_count, last_used_at, updated_at")
      .eq("owner_user_id", ownerUserId)
      .eq("status", "ACTIVE")
      .or(`pursuit_id.is.null,pursuit_id.eq.${pursuitId}`)
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .order("usage_count", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);

  // Skills and agent preferences are newer subsystems: where the runtime
  // database does not yet carry their tables, they degrade to "none" instead
  // of failing the whole Situation. A missing optional capability must never
  // break the core conversation loop.
  const skillsRows = skillsResult.error ? [] : (skillsResult.data ?? []);

  if (sourcesResult.error || actionsResult.error || observationsResult.error || sessionsResult.error || workerGrantsResult.error || userMemoriesResult.error || pursuitMemoriesResult.error) {
    return { situation: null, error: "Unable to assemble adaptive Situation" };
  }

  const sourceRows = sourcesResult.data ?? [];
  const sourceUris = new Set(
    sourceRows.map((source) => source.uri).filter((value): value is string => typeof value === "string"),
  );
  const actionIds = new Set((actionsResult.data ?? []).map((action) => action.id as string));
  const observations = (observationsResult.data ?? []).filter((observation) => {
    const content = observation.content;
    if (typeof content === "object" && content !== null && "action_id" in content) {
      return typeof content.action_id === "string" && actionIds.has(content.action_id);
    }
    return typeof observation.source_uri === "string" && sourceUris.has(observation.source_uri);
  });

  let adaptations: unknown[] = [];
  const sourceIds = sourceRows.map((source) => source.id);
  if (sourceIds.length) {
    const adaptationResult = await supabase
      .from("pursuit_source_adaptation")
      .select("id, source_id, version, status, summary, source_claims, methods, assumptions, prerequisites, expected_outcomes, unknowns, fit, conflicts, gaps, adapted_strategy, goal_candidates, provenance, created_at")
      .eq("owner_user_id", ownerUserId)
      .eq("pursuit_id", pursuitId)
      .in("source_id", sourceIds)
      .order("version", { ascending: false })
      .limit(50);

    if (adaptationResult.error) return { situation: null, error: "Unable to load source adaptations" };

    const latestBySource = new Map<string, unknown>();
    for (const adaptation of adaptationResult.data ?? []) {
      if (!latestBySource.has(adaptation.source_id)) latestBySource.set(adaptation.source_id, adaptation);
    }
    adaptations = [...latestBySource.values()];
  }

  const now = Date.now();
  const worker_capabilities: WorkerCapability[] = [];
  for (const grant of workerGrantsResult.data ?? []) {
    if (grant.expires_at && new Date(grant.expires_at).getTime() <= now) continue;
    const tool = Array.isArray(grant.tool) ? grant.tool[0] : grant.tool;
    const toolKey = tool && typeof tool === "object" ? tool.tool_key : null;
    const toolVersion = tool && typeof tool === "object" ? tool.tool_version : null;
    if (typeof grant.tool_id !== "string" || toolVersion !== "v1") continue;
    // A grant addresses a declared worker type iff its tool key is the derived
    // key for that type — no per-worker branches here.
    const matched = WORKER_TYPES.find((type) => toolKey === workerToolKey(type));
    if (matched) worker_capabilities.push({ worker_type: matched, tool_id: grant.tool_id, tool_version: toolVersion });
  }

  const sessionIds = (sessionsResult.data ?? []).map((session) => session.id as string);
  const memoryMessagesResult = sessionIds.length
    ? await supabase
        .from("conversation_message")
        .select("session_id, role, content, sequence_no")
        .eq("owner_user_id", ownerUserId)
        .in("session_id", sessionIds)
        .order("sequence_no", { ascending: false })
        .limit(64)
    : { data: [], error: null };

  if (memoryMessagesResult.error) return { situation: null, error: "Unable to load episodic memory" };

  const bySession = new Map<string, { user: string | null; stryde: string | null }>();
  for (const message of memoryMessagesResult.data ?? []) {
    const current = bySession.get(message.session_id) ?? { user: null, stryde: null };
    const excerpt = message.content.trim().slice(0, 2_000);
    if (message.role === "USER" && !current.user) current.user = excerpt;
    if (message.role === "STRYDE" && !current.stryde) current.stryde = excerpt;
    bySession.set(message.session_id, current);
  }

  const episodicMemory: MemoryEpisode[] = (sessionsResult.data ?? []).map((session) => {
    const messages = bySession.get(session.id) ?? { user: null, stryde: null };
    return {
      session_id: session.id,
      title: session.title,
      status: session.status,
      updated_at: session.updated_at,
      latest_user_message: messages.user,
      latest_stryde_message: messages.stryde,
    };
  });

  const memoryById = new Map<string, MemoryItem>();
  for (const memory of [...(userMemoriesResult.data ?? []), ...(pursuitMemoriesResult.data ?? [])]) {
    memoryById.set(memory.id, memory as unknown as MemoryItem);
  }
  // Memories reach the model ranked by importance, confidence, recency, and
  // relevance to what the pursuit is about right now — not by volume.
  const pursuitRow = base.situation.pursuit as { title?: string | null; objective_claim_id?: string | null } | undefined;
  const objectiveClaim = (base.situation.claims as Array<{ id?: unknown; content?: unknown }>).find(
    (claim) => claim && typeof claim === "object" && claim.id === pursuitRow?.objective_claim_id,
  );
  const memories = rankMemories(
    [...memoryById.values()],
    {
      objective: typeof objectiveClaim?.content === "string" ? objectiveClaim.content : null,
      focus: typeof pursuitRow?.title === "string" ? pursuitRow.title : null,
    },
    new Date(),
  );

  // Agent selection (policy B): the user's preference (pursuit override,
  // global preference, or Stryde's choice) resolved against what is actually
  // connected, so the planner allocates workers within reality.
  let agentSelection: AgentSelection;
  try {
    agentSelection = await loadAgentSelection(supabase, ownerUserId, pursuitId);
  } catch {
    agentSelection = { preferred: null, source: "STRYDE_AUTO" };
  }
  const resolved = resolvePreferredWorkers(
    agentSelection,
    worker_capabilities.map((capability) => capability.worker_type),
  );
  const agent_selection: AgentSelectionInfo = {
    preferred: agentSelection.preferred,
    source: agentSelection.source,
    allowed_workers: resolved.allowed,
    note: resolved.note,
  };

  return {
    situation: {
      ...base.situation,
      sources: sourceRows,
      source_adaptations: adaptations,
      observations,
      episodic_memory: episodicMemory,
      memories,
      worker_capabilities,
      capabilities: {
        web_search: Boolean(process.env.EXA_API_KEY?.trim()),
      },
      agent_selection,
      skills: skillsRows as unknown as SkillContextItem[],
    },
    error: null,
  };
}