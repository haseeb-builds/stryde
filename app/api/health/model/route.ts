import { NextRequest, NextResponse } from "next/server";
import {
  disabledProviders,
  readModelProviderConfigurationIssues,
  readModelProviderConfigs,
  selectedPreferredProvider,
  getModelRouter,
} from "@/lib/model-provider";

export const runtime = "nodejs";

// In-memory probe cache (60s TTL) to prevent repeated expensive model calls
let lastProbeResult: {
  timestamp: number;
  success: boolean;
  provider?: string;
  model?: string;
  latency_ms?: number;
  error?: string;
} | null = null;

const PROBE_CACHE_TTL_MS = 60_000;

export async function GET(request: NextRequest) {
  let preferred: string | null = null;
  let providers: Array<{ provider: string; model: string }> = [];
  let issues: Array<{ provider: string; message: string }> = [];
  let error: string | null = null;

  try {
    preferred = selectedPreferredProvider(process.env) ?? null;
    providers = readModelProviderConfigs().map((config) => ({
      provider: config.provider,
      model: config.model,
    }));
    issues = readModelProviderConfigurationIssues();
  } catch (e) {
    error = e instanceof Error ? e.message : "Model provider configuration failed";
    try {
      issues = readModelProviderConfigurationIssues();
    } catch {
      /* keep empty */
    }
  }

  const configured = providers.length > 0;
  const shouldProbe = request.nextUrl.searchParams.get("probe") === "true" ||
                      request.nextUrl.searchParams.get("probe") === "1";

  let probe = lastProbeResult;
  const now = Date.now();

  if (shouldProbe && configured) {
    if (!lastProbeResult || now - lastProbeResult.timestamp > PROBE_CACHE_TTL_MS) {
      const probeStart = Date.now();
      try {
        const router = getModelRouter();
        const probeResult = await router.generateStructured({
          schemaName: "stryde_health_probe",
          schema: {
            type: "object",
            properties: { status: { type: "string" } },
            required: ["status"],
          },
          prompt: "Return JSON { \"status\": \"ok\" }",
          maxOutputTokens: 50,
        });
        const latency = Date.now() - probeStart;
        lastProbeResult = {
          timestamp: now,
          success: true,
          provider: probeResult.provider,
          model: probeResult.model,
          latency_ms: latency,
        };
      } catch (probeErr) {
        lastProbeResult = {
          timestamp: now,
          success: false,
          error: probeErr instanceof Error ? probeErr.message : "Upstream probe failed",
        };
      }
    }
    probe = lastProbeResult;
  }

  return NextResponse.json({
    preferred_provider: preferred,
    canonical_chain: ["gemini", "openrouter", "omniroute"],
    disabled_providers: [...disabledProviders(process.env)],
    providers,
    issues,
    configured,
    ready: configured,
    operational_status: probe
      ? probe.success
        ? "VERIFIED_OPERATIONAL"
        : "UPSTREAM_DEGRADED"
      : configured
      ? "CONFIGURED_NOT_PROBED"
      : "UNCONFIGURED",
    last_probe: probe
      ? {
          success: probe.success,
          provider: probe.provider,
          model: probe.model,
          latency_ms: probe.latency_ms,
          cached: now - probe.timestamp < PROBE_CACHE_TTL_MS,
          error: probe.error,
        }
      : null,
    error,
  });
}
