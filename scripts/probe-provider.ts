// Independent per-provider verification against the real ConversationTurn contract.
//
// Usage: npm run probe:provider -- gemini | omniroute [prompt]
//
// Requires the target provider's canonical env vars (STRYDE_<PROVIDER>_API_KEY,
// optionally STRYDE_<PROVIDER>_BASE_URL / _MODEL) to be present in .env.local.
// The run excludes every provider except the requested one by neutralizing the
// disabled list, so a single success/failure answer is attributed to exactly
// that provider. No mocks: this hits the provider's real HTTP endpoint with the
// verbatim conversation-turn prompt, schema, and the 2,600-token output budget.
import assert from "node:assert/strict";

type Json = Record<string, unknown>;

const envPath = new URL("../.env.local", import.meta.url);
const fileEnv = Object.fromEntries(
  (await import("node:fs")).readFileSync(envPath, "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
for (const [k, v] of Object.entries(fileEnv)) if (!(k in process.env)) process.env[k] = v;

const target = (process.argv[2] ?? "").trim().toLowerCase();
if (target !== "gemini" && target !== "omniroute") {
  console.error("Usage: npm run probe:provider -- gemini | omniroute");
  process.exit(1);
}

const KEY = process.env[`STRYDE_${target.toUpperCase()}_API_KEY`]?.trim();
if (!KEY) {
  console.log(`SKIP: STRYDE_${target.toUpperCase()}_API_KEY is not configured; ${target} cannot be probed live.`);
  process.exit(0);
}

// Isolate the target provider: prefer it, disable everything else.
process.env.STRYDE_MODEL_PROVIDER = target;
process.env.STRYDE_PROVIDER_DISABLED = ["gemini", "openrouter", "omniroute", "groq"].filter((p) => p !== target).join(",");

const { readModelProviderConfigs } = await import("../lib/model-provider.ts");
const configs = readModelProviderConfigs();
assert.equal(configs.length, 1, `expected exactly the ${target} leg, got ${configs.map((c) => c.provider).join(",")}`);
assert.equal(configs[0].provider, target);
console.log(`Probe target: ${target} (model ${configs[0].model}, base ${configs[0].baseUrl})`);

const { runConversationTurn, runWorkController } = await import("../lib/model-gateway.ts");

const situation = {
  pursuit: { title: "Two-week system design interview preparation" },
  objective: "Be ready for a system design interview in two weeks with one hour of preparation per day.",
  constraints: ["One hour per day", "Two weeks until the interview"],
  evidence: ["User has not started preparing", "Interview covers distributed systems fundamentals"],
};
const conversation = [
  { role: "user" as const, content: "I have a system design interview in two weeks, one hour a day, and I have not started yet." },
];

let passed = 0;
function ok(name: string, detail: string) { passed += 1; console.log(`  ✔ ${name}${detail ? ` — ${detail}` : ""}`); }

// 1. ConversationTurn contract against the real provider.
const turnStart = Date.now();
const turn = await runConversationTurn({
  pursuitTitle: "Probe: conversation turn",
  situation,
  conversation,
  userMessage: "Help me turn this into a concrete plan.",
});
const turnMs = Date.now() - turnStart;
assert.ok(typeof turn.turn.message === "string" && turn.turn.message.trim().length > 0, "turn.message missing");
ok("runConversationTurn: real provider, schema-valid ConversationTurn", `${turn.provider}/${turn.model}, ${turnMs}ms, message ${turn.turn.message.length} chars`);

// 2. Working-state contract against the same provider (the /work boundary).
const workStart = Date.now();
const work = await runWorkController({
  pursuitTitle: "Probe: work controller",
  situation,
  conversation: [...conversation, { role: "stryde" as const, content: turn.turn.message }],
  previousWorkingState: null,
});
const workMs = Date.now() - workStart;
assert.ok(work.workingState && typeof work.workingState.status === "string", "workingState.status missing");
ok("runWorkController: schema-valid WorkingState", `${work.provider}/${work.model}, ${workMs}ms, status ${work.workingState.status}`);

console.log(`\nPROVIDER PROBE PASSED: ${target} served ${passed} contract calls.`);
console.log(JSON.stringify({ provider: target, conversation_turn: { model: turn.model, ms: turnMs }, work_controller: { model: work.model, ms: workMs } } as Json));
