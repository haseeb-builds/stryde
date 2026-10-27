import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeUrl, stripRawHtmlPreservingCode } from "../lib/sanitization.ts";

test("sanitizeUrl permits valid http, https, and mailto links", () => {
  assert.equal(sanitizeUrl("https://stryde.dev"), "https://stryde.dev");
  assert.equal(sanitizeUrl("http://example.com/docs"), "http://example.com/docs");
  assert.equal(sanitizeUrl("mailto:support@stryde.dev"), "mailto:support@stryde.dev");
});

test("sanitizeUrl permits valid relative paths and anchor links", () => {
  assert.equal(sanitizeUrl("/pursuits/123"), "/pursuits/123");
  assert.equal(sanitizeUrl("/dashboard?tab=active"), "/dashboard?tab=active");
  assert.equal(sanitizeUrl("#section-1"), "#section-1");
});

test("sanitizeUrl rejects protocol-relative links (//attacker.example)", () => {
  assert.equal(sanitizeUrl("//attacker.example"), "#");
  assert.equal(sanitizeUrl("///attacker.example"), "#");
});

test("sanitizeUrl rejects backslash protocol-relative variants (/\\attacker.example)", () => {
  assert.equal(sanitizeUrl("/\\attacker.example"), "#");
  assert.equal(sanitizeUrl("/\\/attacker.example"), "#");
  assert.equal(sanitizeUrl("/\\\\attacker.example"), "#");
  assert.equal(sanitizeUrl("\\\\attacker.example"), "#");
});

test("sanitizeUrl rejects dangerous schemes (javascript, data, vbscript)", () => {
  assert.equal(sanitizeUrl("javascript:alert(document.cookie)"), "#");
  assert.equal(sanitizeUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="), "#");
  assert.equal(sanitizeUrl("vbscript:msgbox(1)"), "#");
  assert.equal(sanitizeUrl("jav\tascript:alert(1)"), "#");
  assert.equal(sanitizeUrl("java\0script:alert(1)"), "#");
});

test("stripRawHtmlPreservingCode strips dangerous HTML tags outside code fences while preserving code blocks", () => {
  const input = [
    "Here is a paragraph with <script>alert('xss')</script> bad script.",
    "",
    "```html",
    "<div class=\"container\">",
    "  <p>Hello world</p>",
    "</div>",
    "```",
    "",
    "Another tag: <img src=\"x\" onerror=\"alert(1)\">.",
    "And inline code: `<span>preserve me</span>`.",
  ].join("\n");

  const output = stripRawHtmlPreservingCode(input);

  // Raw <script> outside code is stripped
  assert.ok(!output.includes("<script>alert"), "Script outside code block should be stripped");
  assert.ok(!output.includes("<img"), "Img tag outside code block should be stripped");

  // Code block is intact
  assert.ok(output.includes("<div class=\"container\">"), "HTML inside code block must be preserved");
  assert.ok(output.includes("<p>Hello world</p>"), "HTML inside code block must be preserved");
  assert.ok(output.includes("`<span>preserve me</span>`"), "HTML inside inline code must be preserved");
});
