// A real Hermes-backed worker endpoint for Stryde's CONTROLLED execution plane.
//
// It implements the exact HTTP contract lib/worker-gateway.ts speaks
// (POST /work, GET /work/:id, GET /work/:id/result, DELETE /work/:id), and backs
// each unit of work with a real `hermes -z` one-shot agent run instead of a
// canned answer. This is what makes "a worker executed something" a fact rather
// than a claim: the agent writes real output into a real working directory, and
// the result reported back to Stryde is read back off disk.
//
// Design notes:
//   - Work runs in a per-job directory so parallel jobs cannot collide, and the
//     produced artifacts are the observable result.
//   - A worker that exits non-zero, times out, or produces nothing is reported as
//     FAILED or UNKNOWN. It is never reported as success, because a worker that
//     did nothing is not a success. This is the same epistemic rule Stryde
//     applies to its own actions.
//   - Output is size-bounded before being returned, because the trusted plane
//     stores the mechanical result.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type JobState = "RUNNING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
type Job = {
  id: string;
  instruction: string;
  context: unknown;
  status: JobState;
  result: unknown;
  error: string | null;
  dir: string;
  model: string;
  startedAt: number;
};

const jobs = new Map<string, Job>();

const HERMES_BIN = process.env.STRYDE_HERMES_BIN?.trim() || "hermes";
const MODEL = process.env.STRYDE_HERMES_MODEL?.trim() || "stealth/space-bunny-alpha";
const TIMEOUT_MS = Math.min(600_000, Math.max(5_000, Number(process.env.STRYDE_HERMES_TIMEOUT_MS ?? "240000")));
const MAX_OUTPUT_BYTES = 200_000;

function hermesEnv(): NodeJS.ProcessEnv {
  // Inherit the operator environment so the agent has its own credentials; never
  // copy secrets into the job record or the result returned to Stryde.
  const env = { ...process.env };
  const hermesEnvPath = process.env.STRYDE_HERMES_ENV_FILE?.trim();
  if (hermesEnvPath && existsSync(hermesEnvPath)) {
    for (const line of readFileSync(hermesEnvPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      if (!(key in env)) env[key] = trimmed.slice(idx + 1);
    }
  }
  return env;
}

function collectArtifacts(dir: string): Array<{ path: string; bytes: number; preview: string }> {
  const out: Array<{ path: string; bytes: number; preview: string }> = [];
  const walk = (current: string, depth: number) => {
    if (depth > 3 || out.length >= 40) return;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) { walk(full, depth + 1); continue; }
      let bytes = 0;
      try { bytes = statSync(full).size; } catch { continue; }
      if (bytes > MAX_OUTPUT_BYTES / 2) continue;
      let preview = "";
      try { preview = readFileSync(full, "utf8").slice(0, 4_000); } catch { continue; }
      out.push({ path: path.relative(dir, full), bytes, preview });
    }
  };
  try { walk(dir, 0); } catch { /* empty directory */ }
  return out;
}

function runJob(job: Job) {
  // The agent is told to produce artifacts in its working directory and to state
  // plainly if it could not. Nothing here assumes the agent succeeded.
  const prompt = [
    "You are executing one delegated unit of work inside a pursuit-tracking system.",
    "Work ONLY inside the current working directory.",
    "Your job is to produce real, inspectable output (files) that a reviewer can check.",
    "",
    `TASK:\n${job.instruction}`,
    "",
    job.context ? `CONTEXT:\n${JSON.stringify(job.context)}` : "",
    "",
    "Rules:",
    "- Perform the work; do not merely describe it.",
    "- Do not claim success unless you actually produced output.",
    "- If you cannot complete the work, say exactly what blocked you.",
  ].filter(Boolean).join("\n");

  // Isolate the unit of work to this job's directory.
  //
  // `spawn`'s own `cwd` only sets the process working directory; it does NOT
  // change where the agent's file/terminal tools operate. Verified directly:
  // with `cwd` set to the sandbox and `--in` passed, the agent still reported
  // and wrote inside an unrelated directory. TERMINAL_CWD is the knob the agent
  // actually honours for tool execution, so it is set explicitly per job. Both
  // are supplied because they are independent mechanisms and either one alone
  // leaves a real chance of artifacts landing outside the sandbox.
  const env = hermesEnv();
  env.TERMINAL_CWD = job.dir;

  const child = spawn(
    HERMES_BIN,
    ["-z", prompt, "--ignore-user-config", "--ignore-rules", "--no-restore-cwd", "--in", job.dir, "-t", "file,terminal", "-m", MODEL],
    { cwd: job.dir, env },
  );

  let stdout = "";
  let stderr = "";
  const timer = setTimeout(() => { child.kill("SIGKILL"); }, TIMEOUT_MS);

  child.stdout.on("data", (c) => { if (stdout.length < MAX_OUTPUT_BYTES) stdout += String(c); });
  child.stderr.on("data", (c) => { if (stderr.length < 20_000) stderr += String(c); });

  child.on("error", (error) => {
    clearTimeout(timer);
    job.status = "FAILED";
    job.error = `worker process error: ${error.message}`;
    job.result = { artifacts: collectArtifacts(job.dir) };
  });

  child.on("close", (code, signal) => {
    clearTimeout(timer);
    const artifacts = collectArtifacts(job.dir);
    if (signal === "SIGKILL" || code === null) {
      // Killed by timeout: we genuinely do not know what happened. UNKNOWN, not
      // FAILED, and never SUCCEEDED.
      job.status = "UNKNOWN";
      job.error = "worker exceeded its runtime budget; outcome unknown";
      job.result = { artifacts, timed_out: true };
      return;
    }
    if (code !== 0) {
      job.status = "FAILED";
      job.error = `worker exited with code ${code}`;
      job.result = { artifacts, stderr: stderr.slice(0, 4_000) };
      return;
    }
    if (artifacts.length === 0) {
      // Exit 0 with nothing produced is not a completed unit of work. Treat it as
      // a failure so Stryde records reality rather than an empty success.
      job.status = "FAILED";
      job.error = "worker exited successfully but produced no artifacts";
      job.result = { artifacts, stdout: stdout.slice(0, 4_000) };
      return;
    }
    job.status = "SUCCEEDED";
    job.result = { artifacts, stdout: stdout.slice(0, 4_000) };
  });
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const send = (code: number, body: unknown) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method === "POST" && url.pathname === "/work") {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1_000_000) { send(413, { error: "work request too large" }); req.destroy(); }
    });
    req.on("end", () => {
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(raw || "{}"); } catch { return send(400, { error: "invalid JSON" }); }
      const instruction = typeof parsed.instruction === "string" ? parsed.instruction.trim() : "";
      if (!instruction) return send(400, { error: "instruction is required" });
      const workerType = (parsed.workerType ?? parsed.worker_type) as string | undefined;
      if (workerType !== "HERMES") return send(400, { error: `unsupported worker type: ${workerType ?? "unknown"}` });

      const dir = mkdtempSync(path.join(tmpdir(), "stryde-worker-"));
      const id = `w-${randomUUID()}`;
      const job: Job = {
        id, instruction, context: parsed.context ?? null,
        status: "RUNNING", result: null, error: null, dir, model: MODEL, startedAt: Date.now(),
      };
      jobs.set(id, job);
      // Respond first so a long unit of work never holds the HTTP connection,
      // then execute. The dispatcher polls /work/:id for the real outcome.
      send(201, { external_work_id: id });
      runJob(job);
    });
    return;
  }

  const match = url.pathname.match(/^\/work\/([^/]+)(\/result)?$/);
  if (match && (req.method === "GET" || req.method === "DELETE")) {
    const job = jobs.get(match[1]);
    if (!job) return send(404, { error: "unknown work id" });
    if (req.method === "DELETE") {
      job.status = "FAILED";
      job.error = "cancelled by requester";
      return send(200, { cancelled: true });
    }
    if (match[2] === "/result") {
      return send(200, {
        status: job.status,
        result: job.result,
        error: job.error,
        raw_result_reference: `hermes-worker://${job.id}`,
        model: job.model,
      });
    }
    return send(200, { status: job.status });
  }

  send(404, { error: "not found" });
});

const port = Number(process.env.STRYDE_HERMES_WORKER_PORT ?? "8899");
server.listen(port, "127.0.0.1", () => {
  console.log(`[stryde-hermes-worker] listening on http://127.0.0.1:${port} (model ${MODEL})`);
});
