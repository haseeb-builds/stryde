// Proves that an MCP tool call executes for real through Stryde's CONTROLLED
// plane: the dispatcher drives the real MCP worker, which starts the real
// stub MCP server over stdio (initialize -> tools/list -> tools/call), and
// the echoed content is judged as artifact text. A successful tool call is
// recorded as a CONTROLLED_EXECUTION observation and never auto-verifies.
//
// Requires: a dev server on BASE_URL and a Supabase runtime with the
// worker.mcp tool registered (local stack with all migrations).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(repoRoot, ".env.local"), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
for (const [k, v] of Object.entries(env)) if (!(k in process.env)) process.env[k] = v;

const { createClient } = await import("@supabase/supabase-js");
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const BASE_URL = (process.env.BASE_URL ?? "http://127.0.0.1:3100").replace(/\/$/, "");
type Json = Record<string, unknown>;

let passed = 0;
const ok = (name: string) => { passed += 1; console.log(`  \u2713 ${name}`); };

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const signed = await anon.auth.signInWithPassword({ email: env.STRYDE_TEST_USER_EMAIL, password: env.STRYDE_TEST_USER_PASSWORD });
assert.ok(signed.data.session, `sign-in failed: ${JSON.stringify(signed.error)}`);
const bearer = signed.data.session.access_token;
const userId = signed.data.user.id;
ok("signed in as real user");

async function api(p: string, method: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${p}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
    ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  const text = await res.text();
  return { status: res.status, json: (text ? JSON.parse(text) : {}) as Json };
}

const { data: policyBefore } = await service.from("user_autonomy_policy")
  .select("allow_worker_delegation, allowed_worker_types, auto_execute_research")
  .eq("owner_user_id", userId).maybeSingle();
let policyChanged = false;
if (policyBefore && !(policyBefore.allow_worker_delegation && (policyBefore.allowed_worker_types as string[]).includes("MCP"))) {
  const allowed = new Set<string>((policyBefore.allowed_worker_types as string[]) ?? []);
  allowed.add("MCP");
  await service.from("user_autonomy_policy")
    .update({ allow_worker_delegation: true, allowed_worker_types: [...allowed] })
    .eq("owner_user_id", userId);
  policyChanged = true;
  console.log("  ... temporarily widened the autonomy policy to allow MCP delegation");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const created = await api("/api/v1/pursuits", "POST", { title: `E2E MCP WORKER ${stamp}` });
assert.equal(created.status, 201, `pursuit create failed: ${JSON.stringify(created.json)}`);
const pursuitId = (created.json.pursuit as Json).id as string;
const sessionRes = await api(`/api/v1/pursuits/${pursuitId}/conversations`, "POST", { title: "mcp worker" });
assert.equal(sessionRes.status, 201, `session create failed: ${JSON.stringify(sessionRes.json)}`);
const sessionId = ((sessionRes.json.session as Json | undefined)?.id) as string;
ok("pursuit and conversation created through the authenticated API");

const ECHO_MESSAGE = `MCP TRANSPORT PROOF ${randomUUID().slice(0, 8)}`;
const workerMove = {
  version: 1,
  status: "WORKING",
  objective: "Prove an MCP tool call executes through the CONTROLLED plane.",
  understanding: "MCP is capability transport; the echo tool is the reference capability.",
  known: ["The MCP worker performs one tool call per job."],
  unknowns: ["Whether the transport round-trips real tool content."],
  bottleneck: "No MCP tool call has ever run through the plane.",
  next_move: {
    mode: "EXECUTE_TOOL",
    actor: "WORKER",
    worker_type: "MCP",
    title: `Call the echo tool on the reference MCP server with message: ${ECHO_MESSAGE}`,
    why: "A round-tripped tool result is the honest proof of the transport.",
    expected_change: "The tool result contains the echoed message.",
    stryde_can_do: "Read the artifact back and judge it against the completion condition.",
    user_needs_to_do: "Nothing; this is an internal capability check.",
    completion_condition: `The tool result contains ECHO: ${ECHO_MESSAGE}`,
    tool_call: {
      server: "reference",
      tool: "echo",
      arguments: { message: ECHO_MESSAGE },
    },
  },
};
const seed = await service.from("conversation_session")
  .update({ working_state: workerMove, updated_at: new Date().toISOString() })
  .eq("id", sessionId).eq("owner_user_id", userId);
assert.ok(!seed.error, `seeding working_state failed: ${seed.error?.message}`);
ok("MCP next move seeded");

const delegated = await api(`/api/v1/pursuits/${pursuitId}/actions/delegate-worker`, "POST", { session_id: sessionId, approved: true });
assert.equal(delegated.status, 201, `delegation failed: ${JSON.stringify(delegated.json)}`);
const jobId = (delegated.json.job as Json).id as string;
const actionId = (delegated.json.action as Json).id as string;
ok("approved delegation committed a real CONTROLLED job");

const { data: mcpTool } = await service.from("tool")
  .select("id, tool_key, tool_version").eq("tool_key", "worker.mcp").eq("tool_version", "v1").maybeSingle();
assert.ok(mcpTool, "worker.mcp tool is not registered");
const { data: jobRow } = await service.from("job").select("tool_id").eq("id", jobId).maybeSingle();
assert.equal(jobRow?.tool_id, mcpTool!.id, "job must run through the worker.mcp tool");
ok("job is bound to the worker.mcp tool");

// Spawn the real MCP worker with the real stub MCP server configured.
const { spawn } = await import("node:child_process");
const workerPort = Number(new URL(process.env.STRYDE_MCP_URL ?? "http://127.0.0.1:8895").port || 8895);
const workerUrl = `http://127.0.0.1:${workerPort}`;
const workerToken = process.env.STRYDE_MCP_TOKEN?.trim() || `e2e-${randomUUID()}`;
const authedProbe = (headers: Record<string, string>) =>
  fetch(`${workerUrl}/work/__probe__`, { headers }).then((r) => r.status).catch(() => 0);
const alreadyListening = await authedProbe({ Authorization: `Bearer ${workerToken}` });
assert.ok(!alreadyListening, `port ${workerPort} is already in use; free it so this suite can manage its own worker`);

const workerChild = spawn(process.execPath, ["--experimental-strip-types", "scripts/mcp-worker.ts"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    STRYDE_MCP_WORKER_PORT: String(workerPort),
    STRYDE_MCP_TOKEN: workerToken,
    STRYDE_MCP_SERVERS: JSON.stringify({
      reference: { command: process.execPath, args: ["scripts/mcp-echo-server.mjs"] },
    }),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let workerOutput = "";
workerChild.stdout.on("data", (c) => { workerOutput += String(c); });
workerChild.stderr.on("data", (c) => { workerOutput += String(c); });
const teardownWorker = () => {
  if (workerChild.pid && process.platform === "win32") {
    try { spawn("taskkill", ["/pid", String(workerChild.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* best effort */ }
  } else {
    workerChild.kill("SIGKILL");
  }
};
process.on("exit", teardownWorker);
let workerUp = false;
for (let i = 0; i < 60 && !workerUp; i++) {
  workerUp = await authedProbe({ Authorization: `Bearer ${workerToken}` }).then((s) => s > 0);
  if (!workerUp) await new Promise((r) => setTimeout(r, 500));
}
assert.ok(workerUp, `MCP worker never became ready: ${workerOutput}`);
ok(`MCP worker listening on ${workerUrl} (spawned by this suite)`);

// Drive the plane: a persistent dispatcher until OUR job is terminal.
const dispatcherChild = spawn(process.execPath, ["--experimental-strip-types", "scripts/worker-dispatcher.ts"], {
  cwd: repoRoot,
  env: { ...process.env, STRYDE_MCP_URL: workerUrl, STRYDE_MCP_TOKEN: workerToken, STRYDE_WORKER_POLL_MS: "500", STRYDE_WORKER_MAX_RUNTIME_MS: "300000" },
  stdio: ["ignore", "pipe", "pipe"],
});
let dispatcherOutput = "";
dispatcherChild.stdout.on("data", (c) => { dispatcherOutput += String(c); });
dispatcherChild.stderr.on("data", (c) => { dispatcherOutput += String(c); });
const teardownDispatcher = () => {
  if (dispatcherChild.pid && process.platform === "win32") {
    try { spawn("taskkill", ["/pid", String(dispatcherChild.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* best effort */ }
  } else {
    dispatcherChild.kill("SIGKILL");
  }
};
process.on("exit", teardownDispatcher);

let job: Json | undefined;
try {
  for (let i = 0; i < 90 && !job; i++) {
    const { data } = await service.from("job").select("status, resolved_at, tool_id").eq("id", jobId).maybeSingle();
    job = data as Json | null ?? undefined;
    if (job && ["SUCCEEDED", "FAILED", "UNKNOWN", "CANCELLED"].includes(String(job.status))) break;
    job = undefined;
    await new Promise((r) => setTimeout(r, 2000));
  }
  assert.ok(job, `job never reached a terminal state; dispatcher output: ${dispatcherOutput.slice(-2_000)}`);
} finally {
  teardownDispatcher();
  process.off("exit", teardownDispatcher);
  teardownWorker();
  process.off("exit", teardownWorker);
}
assert.equal(String(job!.status), "SUCCEEDED", `the MCP tool call must succeed; got ${job!.status}`);

const { data: attemptRow } = await service.from("attempt")
  .select("terminal_resolution, external_correlation_id, error_details, redacted_result").eq("job_id", jobId).maybeSingle();
const { data: observations } = await service.from("observation")
  .select("content, observation_kind, source_type")
  .eq("owner_user_id", userId).order("created_at", { ascending: false }).limit(20);
const workerObs = (observations ?? []).find((o) => o.source_type === "CONTROLLED_EXECUTION");

{
  const { data: finalAction } = await service.from("action").select("status, execution_mode").eq("id", actionId).maybeSingle();
  assert.equal(finalAction!.execution_mode, "CONTROLLED");
  assert.equal(finalAction!.status, "COMPLETED");
  ok("CONTROLLED action finalized COMPLETED");
}
assert.equal(attemptRow!.terminal_resolution, "SUCCEEDED");
assert.ok(attemptRow!.external_correlation_id, "a real run must carry a worker correlation id");
ok("attempt recorded SUCCEEDED with a real worker correlation id");

assert.ok(workerObs, "no CONTROLLED_EXECUTION observation was recorded");
const content = workerObs!.content as Json;
const result = (content.result as Json | undefined) as Json | undefined;
assert.equal(result?.provider, "MCP", "the observation must attribute the run to the MCP provider");
const resultPayload = (result?.result as Json | undefined) as Json | undefined;
assert.equal(resultPayload?.mcp_server, "reference");
assert.equal(resultPayload?.mcp_tool, "echo");
const artifacts = resultPayload?.artifacts as Array<{ path: string; preview: string }> | undefined;
assert.ok(artifacts && artifacts.length > 0, "a SUCCEEDED MCP run must carry inspectable content");
assert.ok(artifacts![0].preview.includes(`ECHO: ${ECHO_MESSAGE}`), "the tool result must contain the echoed message");
ok("tool result content round-tripped and is content-judged (not status-judged)");

const { data: claims } = await service.from("claim").select("id, epistemic_status").eq("pursuit_id", pursuitId);
for (const c of claims ?? []) {
  assert.notEqual(c.epistemic_status, "VERIFIED", "a tool result must never self-verify");
}
ok("no claim was auto-verified from MCP tool output");

if (policyChanged) {
  await service.from("user_autonomy_policy").update({
    allow_worker_delegation: (policyBefore as Json).allow_worker_delegation,
    allowed_worker_types: (policyBefore as Json).allowed_worker_types,
  }).eq("owner_user_id", userId);
  console.log("  ... restored the user autonomy policy");
}

console.log(`\nE2E MCP WORKER PASSED: ${passed} boundaries verified against a real MCP stdio server.`);
console.log(`Evidence: pursuit ${pursuitId}, action ${actionId}, job ${jobId}`);

