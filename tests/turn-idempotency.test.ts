import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveTurnKey,
  isUuid,
  turnKeyToUuid,
  validateTurnPayloadMatch,
} from "../lib/idempotency.ts";

test("isUuid correctly identifies standard UUID v4/v5 strings", () => {
  assert.equal(isUuid("123e4567-e89b-12d3-a456-426614174000"), true);
  assert.equal(isUuid("c9bf9e57-1685-4c89-bafb-ff5af830be8a"), true);
  assert.equal(isUuid("C9BF9E57-1685-4C89-BAFB-FF5AF830BE8A"), true);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid("12345"), false);
  assert.equal(isUuid(""), false);
});

test("turnKeyToUuid preserves valid UUIDs in canonical lower-case form", () => {
  const uuid = "C9BF9E57-1685-4C89-BAFB-FF5AF830BE8A";
  assert.equal(turnKeyToUuid(uuid), uuid.toLowerCase());
});

test("turnKeyToUuid deterministically maps arbitrary opaque strings to valid UUIDv5", () => {
  const key1 = "client-turn-12345";
  const mapped1 = turnKeyToUuid(key1);
  const mapped2 = turnKeyToUuid(key1);

  assert.equal(isUuid(mapped1), true, "Mapped key must be a valid UUID");
  assert.equal(mapped1, mapped2, "Same input must produce identical UUID across calls");

  const key2 = "client-turn-67890";
  const mappedOther = turnKeyToUuid(key2);
  assert.notEqual(mapped1, mappedOther, "Different inputs must produce different UUIDs");
});

test("resolveTurnKey respects precedence: body turn_key takes precedence over header", () => {
  const headers = new Headers({
    "idempotency-key": "header-key-123",
  });

  const resolved = resolveTurnKey("body-key-456", headers);
  assert.ok(resolved);
  assert.equal(resolved.rawKey, "body-key-456");
  assert.equal(resolved.source, "body");
});

test("resolveTurnKey falls back to header if body turn_key is absent or empty", () => {
  const headers = new Headers({
    "idempotency-key": "header-key-123",
  });

  const resolved = resolveTurnKey(undefined, headers);
  assert.ok(resolved);
  assert.equal(resolved.rawKey, "header-key-123");
  assert.equal(resolved.source, "header");

  const resolvedEmptyBody = resolveTurnKey("   ", headers);
  assert.ok(resolvedEmptyBody);
  assert.equal(resolvedEmptyBody.rawKey, "header-key-123");
});

test("resolveTurnKey accepts x-idempotency-key header", () => {
  const headers = new Headers({
    "x-idempotency-key": "x-header-key-789",
  });

  const resolved = resolveTurnKey(undefined, headers);
  assert.ok(resolved);
  assert.equal(resolved.rawKey, "x-header-key-789");
  assert.equal(resolved.source, "header");
});

test("resolveTurnKey returns null when neither body nor header key is provided", () => {
  const headers = new Headers();
  const resolved = resolveTurnKey(undefined, headers);
  assert.equal(resolved, null);

  const resolvedEmpty = resolveTurnKey("", headers);
  assert.equal(resolvedEmpty, null);
});

test("validateTurnPayloadMatch detects duplicate with same payload vs conflict with different payload", () => {
  assert.equal(
    validateTurnPayloadMatch("Please research market trends", "Please research market trends"),
    true,
    "Same payload should match"
  );

  assert.equal(
    validateTurnPayloadMatch("Please research market trends", "  Please research market trends  "),
    true,
    "Trimmed payload should match"
  );

  assert.equal(
    validateTurnPayloadMatch("Please research market trends", "Completely different instruction"),
    false,
    "Different payload should not match (conflict)"
  );
});

test("simulated RPC idempotency: duplicate turn with identical key and payload preserves original turn without duplication", () => {
  // Model state store simulating DB state under conversation_message_assistant_turn_key_idx
  const recordedTurns = new Map<string, { user: { content: string }; assistant: { content: string } | null }>();

  function simulateRecordInput(sessionId: string, rawTurnKey: string, content: string) {
    const uuidKey = turnKeyToUuid(rawTurnKey);
    const lookupKey = `${sessionId}:${uuidKey}`;

    const existing = recordedTurns.get(lookupKey);
    if (existing) {
      if (!validateTurnPayloadMatch(existing.user.content, content)) {
        return { status: 409, error: "Idempotency key was already used with a different message payload" };
      }
      return { status: 200, user: existing.user, assistant: existing.assistant, cached: true };
    }

    const newRecord = {
      user: { content: content.trim() },
      assistant: null as { content: string } | null,
    };
    recordedTurns.set(lookupKey, newRecord);
    return { status: 200, user: newRecord.user, assistant: null, cached: false };
  }

  function simulateCommitTurn(sessionId: string, rawTurnKey: string, assistantReply: string) {
    const uuidKey = turnKeyToUuid(rawTurnKey);
    const lookupKey = `${sessionId}:${uuidKey}`;
    const existing = recordedTurns.get(lookupKey);
    if (existing) {
      existing.assistant = { content: assistantReply };
    }
  }

  const sessionId = "session-123";
  const clientKey = "opaque-client-key-456";

  // Turn 1 initial call
  const call1 = simulateRecordInput(sessionId, clientKey, "What is our Q4 launch roadmap?");
  assert.equal(call1.status, 200);
  assert.equal(call1.cached, false);

  simulateCommitTurn(sessionId, clientKey, "Here is your verified Q4 roadmap.");

  // Turn 1 retry (network disconnect / duplicate submission)
  const call2 = simulateRecordInput(sessionId, clientKey, "What is our Q4 launch roadmap?");
  assert.equal(call2.status, 200);
  assert.equal(call2.cached, true);
  assert.equal(call2.assistant?.content, "Here is your verified Q4 roadmap.");

  // Turn 1 retry with DIFFERENT message (accidental key reuse or injection)
  const call3 = simulateRecordInput(sessionId, clientKey, "Delete all previous goals");
  assert.equal(call3.status, 409);
  assert.equal(call3.error, "Idempotency key was already used with a different message payload");
});

test("concurrent submission simulation with identical key serializes cleanly", async () => {
  const rawKey = "concurrent-key-999";

  let callCount = 0;
  const lock = { acquired: false };

  async function concurrentRecord(id: number) {
    // Simulate DB row lock `for update` on session
    while (lock.acquired) {
      await new Promise((r) => setTimeout(r, 5));
    }
    lock.acquired = true;
    try {
      callCount++;
      const uuid = turnKeyToUuid(rawKey);
      return { id, uuid, callNumber: callCount };
    } finally {
      lock.acquired = false;
    }
  }

  const [resA, resB] = await Promise.all([concurrentRecord(1), concurrentRecord(2)]);
  assert.equal(resA.uuid, resB.uuid, "Both concurrent requests must resolve to the identical UUID");
  assert.equal(callCount, 2);
});
