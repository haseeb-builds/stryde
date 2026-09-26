export type ModelProviderName = "gemini" | "groq" | "openrouter";

export type ModelProviderConfig = {
  provider: ModelProviderName;
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type ModelProvider = {
  name: ModelProviderName;
  model: string;
  generateStructured(input: { schemaName: string; schema: object; prompt: string; maxOutputTokens?: number; signal?: AbortSignal }): Promise<unknown>;
  streamStructured(input: { schemaName: string; schema: object; prompt: string; maxOutputTokens?: number; signal?: AbortSignal; onText: (text: string) => void }): Promise<void>;
};

const defaults: Record<ModelProviderName, { baseUrl: string; model: string }> = {
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/free" },
};

export function readModelProviderConfig(env: NodeJS.ProcessEnv = process.env): ModelProviderConfig {
  const provider = (env.STRYDE_MODEL_PROVIDER ?? "gemini").trim().toLowerCase() as ModelProviderName;
  if (!defaults[provider]) throw new Error(`Unsupported STRYDE_MODEL_PROVIDER: ${provider}`);
  const apiKey = env.STRYDE_MODEL_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing model configuration: STRYDE_MODEL_API_KEY");
  const baseUrl = (env.STRYDE_MODEL_BASE_URL ?? defaults[provider].baseUrl).replace(/\/$/, "");
  const model = (env.STRYDE_MODEL_NAME ?? defaults[provider].model).trim();
  if (!model) throw new Error("Missing model configuration: STRYDE_MODEL_NAME");
  if (provider === "gemini" && /openrouter\.ai|groq\.com/i.test(baseUrl)) throw new Error("Invalid model configuration: Gemini provider cannot use this base URL");
  if (provider === "groq" && /openrouter\.ai|googleapis\.com/i.test(baseUrl)) throw new Error("Invalid model configuration: Groq provider cannot use this base URL");
  if (provider === "openrouter" && /groq\.com|googleapis\.com/i.test(baseUrl)) throw new Error("Invalid model configuration: OpenRouter provider cannot use this base URL");
  return { provider, apiKey, baseUrl, model };
}

function toGeminiSchema(schema: unknown): unknown {
  if (typeof schema !== "object" || schema === null) return schema;
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  const source = schema as Record<string, unknown>;
  const variants = Array.isArray(source.anyOf) ? source.anyOf : null;
  if (variants) {
    const nonNull = variants.find((item) => item && typeof item === "object" && (item as Record<string, unknown>).type !== "null");
    const hasNull = variants.some((item) => item && typeof item === "object" && (item as Record<string, unknown>).type === "null");
    if (nonNull && hasNull) {
      const converted = toGeminiSchema(nonNull) as Record<string, unknown>;
      if (typeof converted.type === "string") return { ...converted, type: [converted.type, "null"] };
    }
  }
  const converted: Record<string, unknown> = {};
  if (source.type !== undefined) converted.type = source.type;
  for (const key of ["description", "title", "enum", "format", "minimum", "maximum", "required", "additionalProperties"]) if (source[key] !== undefined) converted[key] = source[key];
  if (source.properties && typeof source.properties === "object") converted.properties = Object.fromEntries(Object.entries(source.properties as Record<string, unknown>).map(([key, value]) => [key, toGeminiSchema(value)]));
  if (source.items !== undefined) converted.items = toGeminiSchema(source.items);
  return converted;
}

function textFromEnvelope(provider: ModelProviderName, envelope: unknown): string {
  if (typeof envelope !== "object" || envelope === null) throw new Error("Model returned an invalid response envelope");
  if (provider === "gemini") {
    const candidates = (envelope as { candidates?: unknown }).candidates;
    const parts = Array.isArray(candidates) && candidates[0] && typeof candidates[0] === "object" ? (candidates[0] as { content?: { parts?: unknown } }).content?.parts : null;
    const text = Array.isArray(parts) ? parts.filter((part) => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string").map((part) => (part as { text: string }).text).join("").trim() : "";
    if (!text) throw new Error("Gemini returned no text output");
    return text;
  }
  const choices = (envelope as { choices?: unknown }).choices;
  const message = Array.isArray(choices) && choices[0] && typeof choices[0] === "object" ? (choices[0] as { message?: { content?: unknown } }).message : null;
  if (!message || typeof message.content !== "string" || !message.content.trim()) throw new Error("Model returned no text output");
  return message.content.trim();
}

function requestBody(config: ModelProviderConfig, input: { schemaName: string; schema: object; prompt: string; maxOutputTokens: number; stream: boolean }) {
  if (config.provider === "gemini") return { contents: [{ parts: [{ text: input.prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: input.maxOutputTokens, thinkingConfig: { thinkingBudget: 1024 }, responseMimeType: "application/json", responseSchema: toGeminiSchema(input.schema) } };
  const prompt = config.provider === "openrouter" ? `${input.prompt}\n\nReturn one JSON object only.\nThe JSON object MUST conform to this contract:\n${JSON.stringify(input.schema)}` : input.prompt;
  return { model: config.model, messages: [{ role: "user", content: prompt }], response_format: config.provider === "groq" ? { type: "json_schema", json_schema: { name: input.schemaName, strict: true, schema: input.schema } } : { type: "json_object" }, ...(config.provider === "groq" ? { reasoning_effort: "low" } : {}), ...(config.provider === "openrouter" ? { provider: { require_parameters: true, allow_fallbacks: true }, plugins: [{ id: "response-healing" }] } : {}), temperature: 0, max_tokens: config.provider === "groq" ? Math.min(input.maxOutputTokens, 800) : input.maxOutputTokens, stream: input.stream };
}

export function createModelProvider(config: ModelProviderConfig, fetchImpl: typeof fetch = fetch): ModelProvider {
  const request = async (input: Parameters<ModelProvider["generateStructured"]>[0], stream: boolean, onText?: (text: string) => void) => {
    const response = await fetchImpl(config.provider === "gemini" ? `${config.baseUrl}/models/${encodeURIComponent(config.model)}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}` : `${config.baseUrl}/chat/completions`, { method: "POST", headers: config.provider === "gemini" ? { "Content-Type": "application/json", "x-goog-api-key": config.apiKey } : { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "X-Title": "Stryde" }, body: JSON.stringify(requestBody(config, { ...input, maxOutputTokens: input.maxOutputTokens ?? 1000, stream })), signal: input.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`Model request failed (${response.status}): ${(await response.text()).slice(0, 1000)}`);
    if (!stream) return textFromEnvelope(config.provider, await response.json());
    if (!response.body) throw new Error("Model streaming response has no body");
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
    while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const frames = buffer.replace(/\r\n/g, "\n").split("\n\n"); buffer = frames.pop() ?? ""; for (const frame of frames) { const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n"); if (!data || data === "[DONE]") continue; const payload = JSON.parse(data) as { choices?: Array<{ delta?: { content?: unknown } }>; candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }; const delta = config.provider === "gemini" ? payload.candidates?.[0]?.content?.parts?.map((part) => typeof part.text === "string" ? part.text : "").join("") : payload.choices?.[0]?.delta?.content; if (typeof delta === "string" && delta) onText?.(delta); } }
    const tail = decoder.decode(); if (tail) buffer += tail; if (buffer.trim()) { const data = buffer.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n"); if (data && data !== "[DONE]") { const payload = JSON.parse(data) as { choices?: Array<{ delta?: { content?: unknown } }>; candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }; const delta = config.provider === "gemini" ? payload.candidates?.[0]?.content?.parts?.map((part) => typeof part.text === "string" ? part.text : "").join("") : payload.choices?.[0]?.delta?.content; if (typeof delta === "string" && delta) onText?.(delta); } }
  };
  return { name: config.provider, model: config.model, generateStructured: async (input) => JSON.parse(await request(input, false) as string), streamStructured: async (input) => { await request(input, true, input.onText); } };
}

export function getModelProvider(fetchImpl?: typeof fetch) { return createModelProvider(readModelProviderConfig(), fetchImpl); }
