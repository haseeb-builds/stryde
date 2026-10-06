// Plugin package contract (Phase 5): a VALIDATED manifest model, not a
// marketplace. A plugin bundles skills, agents, connectors, and capability
// requests into one reviewable, versioned, trust-classified package with
// explicit permissions, data access, and network access. Validation is
// fail-closed: anything undeclared is a rejection, not a default.

export type PluginTrustState = "TRUSTED" | "REVIEWED" | "UNVERIFIED" | "BLOCKED";

export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  publisher: string;
  license: string;
  description: string;
  skills: string[];
  agents: string[];
  connectors: string[];
  hooks: string[];
  // Capability keys this plugin requires from the registry.
  capabilities: string[];
  permissions: string[];
  dataAccess: string[];
  networkAccess: string[];
  sideEffects: string[];
  compatibility: { stryde?: string };
  provenance: Record<string, unknown>;
  security: { scanCompleted?: boolean; scanVersion?: string };
};

export type PluginValidationIssue = { field: string; problem: string };

export type PluginValidationResult = {
  valid: boolean;
  issues: PluginValidationIssue[];
  trustState: PluginTrustState;
};

const VERSION_RE = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/;
const SIDE_EFFECT_CLASSES = new Set(["NONE", "OBSERVATIONAL", "EXTERNAL_COMMUNICATION", "STATE_CHANGE", "DESTRUCTIVE"]);

export function validatePluginManifest(value: unknown): PluginValidationResult {
  const issues: PluginValidationIssue[] = [];
  if (typeof value !== "object" || value === null) {
    return { valid: false, issues: [{ field: "", problem: "manifest must be an object" }], trustState: "BLOCKED" };
  }
  const m = value as Record<string, unknown>;
  const str = (field: string, min = 1) => {
    const v = m[field];
    if (typeof v !== "string" || v.trim().length < min) issues.push({ field, problem: "required non-empty string" });
    return typeof v === "string" ? v : "";
  };
  const strArray = (field: string) => {
    const v = m[field];
    if (v === undefined) return [] as string[];
    if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
      issues.push({ field, problem: "must be an array of strings" });
      return [] as string[];
    }
    return v as string[];
  };

  str("id");
  str("name");
  str("publisher");
  str("license");
  str("description", 10);
  const version = str("version");
  if (version && !VERSION_RE.test(version)) issues.push({ field: "version", problem: "must be semver (MAJOR.MINOR.PATCH)" });
  strArray("skills");
  strArray("agents");
  strArray("connectors");
  strArray("hooks");
  strArray("capabilities");
  strArray("permissions");
  strArray("dataAccess");
  strArray("networkAccess");

  const sideEffects = strArray("sideEffects");
  for (const s of sideEffects) {
    if (!SIDE_EFFECT_CLASSES.has(s)) issues.push({ field: "sideEffects", problem: `unknown side-effect class ${s}` });
  }
  const security = m.security;
  if (typeof security !== "object" || security === null || (security as { scanCompleted?: boolean }).scanCompleted !== true) {
    issues.push({ field: "security", problem: "security scan must be completed before a plugin is installable" });
  }

  // Trust state: only a completed scan and known publisher classification
  // yield above UNVERIFIED. Trust is data, never inferred from content.
  const scanDone = typeof security === "object" && security !== null && (security as { scanCompleted?: boolean }).scanCompleted === true;
  const trustState: PluginTrustState = !scanDone ? "UNVERIFIED" : "REVIEWED";

  return { valid: issues.length === 0, issues, trustState };
}
