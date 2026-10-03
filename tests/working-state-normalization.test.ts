import assert from "node:assert/strict";
import test from "node:test";

// Model output is a proposal. The Gemini REST API rejects non-string enums, so
// geminiSchema() strips `enum: [1]` and `enum: [...]` before sending a schema.
// A provider can therefore return a drifted-but-recoverable status. These tests
// pin the repair boundary: tolerant on coordination fields, strict on authority.
import { normalizeWorkStatus } from "../lib/working-state-normalization.ts";

test("canonical statuses pass through unchanged", () => {
  for (const status of ["DISCOVERING", "READY", "WAITING_USER", "WORKING", "WAITING_EXTERNAL", "COMPLETE", "STALLED"]) {
    assert.equal(normalizeWorkStatus(status), status);
  }
});

test("case and separator drift is normalized", () => {
  assert.equal(normalizeWorkStatus("initial"), "DISCOVERING");
  assert.equal(normalizeWorkStatus("IN_PROGRESS"), "WORKING");
  assert.equal(normalizeWorkStatus("waiting-external"), "WAITING_EXTERNAL");
  assert.equal(normalizeWorkStatus("  Complete  "), "COMPLETE");
});

test("unknown status is not silently invented", () => {
  assert.equal(normalizeWorkStatus("teleporting"), undefined);
  assert.equal(normalizeWorkStatus(""), undefined);
  assert.equal(normalizeWorkStatus(null), undefined);
  assert.equal(normalizeWorkStatus(7), undefined);
  assert.equal(normalizeWorkStatus({}), undefined);
});

test("an unknown status never resolves to a terminal claim", () => {
  for (const bad of ["teleporting", "", null, 1]) {
    assert.notEqual(normalizeWorkStatus(bad), "COMPLETE");
    assert.notEqual(normalizeWorkStatus(bad), "VERIFIED");
  }
});
