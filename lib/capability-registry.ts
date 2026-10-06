// Semantic capability registry (Phase 1 of the capability platform).
//
// The catalog below is the provider-neutral semantic surface: what Stryde
// knows it CAN do, expressed in product semantics (research rounds, worker
// seconds), never vendor units. Low-level mechanisms stay in public.tool;
// a capability row links to its tool when one exists.
//
// Boundary this module must never cross: registration is not authority.
// Finding a capability in the catalog authorizes nothing — execution still
// requires the existing authorization commit / capability_grant path.
import type { SupabaseClient } from "@supabase/supabase-js";

export type TrustClass = "TRUSTED" | "REVIEWED" | "UNVERIFIED" | "BLOCKED";
export type RiskClass = "LOW" | "MEDIUM" | "HIGH";
export type SideEffectClass =
  | "NONE"
  | "OBSERVATIONAL"
  | "EXTERNAL_COMMUNICATION"
  | "STATE_CHANGE"
  | "DESTRUCTIVE";
export type Availability = "AVAILABLE" | "DEGRADED" | "UNAVAILABLE";

export type CapabilityDefinition = {
  capabilityKey: string;
  version: string;
  provider: string;
  description: string;
  toolKey: string | null;
  trustClass: TrustClass;
  riskClass: RiskClass;
  sideEffectClass: SideEffectClass;
  reversible: boolean;
  requiredCredentials: string[];
  requiredScopes: string[];
  egressPolicy: "NONE" | "PUBLIC_HTTP" | "REGISTERED_ENDPOINTS" | "USER_AUTHORIZED";
  planEligibility: string[];
  // Provider-neutral cost: resource name -> expected units per invocation.
  costModel: Record<string, number>;
  latencyClass: "FAST" | "MEDIUM" | "SLOW";
  verificationCapability: string | null;
  metadata: Record<string, unknown>;
};

// Static first-party catalog. External lanes (Exa/Firecrawl) are registered
// even when their credentials are absent — availability is runtime evidence,
// resolved by the discovery layer, not a registry property.
export const CAPABILITY_CATALOG: CapabilityDefinition[] = [
  {
    capabilityKey: "research.web_search",
    version: "1",
    provider: "search-provider-chain",
    description: "Discrete web search results for a query, via the configured search provider chain.",
    toolKey: null,
    trustClass: "REVIEWED",
    riskClass: "LOW",
    sideEffectClass: "NONE",
    reversible: true,
    requiredCredentials: ["SEARCH_PROVIDER_KEY"],
    requiredScopes: [],
    egressPolicy: "PUBLIC_HTTP",
    planEligibility: ["free", "pro", "max"],
    costModel: { source_discovery: 5 },
    latencyClass: "FAST",
    verificationCapability: "URL_PROVENANCE",
    metadata: { lane: "search", fallback: "direct-page-fetch" },
  },
  {
    capabilityKey: "research.web_extraction",
    version: "1",
    provider: "firecrawl-or-equivalent",
    description: "Structured extraction of a public page's readable content.",
    toolKey: null,
    trustClass: "REVIEWED",
    riskClass: "LOW",
    sideEffectClass: "NONE",
    reversible: true,
    requiredCredentials: ["FIRECRAWL_API_KEY"],
    requiredScopes: [],
    egressPolicy: "PUBLIC_HTTP",
    planEligibility: ["free", "pro", "max"],
    costModel: { source_extraction: 1 },
    latencyClass: "MEDIUM",
    verificationCapability: "URL_PROVENANCE",
    metadata: { lane: "extract" },
  },
  {
    capabilityKey: "research.page_fetch",
    version: "1",
    provider: "direct-fetch",
    description: "Direct observation of one public page (SSRF-guarded fetch; Firecrawl fallback for thin JS shells when configured).",
    toolKey: null,
    trustClass: "TRUSTED",
    riskClass: "LOW",
    sideEffectClass: "OBSERVATIONAL",
    reversible: true,
    requiredCredentials: [],
    requiredScopes: [],
    egressPolicy: "PUBLIC_HTTP",
    planEligibility: ["free", "pro", "max"],
    costModel: { source_extraction: 1 },
    latencyClass: "FAST",
    verificationCapability: "URL_PROVENANCE",
    metadata: { lane: "observe" },
  },
  {
    capabilityKey: "worker.execution",
    version: "1",
    provider: "controlled-worker-plane",
    description: "Bounded task execution by an approved external worker (Hermes/OpenCode/browser/MCP) through the CONTROLLED plane.",
    toolKey: "worker.hermes",
    trustClass: "TRUSTED",
    riskClass: "HIGH",
    sideEffectClass: "STATE_CHANGE",
    reversible: false,
    requiredCredentials: ["WORKER_ENDPOINT"],
    requiredScopes: ["EXPLICIT_USER_APPROVAL"],
    egressPolicy: "REGISTERED_ENDPOINTS",
    planEligibility: ["pro", "max"],
    costModel: { worker_jobs: 1, worker_seconds: 60 },
    latencyClass: "SLOW",
    verificationCapability: "ARTIFACT_JUDGED",
    metadata: { lane: "execution", authority: "EXPLICIT_USER_APPROVAL_REQUIRED" },
  },
  {
    capabilityKey: "browser.authorized",
    version: "1",
    provider: "browser-worker",
    description: "Authorized browser automation against user-approved targets through the browser worker.",
    toolKey: "worker.browser",
    trustClass: "TRUSTED",
    riskClass: "HIGH",
    sideEffectClass: "STATE_CHANGE",
    reversible: false,
    requiredCredentials: ["WORKER_ENDPOINT"],
    requiredScopes: ["EXPLICIT_USER_APPROVAL", "TARGET_AUTHORIZATION"],
    egressPolicy: "USER_AUTHORIZED",
    planEligibility: ["pro", "max"],
    costModel: { browser_actions: 10 },
    latencyClass: "SLOW",
    verificationCapability: "OBSERVATION_REQUIRED",
    metadata: { lane: "browser", authority: "EXPLICIT_USER_APPROVAL_REQUIRED" },
  },
  {
    capabilityKey: "mcp.external_tools",
    version: "1",
    provider: "mcp-worker",
    description: "Tools exposed by registered MCP servers, normalized as ordinary Stryde capabilities.",
    toolKey: "worker.mcp",
    trustClass: "UNVERIFIED",
    riskClass: "HIGH",
    sideEffectClass: "STATE_CHANGE",
    reversible: false,
    requiredCredentials: ["MCP_SERVER_REGISTRATION"],
    requiredScopes: ["EXPLICIT_USER_APPROVAL"],
    egressPolicy: "REGISTERED_ENDPOINTS",
    planEligibility: ["pro", "max"],
    costModel: { worker_jobs: 1 },
    latencyClass: "MEDIUM",
    verificationCapability: "OBSERVATION_REQUIRED",
    metadata: { lane: "mcp", trust: "PER_SERVER" },
  },
  {
    capabilityKey: "acquisition.transcript",
    version: "1",
    provider: "transcriptor-lane",
    description: "Acquire a transcript for an event/media reference when a transcript provider is configured.",
    toolKey: null,
    trustClass: "UNVERIFIED",
    riskClass: "LOW",
    sideEffectClass: "NONE",
    reversible: true,
    requiredCredentials: ["TRANSCRIPT_PROVIDER_KEY"],
    requiredScopes: [],
    egressPolicy: "PUBLIC_HTTP",
    planEligibility: ["pro", "max"],
    costModel: { source_extraction: 1 },
    latencyClass: "MEDIUM",
    verificationCapability: "SOURCE_PROVENANCE",
    metadata: { lane: "transcript", status: "PROVIDER_NOT_CONFIGURED" },
  },
  {
    capabilityKey: "artifact.compose",
    version: "1",
    provider: "stryde-core",
    description: "Compose a durable artifact (markdown/JSON/CSV/code) attached to a pursuit and run.",
    toolKey: null,
    trustClass: "TRUSTED",
    riskClass: "LOW",
    sideEffectClass: "NONE",
    reversible: true,
    requiredCredentials: [],
    requiredScopes: [],
    egressPolicy: "NONE",
    planEligibility: ["free", "pro", "max"],
    costModel: {},
    latencyClass: "FAST",
    verificationCapability: null,
    metadata: { lane: "artifact" },
  },
  {
    capabilityKey: "execution.sandboxed_code",
    version: "0",
    provider: "unassigned",
    description: "Sandboxed code execution boundary. Registered as UNAVAILABLE until a real sandbox substrate exists.",
    toolKey: null,
    trustClass: "BLOCKED",
    riskClass: "HIGH",
    sideEffectClass: "STATE_CHANGE",
    reversible: false,
    requiredCredentials: ["SANDBOX_SUBSTRATE"],
    requiredScopes: ["EXPLICIT_USER_APPROVAL"],
    egressPolicy: "NONE",
    planEligibility: [],
    costModel: {},
    latencyClass: "SLOW",
    verificationCapability: null,
    metadata: { lane: "code", status: "NOT_IMPLEMENTED_DELIBERATELY" },
  },
  {
    capabilityKey: "connector.oauth_service",
    version: "0",
    provider: "connector-layer",
    description: "OAuth-backed external service connector boundary. Registered as UNAVAILABLE until the connector layer ships.",
    toolKey: null,
    trustClass: "BLOCKED",
    riskClass: "MEDIUM",
    sideEffectClass: "EXTERNAL_COMMUNICATION",
    reversible: false,
    requiredCredentials: ["OAUTH_CLIENT"],
    requiredScopes: ["USER_AUTHORIZATION"],
    egressPolicy: "USER_AUTHORIZED",
    planEligibility: [],
    costModel: {},
    latencyClass: "MEDIUM",
    verificationCapability: null,
    metadata: { lane: "connector", status: "NOT_IMPLEMENTED_DELIBERATELY" },
  },
];

function availabilityFor(cap: CapabilityDefinition, configured: {
  hasSearchProvider: boolean;
  hasExtractionProvider: boolean;
  hasWorkerEndpoint: boolean;
  hasBrowserWorker: boolean;
  hasMcpRegistration: boolean;
}): Availability {
  if (cap.trustClass === "BLOCKED") return "UNAVAILABLE";
  switch (cap.capabilityKey) {
    case "research.web_search":
      return configured.hasSearchProvider ? "AVAILABLE" : "DEGRADED";
    case "research.web_extraction":
      return configured.hasExtractionProvider ? "AVAILABLE" : "DEGRADED";
    case "worker.execution":
    case "browser.authorized":
    case "mcp.external_tools":
      // Workers execute off-plane; registry presence stays, runtime
      // availability is worker health, resolved per-execution.
      return cap.capabilityKey === "worker.execution" && !configured.hasWorkerEndpoint
        ? "DEGRADED"
        : "AVAILABLE";
    case "acquisition.transcript":
      return "UNAVAILABLE";
    default:
      return "AVAILABLE";
  }
}

export type ResolvedAvailability = { capabilityKey: string; availability: Availability };

export function resolveCatalogAvailability(env: NodeJS.ProcessEnv): ResolvedAvailability[] {
  const configured = {
    hasSearchProvider: Boolean(env.EXA_API_KEY || env.FIRECRAWL_API_KEY),
    hasExtractionProvider: Boolean(env.FIRECRAWL_API_KEY),
    hasWorkerEndpoint: Boolean(env.STRYDE_HERMES_URL || env.STRYDE_OPENCODE_URL),
    hasBrowserWorker: Boolean(env.STRYDE_BROWSER_WORKER_URL ?? env.STRYDE_HERMES_URL),
    hasMcpRegistration: false,
  };
  return CAPABILITY_CATALOG.map((cap) => ({
    capabilityKey: cap.capabilityKey,
    availability: availabilityFor(cap, configured),
  }));
}

// Idempotent trusted-plane sync of the catalog into public.capability.
// Run from server contexts holding the service client; never from user paths.
export async function syncCapabilityCatalog(
  service: SupabaseClient,
  availability?: ResolvedAvailability[],
): Promise<{ synced: number; errors: string[] }> {
  const availabilityByKey = new Map((availability ?? []).map((a) => [a.capabilityKey, a.availability]));
  const errors: string[] = [];
  let synced = 0;
  for (const cap of CAPABILITY_CATALOG) {
    const row = {
      capability_key: cap.capabilityKey,
      version: cap.version,
      provider: cap.provider,
      description: cap.description,
      trust_class: cap.trustClass,
      risk_class: cap.riskClass,
      side_effect_class: cap.sideEffectClass,
      reversible: cap.reversible,
      required_credentials: cap.requiredCredentials,
      required_scopes: cap.requiredScopes,
      egress_policy: cap.egressPolicy,
      plan_eligibility: cap.planEligibility,
      cost_model: cap.costModel,
      latency_class: cap.latencyClass,
      verification_capability: cap.verificationCapability,
      availability: availabilityByKey.get(cap.capabilityKey) ?? "AVAILABLE",
      metadata: cap.metadata,
    };
    const { error } = await service
      .from("capability")
      .upsert(row, { onConflict: "capability_key" });
    if (error) errors.push(`${cap.capabilityKey}: ${error.message}`);
    else synced += 1;
  }
  return { synced, errors };
}
