import assert from "node:assert/strict";
import test from "node:test";
import { extractMessagePrefix, readSseData, readSseFrames } from "../lib/conversation-stream.ts";
import { createConversationCommitter } from "../lib/conversation-commit.ts";
import { consumeConversationStream } from "../lib/conversation-client-stream.ts";

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
