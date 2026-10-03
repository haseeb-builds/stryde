import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync } from "node:zlib";
import { extractFileSourceText } from "../lib/file-source-extraction.ts";

function buildPdf(contentStream: string, options: { flate?: boolean; encrypted?: boolean } = {}) {
  const streamData = options.flate
    ? deflateSync(Buffer.from(contentStream, "latin1"))
    : Buffer.from(contentStream, "latin1");
  const header = "%PDF-1.4\n" + (options.encrypted ? "/Encrypt 9 0 R\n" : "");
  const dictionary =
    "4 0 obj\n<< /Length " + streamData.length + (options.flate ? " /Filter /FlateDecode" : "") + " >>\nstream\n";
  return Buffer.concat([
    Buffer.from(header + dictionary, "latin1"),
    streamData,
    Buffer.from("\nendstream\nendobj\n%%EOF\n", "latin1"),
  ]);
}

test("text files decode exactly and a UTF-8 BOM is stripped", () => {
  const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("Hello Stryde", "utf8")]);
  const bomResult = extractFileSourceText({ filename: "notes.txt", mimeType: "text/plain", buffer: withBom });
  assert.equal(bomResult.extraction, "EXACT");
  assert.equal(bomResult.text, "Hello Stryde");

  const plain = extractFileSourceText({ filename: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("plain", "utf8") });
  assert.equal(plain.extraction, "EXACT");
  assert.equal(plain.text, "plain");
});

test("markdown, csv, and json files extract exactly", () => {
  const markdown = extractFileSourceText({ filename: "plan.md", mimeType: "text/markdown", buffer: Buffer.from("# Plan\n- step one", "utf8") });
  assert.equal(markdown.extraction, "EXACT");
  assert.equal(markdown.text, "# Plan\n- step one");

  const csv = extractFileSourceText({ filename: "data.csv", mimeType: "text/csv", buffer: Buffer.from("a,b\n1,2", "utf8") });
  assert.equal(csv.extraction, "EXACT");

  const json = extractFileSourceText({ filename: "data.json", mimeType: "application/json", buffer: Buffer.from('{"goal":"run"}', "utf8") });
  assert.equal(json.extraction, "EXACT");
  assert.equal(json.text, '{"goal":"run"}');
});

test("very large text is truncated to 200,000 characters and labeled PARTIAL", () => {
  const buffer = Buffer.from("a".repeat(200_500), "utf8");
  const result = extractFileSourceText({ filename: "big.log", mimeType: "text/plain", buffer });
  assert.equal(result.extraction, "PARTIAL");
  assert.equal(result.text.length, 200_000);
  assert.ok(result.notes && /truncated/i.test(result.notes));
});

test("unsupported file types report UNSUPPORTED with an honest note", () => {
  const result = extractFileSourceText({ filename: "photo.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50]) });
  assert.equal(result.extraction, "UNSUPPORTED");
  assert.equal(result.text, "");
  assert.ok(result.notes && /not supported/i.test(result.notes));
});

test("buffers over 10 MB are rejected up front", () => {
  const buffer = Buffer.alloc(10 * 1024 * 1024 + 1, 0x61);
  assert.throws(() => extractFileSourceText({ filename: "huge.txt", mimeType: "text/plain", buffer }), /10 MB/);
});

test("a minimal flate-compressed PDF yields its shown text as PARTIAL", () => {
  const pdf = buildPdf("BT /F1 12 Tf (Hello Stryde) Tj ET", { flate: true });
  const result = extractFileSourceText({ filename: "report.pdf", mimeType: "application/pdf", buffer: pdf });
  assert.equal(result.extraction, "PARTIAL");
  assert.ok(result.text.includes("Hello Stryde"));
});

test("PDF text is recovered from TJ arrays and unfiltered streams", () => {
  const flateArray = extractFileSourceText({
    filename: "report.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf("BT /F1 12 Tf [(Hello) -120 ( Stryde)] TJ ET", { flate: true }),
  });
  assert.ok(flateArray.text.includes("Hello Stryde"));

  const plain = extractFileSourceText({
    filename: "report.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf("BT /F1 12 Tf (Plain Stryde) Tj ET", {}),
  });
  assert.ok(plain.text.includes("Plain Stryde"));
});

test("encrypted PDFs report UNSUPPORTED instead of pretending", () => {
  const result = extractFileSourceText({
    filename: "locked.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf("BT (Hidden Stryde) Tj ET", { flate: true, encrypted: true }),
  });
  assert.equal(result.extraction, "UNSUPPORTED");
  assert.equal(result.text, "");
  assert.ok(result.notes && /encrypt/i.test(result.notes));
});
