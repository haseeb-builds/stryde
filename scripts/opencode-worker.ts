// A real OpenCode-backed worker endpoint for Stryde's CONTROLLED execution plane.
//
// It implements the exact HTTP contract lib/worker-gateway.ts speaks
// (POST /work, GET /work/:id, GET /work/:id/result, DELETE /work/:id), and backs
// each unit of work with a real `opencode run` one-shot agent run instead of a
// canned answer. This is the OpenCode twin of scripts/hermes-worker.ts, which is
// the proven reference; the epistemic rules are copied from it exactly.
//
// Empirically verified against opencode v1.18.31 before this file was written:
//   - `opencode run "<instruction>"` is the documented non-interactive mode and
//     exits 0 on success, non-zero with an error on stderr on failure.
//   - The agent's file tools write into the run directory: both the spawn `cwd`
//     and the explicit `--dir` flag are honoured, and `--dir` wins even when the
//     process cwd is unrelated. Both are supplied (like hermes-worker supplies
//     cwd and TERMINAL_CWD) because they are independent mechanisms.
//   - The CLI works out of the box with its own stored credentials (see
//     `opencode auth`); it needs no per-job secrets from Stryde.
//   - `--auto` is required so permission requests are approved without a TTY.
//     That is why the per-job directory is the sandbox boundary: nothing outside
//     it is either requested or expected.
//
// Epistemic rules (identical to hermes-worker):
//   - exit 0 with NO artifacts = FAILED (a worker that did nothing is not a success);
//   - killed by timeout = UNKNOWN, never FAILED and never SUCCEEDED;
//   - non-zero exit = FAILED with stderr retained.
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export type Artifact = { path: string; bytes: number; preview: string };

export type JobExit = {
  timedOut: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  artifacts: Artifact[];
};

export type JobOutcome = {
  status: "RUNNING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
  error: string | null;
  result: {
    artifacts: Artifact[];
    stdout?: string;
    stderr?: string;
    timed_out?: boolean;
  };
};

// Exported pure decision so unit tests can pin the epistemic rules without
// spawning any process. The rules are the plane's contract, not implementation
// details: whatever the agent printed, only inspectable artifacts can make a
// zero-exit run a success, and a killed run is always an unknown.
export function decideWorkerOutcome(exit: JobExit): JobOutcome {
  if (exit.timedOut || exit.code === null) {
    // Killed by timeout (or by a signal we did not send): we genuinely do not
    // know what happened. UNKNOWN, not FAILED, and never SUCCEEDED.
    return {
      status: "UNKNOWN",
      error: "worker exceeded its runtime budget; outcome unknown",
      result: { artifacts: exit.artifacts, timed_out: true },
    };
  }
  if (exit.code !== 0) {
    return {
      status: "FAILED",
      error: `worker exited with code ${exit.code}`,
      result: { artifacts: exit.artifacts, stderr: exit.stderr.slice(0, 4_000) },
    };
  }
  if (exit.artifacts.length === 0) {
    // Exit 0 with nothing produced is not a completed unit of work. Treat it as
    // a failure so Stryde records reality rather than an empty success.
    return {
      status: "FAILED",
      error: "worker exited successfully but produced no artifacts",
      result: { artifacts: exit.artifacts, stdout: exit.stdout.slice(0, 4_000) },
    };
  }
  return { status: "SUCCEEDED", error: null, result: { artifacts: exit.artifacts, stdout: exit.stdout.slice(0, 4_000) } };
}

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

// Resolve the runnable opencode binary. Verified directly on Windows: Node's
// spawn without a shell cannot execute the npm-installed CLI — the
// extensionless shim is a sh script (CreateProcess reports ENOENT) and the
// .cmd shim is refused with EINVAL — so a bare name would fail every job
// before the agent ever started. The npm shim itself names the real
// executable it wraps, so on Windows a bare name is resolved to that .exe.
// An explicit STRYDE_OPENCODE_BIN is honoured verbatim.
function resolveOpencodeBin(bin: string): string {
  if (process.platform !== "win32" || path.isAbsolute(bin) || /\.exe$/i.test(bin)) return bin;
  try {
    const located = spawnSync("where", [bin], { encoding: "utf8" });
    const candidates = (located.stdout ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const candidate of candidates) {
      if (/\.exe$/i.test(candidate)) return candidate;
      if (/\.cmd$/i.test(candidate)) {
        try {
          const shim = readFileSync(candidate, "utf8");
          const exe = shim.match(/"([^"]+\.exe)"/i)?.[1];
          if (exe) {
            const resolved = exe.replace(/%dp0%/gi, path.dirname(candidate));
            if (existsSync(resolved)) return resolved;
          }
        } catch { /* try the next candidate */ }
      }
    }
  } catch { /* fall back to the bare name and report honestly if it cannot run */ }
  return bin;
}

const OPENCODE_BIN = resolveOpencodeBin(process.env.STRYDE_OPENCODE_BIN?.trim() || "opencode");
const MODEL = process.env.STRYDE_OPENCODE_MODEL?.trim() || "opencode/space-bunny-free";
const TIMEOUT_MS = Math.min(600_000, Math.max(5_000, Number(process.env.STRYDE_OPENCODE_TIMEOUT_MS ?? "240000")));
const MAX_OUTPUT_BYTES = 200_000;

export function collectArtifacts(dir: string): Artifact[] {
  const out: Artifact[] = [];
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

// opencode spawns its own local server subprocess, so killing only the direct
// child can leave the tree running. On Windows, killed children report an exit
// code rather than the signal, which is why the timeout decision uses the
// explicit `timedOut` flag instead of reading the signal off the close event.
function killTree(child: ReturnType<typeof spawn>) {
  if (process.platform === "win32" && child.pid) {
    try { spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* best effort */ }
    return;
  }
  child.kill("SIGKILL");
}

// Verified directly: two concurrent `opencode run` processes collide on
// opencode's own local state database ("database is locked"), so jobs are
// executed strictly one at a time. Submission stays immediate; only the agent
// runs are serialized.
const jobQueue: Job[] = [];
let jobRunning = false;

function enqueueJob(job: Job) {
  jobQueue.push(job);
  pumpJobs();
}

function pumpJobs() {
  if (jobRunning) return;
  const next = jobQueue.shift();
  if (!next) return;
  jobRunning = true;
  runJob(next);
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

  // Isolate the unit of work to this job's directory. Verified directly: the
  // explicit `--dir` flag moves the agent's file tools even when the process
  // cwd is unrelated, and the spawn `cwd` is honoured on its own as well. Both
  // are supplied because they are independent mechanisms and either one alone
  // leaves a real chance of artifacts landing outside the sandbox.
  //
  // stdin MUST be ignored: with the default piped stdin the child waits forever
  // for an EOF that the parent never sends (verified — the run produced no
  // output and never exited until stdin was cut off; with stdin ignored the
  // same invocation completes in seconds).
  const child = spawn(
    OPENCODE_BIN,
    ["run", "--dir", job.dir, "-m", MODEL, "--auto", prompt],
    { cwd: job.dir, env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] },
  );

  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    killTree(child);
  }, TIMEOUT_MS);

  // Exactly one of the error/close paths settles the job; the queue must also
  // resume exactly once.
  let settled = false;
  const settleJob = () => {
    if (settled) return;
    settled = true;
    jobRunning = false;
    pumpJobs();
  };

  child.stdout.on("data", (c) => { if (stdout.length < MAX_OUTPUT_BYTES) stdout += String(c); });
  child.stderr.on("data", (c) => { if (stderr.length < 20_000) stderr += String(c); });

  child.on("error", (error) => {
    clearTimeout(timer);
    if (job.status !== "RUNNING") return; // the first verdict stands
    job.status = "FAILED";
    job.error = `worker process error: ${error.message}`;
    job.result = { artifacts: collectArtifacts(job.dir) };
    settleJob();
  });

  child.on("close", (code) => {
    clearTimeout(timer);
    if (job.status !== "RUNNING") return; // e.g. a spawn error already failed this job
    const decision = decideWorkerOutcome({ timedOut, code, stdout, stderr, artifacts: collectArtifacts(job.dir) });
    job.status = decision.status;
    job.error = decision.error;
    job.result = decision.result;
    settleJob();
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
      if (workerType !== "OPENCODE") return send(400, { error: `unsupported worker type: ${workerType ?? "unknown"}` });

      const dir = mkdtempSync(path.join(tmpdir(), "stryde-opencode-worker-"));
      const id = `w-${randomUUID()}`;
      const job: Job = {
        id, instruction, context: parsed.context ?? null,
        status: "RUNNING", result: null, error: null, dir, model: MODEL, startedAt: Date.now(),
      };
      jobs.set(id, job);
      // Respond first so a long unit of work never holds the HTTP connection,
      // then execute. The dispatcher polls /work/:id for the real outcome.
      send(201, { external_work_id: id });
      enqueueJob(job);
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
        raw_result_reference: `opencode-worker://${job.id}`,
        model: job.model,
      });
    }
    return send(200, { status: job.status });
  }

  send(404, { error: "not found" });
});

// Listen only when this file is the process entry point, so unit tests can
// import the pure decision function without binding a port.
const entry = process.argv[1];
const modulePath = path.resolve(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"));
if (entry && path.resolve(entry) === modulePath) {
  const port = Number(process.env.STRYDE_OPENCODE_WORKER_PORT ?? "8898");
  server.listen(port, "127.0.0.1", () => {
    console.log(`[stryde-opencode-worker] listening on http://127.0.0.1:${port} (model ${MODEL})`);
  });
}
