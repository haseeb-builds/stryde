import { inflateSync } from "node:zlib";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;

const TEXT_FILE_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".csv", ".json", ".log"]);

export type FileExtractionStatus = "EXACT" | "PARTIAL" | "UNSUPPORTED";

export type FileSourceExtraction = {
  text: string;
  extraction: FileExtractionStatus;
  notes?: string;
};

function fileExtension(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

function isTextLikeSource(filename: string, mimeType: string) {
  return (
    TEXT_FILE_EXTENSIONS.has(fileExtension(filename)) ||
    mimeType.startsWith("text/") ||
    mimeType === "application/json"
  );
}

const PDF_ESCAPE_CHARS: Record<string, string> = {
  n: "\n",
  r: "\r",
  t: "\t",
  b: "\b",
  f: "\f",
  "(": "(",
  ")": ")",
  "\\": "\\",
};

// Reads a PDF literal string "(...)" starting at `start`, handling escapes,
// octal codes, and balanced nested parentheses. Returns null when unterminated.
function readLiteralString(content: string, start: number): { value: string; next: number } | null {
  let i = start + 1;
  let value = "";
  let depth = 1;
  while (i < content.length) {
    const ch = content[i];
    if (ch === "\\") {
      const next = content[i + 1];
      if (next === undefined) return null;
      if (next >= "0" && next <= "7") {
        let octal = "";
        let j = i + 1;
        while (j < content.length && octal.length < 3 && content[j] >= "0" && content[j] <= "7") {
          octal += content[j];
          j += 1;
        }
        value += String.fromCharCode(parseInt(octal, 8));
        i = j;
        continue;
      }
      value += PDF_ESCAPE_CHARS[next] ?? next;
      i += 2;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) return { value, next: i + 1 };
    }
    value += ch;
    i += 1;
  }
  return null;
}

// Reads a PDF hex string "<...>" starting at `start`.
function readHexString(content: string, start: number): { value: string; next: number } | null {
  const close = content.indexOf(">", start + 1);
  if (close === -1) return null;
  const hex = content.slice(start + 1, close).replace(/[^0-9a-fA-F]/g, "");
  const padded = hex.length % 2 ? hex + "0" : hex;
  let value = "";
  for (let i = 0; i < padded.length; i += 2) {
    value += String.fromCharCode(parseInt(padded.slice(i, i + 2), 16));
  }
  return { value, next: close + 1 };
}

function followsShowOperator(content: string, pos: number, operator: RegExp) {
  return operator.test(content.slice(pos, pos + 8));
}

// Collects the string operands inside a TJ array; kerning splits within a word
// are rejoined without separators.
function collectArrayStrings(segment: string): string {
  let value = "";
  let i = 0;
  while (i < segment.length) {
    const ch = segment[i];
    if (ch === "(") {
      const literal = readLiteralString(segment, i);
      if (!literal) break;
      value += literal.value;
      i = literal.next;
    } else if (ch === "<") {
      if (segment[i + 1] === "<") {
        i += 2;
        continue;
      }
      const hex = readHexString(segment, i);
      if (!hex) break;
      value += hex.value;
      i = hex.next;
    } else {
      i += 1;
    }
  }
  return value;
}

// Finds the "]" closing a TJ array while skipping over literal strings, so a
// "]" inside string content is not mistaken for the array terminator.
function findArrayEnd(content: string, start: number): number {
  let i = start;
  let depth = 0;
  while (i < content.length) {
    const ch = content[i];
    if (ch === "(") {
      const literal = readLiteralString(content, i);
      if (!literal) return -1;
      i = literal.next;
    } else if (ch === "[") {
      depth += 1;
      i += 1;
    } else if (ch === "]") {
      if (depth === 0) return i;
      depth -= 1;
      i += 1;
    } else {
      i += 1;
    }
  }
  return -1;
}

// Pulls the text shown by Tj / TJ / ' / " operators out of one decoded PDF
// content stream. Show operations are joined with spaces, then normalized.
function extractShownText(content: string): string {
  const pieces: string[] = [];
  let i = 0;
  while (i < content.length) {
    const ch = content[i];
    if (ch === "(") {
      const literal = readLiteralString(content, i);
      if (!literal) {
        i += 1;
        continue;
      }
      if (followsShowOperator(content, literal.next, /^\s*(?:Tj|TJ|'|")/)) pieces.push(literal.value);
      i = literal.next;
    } else if (ch === "<") {
      if (content[i + 1] === "<") {
        i += 2;
        continue;
      }
      const hex = readHexString(content, i);
      if (!hex) {
        i += 1;
        continue;
      }
      if (followsShowOperator(content, hex.next, /^\s*(?:Tj|TJ|'|")/)) pieces.push(hex.value);
      i = hex.next;
    } else if (ch === "[") {
      const close = findArrayEnd(content, i + 1);
      if (close === -1) {
        i += 1;
        continue;
      }
      if (followsShowOperator(content, close + 1, /^\s*TJ/)) {
        const value = collectArrayStrings(content.slice(i + 1, close));
        if (value) pieces.push(value);
      }
      i = close + 1;
    } else {
      i += 1;
    }
  }
  return pieces.join(" ");
}

function extractPdfSourceText(buffer: Buffer): FileSourceExtraction {
  const raw = buffer.toString("latin1");
  if (raw.includes("/Encrypt")) {
    return {
      text: "",
      extraction: "UNSUPPORTED",
      notes: "Stryde cannot read encrypted PDFs yet.",
    };
  }

  const pieces: string[] = [];
  const streamKeyword = /(?<!end)stream(?:\r\n|\n|\r)/g;
  let match: RegExpExecArray | null;
  while ((match = streamKeyword.exec(raw)) !== null) {
    const dataStart = match.index + match[0].length;
    const dataEnd = raw.indexOf("endstream", dataStart);
    if (dataEnd === -1) continue;
    const data = raw.slice(dataStart, dataEnd).replace(/\r$/, "");

    let content = "";
    if (/\/FlateDecode/.test(raw.slice(Math.max(0, match.index - 800), match.index))) {
      try {
        content = inflateSync(Buffer.from(data, "latin1")).toString("latin1");
      } catch {
        continue;
      }
    } else {
      content = data;
    }

    const shown = extractShownText(content);
    if (shown) pieces.push(shown);
  }

  const text = pieces.join(" ").replace(/\s+/g, " ").trim();
  if (!text) {
    return {
      text: "",
      extraction: "UNSUPPORTED",
      notes: "Stryde could not extract text from this PDF; it may be scanned images or use text encoding Stryde cannot read yet.",
    };
  }
  return {
    text,
    extraction: "PARTIAL",
    notes: "Text was recovered from the PDF with a minimal extractor; structure and some characters may be lost.",
  };
}

export function extractFileSourceText(input: { filename: string; mimeType: string; buffer: Buffer }): FileSourceExtraction {
  if (input.buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("File is larger than the 10 MB source limit");
  }

  if (isTextLikeSource(input.filename, input.mimeType)) {
    let text = input.buffer.toString("utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    if (text.length > MAX_TEXT_CHARS) {
      return {
        text: text.slice(0, MAX_TEXT_CHARS),
        extraction: "PARTIAL",
        notes: "Truncated to the first 200,000 characters.",
      };
    }
    return { text, extraction: "EXACT" };
  }

  if (fileExtension(input.filename) === ".pdf" || input.mimeType === "application/pdf") {
    return extractPdfSourceText(input.buffer);
  }

  return {
    text: "",
    extraction: "UNSUPPORTED",
    notes: "Stryde can currently read text files (.txt, .md, .markdown, .csv, .json, .log) and PDFs. This file type is not supported yet.",
  };
}
