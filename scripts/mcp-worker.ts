// A real MCP worker endpoint for Stryde's CONTROLLED execution plane.
//
// Same HTTP contract as the other workers; the bounded v1 task is one MCP
// tool call: context { server, tool, arguments }. The server registry comes
// from STRYDE_MCP_SERVERS (JSON name -> {command, args}); process lifetime is
// per job. Tool results are returned as inspectable artifacts — a tool saying
// "done" is still only an observation to Stryde, never a verified outcome.
//
// Epistemic rules match the other workers: timeout = UNKNOWN; a tool call that
// reports isError = FAILED; a call with no inspectable content = FAILED.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isAuthorizedWorkerRequest } from "../lib/worker-server-auth.ts";
import { parseMcpServerConfig } from "../lib/mcp-client.ts";

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

const CALL_TIMEOUT_MS = Math.min(300_000, Math.max(5_000, Number(process.env.STRYDE_MCP_TIMEOUT_MS ?? "60000")));
const MAX_CONTENT_CHARS = 20_000;

// Exported pure decision so unit tests can pin the epistemic rules.
export function decideMcpOutcome(input: {
  called: boolean;
  timedOut: boolean;
  isError: boolean;
  contentChars: number;
  error: string | null;
}): { status: "SUCCEEDED" | "FAILED" | "UNKNOWN"; error: string | null; result: Record<string, unknown> } {
  if (input.timedOut) {
    return { status: "UNKNOWN", error: "MCP tool call exceeded its runtime budget; outcome unknown", result: { timed_out: true } };
  }
  if (!input.called) {
    return { status: "FAILED", error: input.error ?? "the tool was never called", result: {} };
  }
  if (input.isError) {
    return { status: "FAILED", error: input.error ?? "the tool reported an error", result: {} };
  }
  if (input.contentChars === 0) {
    return { status: "FAILED", error: "the tool returned nothing inspectable", result: {} };
  }
  return { status: "SUCCEEDED", error: null, result: {} };
}

type JobState = "RUNNING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
type Job = {
  id: string;
  instruction: string;
  context: Record<string, unknown>;
  status: JobState;
  result: unknown;
  error: string | null;
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
    const toolCall = (job.context.tool_call ?? {}) as Record<string, unknown>;
    const serverName = typeof job.context.server === "string" ? job.context.server : typeof toolCall.server === "string" ? toolCall.server : "";
    const toolName = typeof job.context.tool === "string" ? job.context.tool : typeof toolCall.tool === "string" ? toolCall.tool : "";
    const args = ((job.context.arguments ?? toolCall.arguments) ?? {}) as Record<string, unknown>;
    if (!serverName || !toolName) {
      job.status = "FAILED";
      job.error = "an MCP call needs context.server and context.tool";
      settle();
      return;
    }

    let servers: Map<string, { command: string; args: string[] }>;
    try {
      servers = parseMcpServerConfig(process.env.STRYDE_MCP_SERVERS);
    } catch (error) {
      job.status = "FAILED";
      job.error = error instanceof Error ? error.message : "invalid MCP server configuration";
      settle();
      return;
    }
    const server = servers.get(serverName);
    if (!server) {
      job.status = "FAILED";
      job.error = `unknown MCP server: ${serverName}; configured: ${[...servers.keys()].join(", ") || "(none)"}`;
      settle();
      return;
    }

    const { McpStdioClient } = await import("../lib/mcp-client.ts");
    const client = new McpStdioClient(server.command, server.args, CALL_TIMEOUT_MS);
    const killTimer = setTimeout(() => void client.stop(), CALL_TIMEOUT_MS);
    try {
      await client.start();
      const result = await client.callTool(toolName, args);
      const contentText = result.content
        .map((item) => (typeof item.text === "string" ? item.text : ""))
        .join("\n")
        .slice(0, MAX_CONTENT_CHARS);

      const decision = decideMcpOutcome({
        called: true,
        timedOut: false,
        isError: Boolean(result.isError),
        contentChars: contentText.length,
        error: null,
      });
      job.status = decision.status;
      job.error = decision.error;
      job.result = {
        mcp_server: serverName,
        mcp_tool: toolName,
        content_chars: contentText.length,
        structured_content: result.structuredContent ?? null,
        artifacts: contentText ? [{ path: "tool-result.txt", bytes: Buffer.byteLength(contentText, "utf8"), preview: contentText.slice(0, 4_000) }] : [],
        ...decision.result,
      };
      await client.stop();
    } catch (error) {
      clearTimeout(killTimer);
      await client.stop().catch(() => {});
      const decision = decideMcpOutcome({
        called: false,
        timedOut: false,
        isError: false,
        contentChars: 0,
        error: error instanceof Error ? error.message : "MCP call failed",
      });
      job.status = decision.status;
      job.error = decision.error;
      job.result = decision.result;
      settle();
      return;
    }
    clearTimeout(killTimer);
  } catch (error) {
    if (job.status === "RUNNING") {
      job.status = "FAILED";
      job.error = error instanceof Error ? error.message : "MCP execution failed";
      job.result = {};
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

  if (!isAuthorizedWorkerRequest("MCP", req.headers)) {
    return send(401, { error: "unauthorized" });
  }

  // Capability discovery: what this transport can reach, with metadata.
  if (req.method === "GET" && url.pathname === "/capabilities") {
    let servers: Map<string, { command: string; args: string[] }>;
    try {
      servers = parseMcpServerConfig(process.env.STRYDE_MCP_SERVERS);
    } catch (error) {
      return send(503, { error: error instanceof Error ? error.message : "invalid MCP configuration" });
    }
    const discovered: Array<Record<string, unknown>> = [];
    for (const [name, config] of servers) {
      discovered.push({ server: name, command: config.command, args: config.args, tools: "discovered per job" });
    }
    return send(200, { servers: discovered, note: "tools/list runs per job; Stryde registers the capabilities it grants" });
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
      if (workerType !== "MCP") return send(400, { error: `unsupported worker type: ${workerType ?? "unknown"}` });

      const id = `w-${randomUUID()}`;
      const job: Job = {
        id, instruction, context: (parsed.context ?? {}) as Record<string, unknown>,
        status: "RUNNING", result: null, error: null,
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
        raw_result_reference: `mcp-worker://${job.id}`,
      });
    }
    return send(200, { status: job.status });
  }

  send(404, { error: "not found" });
});

const entry = process.argv[1];
const modulePath = path.resolve(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"));
if (entry && path.resolve(entry) === modulePath) {
  const port = Number(process.env.STRYDE_MCP_WORKER_PORT ?? "8895");
  server.listen(port, "127.0.0.1", () => {
    console.log(`[stryde-mcp-worker] listening on http://127.0.0.1:${port}`);
  });
}
