import assert from "node:assert/strict";
import test from "node:test";

import { buildSourceCitation } from "../lib/source-citation.ts";

function locate(content: string, statement: string) {
  const citation = buildSourceCitation({ content, contentSha256: "hash-locator", statement, basis: "EXPLICIT_SOURCE" });
  assert.equal(citation.locator.type, "CHARACTER_RANGE");
  assert.equal(citation.locator.located, true);
  assert.ok(Number.isInteger(citation.locator.start) && Number.isInteger(citation.locator.end), "locator offsets must be integers");
  assert.ok(citation.locator.start >= 0 && citation.locator.start < citation.locator.end, `range must satisfy 0 <= start < end, got ${citation.locator.start}..${citation.locator.end}`);
  assert.ok(citation.locator.end <= content.length, `range end ${citation.locator.end} must stay within content length ${content.length}`);
  return citation.locator;
}

test("exact substring is located and the range slices to the statement", () => {
  const content = "The quick brown fox jumps over the lazy dog.";
  const locator = locate(content, "brown fox");
  assert.deepEqual(locator, { type: "CHARACTER_RANGE", start: 10, end: 19, located: true });
  assert.equal(content.slice(locator.start, locator.end), "brown fox");
});

test("whitespace and case differences still locate, mapped back to original offsets", () => {
  const content = "Report body.\n\n  RUNNER   STRIDE  length mattered here.";
  const locator = locate(content, "runner  stride");
  const found = content.slice(locator.start, locator.end);
  assert.match(found, /^RUNNER\s+STRIDE$/);
  assert.ok(!found.includes("\n"), "collapsed newlines must not leak into the original range");
  assert.ok(locator.start > 0 && locator.end <= content.length);
});

test("long statements fall back to their distinctive last window", () => {
  const head = "Unrelated preamble about training load, periodization, and shoe geometry that never appears in the source document at all. ";
  const tail = "the cooldown protocol must be logged within ten minutes of finishing the session and the recovery notes must be archived for review by the coaching staff before the next block begins";
  assert.ok(tail.replace(/\s+/g, " ").length >= 120, "tail must exceed the distinctive window on its own");
  const statement = head + tail;
  const content = "Session notes: " + tail + ". Additional context.";
  const locator = locate(content, statement);
  assert.equal(content.slice(locator.start, locator.end), tail.slice(-120));
});

test("long statements fall back to their distinctive first window", () => {
  const head = "the warmup protocol must be logged before any interval work begins and each rep noted with its cadence and perceived effort for later review";
  const tail = "Unrelated epilogue about gear closets and race calendars.";
  assert.ok(head.replace(/\s+/g, " ").length >= 120, "head must exceed the distinctive window on its own");
  const statement = head + ". " + tail;
  const content = "Coach handbook: " + head + ". See appendix.";
  const locator = locate(content, statement);
  assert.equal(content.slice(locator.start, locator.end), statement.slice(0, 120));
});

test("unlocatable statements keep the full-range fallback with located false", () => {
  const content = "Alpha beta gamma.";
  const citation = buildSourceCitation({ content, contentSha256: "hash-locator", statement: "totally absent phrase", basis: "EXPLICIT_SOURCE" });
  assert.deepEqual(citation.locator, { type: "CHARACTER_RANGE", start: 0, end: content.length, located: false });
});

test("empty statement still throws", () => {
  assert.throws(() => buildSourceCitation({ content: "some content", contentSha256: "hash-locator", statement: "   ", basis: "EXPLICIT_SOURCE" }), /source hash and excerpt/);
  assert.throws(() => buildSourceCitation({ content: "some content", contentSha256: "", statement: "some statement", basis: "EXPLICIT_SOURCE" }), /source hash and excerpt/);
});

test("hash, excerpt, and basis passthrough are unchanged by locating", () => {
  const explicit = buildSourceCitation({ content: "before TARGET after", contentSha256: "hash-x", statement: "  TARGET  ", basis: "EXPLICIT_SOURCE" });
  assert.equal(explicit.source_content_sha256, "hash-x");
  assert.equal(explicit.excerpt, "TARGET");
  assert.equal(explicit.basis, "EXPLICIT_SOURCE");
  const inferred = buildSourceCitation({ content: "before TARGET after", contentSha256: "hash-y", statement: "TARGET", basis: "INFERRED" });
  assert.equal(inferred.basis, "INFERRED");
  assert.equal(buildSourceCitation({ content: "before TARGET after", contentSha256: "hash-z", statement: "TARGET", basis: "something-else" }).basis, "INFERRED");
});

test("research-shaped case: an extracted page locates its highlight", () => {
  const content = "Example Domain\n\nThis domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.\n\nMore information...";
  const locator = locate(content, "Example Domain");
  assert.equal(locator.start, 0);
  assert.equal(content.slice(locator.start, locator.end), "Example Domain");
});
