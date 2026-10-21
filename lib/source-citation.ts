export type SourceCitation = {
  source_content_sha256: string;
  locator: { type: "CHARACTER_RANGE"; start: number; end: number; located: boolean };
  excerpt: string;
  basis: "EXPLICIT_SOURCE" | "INFERRED";
};

// The pursuit_source_citation.locator column is `jsonb not null` with no CHECK
// constraints (migrations 20260927083712 and 20260927090000), so the extra
// `located` flag is storable: true when the excerpt was actually located inside
// the stored content, false when the full-range fallback was used.
const DISTINCTIVE_LENGTH = 120;

type NormalizedContent = { text: string; starts: number[]; ends: number[] };

// Collapse whitespace runs to single spaces while keeping, for every normalized
// code unit, the original [start, end) span it covers — collapsed runs expand
// back out when a normalized match is mapped onto the original content.
function normalizeWithOffsets(content: string): NormalizedContent {
  const chars: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  let i = 0;
  while (i < content.length) {
    if (/\s/.test(content[i])) {
      const runStart = i;
      while (i < content.length && /\s/.test(content[i])) i += 1;
      chars.push(" ");
      starts.push(runStart);
      ends.push(i);
    } else {
      chars.push(content[i]);
      starts.push(i);
      ends.push(i + 1);
      i += 1;
    }
  }
  return { text: chars.join(""), starts, ends };
}

function originalRange(normalized: NormalizedContent, start: number, end: number, contentLength: number): { start: number; end: number } | null {
  if (start < 0 || start >= end || end > normalized.starts.length) return null;
  const range = { start: normalized.starts[start], end: normalized.ends[end - 1] };
  if (range.start < 0 || range.start >= range.end || range.end > contentLength) return null;
  return range;
}

// Locate the statement in the content and return its zero-based character range
// in the ORIGINAL content (the one content_sha256 refers to). Search order:
// exact normalized match, then case-insensitive, then distinctive substrings
// (first 120 normalized chars, then last 120) for statements too long to match
// verbatim. Returns null when the statement cannot be located.
export function locateStatement(content: string, statement: string): { start: number; end: number } | null {
  const normalized = normalizeWithOffsets(content);
  const statementNormalized = statement.replace(/\s+/g, " ").trim();
  if (!normalized.text || !statementNormalized) return null;

  const candidates = [statementNormalized];
  if (statementNormalized.length > DISTINCTIVE_LENGTH) {
    candidates.push(statementNormalized.slice(0, DISTINCTIVE_LENGTH), statementNormalized.slice(-DISTINCTIVE_LENGTH));
  }
  for (const candidate of candidates) {
    const exact = normalized.text.indexOf(candidate);
    if (exact >= 0) return originalRange(normalized, exact, exact + candidate.length, content.length);
    const textLower = normalized.text.toLowerCase();
    const candidateLower = candidate.toLowerCase();
    // toLowerCase can change code-unit length (e.g. U+0130); only trust the
    // lowered index when alignment with the original is preserved.
    if (textLower.length === normalized.text.length && candidateLower.length === candidate.length) {
      const lowered = textLower.indexOf(candidateLower);
      if (lowered >= 0) return originalRange(normalized, lowered, lowered + candidate.length, content.length);
    }
  }
  return null;
}

export function findSupportingPassage(
  content: string,
  statement: string
): { start: number; end: number; excerpt: string } | null {
  const range = locateStatement(content, statement);
  if (!range) return null;
  return {
    start: range.start,
    end: range.end,
    excerpt: content.slice(range.start, range.end),
  };
}

export function findSupportingSource<T extends { id: string; content_text: string | null; content_sha256: string | null }>(
  sources: T[],
  statement: string
): { source: T; passage: { start: number; end: number; excerpt: string } } | null {
  const trimmed = statement.trim();
  if (!trimmed) return null;
  for (const source of sources) {
    if (!source.content_text || !source.content_sha256) continue;
    const passage = findSupportingPassage(source.content_text, trimmed);
    if (passage) {
      return { source, passage };
    }
  }
  return null;
}

export function buildSourceCitation(input: { content: string; contentSha256: string; statement: string; basis: string }): SourceCitation {
  if (!input.contentSha256 || !input.statement.trim()) throw new Error("Citation requires a source hash and excerpt");
  // Honest fallback: an unlocatable statement keeps the full-range locator
  // (located: false); the caller-provided basis is model provenance and is
  // never rewritten here.
  const range = locateStatement(input.content, input.statement);
  const locator = range
    ? { type: "CHARACTER_RANGE" as const, start: range.start, end: range.end, located: true }
    : { type: "CHARACTER_RANGE" as const, start: 0, end: input.content.length, located: false };
  const excerpt = range
    ? input.content.slice(range.start, range.end)
    : input.statement.trim().slice(0, 4000);
  return { source_content_sha256: input.contentSha256, locator, excerpt, basis: input.basis === "EXPLICIT_SOURCE" ? "EXPLICIT_SOURCE" : "INFERRED" };
}

export type PursuitSourceCitationInsert = {
  owner_user_id: string;
  pursuit_id: string;
  source_id: string;
  adaptation_id?: string | null;
  source_content_sha256: string;
  locator: {
    type: "CHARACTER_RANGE" | "CONTENT_LOCATOR" | string;
    start?: number;
    end?: number;
    located?: boolean;
    claim_text?: string;
    content_locator?: string;
    [key: string]: unknown;
  };
  excerpt: string;
  basis: "EXPLICIT_SOURCE" | "INFERRED";
  claim_text?: string;
};

export function validatePursuitSourceCitationRow(row: unknown): PursuitSourceCitationInsert {
  if (typeof row !== "object" || row === null) throw new Error("Citation payload must be an object");
  const r = row as Record<string, unknown>;

  // Check required NOT NULL fields per PostgreSQL schema
  if (typeof r.owner_user_id !== "string" || !r.owner_user_id.trim()) {
    throw new Error("Citation requires non-empty owner_user_id");
  }
  if (typeof r.pursuit_id !== "string" || !r.pursuit_id.trim()) {
    throw new Error("Citation requires non-empty pursuit_id");
  }
  if (typeof r.source_id !== "string" || !r.source_id.trim()) {
    throw new Error("Citation requires non-empty source_id");
  }
  if (typeof r.source_content_sha256 !== "string" || !r.source_content_sha256.trim()) {
    throw new Error("Citation requires non-empty source_content_sha256");
  }
  if (typeof r.locator !== "object" || r.locator === null || Array.isArray(r.locator)) {
    throw new Error("Citation requires jsonb object locator");
  }
  if (typeof r.excerpt !== "string" || !r.excerpt.trim()) {
    throw new Error("Citation requires non-empty excerpt");
  }
  if (r.basis !== "EXPLICIT_SOURCE" && r.basis !== "INFERRED") {
    throw new Error("Citation basis must be EXPLICIT_SOURCE or INFERRED");
  }

  // Reject legacy incompatible column names that caused defect R-1
  if ("quote" in r) throw new Error("quote is invalid: schema column is excerpt");
  if ("content_sha256" in r) throw new Error("content_sha256 is invalid: schema column is source_content_sha256");
  if ("locator_type" in r) throw new Error("locator_type is not a column on pursuit_source_citation");
  if ("exact_match" in r) throw new Error("exact_match is not a column on pursuit_source_citation");
  if ("verification_status" in r) throw new Error("verification_status is not a column on pursuit_source_citation");
  if ("metadata" in r) throw new Error("metadata is not a column on pursuit_source_citation");

  return r as PursuitSourceCitationInsert;
}
