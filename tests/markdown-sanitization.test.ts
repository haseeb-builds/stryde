import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeUrl, stripRawHtmlPreservingCode, isPrivateHost } from "../lib/sanitization.ts";

test("sanitizeUrl permits valid public http, https, and mailto links", () => {
  assert.equal(sanitizeUrl("https://stryde.dev"), "https://stryde.dev");
  assert.equal(sanitizeUrl("http://example.com/docs"), "http://example.com/docs");
  assert.equal(sanitizeUrl("mailto:support@stryde.dev"), "mailto:support@stryde.dev");
  assert.equal(sanitizeUrl("https://8.8.8.8/dns"), "https://8.8.8.8/dns");
  assert.equal(sanitizeUrl("https://1.1.1.1/"), "https://1.1.1.1/");
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

test("SSRF Defense: sanitizeUrl strictly blocks private, loopback, and metadata IPv4 vectors", () => {
  const privateIpv4s = [
    // 127.0.0.0/8 Loopback
    "http://127.0.0.1",
    "http://127.0.0.1:8080/admin",
    "http://127.127.127.127/status",
    "http://127.1",
    // 10.0.0.0/8 Private
    "http://10.0.0.1",
    "http://10.255.255.254/secret",
    // 172.16.0.0/12 Private
    "http://172.16.0.1",
    "http://172.24.1.10",
    "http://172.31.255.254",
    // 192.168.0.0/16 Private
    "http://192.168.1.1",
    "http://192.168.0.254/router",
    // 169.254.0.0/16 Link-Local & Cloud Metadata
    "http://169.254.169.254/latest/meta-data",
    "http://169.254.1.1",
    // 0.0.0.0/8 Current Network
    "http://0.0.0.0",
    "http://0.0.0.0:3000",
    // Shared Address Space / CGNAT (100.64.0.0/10)
    "http://100.64.0.1",
    "http://100.100.1.1",
    // Benchmarking (198.18.0.0/15)
    "http://198.18.0.1",
    // Multicast & Reserved
    "http://224.0.0.1",
    "http://240.0.0.1",
    "http://255.255.255.255",
  ];

  for (const url of privateIpv4s) {
    assert.equal(sanitizeUrl(url), "#", `Must block private IPv4 URL: ${url}`);
  }
});

test("SSRF Defense: sanitizeUrl strictly blocks hex, decimal, and octal IP encodings", () => {
  const encodedIps = [
    // Decimal encoding of 127.0.0.1 (2130706433)
    "http://2130706433/admin",
    // Hex encoding of 127.0.0.1 (0x7f000001)
    "http://0x7f000001/admin",
    // Hex shorthand (0x7f.1)
    "http://0x7f.1/admin",
    // Octal encoding of 127.0.0.1 (0177.0.0.1)
    "http://0177.0.0.1/admin",
    // Decimal encoding of 169.254.169.254 (2852039166)
    "http://2852039166/latest/meta-data",
    // Hex encoding of 169.254.169.254 (0xa9fea9fe)
    "http://0xa9fea9fe/latest/meta-data",
  ];

  for (const url of encodedIps) {
    assert.equal(sanitizeUrl(url), "#", `Must block encoded IP URL: ${url}`);
  }
});

test("SSRF Defense: sanitizeUrl strictly blocks IPv6 loopback, unspecified, and private vectors", () => {
  const ipv6Vectors = [
    "http://[::1]/admin",
    "http://[0:0:0:0:0:0:0:1]/status",
    "http://[::]/",
    "http://[fe80::1]/link-local",
    "http://[fc00::1]/unique-local",
    "http://[fd12:3456:789a::1]/unique-local",
    "http://[::ffff:127.0.0.1]/mapped-loopback",
    "http://[::ffff:169.254.169.254]/mapped-metadata",
    "http://[ff02::1]/multicast",
  ];

  for (const url of ipv6Vectors) {
    assert.equal(sanitizeUrl(url), "#", `Must block IPv6 URL: ${url}`);
  }
});

test("SSRF Defense: sanitizeUrl strictly blocks internal and local hostnames", () => {
  const internalHosts = [
    "http://localhost",
    "http://localhost:3000",
    "http://test.localhost/app",
    "http://metadata.google.internal/computeMetadata/v1",
    "http://kubernetes.default.svc.cluster.local",
    "http://router.local",
    "http://service.internal",
    "http://nas.lan",
    "http://database.localdomain",
    "http://printer.home.arpa",
    // Trailing-dot FQDN root-zone bypass vectors
    "http://localhost./admin",
    "http://metadata.google.internal./computeMetadata/v1",
    "http://router.local./",
    "http://127.0.0.1./admin",
  ];

  for (const url of internalHosts) {
    assert.equal(sanitizeUrl(url), "#", `Must block internal host URL: ${url}`);
  }
});

test("isPrivateHost correctly evaluates IP and hostname classifications", () => {
  assert.equal(isPrivateHost("127.0.0.1"), true);
  assert.equal(isPrivateHost("10.0.0.1"), true);
  assert.equal(isPrivateHost("172.16.0.1"), true);
  assert.equal(isPrivateHost("192.168.1.1"), true);
  assert.equal(isPrivateHost("169.254.169.254"), true);
  assert.equal(isPrivateHost("localhost"), true);
  assert.equal(isPrivateHost("app.localhost"), true);
  assert.equal(isPrivateHost("metadata.google.internal"), true);
  assert.equal(isPrivateHost("::1"), true);
  assert.equal(isPrivateHost("::"), true);
  assert.equal(isPrivateHost("fe80::1"), true);
  assert.equal(isPrivateHost("fc00::1"), true);

  // Public hosts
  assert.equal(isPrivateHost("stryde.dev"), false);
  assert.equal(isPrivateHost("example.com"), false);
  assert.equal(isPrivateHost("8.8.8.8"), false);
  assert.equal(isPrivateHost("1.1.1.1"), false);
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
