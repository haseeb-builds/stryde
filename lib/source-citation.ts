export type SourceCitation = {
  source_content_sha256: string;
  locator: { type: "CHARACTER_RANGE"; start: number; end: number };
  excerpt: string;
  basis: "EXPLICIT_SOURCE" | "INFERRED";
};

export function buildSourceCitation(input: { content: string; contentSha256: string; statement: string; basis: string }): SourceCitation {
  const excerpt = input.statement.trim().slice(0, 4000);
  if (!input.contentSha256 || !excerpt) throw new Error("Citation requires a source hash and excerpt");
  return { source_content_sha256: input.contentSha256, locator: { type: "CHARACTER_RANGE", start: 0, end: input.content.length }, excerpt, basis: input.basis === "EXPLICIT_SOURCE" ? "EXPLICIT_SOURCE" : "INFERRED" };
}
