import assert from "node:assert/strict";
import test from "node:test";
import { createModelRouter, type ModelProviderConfig } from "../lib/model-provider.ts";

process.env.STRYDE_MODEL_RETRY_BASE_DELAY_MS = "0";

const config: ModelProviderConfig = { provider: "gemini", apiKey: "key", baseUrl: "https://gemini.test/v1beta", model: "test-model" };
const schema = { type: "OBJECT", properties: { status: { type: "STRING" } }, required: ["status"] };
const input = { schemaName: "probe", schema, prompt: "Return JSON" };
const okOpenAi = () => new Response(JSON.stringify({ choices: [{ message: { content: '{"status":"ok"}' } }] }), { status: 200 });
const okEnvelope = { candidates: [{ content: { parts: [{ text: '{"status":"ok"}' }] } }] };

const okResponse = () => new Response(JSON.stringify(okEnvelope), { status: 200 });

test("router retries a retryable 503 within one provider before falling through", async () => {
  let calls = 0;
  const router = createModelRouter([config], async () => { calls++; return calls <= 2 ? new Response('{"error":{"code":503}}', { status: 503 }) : okResponse(); });
  const result = await router.generateStructured(input);
  assert.equal(calls, 3);
  assert.deepEqual(result.parsed, { status: "ok" });
  assert.equal(result.provider, "gemini");
});

test("router falls through to the next provider only after retry budget is exhausted", async () => {
  let geminiCalls = 0;
  const fallback: ModelProviderConfig = { provider: "omniroute", apiKey: "key", baseUrl: "https://omni.test/v1", model: "auto" };
  let omniCalls = 0;
  const router = createModelRouter([config, fallback], async (_url, init) => {
    if ((init?.headers as Record<string, string>)?.["x-goog-api-key"] !== undefined) { geminiCalls++; return new Response('{"error":{}}', { status: 503 }); }
    omniCalls++;
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"status":"fallback"}' } }] }), { status: 200 });
  });
  const result = await router.generateStructured(input);
  assert.equal(geminiCalls, 3);
  assert.equal(omniCalls, 1);
  assert.deepEqual(result.parsed, { status: "fallback" });
});

test("non-retryable failures are not retried and abort the chain", async () => {
  let calls = 0;
  const fallback: ModelProviderConfig = { provider: "omniroute", apiKey: "key", baseUrl: "https://omni.test/v1", model: "auto" };
  const router = createModelRouter([config, fallback], async (_url, init) => {
    if ((init?.headers as Record<string, string>)?.["x-goog-api-key"]) { calls++; return new Response('{"error":{}}', { status: 401 }); }
    calls += 100;
    return okOpenAi();
  });
  await assert.rejects(router.generateStructured(input), /failed \(401\)/);
  assert.equal(calls, 1);
});

test("429 rate limits are retried and fall through to fallback provider", async () => {
  let geminiCalls = 0;
  let omniCalls = 0;
  const fallback: ModelProviderConfig = { provider: "omniroute", apiKey: "key", baseUrl: "https://omni.test/v1", model: "auto" };
  const router = createModelRouter([config, fallback], async (_url, init) => {
    if ((init?.headers as Record<string, string>)?.["x-goog-api-key"] !== undefined) {
      geminiCalls++;
      return new Response('{"error":{"code":429,"message":"Resource exhausted"}}', { status: 429 });
    }
    omniCalls++;
    return okOpenAi();
  });
  const result = await router.generateStructured(input);
  assert.equal(geminiCalls, 3, "Primary provider should be retried 3 times on 429");
  assert.equal(omniCalls, 1, "Fallback provider should be invoked after primary 429 exhaustion");
  assert.deepEqual(result.parsed, { status: "ok" });
  assert.equal(result.provider, "omniroute");
});

test("malformed JSON output is retried and falls through to fallback provider", async () => {
  let geminiCalls = 0;
  let omniCalls = 0;
  const fallback: ModelProviderConfig = { provider: "omniroute", apiKey: "key", baseUrl: "https://omni.test/v1", model: "auto" };
  const router = createModelRouter([config, fallback], async (_url, init) => {
    if ((init?.headers as Record<string, string>)?.["x-goog-api-key"] !== undefined) {
      geminiCalls++;
      // Return 200 OK with unparseable text
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "not-json-content-here" }] } }] }), { status: 200 });
    }
    omniCalls++;
    return okOpenAi();
  });
  const result = await router.generateStructured(input);
  assert.equal(geminiCalls, 3, "Primary provider should be retried 3 times on malformed output");
  assert.equal(omniCalls, 1, "Fallback provider should serve request after primary malformed output");
  assert.deepEqual(result.parsed, { status: "ok" });
  assert.equal(result.provider, "omniroute");
});

test("cancellation aborts immediately without retrying or falling through", async () => {
  let geminiCalls = 0;
  let omniCalls = 0;
  const controller = new AbortController();
  controller.abort();
  const fallback: ModelProviderConfig = { provider: "omniroute", apiKey: "key", baseUrl: "https://omni.test/v1", model: "auto" };
  const router = createModelRouter([config, fallback], async (_url, init) => {
    if ((init?.headers as Record<string, string>)?.["x-goog-api-key"] !== undefined) {
      geminiCalls++;
    } else {
      omniCalls++;
    }
    const domEx = new DOMException("The operation was aborted", "AbortError");
    throw domEx;
  });
  await assert.rejects(
    router.generateStructured({ ...input, signal: controller.signal }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      return err.message.includes("Aborted") || err.name === "AbortError";
    }
  );
  assert.equal(geminiCalls, 1, "Cancelled request must fail on first attempt without retrying");
  assert.equal(omniCalls, 0, "Cancelled request must NOT fall through to fallback provider");
});

test("router rejects oversized input prompt before network dispatch", async () => {
  let calls = 0;
  const router = createModelRouter([config], async () => { calls++; return okResponse(); });
  const oversizedPrompt = "A".repeat(150_000);
  await assert.rejects(
    router.generateStructured({ ...input, prompt: oversizedPrompt }),
    /Assembled prompt exceeds maximum allowed size/
  );
  assert.equal(calls, 0, "No network request should be dispatched for oversized prompt");
});
