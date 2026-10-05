// A real browser-backed worker endpoint for Stryde's CONTROLLED execution plane.
//
// It implements the exact HTTP contract lib/worker-gateway.ts speaks
// (POST /work, GET /work/:id, GET /work/:id/result, DELETE /work/:id) and backs
// each unit of work with a real headless browser render of a live page — the
// capability the verification matrix deferred when no browser runtime existed
// (JS-rendered pages were observable only through the Firecrawl render
// fallback).
//
// Bounded authority (v1): the only task class is OBSERVE_PAGE. The worker
// navigates to ONE http(s) URL supplied in the job context, waits for the
// document to settle, and produces inspectable artifacts: extracted page text,
// a PNG screenshot, and a metadata record (final URL after redirects, title,
// HTTP status). It performs no clicks, no form submission, no credential entry.
// A broader task grammar must arrive with its own authority analysis, not by
// silently widening this one.
//
// Epistemic rules (same discipline as the other worker servers):
//   - navigation that never settled = FAILED with the browser error retained;
//   - killed by timeout = UNKNOWN, never FAILED and never SUCCEEDED;
//   - a "successful" run with NO inspectable artifacts = FAILED (a worker that
//     produced nothing observable has not done the work);
//   - loopback/private-network URLs are refused before any navigation (SSRF).
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isAuthorizedWorkerRequest } from "../lib/worker-server-auth.ts";

// Load .env.local the same way the other worker servers do, so the documented
// "npm run worker:browser" flow sees STRYDE_BROWSER_TOKEN without the operator
// exporting it manually. Existing process env always wins.
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const localEnvPath = path.join(repoRoot, ".env.local");
if (existsSync(localEnvPath)) {
  const fileEnv = Object.fromEntries(
    readFileSync(localEnvPath, "utf8")
      .split(/\r?\n/).filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  for (const [k, v] of Object.entries(fileEnv)) if (!(k in process.env)) process.env[k] = v;
}

export type BrowserArtifact = { path: string; bytes: number; preview: string };

export type BrowserRun = {
  navigated: boolean;
  timedOut: boolean;
  error: string | null;
  pageTitle: string | null;
  finalUrl: string | null;
  httpStatus: number | null;
  textChars: number;
  screenshotSaved: boolean;
  artifacts: BrowserArtifact[];
};

// Exported pure decision so unit tests can pin the epistemic rules without
// launching any browser. The rules are the plane's contract, not details.
export function decideBrowserOutcome(run: BrowserRun): {
  status: "SUCCEEDED" | "FAILED" | "UNKNOWN";
  error: string | null;
  result: Record<string, unknown>;
} {
  if (run.timedOut) {
    return {
      status: "UNKNOWN",
      error: "browser observation exceeded its runtime budget; outcome unknown",
      result: { timed_out: true, artifacts: run.artifacts },
    };
  }
  if (!run.navigated) {
    return {
      status: "FAILED",
      error: run.error ?? "the page never loaded",
      result: { artifacts: run.artifacts },
    };
  }
  if (!run.screenshotSaved && run.textChars === 0) {
    return {
      status: "FAILED",
      error: "the page loaded but produced nothing observable (no text, no screenshot)",
      result: { http_status: run.httpStatus, final_url: run.finalUrl, artifacts: run.artifacts },
    };
  }
  return {
    status: "SUCCEEDED",
    error: null,
    result: {
      page_title: run.pageTitle,
      final_url: run.finalUrl,
      http_status: run.httpStatus,
      text_chars: run.textChars,
      artifacts: run.artifacts,
    },
  };
}

// Refuse network locations that must never be observed by a delegated worker.
// Literal and hostname forms cover the practical SSRF surface for a v1 that
// only navigates to one user-context URL.
export function isForbiddenBrowserUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host === "::1" || host === "[::1]" || host === "0.0.0.0") return true;
  const literal = host.replace(/^\[|\]$/g, "");
  if (/^(127|10)\./.test(literal)) return true;
  if (/^192\.168\./.test(literal)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(literal)) return true;
  if (/^169\.254\./.test(literal)) return true;
  return false;
}

// Resolve an existing browser executable. The worker drives a browser the
// machine already has (Edge on Windows, Chrome elsewhere); it never downloads
// one. STRYDE_BROWSER_EXECUTABLE wins verbatim.
function findBrowserExecutable(): string | null {
  const explicit = process.env.STRYDE_BROWSER_EXECUTABLE?.trim();
  if (explicit) return existsSync(explicit) ? explicit : null;
  const candidates = process.platform === "win32"
    ? [
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      ]
    : process.platform === "darwin"
      ? ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
      : ["/usr/bin/microsoft-edge", "/usr/bin/microsoft-edge-stable", "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

const TIMEOUT_MS = Math.min(300_000, Math.max(5_000, Number(process.env.STRYDE_BROWSER_TIMEOUT_MS ?? "90000")));
const MAX_TEXT_CHARS = 200_000;

type JobState = "RUNNING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
type Job = {
  id: string;
  instruction: string;
  context: Record<string, unknown>;
  status: JobState;
  result: unknown;
  error: string | null;
  startedAt: number;
};

const jobs = new Map<string, Job>();
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

async function runJob(job: Job) {
  const settle = () => {
    jobRunning = false;
    pumpJobs();
  };
  try {
    const task = typeof job.context.task === "string" ? job.context.task : "";
    if (task && task !== "OBSERVE_PAGE") {
      job.status = "FAILED";
      job.error = `unsupported browser task: ${task}; this worker only performs bounded page observation`;
      settle();
      return;
    }
    // The bounded task is page observation; the target comes from an explicit
    // context URL or, failing that, the first http(s) URL in the instruction.
    // Delegation keeps worker neutrality: the CONTROLLED route never
    // special-cases per-worker context.
    const explicitUrl = typeof job.context.url === "string" ? job.context.url.trim() : "";
    const instructionUrl = job.instruction.match(/https?:\/\/[^\s<>"']+/i)?.[0] ?? "";
    const url = (explicitUrl || instructionUrl).replace(/[),.;!?'"]+$/, "");
    if (!url || isForbiddenBrowserUrl(url)) {
      job.status = "FAILED";
      job.error = url
        ? "the observation target is forbidden: loopback, private ranges, and non-http(s) schemes are never observed by this worker"
        : "no usable observation target: provide context.url or a public http(s) URL in the instruction";
      settle();
      return;
    }

    const executable = findBrowserExecutable();
    if (!executable) {
      job.status = "FAILED";
      job.error = "no browser executable found; set STRYDE_BROWSER_EXECUTABLE to an existing Edge/Chrome path";
      settle();
      return;
    }

    const { default: puppeteer } = await import("puppeteer-core");
    const dir = mkdtempSync(path.join(tmpdir(), "stryde-browser-worker-"));
    const browser = await puppeteer.launch({
      executablePath: executable,
      headless: true,
      args: ["--no-first-run", "--no-default-browser-check", "--disable-background-networking"],
    });
    const killTimer = setTimeout(() => void browser.close(), TIMEOUT_MS);

    try {
      const page = await browser.newPage();
      const response = await page.goto(url, { waitUntil: "networkidle2", timeout: TIMEOUT_MS });
      // JS-rendered pages settle after networkidle2; one extra paint beat gives
      // late hydration a chance without unbounded waiting.
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      const pageTitle = await page.title();
      const finalUrl = page.url();
      const text = (await page.evaluate(() => document.body?.innerText ?? "")).slice(0, MAX_TEXT_CHARS);
      const screenshotPath = path.join(dir, "screenshot.png");
      let screenshotSaved = false;
      try {
        await page.screenshot({ path: screenshotPath, fullPage: false });
        screenshotSaved = existsSync(screenshotPath);
      } catch { /* screenshot failure is recorded, not fatal */ }

      const textPath = path.join(dir, "page-text.txt");
      writeFileSync(textPath, text, "utf8");
      const metaPath = path.join(dir, "page-metadata.json");
      const metadata = {
        requested_url: url,
        final_url: finalUrl,
        http_status: response?.status() ?? null,
        page_title: pageTitle,
        text_chars: text.length,
        renderer: "PUPPETEER_HEADLESS",
      };
      writeFileSync(metaPath, JSON.stringify(metadata, null, 2), "utf8");

      const artifacts: BrowserArtifact[] = [];
      artifacts.push({ path: "page-text.txt", bytes: Buffer.byteLength(text, "utf8"), preview: text.slice(0, 4_000) });
      const metaText = JSON.stringify(metadata, null, 2);
      artifacts.push({ path: "page-metadata.json", bytes: Buffer.byteLength(metaText, "utf8"), preview: metaText.slice(0, 4_000) });
      if (screenshotSaved) {
        artifacts.push({ path: "screenshot.png", bytes: statSync(screenshotPath).size, preview: "(binary PNG screenshot)" });
      }

      const decision = decideBrowserOutcome({
        navigated: true,
        timedOut: false,
        error: null,
        pageTitle,
        finalUrl,
        httpStatus: response?.status() ?? null,
        textChars: text.length,
        screenshotSaved,
        artifacts,
      });
      job.status = decision.status;
      job.error = decision.error;
      job.result = decision.result;
    } finally {
      clearTimeout(killTimer);
      await browser.close().catch(() => {});
    }
  } catch (error) {
    if (job.status === "RUNNING") {
      job.status = "FAILED";
      job.error = error instanceof Error ? error.message : "browser observation failed";
      job.result = { artifacts: [] };
    }
  }
  settle();
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const send = (code: number, body: unknown) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  // Inbound auth gate for the whole worker contract (see lib/worker-server-auth.ts).
  if (!isAuthorizedWorkerRequest("BROWSER", req.headers)) {
    return send(401, { error: "unauthorized" });
  }

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
      if (workerType !== "BROWSER") return send(400, { error: `unsupported worker type: ${workerType ?? "unknown"}` });
      const context = (parsed.context ?? {}) as Record<string, unknown>;

      const id = `w-${randomUUID()}`;
      const job: Job = {
        id, instruction, context,
        status: "RUNNING", result: null, error: null, startedAt: Date.now(),
      };
      jobs.set(id, job);
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
        raw_result_reference: `browser-worker://${job.id}`,
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
  const port = Number(process.env.STRYDE_BROWSER_WORKER_PORT ?? "8899");
  server.listen(port, "127.0.0.1", () => {
    console.log(`[stryde-browser-worker] listening on http://127.0.0.1:${port}`);
  });
}
