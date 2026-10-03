import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

// The ConversationTurn contract has seven required fields. The streaming path
// requested the full budget; the non-streaming path silently took the generic
// 1,000-token default, so providers truncated the reply and validation failed.
// The two paths must never diverge again: a product that behaves differently
// depending on which path served the request is not the same product.
const source = readFileSync(path.join(import.meta.dirname, "..", "lib", "model-gateway.ts"), "utf8");

test("the non-streaming conversation turn requests the full output budget", () => {
  const budgetMatch = source.match(/MAX_CONVERSATION_TURN_OUTPUT_TOKENS\s*=\s*([\d_]+)/);
  assert.ok(budgetMatch, "MAX_CONVERSATION_TURN_OUTPUT_TOKENS must be declared");
  const budget = Number(budgetMatch![1].replace(/_/g, ""));
  assert.ok(budget >= 2_000, `conversation turn budget ${budget} is too small for the seven-field contract`);

  const calls = [...source.matchAll(/callStructuredModel\(\s*"stryde_conversation_turn"[^)]*\)/g)];
  assert.equal(calls.length, 1, "expected exactly one non-streaming conversation turn call");
  assert.match(
    calls[0]![0],
    /MAX_CONVERSATION_TURN_OUTPUT_TOKENS/,
    "the non-streaming conversation turn must pass MAX_CONVERSATION_TURN_OUTPUT_TOKENS explicitly, not rely on the default",
  );
});

test("both conversation-turn paths declare the same budget", () => {
  assert.match(source, /streamStructured\(\{[^}]*maxOutputTokens:\s*MAX_CONVERSATION_TURN_OUTPUT_TOKENS/);
  assert.match(source, /callStructuredModel\("stryde_conversation_turn"[^)]*MAX_CONVERSATION_TURN_OUTPUT_TOKENS/);
});

test("an empty provider completion is retryable rather than fatal", () => {
  // A routed provider returning no content is transient. Treating it as fatal
  // ended the user's turn on a single empty reply.
  const provider = readFileSync(path.join(import.meta.dirname, "..", "lib", "model-provider.ts"), "utf8");
  const match = provider.match(/Provider returned no text output",\s*(true|false)\)/);
  assert.ok(match, "empty-output error not found");
  assert.equal(match![1], "true", "an empty completion must be retryable");
});
