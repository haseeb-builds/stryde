import { test } from "node:test";
import assert from "node:assert/strict";
import { createModelProvider, ModelProviderError } from "../lib/model-provider.ts";

test("createModelProvider propagates abort signal and aborts upstream fetch", async () => {
  const abortController = new AbortController();
  let fetchAborted = false;

  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    return new Promise<Response>((_, reject) => {
      const signal = init?.signal;
      if (signal) {
        if (signal.aborted) {
          fetchAborted = true;
          reject(new DOMException("The operation was aborted", "AbortError"));
          return;
        }
        signal.addEventListener("abort", () => {
          fetchAborted = true;
          reject(new DOMException("The operation was aborted", "AbortError"));
        });
      }
    });
  };

  const provider = createModelProvider(
    {
      provider: "openrouter",
      apiKey: "test-key",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "test-model",
    },
    mockFetch as typeof fetch
  );

  const generatePromise = provider.generateStructured({
    schemaName: "test_schema",
    schema: { type: "object" },
    prompt: "Hello world",
    maxOutputTokens: 500,
    signal: abortController.signal,
  });

  // Trigger abort immediately while request is pending
  abortController.abort();

  await assert.rejects(
    async () => await generatePromise,
    (err: unknown) => {
      assert.ok(err instanceof ModelProviderError);
      assert.equal(err.kind, "cancellation");
      assert.equal(err.message, "Aborted");
      return true;
    }
  );

  assert.equal(fetchAborted, true, "Upstream fetch signal must have received abort event");
});

test("createModelProvider enforces explicit max_tokens on upstream request body", async () => {
  const holder = { body: null as { max_tokens?: number } | null };

  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    holder.body = JSON.parse(init?.body as string) as { max_tokens?: number };
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ result: "ok" }) } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const provider = createModelProvider(
    {
      provider: "openrouter",
      apiKey: "test-key",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "test-model",
    },
    mockFetch as typeof fetch
  );

  await provider.generateStructured({
    schemaName: "test_schema",
    schema: { type: "object" },
    prompt: "Hello world",
    maxOutputTokens: 1234,
  });

  assert.ok(holder.body !== null);
  assert.equal(holder.body?.max_tokens, 1234, "max_tokens in request body must match maxOutputTokens");
});
