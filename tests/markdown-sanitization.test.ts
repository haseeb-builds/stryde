import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeUrl, stripRawHtml } from "../lib/sanitization.ts";

test("sanitizeUrl accepts valid http, https, mailto, and relative paths", () => {
  assert.equal(sanitizeUrl("https://example.com/docs"), "https://example.com/docs");
  assert.equal(sanitizeUrl("http://localhost:3000"), "http://localhost:3000");
  assert.equal(sanitizeUrl("mailto:support@stryde.dev"), "mailto:support@stryde.dev");
  assert.equal(sanitizeUrl("/pursuits/123"), "/pursuits/123");
  assert.equal(sanitizeUrl("#section-1"), "#section-1");
});

test("sanitizeUrl blocks javascript:, data:, vbscript:, and protocol-relative URLs", () => {
  assert.equal(sanitizeUrl("javascript:alert(1)"), "#");
  assert.equal(sanitizeUrl("JavaScript:alert(document.cookie)"), "#");
  assert.equal(sanitizeUrl("  javascript:evil()  "), "#");
  assert.equal(sanitizeUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="), "#");
  assert.equal(sanitizeUrl("vbscript:msgbox(1)"), "#");
  assert.equal(sanitizeUrl("//malicious.com/phish"), "#");
  assert.equal(sanitizeUrl("jav\tascript:alert(1)"), "#");
});

test("stripRawHtml removes HTML tags from markdown strings", () => {
  const dirty = 'Hello <script>alert("xss")</script> <b>world</b> <img src="x" onerror="evil()" />';
  const cleaned = stripRawHtml(dirty);
  assert.equal(cleaned, "Hello  world ");
  assert.ok(!cleaned.includes("<script>"));
  assert.ok(!cleaned.includes("<img"));
  assert.ok(!cleaned.includes("<b>"));
});
