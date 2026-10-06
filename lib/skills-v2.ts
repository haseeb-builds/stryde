// Skills V2 (Phase 4): progressive disclosure + capability packaging on top
// of the existing skill lifecycle. The skill table keeps its established
// semantics (procedure, scan, version, rollback, usage); this module adds
// the package surface: a cheap manifest for listing/selection and the full
// body loaded only on activation. A skill never grants authority.
import type { SupabaseClient } from "@supabase/supabase-js";

export type SkillManifest = {
  id: string;
  title: string;
  description: string | null;
  version: number;
  status: string;
  // When-to-use trigger: short conditions under which this skill is relevant.
  whenToUse: string[];
  requiredCapabilities: string[];
  allowedCapabilities: string[];
  compatibility: Record<string, unknown>;
  freshness: string | null;
  provenance: Record<string, unknown>;
  usageCount: number;
};

type SkillRowV2 = {
  id: string;
  title: string;
  description: string | null;
  version: number;
  status: string;
  metadata: Record<string, unknown> | null;
  required_capabilities: string[] | null;
  allowed_capabilities: string[] | null;
  provenance: Record<string, unknown> | null;
  usage_count: number;
};

// Level 1 of progressive disclosure: list manifests only. The procedure,
// verification rules, and cost profile are NOT loaded.
export function toSkillManifest(row: SkillRowV2): SkillManifest {
  const meta = row.metadata ?? {};
  const whenToUse = Array.isArray(meta.when_to_use) ? meta.when_to_use.filter((v): v is string => typeof v === "string") : [];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    version: row.version,
    status: row.status,
    whenToUse,
    requiredCapabilities: row.required_capabilities ?? [],
    allowedCapabilities: row.allowed_capabilities ?? [],
    compatibility: (meta.compatibility as Record<string, unknown>) ?? {},
    freshness: typeof meta.freshness === "string" ? meta.freshness : null,
    provenance: row.provenance ?? {},
    usageCount: row.usage_count,
  };
}

export async function listSkillManifests(
  supabase: SupabaseClient,
  ownerUserId: string,
  options?: { status?: string; pursuitId?: string | null },
): Promise<SkillManifest[]> {
  let query = supabase
    .from("skill")
    .select("id, title, description, version, status, metadata, required_capabilities, allowed_capabilities, provenance, usage_count")
    .eq("owner_user_id", ownerUserId)
    .limit(100);
  query = query.eq("status", options?.status ?? "ACTIVE");
  if (options?.pursuitId) query = query.eq("pursuit_id", options.pursuitId);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to list skill manifests: ${error.message}`);
  return ((data ?? []) as SkillRowV2[]).map(toSkillManifest);
}

// Selection: which manifests are relevant to a task hint? Mechanical lexical
// overlap on when-to-use conditions and title — the model does the semantic
// judgment in the context compiler; this only narrows the candidate set.
export function selectRelevantManifests(
  manifests: SkillManifest[],
  taskHint: string,
  limit = 3,
): SkillManifest[] {
  const hint = taskHint.toLowerCase();
  const scored = manifests
    .map((m) => {
      const needles = [m.title.toLowerCase(), ...m.whenToUse.map((w) => w.toLowerCase())];
      const score = needles.reduce((acc, n) => acc + (hint.includes(n) || n.split(/\s+/).some((word) => word.length > 4 && hint.includes(word)) ? 1 : 0), 0);
      return { m, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.m.usageCount - a.m.usageCount);
  return scored.slice(0, limit).map((s) => s.m);
}
