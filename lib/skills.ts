// Stryde Skills lifecycle (Issue #6 decision 3, option C): procedural memory
// proposed from solved workflows, security-scanned, versioned, approved when
// policy requires it, usage-tracked, and rollback-safe. Skills are procedures,
// not facts: they never grant authority and execution still flows through the
// normal control plane.
import type { SupabaseClient } from "@supabase/supabase-js";
import { scanSkillText, skillIsRefused, skillRequiresApproval, type SkillScanResult } from "./skill-scan.ts";

export type SkillStatus = "PROPOSED" | "ACTIVE" | "REJECTED" | "STALE" | "ARCHIVED";

export type SkillRow = {
  id: string;
  owner_user_id: string;
  pursuit_id: string | null;
  title: string;
  description: string | null;
  procedure: { steps?: Array<{ text: string; sequence: number }>; raw?: string } & Record<string, unknown>;
  status: SkillStatus;
  version: number;
  provenance: Record<string, unknown>;
  security_scan: { verdict?: string; findings?: unknown[] } & Record<string, unknown>;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

const MAX_TITLE = 300;
const MAX_DESCRIPTION = 2_000;
const MAX_STEPS = 20;
const MAX_STEP_TEXT = 2_000;
const MAX_RAW = 12_000;

function procedureToText(procedure: SkillRow["procedure"]): string {
  if (typeof procedure.raw === "string") return procedure.raw;
  if (Array.isArray(procedure.steps)) {
    return procedure.steps
      .map((step) => (typeof step?.text === "string" ? step.text : JSON.stringify(step)))
      .join("\n");
  }
  return JSON.stringify(procedure);
}

export function validateProcedure(value: unknown): SkillRow["procedure"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("procedure must be an object");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.raw === "string" && record.raw.trim()) {
    if (record.raw.length > MAX_RAW) throw new Error("procedure.raw is too long");
    return { raw: record.raw.trim() };
  }
  if (Array.isArray(record.steps)) {
    const steps = record.steps.slice(0, MAX_STEPS).map((step, index) => {
      if (typeof step !== "object" || step === null || typeof (step as Record<string, unknown>).text !== "string") {
        throw new Error(`procedure.steps[${index}] is invalid`);
      }
      const row = step as Record<string, unknown>;
      const text = (row.text as string).trim();
      if (!text) throw new Error(`procedure.steps[${index}].text must be non-empty`);
      if (text.length > MAX_STEP_TEXT) throw new Error(`procedure.steps[${index}].text is too long`);
      return { sequence: typeof row.sequence === "number" ? row.sequence : index + 1, text };
    });
    if (!steps.length) throw new Error("procedure.steps must not be empty");
    return { steps };
  }
  throw new Error("procedure must contain steps[] or raw");
}

export type SkillProposalInput = {
  title: string;
  description?: string | null;
  procedure: unknown;
  pursuitId?: string | null;
  provenance?: Record<string, unknown>;
};

// The single entry point for a new or revised skill: validate, scan, and
// persist as PROPOSED (approval required), ACTIVE (clean scan + auto-create
// policy), or REFUSED (blocked scan). The verdict is stored either way so the
// refusal is inspectable, not silent.
export async function proposeSkill(
  supabase: SupabaseClient,
  ownerUserId: string,
  input: SkillProposalInput,
): Promise<{ skill: SkillRow | null; scan: SkillScanResult; refused: boolean; requiresApproval: boolean }> {
  const title = input.title.trim();
  if (!title) throw new Error("title must be non-empty");
  if (title.length > MAX_TITLE) throw new Error("title is too long");
  if (input.description && input.description.length > MAX_DESCRIPTION) throw new Error("description is too long");
  const procedure = validateProcedure(input.procedure);
  const scan = scanSkillText(`${title}\n${input.description ?? ""}\n${procedureToText(procedure)}`);

  const verdict = skillIsRefused(scan)
    ? "REJECTED"
    : skillRequiresApproval(scan)
      ? "PROPOSED"
      : "ACTIVE";

  const { data, error } = await supabase
    .from("skill")
    .insert({
      owner_user_id: ownerUserId,
      pursuit_id: input.pursuitId ?? null,
      title,
      description: input.description ?? null,
      procedure,
      status: verdict,
      version: 1,
      provenance: input.provenance ?? { origin: "USER" },
      security_scan: { verdict: scan.verdict, findings: scan.findings },
    })
    .select("id, owner_user_id, pursuit_id, title, description, procedure, status, version, provenance, security_scan, usage_count, last_used_at, created_at, updated_at")
    .single();

  if (error || !data) throw new Error("Unable to store the skill");
  const skill = data as unknown as SkillRow;

  if (verdict !== "REJECTED") {
    await supabase.from("skill_version").insert({
      skill_id: skill.id,
      version: 1,
      procedure,
      security_scan: skill.security_scan,
      created_from: "PROPOSAL",
    });
  }

  return { skill, scan, refused: verdict === "REJECTED", requiresApproval: verdict === "PROPOSED" };
}

export async function approveSkill(
  supabase: SupabaseClient,
  ownerUserId: string,
  skillId: string,
): Promise<{ ok: boolean; message: string | null }> {
  const { data: skill } = await supabase
    .from("skill")
    .select("id, status, security_scan")
    .eq("id", skillId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (!skill) return { ok: false, message: "Skill not found" };
  if (skill.status !== "PROPOSED") return { ok: false, message: `A ${skill.status} skill cannot be approved` };
  const scan = (skill.security_scan ?? {}) as { verdict?: string };
  if (scan.verdict === "BLOCKED") return { ok: false, message: "A blocked skill can never be approved" };
  const { error } = await supabase
    .from("skill")
    .update({ status: "ACTIVE", updated_at: new Date().toISOString() })
    .eq("id", skillId)
    .eq("owner_user_id", ownerUserId);
  return error ? { ok: false, message: "Unable to approve the skill" } : { ok: true, message: null };
}

export async function rejectSkill(
  supabase: SupabaseClient,
  ownerUserId: string,
  skillId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("skill")
    .update({ status: "REJECTED", updated_at: new Date().toISOString() })
    .eq("id", skillId)
    .eq("owner_user_id", ownerUserId)
    .in("status", ["PROPOSED", "STALE"]);
  return !error;
}

export async function archiveSkill(
  supabase: SupabaseClient,
  ownerUserId: string,
  skillId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("skill")
    .update({ status: "ARCHIVED", updated_at: new Date().toISOString() })
    .eq("id", skillId)
    .eq("owner_user_id", ownerUserId)
    .in("status", ["ACTIVE", "STALE", "PROPOSED"]);
  return !error;
}

// A revision is a NEW version with a fresh scan; the procedure is never edited
// in place, and rollback always has somewhere to go back to.
export async function reviseSkill(
  supabase: SupabaseClient,
  ownerUserId: string,
  skillId: string,
  procedure: unknown,
  createdFrom: string = "REVISION",
): Promise<{ ok: boolean; message: string | null; requiresApproval: boolean }> {
  const { data: skill } = await supabase
    .from("skill")
    .select("id, status, version, title, description")
    .eq("id", skillId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (!skill) return { ok: false, message: "Skill not found", requiresApproval: false };
  if (["ARCHIVED", "REJECTED"].includes(skill.status as string)) {
    return { ok: false, message: `A ${skill.status} skill cannot be revised`, requiresApproval: false };
  }
  const validated = validateProcedure(procedure);
  const scan = scanSkillText(`${skill.title}\n${skill.description ?? ""}\n${procedureToText(validated)}`);
  if (skillIsRefused(scan)) {
    return { ok: false, message: "The revised procedure was refused by the security scan", requiresApproval: false };
  }

  const nextVersion = Number(skill.version) + 1;
  const { error: versionError } = await supabase.from("skill_version").insert({
    skill_id: skillId,
    version: nextVersion,
    procedure: validated,
    security_scan: { verdict: scan.verdict, findings: scan.findings },
    created_from: createdFrom,
  });
  if (versionError) return { ok: false, message: "Unable to record the new version", requiresApproval: false };

  // A flagged revision drops back to PROPOSED (approval gate); a clean one
  // stays or becomes ACTIVE.
  const status = skillRequiresApproval(scan) ? "PROPOSED" : "ACTIVE";
  const { error } = await supabase
    .from("skill")
    .update({
      procedure: validated,
      version: nextVersion,
      status,
      security_scan: { verdict: scan.verdict, findings: scan.findings },
      updated_at: new Date().toISOString(),
    })
    .eq("id", skillId)
    .eq("owner_user_id", ownerUserId);
  return { ok: !error, message: error ? "Unable to apply the revision" : null, requiresApproval: status === "PROPOSED" };
}

// Rollback re-activates the previous version's procedure as a NEW version —
// history is append-only, so even a rollback is inspectable.
export async function rollbackSkill(
  supabase: SupabaseClient,
  ownerUserId: string,
  skillId: string,
): Promise<{ ok: boolean; message: string | null }> {
  const { data: skill } = await supabase
    .from("skill")
    .select("id, status, version, title, description")
    .eq("id", skillId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (!skill) return { ok: false, message: "Skill not found" };
  if (Number(skill.version) <= 1) return { ok: false, message: "There is no earlier version to roll back to" };

  const { data: previous } = await supabase
    .from("skill_version")
    .select("version, procedure")
    .eq("skill_id", skillId)
    .lt("version", Number(skill.version))
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!previous) return { ok: false, message: "No earlier version exists" };

  const revised = await reviseSkill(supabase, ownerUserId, skillId, previous.procedure, `ROLLBACK_TO_V${previous.version}`);
  return { ok: revised.ok, message: revised.message };
}

export async function recordSkillUsage(
  supabase: SupabaseClient,
  ownerUserId: string,
  skillIds: string[],
): Promise<void> {
  if (!skillIds.length) return;
  const { data: rows } = await supabase
    .from("skill")
    .select("id, usage_count")
    .eq("owner_user_id", ownerUserId)
    .in("id", skillIds);
  for (const row of rows ?? []) {
    await supabase
      .from("skill")
      .update({ usage_count: Number(row.usage_count ?? 0) + 1, last_used_at: new Date().toISOString() })
      .eq("id", row.id as string)
      .eq("owner_user_id", ownerUserId);
  }
}
