/* eslint-disable @typescript-eslint/no-explicit-any */
export type ModelProviderName = "gemini" | "openrouter" | "omniroute" | "groq";
export type ModelProviderConfig = { provider: ModelProviderName; apiKey: string; baseUrl: string; model: string };

export type ProviderFailureKind = "configuration" | "transport" | "cancellation" | "http" | "rate_limit" | "authentication" | "malformed_output" | "streaming";

export type ModelProviderConfigurationIssue = { provider: ModelProviderName; message: string };

export class ModelProviderError extends Error {
  readonly kind: ProviderFailureKind;
  readonly provider: ModelProviderName;
  readonly retryable: boolean;
  readonly status?: number;
  constructor(provider: ModelProviderName, kind: ProviderFailureKind, message: string, retryable: boolean, status?: number) {
    super(message); this.name = "ModelProviderError"; this.provider = provider; this.kind = kind; this.retryable = retryable; this.status = status;
  }
}

export type StructuredInput = { schemaName: string; schema: object; prompt: string; maxOutputTokens?: number; signal?: AbortSignal };
export type ModelProvider = {
  name: ModelProviderName; model: string;
  generateStructured(input: StructuredInput): Promise<unknown>;
  streamStructured(input: StructuredInput & { onText: (text: string) => void }): Promise<void>;
};

const defaults: Record<ModelProviderName, { baseUrl: string; model: string; envKey: string }> = {
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash", envKey: "STRYDE_GEMINI_API_KEY" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/free", envKey: "STRYDE_OPENROUTER_API_KEY" },
  omniroute: { baseUrl: "", model: "", envKey: "STRYDE_OMNIROUTE_API_KEY" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b", envKey: "STRYDE_GROQ_API_KEY" },
};

// Canonical router chain: Gemini → OpenRouter → OmniRoute. STRYDE_MODEL_PROVIDER,
// when set, only reorders this chain (preferred first leg); it never removes legs.
// STRYDE_PROVIDER_DISABLED is the one legitimate removal mechanism: a comma list
// of provider names excluded from every chain regardless of configuration. A
// disabled provider cannot participate even if fully configured.
const CANONICAL_PROVIDER_ORDER: ModelProviderName[] = ["gemini", "openrouter", "omniroute"];

export function disabledProviders(env: NodeJS.ProcessEnv): Set<ModelProviderName> {
  const raw = env.STRYDE_PROVIDER_DISABLED ?? "";
  return new Set(
    raw.split(",").map((name) => name.trim().toLowerCase()).filter((name): name is ModelProviderName =>
      (["gemini", "openrouter", "omniroute", "groq"] as const).includes(name as ModelProviderName),
    ),
  );
}

function applyDisabled(order: ModelProviderName[], disabled: Set<ModelProviderName>): ModelProviderName[] {
  return order.filter((provider) => !disabled.has(provider));
}

export function selectedPreferredProvider(env: NodeJS.ProcessEnv): ModelProviderName | undefined {
  const selected = env.STRYDE_MODEL_PROVIDER?.trim().toLowerCase();
  if (!selected) return undefined;
  if (!(selected in defaults)) throw new ModelProviderError(selected as ModelProviderName, "configuration", `Unsupported STRYDE_MODEL_PROVIDER: ${selected}`, false);
  if (disabledProviders(env).has(selected as ModelProviderName)) return undefined;
  return selected as ModelProviderName;
}

function providerOrder(env: NodeJS.ProcessEnv, selected?: ModelProviderName): ModelProviderName[] {
  const disabled = disabledProviders(env);
  const base = selected
    ? [selected, ...CANONICAL_PROVIDER_ORDER.filter((p) => p !== selected)]
    : [...CANONICAL_PROVIDER_ORDER];
  return applyDisabled(base, disabled);
}

// Legacy STRYDE_MODEL_* variables are compatibility for the Gemini path only: they
// configure the Gemini leg when Gemini is the selected provider (or when no provider
// is selected), and never leak into other legs.
function legacyGeminiAlias(provider: ModelProviderName, selected?: ModelProviderName): boolean {
  return provider === "gemini" && (selected === undefined || selected === "gemini");
}

function configured(env: NodeJS.ProcessEnv, provider: ModelProviderName, selected?: ModelProviderName): ModelProviderConfig | null {
  const d = defaults[provider];
  const alias = legacyGeminiAlias(provider, selected);
  const apiKey = (env[d.envKey] ?? (alias ? env.STRYDE_MODEL_API_KEY : undefined))?.trim();
  if (!apiKey) return null;
  const baseUrl = (env[`STRYDE_${provider.toUpperCase()}_BASE_URL`] ?? (alias ? env.STRYDE_MODEL_BASE_URL : undefined) ?? d.baseUrl).replace(/\/$/, "");
  const model = (env[`STRYDE_${provider.toUpperCase()}_MODEL`] ?? (alias ? env.STRYDE_MODEL_NAME : undefined) ?? d.model).trim();
  if (!baseUrl || !model) throw new ModelProviderError(provider, "configuration", `${provider} provider requires base URL and model`, false);
  if (provider === "gemini" && /openrouter\.ai|groq\.com/i.test(baseUrl) || provider === "openrouter" && /googleapis\.com|groq\.com/i.test(baseUrl) || provider === "groq" && /googleapis\.com|openrouter\.ai/i.test(baseUrl)) throw new ModelProviderError(provider, "configuration", `Invalid model configuration: ${provider} provider cannot use this base URL`, false);
  return { provider, apiKey, baseUrl, model };
}

export function readModelProviderConfigurationIssues(env: NodeJS.ProcessEnv = process.env): ModelProviderConfigurationIssue[] {
  const selected = selectedPreferredProvider(env);
  const issues: ModelProviderConfigurationIssue[] = [];
  for (const provider of providerOrder(env, selected)) {
    try { configured(env, provider, selected); } catch (error) { issues.push({ provider, message: error instanceof Error ? error.message : "Invalid provider configuration" }); }
  }
  return issues;
}

export function readModelProviderConfigs(env: NodeJS.ProcessEnv = process.env): ModelProviderConfig[] {
  const selected = selectedPreferredProvider(env);
  const configs: ModelProviderConfig[] = [];
  const issues: ModelProviderConfigurationIssue[] = [];
  for (const provider of providerOrder(env, selected)) {
    try { const config = configured(env, provider, selected); if (config) configs.push(config); }
    catch (error) { issues.push({ provider, message: error instanceof Error ? error.message : "Invalid provider configuration" }); }
  }
  if (!configs.length) throw new ModelProviderError(selected ?? "gemini", "configuration", `No usable model providers configured${issues.length ? `: ${issues.map((issue) => `${issue.provider}: ${issue.message}`).join("; ")}` : ""}`, false);
  return configs;
}

export function readModelProviderConfig(env: NodeJS.ProcessEnv = process.env): ModelProviderConfig {
  const selected = selectedPreferredProvider(env);
  if (selected) { const config = configured(env, selected, selected); if (!config) throw new ModelProviderError(selected, "configuration", "Missing model configuration", false); return config; }
  return readModelProviderConfigs(env)[0];
}

function geminiSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(geminiSchema);
  const s = schema as Record<string, unknown>;
  // The Gemini REST API rejects "type" lists ("Proto field is not repeating").
  // A T-anyOf-null union becomes T with nullable: true, which the live API accepts.
  const variants = Array.isArray(s.anyOf) ? s.anyOf : null;
  if (variants) {
    const value = variants.find((v) => v && typeof v === "object" && (v as Record<string, unknown>).type !== "null");
    const hasNull = variants.some((v) => v && typeof v === "object" && (v as Record<string, unknown>).type === "null");
    if (value && (value as Record<string, unknown>).type && hasNull) {
      const converted = geminiSchema(value) as Record<string, unknown>;
      return hasNull ? { ...converted, nullable: true } : converted;
    }
  }
  // "additionalProperties" is rejected by the live Gemini REST API ("Cannot find field"),
  // and enum values must be strings; non-string enums are dropped (runtime
  // validators still enforce them) instead of failing the whole request.
  const converted = Object.fromEntries(Object.entries(s).filter(([k]) => ["type","description","title","enum","format","minimum","maximum","required","properties","items"].includes(k)).map(([k,v]) => [k, k === "properties" && v && typeof v === "object" ? Object.fromEntries(Object.entries(v as object).map(([n,x]) => [n, geminiSchema(x)])) : k === "items" ? geminiSchema(v) : v])) as Record<string, unknown>;
  if (Array.isArray(converted.enum) && converted.enum.some((value) => typeof value !== "string")) {
    delete converted.enum;
  }
  if (Array.isArray(converted.type)) {
    const types = converted.type as string[];
    const nonNull = types.filter((t) => t !== "null");
    if (nonNull.length === 1) { converted.type = nonNull[0]; if (types.includes("null")) converted.nullable = true; }
  }
  return converted;
}

function outputText(provider: ModelProviderName, envelope: any): string {
  const text = provider === "gemini" ? envelope?.candidates?.[0]?.content?.parts?.map((p: any) => typeof p?.text === "string" ? p.text : "").join("") : envelope?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new ModelProviderError(provider, "malformed_output", "Provider returned no text output", false);
  return text.trim();
}

function modelTimeoutMs(): number {
  const raw = Number(process.env.STRYDE_MODEL_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 45_000;
}

function abortErrorName(error: unknown): string | null {
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) return error.name;
  if (typeof DOMException !== "undefined" && error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) return error.name;
  return null;
}

function geminiThinkingBudget(): number {
  const raw = Number(process.env.STRYDE_GEMINI_THINKING_BUDGET);
  return Number.isFinite(raw) && raw >= 0 ? raw : 1024;
}

function body(config: ModelProviderConfig, input: StructuredInput, stream: boolean) {
  const max = input.maxOutputTokens ?? 1000;
  if (config.provider === "gemini") return { contents: [{ parts: [{ text: input.prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: max, thinkingConfig: { thinkingBudget: geminiThinkingBudget() }, responseMimeType: "application/json", responseSchema: geminiSchema(input.schema) } };
  const openrouterRouting = config.provider === "openrouter" ? { provider: { require_parameters: true, allow_fallbacks: true }, plugins: [{ id: "response-healing" }] } : {};
  return { model: config.model, messages: [{ role: "user", content: `${input.prompt}\n\nReturn one JSON object only matching this schema:\n${JSON.stringify(input.schema)}` }], response_format: { type: "json_object" }, temperature: 0, max_tokens: max, stream, ...openrouterRouting };
}

export function createModelProvider(config: ModelProviderConfig, fetchImpl: typeof fetch = fetch): ModelProvider {
  const request = async (input: StructuredInput, stream: boolean, onText?: (text: string) => void) => {
    const url = config.provider === "gemini" ? `${config.baseUrl}/models/${encodeURIComponent(config.model)}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}` : `${config.baseUrl}/chat/completions`;
    const timeoutMs = modelTimeoutMs();
    const timeoutController = new AbortController();
    const timeoutHandle = setTimeout(() => {
      timeoutController.abort(new DOMException("Provider request timed out", "TimeoutError"));
    }, timeoutMs);
    const signal = input.signal
      ? AbortSignal.any([input.signal, timeoutController.signal])
      : timeoutController.signal;
    let response: Response;
    try {
      response = await fetchImpl(url, { method: "POST", headers: config.provider === "gemini" ? { "Content-Type": "application/json", "x-goog-api-key": config.apiKey } : { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "X-Title": "Stryde" }, body: JSON.stringify(body(config, input, stream)), signal, cache: "no-store" });
    } catch (e) {
      const abortName = abortErrorName(e);
      if (abortName === "AbortError") throw new ModelProviderError(config.provider, "cancellation", "Aborted", false);
      if (abortName === "TimeoutError") throw new ModelProviderError(config.provider, "transport", `Provider request timed out after ${timeoutMs}ms`, true);
      throw new ModelProviderError(config.provider, "transport", e instanceof Error ? e.message : "Provider request failed", true);
    } finally {
      clearTimeout(timeoutHandle);
    }
    if (!response.ok) { const kind: ProviderFailureKind = response.status === 401 || response.status === 403 ? "authentication" : response.status === 429 ? "rate_limit" : "http"; throw new ModelProviderError(config.provider, kind, `Provider request failed (${response.status})`, kind !== "authentication" && response.status >= 500 || kind === "rate_limit", response.status); }
    if (!stream) return outputText(config.provider, await response.json());
    if (!response.body) throw new ModelProviderError(config.provider, "streaming", "Provider streaming response has no body", true);
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
    try {
      while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const frames = buffer.replace(/\r\n/g, "\n").split("\n\n"); buffer = frames.pop() ?? ""; for (const frame of frames) { const data = frame.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n"); if (!data || data === "[DONE]") continue; let payload: any; try { payload = JSON.parse(data); } catch { throw new ModelProviderError(config.provider, "streaming", "Provider returned malformed streaming data", false); } const delta = config.provider === "gemini" ? payload?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") : payload?.choices?.[0]?.delta?.content; if (typeof delta === "string" && delta) onText?.(delta); } }
    } catch (error) {
      if (error instanceof ModelProviderError) throw error;
      if (error instanceof DOMException && error.name === "AbortError" || error instanceof Error && error.name === "AbortError") throw new ModelProviderError(config.provider, "cancellation", "Aborted", false);
      throw new ModelProviderError(config.provider, "streaming", error instanceof Error ? error.message : "Provider stream failed", true);
    }
  };
  return { name: config.provider, model: config.model, generateStructured: async (i) => JSON.parse(await request(i, false) as string), streamStructured: async (i) => { await request(i, true, i.onText); } };
}

export function createModelRouter(configs: ModelProviderConfig[], fetchImpl: typeof fetch = fetch) {
  const providers = configs.map((c) => createModelProvider(c, fetchImpl));
  return {
    async generateStructured(input: StructuredInput) { let last: unknown; for (const p of providers) { try { return { parsed: await p.generateStructured(input), provider: p.name, model: p.model }; } catch (e) { last = e; if (!(e instanceof ModelProviderError) || !e.retryable) throw e; } } throw last; },
    async streamStructured(input: StructuredInput & { onText: (text: string) => void }) { let last: unknown; for (const p of providers) { try { const chunks: string[] = []; await p.streamStructured({ ...input, onText: (text) => chunks.push(text) }); input.onText(chunks.join("")); return { provider: p.name, model: p.model }; } catch (e) { last = e; if (!(e instanceof ModelProviderError) || !e.retryable) throw e; } } throw last; },
  };
}

export function getModelRouter(fetchImpl?: typeof fetch) { return createModelRouter(readModelProviderConfigs(), fetchImpl); }