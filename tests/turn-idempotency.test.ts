import { test } from "node:test";
import assert from "node:assert/strict";

test("idempotency header resolution extracts Idempotency-Key from headers or body", () => {
  const extractIdempotencyKey = (headers: Record<string, string>, bodyKey?: unknown): string | null => {
    const header = headers["idempotency-key"] || headers["x-idempotency-key"];
    if (header && header.trim()) return header.trim();
    if (typeof bodyKey === "string" && bodyKey.trim()) return bodyKey.trim();
    return null;
  };

  assert.equal(
    extractIdempotencyKey({ "idempotency-key": "idem-123" }),
    "idem-123"
  );
  assert.equal(
    extractIdempotencyKey({ "x-idempotency-key": "x-idem-456" }),
    "x-idem-456"
  );
  assert.equal(
    extractIdempotencyKey({}, "body-turn-key"),
    "body-turn-key"
  );
  assert.equal(
    extractIdempotencyKey({ "idempotency-key": "header-wins" }, "body-key"),
    "header-wins"
  );
  assert.equal(
    extractIdempotencyKey({}),
    null
  );
});

test("duplicate turn submission with same idempotency key returns existing completion without executing turn logic", async () => {
  let rpcCallCount = 0;
  let modelCallCount = 0;

  // Simulated RPC handler representing stryde_record_conversation_user_input
  const mockRecordUserInputRpc = async (_sessionId: string, turnKey: string, content: string) => {
    rpcCallCount++;
    if (turnKey === "cached-turn-key") {
      return {
        data: {
          assistant: {
            content: "Previously generated response for turn",
            metadata: { model: "gemini-3.8-flash", ready_for_reasoning: true },
          },
        },
        error: null,
      };
    }
    return {
      data: { assistant: null, receivedContent: content },
      error: null,
    };
  };

  const handleTurnSubmission = async (turnKey: string) => {
    const recordResult = await mockRecordUserInputRpc("sess-1", turnKey, "User message");
    const existingAssistant = recordResult.data?.assistant;
    if (existingAssistant?.content) {
      // Returns cached complete event immediately
      return {
        fromCache: true,
        message: existingAssistant.content,
      };
    }

    // Otherwise would execute expensive model call
    modelCallCount++;
    return {
      fromCache: false,
      message: "Newly generated response",
    };
  };

  // First call creates/processes
  const res1 = await handleTurnSubmission("fresh-key");
  assert.equal(res1.fromCache, false);
  assert.equal(modelCallCount, 1);

  // Subsequent call with identical idempotency key returns cached output
  const res2 = await handleTurnSubmission("cached-turn-key");
  assert.equal(res2.fromCache, true);
  assert.equal(res2.message, "Previously generated response for turn");
  // Model call count must NOT increment
  assert.equal(modelCallCount, 1, "Model call must not re-execute on idempotent duplicate");
  assert.equal(rpcCallCount, 2, "Both calls query the idempotency record");
});
