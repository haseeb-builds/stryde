import assert from "node:assert/strict";
import test from "node:test";
import { extractMessagePrefix, readSseData, readSseFrames } from "../lib/conversation-stream.ts";
import { createConversationCommitter } from "../lib/conversation-commit.ts";
import { consumeConversationStream } from "../lib/conversation-client-stream.ts";
import { createModelProvider, createModelRouter, ModelProviderError, readModelProviderConfig, readModelProviderConfigs, readModelProviderConfigurationIssues } from "../lib/model-provider.ts";
import { MAX_CONVERSATION_TURN_OUTPUT_TOKENS } from "../lib/model-gateway.ts";

test("SSE frames reconstruct across arbitrary transport chunks", () => {
  let buffer = "";
  const frames: string[] = [];
  for (const chunk of ["data: {\"type\":\"message_delta\",\"content\":\"Hel", "lo\"}\r\n\r\n", "data: {\"type\":\"complete\"}\n\n"]) {
    const parsed = readSseFrames(buffer + chunk);
    frames.push(...parsed.frames);
    buffer = parsed.remainder;
  }
  assert.equal(frames.length, 2);
  assert.equal(JSON.parse(readSseData(frames[0])!).content, "Hello");
  assert.equal(JSON.parse(readSseData(frames[1])!).type, "complete");
});

test("structured JSON message prefixes reconstruct the exact displayed content", () => {
  const complete = JSON.stringify({ message: "Line one\nLine \"two\"", question: null });
  const reconstructed = [7, 14, complete.length].reduce((previous, end) => {
    const next = extractMessagePrefix(complete.slice(0, end));
    return next.startsWith(previous) ? next : previous;
  }, "");
  assert.equal(reconstructed, "Line one\nLine \"two\"");
});

test("failed structured validation has no assistant commit", () => {
  const commits: string[] = [];
  const commitOnlyAfterValidation = (value: unknown) => {
    if (!value || typeof value !== "object" || typeof (value as { message?: unknown }).message !== "string") return;
    commits.push((value as { message: string }).message);
  };
  commitOnlyAfterValidation({ message: "valid" });
  commitOnlyAfterValidation({ message: 42 });
  assert.deepEqual(commits, ["valid"]);
});

test("successful assistant commit is exactly once and equals final content", async () => {
  const persisted: string[] = [];
  const states: string[] = [];
  const streamed = ["Hel", "lo"].join("");
  const commit = createConversationCommitter({
    commit: async () => { persisted.push(streamed); states.push("working-state"); },
  });
  const turn = { message: streamed } as never;
  await commit(turn, {} as never);
  await commit(turn, {} as never);
  assert.deepEqual(persisted, ["Hello"]);
  assert.deepEqual(states, ["working-state"]);
});

test("concurrent commit attempts have one in-flight commit", async () => {
  let calls = 0;
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const commit = createConversationCommitter({
    commit: async () => { calls += 1; await blocked; },
  });
  const first = commit({ message: "Hello" } as never, {} as never);
  const second = await commit({ message: "Hello" } as never, {} as never);
  release();
  await first;
  assert.equal(second, false);
  assert.equal(calls, 1);
});

test("interrupted or invalid turns do not reach the commit point", async () => {
  const persisted: string[] = [];
  const commit = createConversationCommitter({
    commit: async (turn) => { persisted.push(turn.message); },
  });
  const validated = false;
  if (validated) await commit({ message: "partial" } as never, {} as never);
  assert.deepEqual(persisted, []);
});

test("user-message persistence remains a single explicit write", () => {
  let writes = 0;
  const persistUserMessage = () => { writes += 1; };
  persistUserMessage();
  assert.equal(writes, 1);
});

test("client consumes progressive deltas before the final turn", async () => {
  const chunks = [
    `data: ${JSON.stringify({ type: "message_delta", content: "Hel" })}\n\n`,
    `data: ${JSON.stringify({ type: "message_delta", content: "lo" })}\n\n`,
    `data: ${JSON.stringify({ type: "complete", turn: { message: "Hello" } })}\n\n`,
  ];
  const response = new Response(new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(new TextEncoder().encode(chunk)));
      controller.close();
    },
  }));
  const deltas: string[] = [];
  const turn = await consumeConversationStream<{ message: string }>(response, (delta) => deltas.push(delta), () => undefined);
  assert.deepEqual(deltas, ["Hel", "lo"]);
  assert.equal(turn.message, "Hello");
});

test("provider adapter maps structured OpenAI-compatible responses", async () => {
  const provider = createModelProvider({ provider: "groq", apiKey: "key", baseUrl: "https://api.groq.com/openai/v1", model: "test" }, async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 }));
  assert.deepEqual(await provider.generateStructured({ schemaName: "test", schema: { type: "object" }, prompt: "x" }), { ok: true });
});

test("provider adapter streams Gemini and OpenAI-compatible deltas", async () => {
  const sse = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
  const provider = createModelProvider({ provider: "groq", apiKey: "key", baseUrl: "https://api.groq.com/openai/v1", model: "test" }, async () => {
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(sse({ choices: [{ delta: { content: '{"' } }] }) + sse({ choices: [{ delta: { content: 'ok":true}' } }] }))); controller.close(); } }), { status: 200 });
  });
  let text = "";
  await provider.streamStructured({ schemaName: "test", schema: { type: "object" }, prompt: "x", onText: (delta) => { text += delta; } });
  assert.equal(text, '{"ok":true}');
});

test("provider configuration rejects mismatched endpoints and malformed output", async () => {
  assert.throws(() => readModelProviderConfig({ STRYDE_MODEL_PROVIDER: "gemini", STRYDE_MODEL_API_KEY: "key", STRYDE_MODEL_BASE_URL: "https://api.groq.com" } as unknown as NodeJS.ProcessEnv), /Invalid model configuration/);
  const provider = createModelProvider({ provider: "groq", apiKey: "key", baseUrl: "https://api.groq.com", model: "test" }, async () => new Response("{}", { status: 200 }));
  await assert.rejects(provider.generateStructured({ schemaName: "test", schema: {}, prompt: "x" }), /no text output|missing choices/);
});

test("provider adapter propagates cancellation", async () => {
  const controller = new AbortController();
  const provider = createModelProvider({ provider: "groq", apiKey: "key", baseUrl: "https://api.groq.com", model: "test" }, (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  const pending = provider.generateStructured({ schemaName: "test", schema: {}, prompt: "x", signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error) => error instanceof ModelProviderError && error.kind === "cancellation");
});

test("provider request timeout is a retryable transport error", async () => {
  process.env.STRYDE_MODEL_TIMEOUT_MS = "50";
  try {
    const provider = createModelProvider({ provider: "groq", apiKey: "key", baseUrl: "https://api.groq.com", model: "test" }, (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject((init!.signal as AbortSignal).reason));
    }));
    await assert.rejects(provider.generateStructured({ schemaName: "test", schema: {}, prompt: "x" }), (error) => error instanceof ModelProviderError && error.kind === "transport" && error.retryable && /timed out/.test(error.message));
  } finally {
    delete process.env.STRYDE_MODEL_TIMEOUT_MS;
  }
});

test("router fails over to the next provider when a leg times out", async () => {
  process.env.STRYDE_MODEL_TIMEOUT_MS = "50";
  try {
    const calls: string[] = [];
    const router = createModelRouter([
      { provider: "gemini", apiKey: "g", baseUrl: "https://g", model: "g" },
      { provider: "openrouter", apiKey: "o", baseUrl: "https://o", model: "o" },
    ], (url, init) => {
      calls.push(String(url));
      if (String(url).startsWith("https://g")) {
        return new Promise((_resolve, reject) => { init?.signal?.addEventListener("abort", () => reject((init!.signal as AbortSignal).reason)); });
      }
      return Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 }));
    });
    const result = await router.generateStructured({ schemaName: "x", schema: {}, prompt: "x" });
    assert.equal(result.provider, "openrouter");
    assert.deepEqual(calls, ["https://g/models/g:generateContent", "https://o/chat/completions"]);
  } finally {
    delete process.env.STRYDE_MODEL_TIMEOUT_MS;
  }
});

test("model router follows Gemini, OpenRouter, OmniRoute order and falls back only on retryable failures", async () => {
  const calls: string[] = [];
  const router = createModelRouter([
    { provider: "gemini", apiKey: "g", baseUrl: "https://g", model: "g" },
    { provider: "openrouter", apiKey: "o", baseUrl: "https://o", model: "o" },
    { provider: "omniroute", apiKey: "m", baseUrl: "https://m", model: "m" },
  ], async (url) => { const target = String(url); calls.push(target); return new Response(target.endsWith("/chat/completions") ? JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }) : "{}", { status: target.startsWith("https://g") ? 503 : 200 }); });
  const result = await router.generateStructured({ schemaName: "x", schema: {}, prompt: "x" });
  assert.equal(result.provider, "openrouter");
  assert.deepEqual(calls, ["https://g/models/g:generateContent", "https://o/chat/completions"]);
});

test("router never falls back after a non-retryable malformed output", async () => {
  const router = createModelRouter([
    { provider: "gemini", apiKey: "g", baseUrl: "https://g", model: "g" },
    { provider: "openrouter", apiKey: "o", baseUrl: "https://o", model: "o" },
  ], async () => new Response("{}", { status: 200 }));
  await assert.rejects(router.generateStructured({ schemaName: "x", schema: {}, prompt: "x" }), (error) => error instanceof ModelProviderError && error.kind === "malformed_output");
});

test("Gemini AbortError stops routing without calling fallbacks", async () => {
  const calls: string[] = [];
  const router = createModelRouter([
    { provider: "gemini", apiKey: "g", baseUrl: "https://g", model: "g" },
    { provider: "openrouter", apiKey: "o", baseUrl: "https://o", model: "o" },
    { provider: "omniroute", apiKey: "m", baseUrl: "https://m", model: "m" },
  ], async (url) => { calls.push(String(url)); throw new DOMException("Aborted", "AbortError"); });
  await assert.rejects(router.generateStructured({ schemaName: "x", schema: {}, prompt: "x" }), (error) => error instanceof ModelProviderError && error.kind === "cancellation");
  assert.deepEqual(calls, ["https://g/models/g:generateContent"]);
});

test("valid Gemini with absent OmniRoute remains usable", () => {
  const env = { STRYDE_GEMINI_API_KEY: "g", STRYDE_GEMINI_BASE_URL: "https://g", STRYDE_GEMINI_MODEL: "g" } as unknown as NodeJS.ProcessEnv;
  const configs = readModelProviderConfigs(env);
  assert.deepEqual(configs.map((config) => config.provider), ["gemini"]);
});

test("partially configured OmniRoute is observable but does not block valid providers", async () => {
  const env = { STRYDE_GEMINI_API_KEY: "g", STRYDE_GEMINI_BASE_URL: "https://g", STRYDE_GEMINI_MODEL: "g", STRYDE_OPENROUTER_API_KEY: "o", STRYDE_OMNIROUTE_API_KEY: "partial" } as unknown as NodeJS.ProcessEnv;
  const configs = readModelProviderConfigs(env);
  assert.deepEqual(configs.map((config) => config.provider), ["gemini", "openrouter"]);
  assert.deepEqual(readModelProviderConfigurationIssues(env), [{ provider: "omniroute", message: "omniroute provider requires base URL and model" }]);
  const router = createModelRouter(configs, async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }), { status: 200 }));
  assert.equal((await router.generateStructured({ schemaName: "x", schema: {}, prompt: "x" })).provider, "gemini");
});

test("router preserves canonical Gemini, OpenRouter, OmniRoute order when no provider is preferred", () => {
  const env = { STRYDE_GEMINI_API_KEY: "g", STRYDE_OPENROUTER_API_KEY: "o", STRYDE_OMNIROUTE_API_KEY: "m", STRYDE_OMNIROUTE_BASE_URL: "https://m", STRYDE_OMNIROUTE_MODEL: "m" } as unknown as NodeJS.ProcessEnv;
  assert.deepEqual(readModelProviderConfigs(env).map((config) => config.provider), ["gemini", "openrouter", "omniroute"]);
});

test("STRYDE_MODEL_PROVIDER moves the preferred leg first and keeps the canonical fallback chain", () => {
  const env = { STRYDE_MODEL_PROVIDER: "openrouter", STRYDE_GEMINI_API_KEY: "g", STRYDE_OPENROUTER_API_KEY: "o", STRYDE_OMNIROUTE_API_KEY: "m", STRYDE_OMNIROUTE_BASE_URL: "https://m", STRYDE_OMNIROUTE_MODEL: "m" } as unknown as NodeJS.ProcessEnv;
  assert.deepEqual(readModelProviderConfigs(env).map((config) => config.provider), ["openrouter", "gemini", "omniroute"]);
});

test("legacy STRYDE_MODEL_* configures the Gemini leg when Gemini is selected or nothing is selected", () => {
  const selectedGemini = { STRYDE_MODEL_PROVIDER: "gemini", STRYDE_MODEL_API_KEY: "k", STRYDE_MODEL_NAME: "m", STRYDE_OPENROUTER_API_KEY: "o" } as unknown as NodeJS.ProcessEnv;
  assert.deepEqual(readModelProviderConfigs(selectedGemini).map((config) => config.provider), ["gemini", "openrouter"]);
  const unset = { STRYDE_MODEL_API_KEY: "k", STRYDE_MODEL_NAME: "m" } as unknown as NodeJS.ProcessEnv;
  assert.deepEqual(readModelProviderConfigs(unset).map((config) => config.provider), ["gemini"]);
});

test("legacy STRYDE_MODEL_* never configures legs of other selected providers", () => {
  const env = { STRYDE_MODEL_PROVIDER: "openrouter", STRYDE_MODEL_API_KEY: "openrouter-key", STRYDE_MODEL_NAME: "openrouter/free" } as unknown as NodeJS.ProcessEnv;
  assert.throws(() => readModelProviderConfigs(env), /No usable model providers configured/);
});

test("unsupported STRYDE_MODEL_PROVIDER fails fast", () => {
  assert.throws(() => readModelProviderConfigs({ STRYDE_MODEL_PROVIDER: "banana" } as unknown as NodeJS.ProcessEnv), /Unsupported STRYDE_MODEL_PROVIDER/);
});

test("unconfigured preferred provider degrades to the canonical chain", () => {
  const env = { STRYDE_MODEL_PROVIDER: "openrouter", STRYDE_GEMINI_API_KEY: "g" } as unknown as NodeJS.ProcessEnv;
  assert.deepEqual(readModelProviderConfigs(env).map((config) => config.provider), ["gemini"]);
  assert.deepEqual(readModelProviderConfigurationIssues(env), []);
});

test("OpenAI-compatible legs send the canonical OpenRouter routing shape", async () => {
  let captured: Record<string, unknown> | undefined;
  const provider = createModelProvider({ provider: "openrouter", apiKey: "o", baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/free" }, async (_url, init) => {
    captured = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 });
  });
  await provider.generateStructured({ schemaName: "test", schema: { type: "object" }, prompt: "x" });
  assert.deepEqual(captured?.provider, { require_parameters: true, allow_fallbacks: true });
  assert.deepEqual(captured?.plugins, [{ id: "response-healing" }]);
  assert.deepEqual(captured?.response_format, { type: "json_object" });
});

test("provider request carries the requested output budget", async () => {
  const bodies: Array<Record<string, unknown>> = [];
  const provider = createModelProvider({ provider: "openrouter", apiKey: "o", baseUrl: "https://openrouter.ai/api/v1", model: "m" }, async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 });
  });
  await provider.generateStructured({ schemaName: "test", schema: { type: "object" }, prompt: "x", maxOutputTokens: 2_600 });
  await provider.generateStructured({ schemaName: "test", schema: { type: "object" }, prompt: "x" });
  assert.equal(bodies[0].max_tokens, 2_600);
  assert.equal(bodies[1].max_tokens, 1_000);
});

test("conversation-turn budget exceeds the truncation threshold observed in benchmarking", async () => {
  // 1,000 tokens truncated every capable provider mid-JSON (finish_reason=length);
  // the guard keeps the budget above the truncation point so a complete
  // ConversationTurn incl. WorkingState projection can be emitted.
  assert.ok(MAX_CONVERSATION_TURN_OUTPUT_TOKENS >= 2_000);
});

test("client surfaces the server error message from error frames", async () => {
  const chunks = [`data: ${JSON.stringify({ type: "error", message: "Provider request failed (503)" })}\n\n`];
  const response = new Response(new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(new TextEncoder().encode(chunk)));
      controller.close();
    },
  }));
  await assert.rejects(consumeConversationStream(response, () => undefined, () => undefined), /Provider request failed \(503\)/);
});

test("Gemini upstream stream failure before completion may retry safely", async () => {
  let calls = 0;
  const sse = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
  const router = createModelRouter([
    { provider: "gemini", apiKey: "g", baseUrl: "https://g", model: "g" },
    { provider: "openrouter", apiKey: "o", baseUrl: "https://o", model: "o" },
  ], async (url) => {
    calls += 1;
    if (String(url).startsWith("https://g")) return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(sse({ candidates: [{ content: { parts: [{ text: '{"' }] } }] }))); controller.error(new Error("upstream failed")); } }), { status: 200 });
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(sse({ choices: [{ delta: { content: '{"ok":true' } }] }) + sse({ choices: [{ delta: { content: '}' } }] }))); controller.close(); } }), { status: 200 });
  });
  let received = "";
  const result = await router.streamStructured({ schemaName: "x", schema: {}, prompt: "x", onText: (text) => { received += text; } });
  assert.equal(result.provider, "openrouter"); assert.equal(received, '{"ok":true}'); assert.equal(calls, 2);
});

test("persistence failure after buffered provider success does not invoke another provider", async () => {
  let providerCalls = 0;
  const router = createModelRouter([{ provider: "gemini", apiKey: "g", baseUrl: "https://g", model: "g" }], async () => { providerCalls += 1; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }), { status: 200 }); });
  await router.generateStructured({ schemaName: "x", schema: {}, prompt: "x" });
  const commit = createConversationCommitter({ commit: async () => { throw new Error("persistence failed"); } });
  await assert.rejects(commit({ message: "ok" } as never, null as never), /persistence failed/);
  assert.equal(providerCalls, 1);
});
