import { NextResponse } from "next/server";
import { disabledProviders, readModelProviderConfigurationIssues, readModelProviderConfigs, selectedPreferredProvider } from "@/lib/model-provider";

export const runtime = "nodejs";

// Reports the effective router chain (preferred first leg + canonical remainder)
// without exposing credentials. A leg appears in `providers` only when it resolves.
export async function GET() {
  let preferred: string | null = null;
  let providers: Array<{ provider: string; model: string }> = [];
  let issues: Array<{ provider: string; message: string }> = [];
  let error: string | null = null;
  try {
    preferred = selectedPreferredProvider(process.env) ?? null;
    providers = readModelProviderConfigs().map((config) => ({ provider: config.provider, model: config.model }));
    issues = readModelProviderConfigurationIssues();
  } catch (e) {
    error = e instanceof Error ? e.message : "Model provider configuration failed";
    try { issues = readModelProviderConfigurationIssues(); } catch { /* keep empty */ }
  }

  return NextResponse.json({
    preferred_provider: preferred,
    canonical_chain: ["gemini", "openrouter", "omniroute"],
    disabled_providers: [...disabledProviders(process.env)],
    providers,
    issues,
    ready: providers.length > 0,
    error,
  });
}
