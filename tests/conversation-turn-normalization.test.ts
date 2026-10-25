import test from "node:test";
import assert from "node:assert/strict";
import { validateConversationTurn, streamConversationTurn, runConversationTurn } from "../lib/model-gateway.ts";
import { validateAdaptiveWorkingState } from "../lib/adaptive-work-controller.ts";
import { runAdaptiveWorkController } from "../lib/adaptive-model.ts";
import { validateWorkingState } from "../lib/work-controller.ts";

process.env.STRYDE_MODEL_RETRY_BASE_DELAY_MS = "0";

test("conversation turn normalizes missing options and memory candidates to empty arrays", () => {
  const turn = validateConversationTurn({
    message: "Hello",
    question: null,
    options: null,
    ready_for_reasoning: false,
    focus: null,
    input_class: "MESSAGE",
    memory_candidates: undefined,
    work: {
      version: 1,
      status: "DISCOVERING",
      objective: null,
      understanding: "u",
      known: [],
      unknowns: [],
      bottleneck: null,
      next_move: {
        mode: "ASK_USER",
        actor: "STRYDE",
        worker_type: null,
        title: "t",
        why: "w",
        expected_change: "e",
        stryde_can_do: "s",
        user_needs_to_do: "n",
        completion_condition: "c",
      },
    },
  });
  assert.deepEqual(turn.options, []);
  assert.deepEqual(turn.memory_candidates, []);
});

test("conversation turn normalizes drifted status aliases", () => {
  const turn = validateConversationTurn({
    message: "Hello",
    question: null,
    options: [],
    ready_for_reasoning: "yes" as unknown,
    focus: null,
    input_class: "NOPE",
    memory_candidates: [],
    work: {
      version: 1,
      status: "IN_PROGRESS",
      objective: null,
      understanding: "u",
      known: [],
      unknowns: [],
      bottleneck: null,
      next_move: {
        mode: "ASK_USER",
        actor: "STRYDE",
        worker_type: null,
        title: "t",
        why: "w",
        expected_change: "e",
        stryde_can_do: "s",
        user_needs_to_do: "n",
        completion_condition: "c",
      },
    },
  });
  assert.equal(turn.work.status, "WORKING");
  assert.equal(turn.ready_for_reasoning, false);
  assert.equal(turn.input_class, "MESSAGE");
});

test("second-turn CREATE_ACTION in ConversationTurn.work is accepted and normalized", () => {
  const turn = validateConversationTurn({
    message: "With 2 weeks and 1 hour a day, let's set up the landing page first.",
    question: null,
    options: [],
    ready_for_reasoning: true,
    focus: "Landing page setup",
    input_class: "MESSAGE",
    memory_candidates: [],
    work: {
      version: "1",
      status: "READY",
      objective: "Launch paid beta in 2 weeks",
      understanding: "User has 2 weeks and 1 hour per day.",
      known: ["2 weeks timeline", "1 hour/day budget"],
      unknowns: [],
      bottleneck: "No landing page yet",
      next_move: {
        mode: "create-action",
        actor: "HUMAN",
        worker_type: null,
        title: "Publish a one-page founding tier landing page",
        why: "Subscribers need a place to pre-order.",
        expected_change: "Live landing page with pre-order link",
        stryde_can_do: "Draft the page copy",
        user_needs_to_do: "Publish the page and share the link",
        completion_condition: "Landing page URL is live",
      },
    },
  });
  assert.equal(turn.work.version, 1);
  assert.equal(turn.work.status, "READY");
  assert.equal(turn.work.next_move?.mode, "CREATE_ACTION");
  assert.equal(turn.work.next_move?.actor, "HUMAN");
});

test("validateWorkingState and validateAdaptiveWorkingState slice >8 known/unknowns items instead of failing the turn", () => {
  const nineItems = Array.from({ length: 9 }, (_, index) => `Fact ${index + 1}`);
  const rawState = {
    version: "1",
    status: "completed",
    objective: "Finish launch",
    understanding: "All steps done.",
    known: nineItems,
    unknowns: nineItems,
    bottleneck: null,
    next_move: null,
  };

  const standard = validateWorkingState(rawState);
  assert.equal(standard.status, "COMPLETE");
  assert.equal(standard.known.length, 8);
  assert.equal(standard.unknowns.length, 8);

  const adaptive = validateAdaptiveWorkingState(rawState);
  assert.equal(adaptive.status, "COMPLETE");
  assert.equal(adaptive.known.length, 8);
  assert.equal(adaptive.unknowns.length, 8);
});

test("gateway and adaptive controller retry once on schema validation failure but never amplify ModelProviderError retries", async () => {
  const prevKey = process.env.STRYDE_GEMINI_API_KEY;
  const prevDisabled = process.env.STRYDE_PROVIDER_DISABLED;
  const originalFetch = globalThis.fetch;
  process.env.STRYDE_GEMINI_API_KEY = "test-gemini-key";
  process.env.STRYDE_PROVIDER_DISABLED = "openrouter,omniroute,groq";

  try {
    // 1. Provider HTTP 503 failure: router retries 3 times internally; outer gateway loop must NOT amplify to 6.
    let providerCalls = 0;
    globalThis.fetch = (async () => {
      providerCalls += 1;
      return new Response("{}", { status: 503 });
    }) as typeof fetch;

    await assert.rejects(
      () =>
        runConversationTurn({
          pursuitTitle: "Test",
          contextPacket: {},
          conversation: [],
          userMessage: "Hello",
        }),
      /Provider request failed \(503\)/,
    );
    assert.equal(providerCalls, 3, "ModelProviderError must not be retried a second time by the outer gateway loop");

    // 2. Schema validation failure on parseable JSON: retried once and recovers on attempt 2.
    let validationCalls = 0;
    const validTurnPayload = {
      message: "Recovered on second attempt",
      question: null,
      options: [],
      ready_for_reasoning: false,
      focus: null,
      input_class: "MESSAGE",
      memory_candidates: [],
      work: {
        version: 1,
        status: "READY",
        objective: "Ship",
        understanding: "Clear",
        known: ["k1"],
        unknowns: [],
        bottleneck: null,
        next_move: {
          mode: "CREATE_ACTION",
          actor: "HUMAN",
          worker_type: null,
          title: "Do step 1",
          why: "w",
          expected_change: "e",
          stryde_can_do: "s",
          user_needs_to_do: "u",
          completion_condition: "c",
        },
      },
    };

    const sse = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
    globalThis.fetch = (async () => {
      validationCalls += 1;
      const payload = validationCalls === 1 ? { message: "" } : validTurnPayload;
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                sse({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
              ),
            );
            controller.close();
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const events: string[] = [];
    const streamed = await streamConversationTurn(
      {
        pursuitTitle: "Test",
        contextPacket: {},
        conversation: [],
        userMessage: "Second turn message",
      },
      (evt) => events.push(evt.type),
    );
    assert.equal(validationCalls, 2);
    assert.equal(streamed.turn.message, "Recovered on second attempt");
    assert.equal(streamed.turn.work.next_move?.mode, "CREATE_ACTION");
    assert.deepEqual(events, ["message_delta", "complete"]);

    // 3. Adaptive work controller: ModelProviderError is not amplified, and abort signal is honored.
    let adaptiveCalls = 0;
    globalThis.fetch = (async () => {
      adaptiveCalls += 1;
      return new Response("{}", { status: 503 });
    }) as typeof fetch;

    await assert.rejects(
      () =>
        runAdaptiveWorkController({
          pursuitTitle: "Test",
          contextPacket: {},
          conversation: [],
          previousWorkingState: null,
        }),
      /Provider request failed \(503\)/,
    );
    assert.equal(adaptiveCalls, 3, "runAdaptiveWorkController must not amplify ModelProviderError retries");
  } finally {
    globalThis.fetch = originalFetch;
    if (prevKey === undefined) delete process.env.STRYDE_GEMINI_API_KEY;
    else process.env.STRYDE_GEMINI_API_KEY = prevKey;
    if (prevDisabled === undefined) delete process.env.STRYDE_PROVIDER_DISABLED;
    else process.env.STRYDE_PROVIDER_DISABLED = prevDisabled;
  }
});
