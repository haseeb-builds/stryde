import { validateModelProposal, type ModelProposal } from "@/lib/orchestration";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";
const MAX_OUTPUT_CHARS = 20_000;

type ModelGatewayResult = {
  proposal: ModelProposal;
  provider: string;
  model: string;
};

const MODEL_PROPOSAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "understanding", "diagnosis", "intervention", "proposed_response"],
  properties: {
    path: { type: "string", enum: ["CLEAR", "UNCLEAR"] },
    understanding: { type: "string", minLength: 1, maxLength: 8000 },
    diagnosis: { type: ["string", "null"], maxLength: 8000 },
    intervention: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["kind", "rationale"],
      properties: {
        kind: {
          type: "string",
          enum: ["ANSWER", "DECISION", "HUMAN_ACTION", "CONTROLLED_ACTION", "WAIT"],
        },
        rationale: { type: "string", minLength: 1, maxLength: 8000 },
      },
    },
    proposed_response: { type: ["string", "null"], maxLength: 8000 },
  },
} as const;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing model configuration: ${name}`);
  return value;
}

function extractResponseText(response: unknown): string {
  if (typeof response !== "object" || response === null) {
    throw new Error("Model returned an invalid response envelope");
  }

  const candidate = response as { output?: unknown };
  if (!Array.isArray(candidate.output)) {
    throw new Error("Model response is missing output");
  }

  const chunks: string[] = [];
  for (const item of candidate.output) {
    if (typeof item !== "object" || item === null) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) chunks.push(text);
    }
  }

  const text = chunks.join("\n").trim();
  if (!text) throw new Error("Model returned no text output");
  if (text.length > MAX_OUTPUT_CHARS) throw new Error("Model output exceeded the allowed size");
  return text;
}

export async function runModelProposal(prompt: string): Promise<ModelGatewayResult> {
  const provider = (process.env.STRYDE_MODEL_PROVIDER ?? "openai").trim().toLowerCase();
  if (provider !== "openai") {
    throw new Error(`Unsupported STRYDE_MODEL_PROVIDER: ${provider}`);
  }

  const apiKey = (process.env.STRYDE_MODEL_API_KEY ?? process.env.OPENAI_API_KEY)?.trim();
  if (!apiKey) throw new Error("Missing model configuration: STRYDE_MODEL_API_KEY");

  const baseUrl = (process.env.STRYDE_MODEL_BASE_URL ?? DEFAULT_OPENAI_BASE_URL).replace(/\/$/, "");
  const model = (process.env.STRYDE_MODEL_NAME ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL).trim();
  if (!model) throw new Error("Missing model configuration: STRYDE_MODEL_NAME");

  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "stryde_model_proposal",
          strict: true,
          schema: MODEL_PROPOSAL_SCHEMA,
        },
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    throw new Error(`Model request failed (${response.status}): ${detail}`);
  }

  const envelope: unknown = await response.json();
  const text = extractResponseText(envelope);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Model returned non-JSON proposal text");
  }

  return { proposal: validateModelProposal(parsed), provider, model };
}
