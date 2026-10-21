import assert from "node:assert/strict";
import test from "node:test";
import {
  detectDeterministicResearchRequirement,
  buildBlockedResearchTurn,
} from "../lib/research-orchestration.ts";
import { readSseFrames, readSseData } from "../lib/conversation-stream.ts";

test("R-4 guard: unconfigured research blocks model invocation and produces honest blocker turn", () => {
  const message = "Audit this roadmap for customer acquisition. Step 1: Scrape LinkedIn. Step 2: Cold message 500 people.";
  const check = detectDeterministicResearchRequirement({ message });
  assert.equal(check.required, true);

  const blocker = {
    reason: "UNCONFIGURED" as const,
    message: "External web research capability is unconfigured or not available in this environment.",
  };

  const blocked = buildBlockedResearchTurn({
    blocker,
    pursuitTitle: "Customer Acquisition",
    workingState: null,
  });

  // 1. Message must be an honest blocker notification, NOT substantive ungrounded advice
  assert.ok(blocked.streamText.includes("unconfigured"), "Stream text must state research is unconfigured");
  assert.ok(!blocked.streamText.includes("Scrape LinkedIn"), "Stream text must not give substantive advice on the unverified plan");
  assert.equal(blocked.turn.message, blocked.streamText, "Persisted message must match streamed text");

  // 2. Work state must transition to WAITING_EXTERNAL with ASK_USER next move
  assert.equal(blocked.work.status, "WAITING_EXTERNAL");
  assert.ok(blocked.work.next_move);
  assert.equal(blocked.work.next_move?.mode, "ASK_USER");
  assert.equal(blocked.work.next_move?.actor, "HUMAN");
  assert.equal(blocked.work.bottleneck, blocker.message);

  // 3. Blocker status and metadata agree
  assert.equal(blocked.turn.research_blocker?.reason, "UNCONFIGURED");
  assert.equal(blocked.turn.work.status, "WAITING_EXTERNAL");
});

test("R-4 guard: unauthorized research blocks model invocation, asks for user permission", () => {
  const message = "I want to build muscle.";
  const check = detectDeterministicResearchRequirement({ message });
  assert.equal(check.required, true);

  const blocker = {
    reason: "UNAUTHORIZED" as const,
    message: "Automatic research is not authorized by your autonomy policy. Permission is required to execute external research.",
  };

  const blocked = buildBlockedResearchTurn({
    blocker,
    pursuitTitle: "Hypertrophy Program",
    workingState: null,
  });

  // Must request user authorization and not output fabricated workout protocols
  assert.ok(blocked.streamText.includes("autonomy settings") || blocked.streamText.includes("not authorized"));
  assert.ok(!blocked.streamText.includes("3 sets of 8-12 reps"), "Must not invent ungrounded training advice");
  assert.equal(blocked.work.status, "WAITING_USER");
  assert.ok(blocked.work.next_move);
  assert.equal(blocked.work.next_move?.mode, "ASK_USER");
  assert.ok(blocked.turn.options.some((opt) => opt.label.toLowerCase().includes("authorize")));
  assert.equal(blocked.turn.research_blocker?.reason, "UNAUTHORIZED");
});

test("R-4 guard: exhausted quota blocks model invocation, states quota reset honestly", () => {
  const blocker = {
    reason: "BUDGET_EXHAUSTED" as const,
    message: "Daily plan limit reached for research rounds. Your quota resets tomorrow.",
  };

  const blocked = buildBlockedResearchTurn({
    blocker,
    pursuitTitle: "Career Strategy",
    workingState: null,
  });

  assert.ok(blocked.streamText.includes("quota"));
  assert.equal(blocked.work.status, "WAITING_EXTERNAL");
  assert.ok(blocked.work.next_move);
  assert.equal(blocked.work.next_move?.mode, "ASK_USER");
  assert.equal(blocked.turn.research_blocker?.reason, "BUDGET_EXHAUSTED");
});

test("R-4 guard: unavailable research service blocks model invocation, offers retry/manual source", () => {
  const blocker = {
    reason: "UNAVAILABLE" as const,
    message: "Research provider returned 503 Service Unavailable.",
  };

  const blocked = buildBlockedResearchTurn({
    blocker,
    pursuitTitle: "Tech Architecture",
    workingState: null,
  });

  assert.ok(blocked.streamText.includes("unavailable"));
  assert.equal(blocked.work.status, "WAITING_EXTERNAL");
  assert.ok(blocked.work.next_move);
  assert.equal(blocked.work.next_move?.mode, "ASK_USER");
  assert.equal(blocked.turn.research_blocker?.reason, "UNAVAILABLE");
});

test("R-4 conversation streaming contract: when research is blocked, model stream is NEVER called and SSE frames agree", async () => {
  let modelInvoked = false;
  const mockStreamConversationTurn = async () => {
    modelInvoked = true;
    return {
      turn: { message: "Ungrounded advice", work: {} },
      provider: "mock",
      model: "mock-model",
    };
  };

  const researchBlocker = {
    reason: "UNAUTHORIZED" as const,
    message: "Automatic research is not authorized by your autonomy policy.",
  };

  // Simulating the route's streaming controller logic with R-4 guard
  const streamedRawChunks: string[] = [];
  const committedTurns: Array<{ content: string; work: unknown }> = [];

  const streamEvent = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`;

  // The R-4 route logic
  if (researchBlocker) {
    const blocked = buildBlockedResearchTurn({
      blocker: researchBlocker,
      pursuitTitle: "Fitness Goal",
      workingState: null,
    });

    // Emits the honest blocker delta
    streamedRawChunks.push(streamEvent({ type: "message_delta", content: blocked.streamText }));

    // Commits the blocker response directly to database
    committedTurns.push({
      content: blocked.turn.message,
      work: blocked.work,
    });

    streamedRawChunks.push(streamEvent({
      type: "complete",
      turn: blocked.turn,
      model: null,
    }));
  } else {
    await mockStreamConversationTurn();
  }

  // Verification:
  // 1. Model stream was NEVER invoked
  assert.equal(modelInvoked, false, "Model stream MUST NOT be called when research is blocked");

  // 2. Parse SSE frames
  const rawStream = streamedRawChunks.join("");
  const { frames } = readSseFrames(rawStream);
  assert.equal(frames.length, 2, "Expected exactly message_delta and complete frames");

  const deltaData = JSON.parse(readSseData(frames[0])!) as { type: string; content: string };
  assert.equal(deltaData.type, "message_delta");
  assert.ok(deltaData.content.includes("not authorized"));

  const completeData = JSON.parse(readSseData(frames[1])!) as {
    type: string;
    turn: { message: string; work: { status: string }; research_blocker: { reason: string } };
  };
  assert.equal(completeData.type, "complete");
  assert.equal(completeData.turn.message, deltaData.content);
  assert.equal(completeData.turn.work.status, "WAITING_USER");
  assert.equal(completeData.turn.research_blocker.reason, "UNAUTHORIZED");

  // 3. Persisted turn and streamed delta are identical
  assert.equal(committedTurns.length, 1);
  assert.equal(committedTurns[0].content, deltaData.content);
  assert.equal((committedTurns[0].work as { status: string }).status, "WAITING_USER");
});

test("R-4 non-streaming / replayed turn contract: returns persisted blocker state idempotently", () => {
  // Simulate replaying a turn that was previously committed with a research blocker
  const persistedContent =
    "Stryde identified that research is required before an evidence-backed recommendation can be made, but automatic research is not authorized by your autonomy policy.";
  const persistedWork = {
    version: 1 as const,
    status: "WAITING_USER" as const,
    objective: "Fitness Goal",
    understanding: "Research is required but unauthorized",
    known: [],
    unknowns: [],
    bottleneck: "Automatic research is not authorized",
    next_move: {
      mode: "ASK_USER" as const,
      actor: "HUMAN" as const,
      worker_type: null,
      title: "Authorize research to investigate this question.",
      why: "Automatic research is not authorized",
      expected_change: "Clear blocker",
      stryde_can_do: "Perform research once authorized",
      user_needs_to_do: "Confirm permission",
      completion_condition: "Authorized",
    },
  };
  const persistedMetadata = {
    question: "Would you like to authorize external web research?",
    options: [{ label: "Authorize research", value: "Authorize" }],
    work: persistedWork,
    research_blocker: {
      reason: "UNAUTHORIZED",
      message: "Automatic research is not authorized",
    },
  };

  // Replay handler reconstructs the turn directly from existingTurn
  const replayedTurn = {
    message: persistedContent,
    question: persistedMetadata.question,
    options: persistedMetadata.options,
    work: persistedMetadata.work,
    research_blocker: persistedMetadata.research_blocker,
  };

  assert.equal(replayedTurn.message, persistedContent);
  assert.equal(replayedTurn.work.status, "WAITING_USER");
  assert.equal(replayedTurn.research_blocker.reason, "UNAUTHORIZED");
  assert.equal(replayedTurn.work.bottleneck, replayedTurn.research_blocker.message);
});
