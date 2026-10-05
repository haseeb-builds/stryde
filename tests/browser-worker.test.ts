import assert from "node:assert/strict";
import { test } from "node:test";
import { decideBrowserOutcome, isForbiddenBrowserUrl, type BrowserRun } from "../scripts/browser-worker.ts";
import { WORKER_TYPES } from "../lib/actor.ts";
import { workerToolKey, workerTypeForToolKey } from "../lib/worker-contract.ts";

function baseRun(overrides: Partial<BrowserRun> = {}): BrowserRun {
  return {
    navigated: true,
    timedOut: false,
    error: null,
    pageTitle: "Example",
    finalUrl: "https://example.com/",
    httpStatus: 200,
    textChars: 100,
    screenshotSaved: true,
    artifacts: [{ path: "page-text.txt", bytes: 100, preview: "text" }],
    ...overrides,
  };
}

test("browser outcome: timed-out run is UNKNOWN, never SUCCEEDED or FAILED", () => {
  const decision = decideBrowserOutcome(baseRun({ timedOut: true }));
  assert.equal(decision.status, "UNKNOWN");
  assert.ok(String(decision.error).includes("budget"));
});

test("browser outcome: navigation failure is FAILED with the error retained", () => {
  const decision = decideBrowserOutcome(baseRun({ navigated: false, error: "net::ERR_NAME_NOT_RESOLVED" }));
  assert.equal(decision.status, "FAILED");
  assert.match(String(decision.error), /ERR_NAME_NOT_RESOLVED/);
});

test("browser outcome: a loaded page with nothing observable is FAILED, not a silent success", () => {
  const decision = decideBrowserOutcome(baseRun({ textChars: 0, screenshotSaved: false, artifacts: [] }));
  assert.equal(decision.status, "FAILED");
  assert.match(String(decision.error), /nothing observable/);
});

test("browser outcome: real render with text and screenshot is SUCCEEDED and carries provenance", () => {
  const decision = decideBrowserOutcome(baseRun());
  assert.equal(decision.status, "SUCCEEDED");
  assert.equal(decision.error, null);
  const result = decision.result as { http_status: number; text_chars: number; artifacts: unknown[] };
  assert.equal(result.http_status, 200);
  assert.equal(result.text_chars, 100);
  assert.ok(result.artifacts.length > 0);
});

test("SSRF guard: loopback, private ranges, and non-http schemes are forbidden", () => {
  for (const url of [
    "http://localhost:9999/admin",
    "http://127.0.0.1:8080/",
    "http://10.1.2.3/",
    "http://192.168.1.10/",
    "http://172.16.0.9/",
    "http://169.254.169.254/latest/meta-data",
    "file:///C:/Windows/win.ini",
    "ftp://example.com/",
    "not a url",
  ]) {
    assert.ok(isForbiddenBrowserUrl(url), `${url} must be forbidden`);
  }
});

test("SSRF guard: public http(s) URLs are allowed", () => {
  for (const url of ["https://example.com", "http://example.com/page?q=1"]) {
    assert.equal(isForbiddenBrowserUrl(url), false, `${url} must be allowed`);
  }
});

test("BROWSER is a declared worker type with a derived, round-tripping tool key", () => {
  assert.ok((WORKER_TYPES as readonly string[]).includes("BROWSER"));
  assert.equal(workerToolKey("BROWSER"), "worker.browser");
  assert.equal(workerTypeForToolKey("worker.browser"), "BROWSER");
});
