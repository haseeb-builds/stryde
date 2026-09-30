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

const NEMOTRON_3_ULTRA = "nvidia/nemotron-3-ultra-550b-a55b";
const defaults: Record<ModelProviderName, { baseUrl: string; model: string; envKey: string }> = {
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash", envKey: "STRYDE_GEMINI_API_KEY" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: NEMOTRON_3_ULTRA, envKey: "STRYDE_OPENROUTER_API_KEY" },
  omniroute: { baseUrl: "", model: "", envKey: "STRYDE_OMNIROUTE_API_KEY" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b", envKey: "STRYDE_GROQ_API_KEY" },
};

function configured(env: NodeJS.ProcessEnv, provider: ModelProviderName): ModelProviderConfig | null {
  const d = defaults[provider];
  const apiKey = (env[d.envKey] ?? (provider === "gemini" ? env.STRYDE_MODEL_API_KEY : undefined))?.trim();
  if (!apiKey) return null;
  const baseUrl = (env[`STRYDE_${provider.toUpperCase()}_BASE_URL`] ?? (provider === "gemini" ? env.STRYDE_MODEL_BASE_URL : undefined) ?? d.baseUrl).replace(/\/$/, "");
  let model = (env[`STRYDE_${provider.toUpperCase()}_MODEL`] ?? (provider === "gemini" ? env.STRYDE_MODEL_NAME : undefined) ?? d.model).trim();
  // The previous OpenRouter default was a generic free router. Treat it as a legacy
  // value so a stale deployment variable cannot silently select a different model.
  if (provider === "openrouter" && model === "openrouter/free") model = NEMOTRON_3_ULTRA;
  if (!baseUrl || !model) throw new ModelProviderError(provider, "configuration", `${provider} provider requires base URL and model`, false);
  if (provider === "gemini" && /openrouter\.ai|groq\.com/i.test(baseUrl) || provider === "openrouter" && /googleapis\.com|groq\.com/i.test(baseUrl) || provider === "groq" && /googleapis\.com|openrouter\.ai/i.test(baseUrl)) throw new ModelProviderError(provider, "configuration", `Invalid model configuration: ${provider} provider cannot use this base URL`, false);
  return { provider, apiKey, baseUrl, model };
}

export function readModelProviderConfigurationIssues(env: NodeJS.ProcessEnv = process.env): ModelProviderConfigurationIssue[] {
  const issues: ModelProviderConfigurationIssue[] = [];
  for (const provider of ["gemini", "openrouter", "omniroute"] as ModelProviderName[]) {
    try { configured(env, provider); } catch (error) { issues.push({ provider, message: error instanceof Error ? error.message : "Invalid provider configuration" }); }
  }
  return issues;
}

export function readModelProviderConfigs(env: NodeJS.ProcessEnv = process.env): ModelProviderConfig[] {
  const configs: ModelProviderConfig[] = [];
  const issues: ModelProviderConfigurationIssue[] = [];
  for (const provider of ["gemini", "openrouter", "omniroute"] as ModelProviderName[]) {
    try { const config = configured(env, provider); if (config) configs.push(config); }
    catch (error) { issues.push({ provider, message: error instanceof Error ? error.message : "Invalid provider configuration" }); }
  }
  if (!configs.length) throw new ModelProviderError("gemini", "configuration", `No usable model providers configured${issues.length ? `: ${issues.map((issue) => `${issue.provider}: ${issue.message}`).join("; ")}` : ""}`, false);
  return configs;
}

export function readModelProviderConfig(env: NodeJS.ProcessEnv = process.env): ModelProviderConfig {
  const selected = env.STRYDE_MODEL_PROVIDER?.trim().toLowerCase() as ModelProviderName | undefined;
  if (selected) { if (!defaults[selected]) throw new ModelProviderError(selected, "configuration", `Unsupported STRYDE_MODEL_PROVIDER: ${selected}`, false); const config = configured(env, selected); if (!config) throw new ModelProviderError(selected, "configuration", "Missing model configuration", false); return config; }
  return readModelProviderConfigs(env)[0];
}

function geminiSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(geminiSchema);
  const s = schema as Record<string, unknown>; const variants = Array.isArray(s.anyOf) ? s.anyOf : null;
  if (variants) { const value = variants.find((v) => v && typeof v === "object" && (v as Record<string, unknown>).type !== "null"); if (value && (value as Record<string, unknown>).type && variants.some((v) => v && typeof v === "object" && (v as Record<string, unknown>).type === "null")) return { ...geminiSchema(value) as object, type: [(value as Record<string, unknown>).type, "null"] }; }
  return Object.fromEntries(Object.entries(s).filter(([k]) => ["type","description","title","enum","format","minimum","maximum","required","additionalProperties","properties","items"].includes(k)).map(([k,v]) => [k, k === "properties" && v && typeof v === "object" ? Object.fromEntries(Object.entries(v as object).map(([n,x]) => [n, geminiSchema(x)])) : k === "items" ? geminiSchema(v) : v]));
}

function outputText(provider: ModelProviderName, envelope: any): string {
  const text = provider === "gemini" ? envelope?.candidates?.[0]?.content?.parts?.map((p: any) => typeof p?.text === "string" ? p.text : "").join("") : envelope?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new ModelProviderError(provider, "malformed_output", "Provider returned no text output", false);
  return text.trim();
}

function body(config: ModelProviderConfig, input: StructuredInput, stream: boolean) {
  const max = input.maxOutputTokens ?? 1000;
  if (config.provider === "gemini") return { contents: [{ parts: [{ text: input.prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: max, thinkingConfig: { thinkingBudget: 1024 }, responseMimeType: "application/json", responseSchema: geminiSchema(input.schema) } };
  const responseFormat = config.provider === "openrouter" && config.model === NEMOTRON_3_ULTRA
    ? { type: "json_schema", json_schema: { name: input.schemaName, strict: true, schema: input.schema } }
    : { type: "json_object" };
  return { model: config.model, messages: [{ role: "user", content: `${input.prompt}\n\nReturn one JSON object only matching this schema:\n${JSON.stringify(input.schema)}` }], response_format: responseFormat, temperature: 0, max_tokens: max, stream };
}

export function createModelProvider(config: ModelProviderConfig, fetchImpl: typeof fetch = fetch): ModelProvider {
  const request = async (input: StructuredInput, stream: boolean, onText?: (text: string) => void) => {
    const url = config.provider === "gemini" ? `${config.baseUrl}/models/${encodeURIComponent(config.model)}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}` : `${config.baseUrl}/chat/completions`;
    let response: Response;
    try { response = await fetchImpl(url, { method: "POST", headers: config.provider === "gemini" ? { "Content-Type": "application/json", "x-goog-api-key": config.apiKey } : { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "X-Title": "Stryde" }, body: JSON.stringify(body(config, input, stream)), signal: input.signal, cache: "no-store" }); } catch (e) { if (e instanceof DOMException && e.name === "AbortError" || e instanceof Error && e.name === "AbortError") throw new ModelProviderError(config.provider, "cancellation", "Aborted", false); throw new ModelProviderError(config.provider, "transport", e instanceof Error ? e.message : "Provider request failed", true); }
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
export function getModelProvider(fetchImpl?: typeof fetch) { const config = readModelProviderConfig(); return createModelProvider(config, fetchImpl); }
