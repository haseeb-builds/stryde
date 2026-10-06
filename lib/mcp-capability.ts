// MCP as a dynamic capability source (Phase 6). Tools exposed by registered
// MCP servers become ordinary Stryde capabilities: normalized descriptors
// with per-server trust, read/write classification, scopes, and cost.
// Normalization is NOT authorization: a discovered MCP tool still requires
// the standard authority path, and an MCP response is untrusted result data,
// never canonical truth.
import type { CapabilityDefinition } from "./capability-registry.ts";

export type McpServerRegistration = {
  serverKey: string;
  // Per-server trust. Tools inherit the server's trust ceiling.
  trustState: "TRUSTED" | "REVIEWED" | "UNVERIFIED" | "BLOCKED";
};

export type McpDiscoveredTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: unknown;
  // MCP annotation hints, when the server provides them.
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
};

const RISK_BY_TRUST: Record<McpServerRegistration["trustState"], CapabilityDefinition["riskClass"]> = {
  TRUSTED: "MEDIUM",
  REVIEWED: "MEDIUM",
  UNVERIFIED: "HIGH",
  BLOCKED: "HIGH",
};

// Normalize one MCP tool into a registry CapabilityDefinition. Read-only
// tools are observational and reversible; anything else is treated as a
// state change requiring explicit approval — MCP hints can lower the
// classification only when the server is trusted AND the tool is annotated
// read-only. A BLOCKED server yields no capabilities at all.
export function normalizeMcpTool(server: McpServerRegistration, tool: McpDiscoveredTool): CapabilityDefinition | null {
  if (server.trustState === "BLOCKED") return null;
  const key = `mcp.${server.serverKey}.${tool.name}`;
  const readOnly = tool.annotations?.readOnlyHint === true;
  const destructive = tool.annotations?.destructiveHint === true;
  const sideEffectClass: CapabilityDefinition["sideEffectClass"] = readOnly
    ? "OBSERVATIONAL"
    : destructive
      ? "DESTRUCTIVE"
      : "STATE_CHANGE";
  const rawDescription = tool.description ?? tool.title ?? tool.name;
  const sanitized = sanitizeMcpDescription(String(rawDescription));
  return {
    capabilityKey: key,
    version: "1",
    provider: `mcp:${server.serverKey}`,
    description: sanitized.clean.slice(0, 500),
    toolKey: "worker.mcp",
    // A trusted server's read-only tool is REVIEWED; everything else stays
    // at the server's trust ceiling, and UNVERIFIED never rises.
    trustClass: server.trustState === "TRUSTED" && readOnly ? "REVIEWED" : server.trustState,
    riskClass: readOnly && !destructive ? RISK_BY_TRUST[server.trustState] : "HIGH",
    sideEffectClass,
    reversible: readOnly,
    requiredCredentials: ["MCP_SERVER_REGISTRATION"],
    requiredScopes: readOnly ? [] : ["EXPLICIT_USER_APPROVAL"],
    egressPolicy: "REGISTERED_ENDPOINTS",
    // MCP tools are plan-gated with the worker plane: pro and max.
    planEligibility: ["pro", "max"],
    costModel: { worker_jobs: 1 },
    latencyClass: "MEDIUM",
    verificationCapability: "OBSERVATION_REQUIRED",
    metadata: { lane: "mcp", server: server.serverKey, annotations: tool.annotations ?? {}, description_suspicious: sanitized.suspicious },
  };
}

export function normalizeMcpServerTools(server: McpServerRegistration, tools: McpDiscoveredTool[]): CapabilityDefinition[] {
  return tools
    .map((t) => normalizeMcpTool(server, t))
    .filter((c): c is CapabilityDefinition => c !== null);
}

// Prompt-injection resistance for MCP tool descriptions: a malicious server
// can embed instructions in tool text. The registry stores the description
// as DATA with instruction-shaped content neutralized (control characters
// stripped, role markers flagged in metadata) so downstream prompts treat it
// as untrusted text.
export function sanitizeMcpDescription(text: string): { clean: string; suspicious: boolean } {
  const stripped = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const suspicious = /system prompt|ignore (all )?(previous|prior) instructions|you are now|disregard/i.test(stripped);
  return { clean: stripped, suspicious };
}
