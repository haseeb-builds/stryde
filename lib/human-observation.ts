import { getModelRouter } from "./model-provider.ts";

export type HumanObservation = {
  summary: string;
  what_happened: string;
  evidence: string[];
  user_claims: string[];
  uncertainties: string[];
  blockers: string[];
  implications: string[];
  suggested_follow_up: string | null;
};

const MAX_TEXT = 2_000;
const MAX_ITEMS = 8;

export const HUMAN_OBSERVATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "what_happened",
    "evidence",
    "user_claims",
    "uncertainties",
    "blockers",
    "implications",
    "suggested_follow_up",
  ],
  properties: {
    summary: { type: "string", minLength: 1, maxLength: MAX_TEXT },
    what_happened: { type: "string", minLength: 1, maxLength: MAX_TEXT },
    evidence: {
      type: "array",
      maxItems: MAX_ITEMS,
      items: { type: "string", minLength: 1, maxLength: MAX_TEXT },
    },
    user_claims: {
      type: "array",
      maxItems: MAX_ITEMS,
      items: { type: "string", minLength: 1, maxLength: MAX_TEXT },
    },
    uncertainties: {
      type: "array",
      maxItems: MAX_ITEMS,
      items: { type: "string", minLength: 1, maxLength: MAX_TEXT },
    },
    blockers: {
      type: "array",
      maxItems: MAX_ITEMS,
      items: { type: "string", minLength: 1, maxLength: MAX_TEXT },
    },
    implications: {
      type: "array",
      maxItems: MAX_ITEMS,
      items: { type: "string", minLength: 1, maxLength: MAX_TEXT },
    },
    suggested_follow_up: {
      anyOf: [{ type: "string", maxLength: MAX_TEXT }, { type: "null" }],
    },
  },
} as const;

function text(value: unknown, field: string, max = MAX_TEXT): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} must be non-empty`);
  if (normalized.length > max) throw new Error(`${field} is too long`);
  return normalized;
}

function optionalText(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`${field} must be a string or null`);
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > MAX_TEXT) throw new Error(`${field} is too long`);
  return normalized;
}

function list(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) throw new Error(`${field} must be an array`);
  return value.map((item, index) => text(item, `${field}[${index}]`));
}

export function validateHumanObservation(value: unknown): HumanObservation {
  if (typeof value !== "object" || value === null) throw new Error("Human observation must be an object");
  const candidate = value as Record<string, unknown>;
  return {
    summary: text(candidate.summary, "summary"),
    what_happened: text(candidate.what_happened, "what_happened"),
    evidence: list(candidate.evidence, "evidence"),
    user_claims: list(candidate.user_claims, "user_claims"),
    uncertainties: list(candidate.uncertainties, "uncertainties"),
    blockers: list(candidate.blockers, "blockers"),
    implications: list(candidate.implications, "implications"),
    suggested_follow_up: optionalText(candidate.suggested_follow_up, "suggested_follow_up"),
  };
}

export function fallbackHumanObservation(input: {
  report: string;
  terminalStatus: "COMPLETED" | "FAILED" | "CANCELLED";
}): HumanObservation {
  const statusText =
    input.terminalStatus === "COMPLETED"
      ? "The user marked the human Action completed."
      : input.terminalStatus === "FAILED"
        ? "The user marked the human Action unsuccessful."
        : "The user marked the human Action cancelled.";

  return {
    summary: input.report,
    what_happened: `${statusText} ${input.report}`,
    evidence: [input.report],
    user_claims: [],
    uncertainties: ["Stryde could not run the structured interpretation for this report."],
    blockers: input.terminalStatus === "FAILED" ? [input.report] : [],
    implications: [],
    suggested_follow_up: null,
  };
}

export async function interpretHumanActionReport(input: {
  pursuitTitle: string;
  actionSummary: string;
  terminalStatus: "COMPLETED" | "FAILED" | "CANCELLED";
  report: string;
  situation: unknown;
  conversation: Array<{ role: "user" | "stryde"; content: string }>;
}): Promise<{ observation: HumanObservation; provider: string; model: string }> {
  const prompt = [
    "You are Stryde's Human Action Report Interpreter.",
    "The user has just returned from real-world work and described what happened in natural language.",
    "Turn the report into a provenance-preserving observation proposal that Stryde can reason over.",
    "The report is USER_REPORTED evidence. Never call anything independently verified.",
    "Do not invent people, counts, dates, outcomes, commitments, measurements, causes, or consensus.",
    "Keep direct observations separate from what the user claims or believes.",
    "Unclear statements belong in uncertainties, not facts.",
    "A failed action is still useful evidence; preserve what was learned rather than treating failure as zero information.",
    "Implications are planning hypotheses only. They are not canonical Decisions or Claims.",
    "Suggested follow-up should be non-empty only when a missing detail materially changes what Stryde should do next.",
    "Return JSON only matching the HumanObservation contract.",
    "",
    `PURSUIT_TITLE: ${input.pursuitTitle}`,
    `ACTION: ${input.actionSummary}`,
    `TERMINAL_STATUS: ${input.terminalStatus}`,
    `REPORT: ${input.report}`,
    `CURRENT_SITUATION: ${JSON.stringify(input.situation)}`,
    `RECENT_CONVERSATION: ${JSON.stringify(input.conversation.slice(-12))}`,
  ].join("\n");

  // Route through the full provider chain; fallback and disabled-provider
  // rules live inside the model boundary.
  const result = await getModelRouter().generateStructured({
    schemaName: "stryde_human_action_observation",
    schema: HUMAN_OBSERVATION_SCHEMA,
    prompt,
    maxOutputTokens: 2_200,
  });

  return {
    observation: validateHumanObservation(result.parsed),
    provider: result.provider,
    model: result.model,
  };
}
