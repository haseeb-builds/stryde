// Minimal but faithful implementation of the worker HTTP contract that
// lib/worker-gateway.ts speaks. Used to prove the CONTROLLED execution path
// end to end without depending on any real worker installation.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

type Job = { id: string; instruction: string; context: unknown; provider: string; status: string; result: unknown; createdAt: number };

const jobs = new Map<string, Job>();
const token = process.env.WORKER_TOKEN ?? "";

function auth(req: any): boolean {
  if (!token) return true;
  return req.headers["authorization"] === `Bearer ${token}`;
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const send = (code: number, body: unknown) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (!auth(req)) return send(401, { error: "unauthorized" });

  if (req.method === "POST" && url.pathname === "/work") {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      let parsed: any = {};
      try { parsed = JSON.parse(raw || "{}"); } catch { return send(400, { error: "invalid json" }); }
      const id = `w-${randomUUID()}`;
      jobs.set(id, {
        id,
        instruction: String(parsed.instruction ?? ""),
        context: parsed.context ?? null,
        provider: String(parsed.workerType ?? "UNKNOWN"),
        // Complete on the first poll so the dispatcher observes a terminal state.
        status: "RUNNING",
        result: null,
        createdAt: Date.now(),
      });
      send(201, { external_work_id: id });
    });
    return;
  }

  const match = url.pathname.match(/^\/work\/([^/]+)(\/result)?$/);
  if (match && req.method === "GET") {
    const job = jobs.get(match[1]);
    if (!job) return send(404, { error: "not found" });
    if (match[2] === "/result") {
      return send(200, {
        status: job.status === "RUNNING" ? "SUCCEEDED" : job.status,
        result: job.result,
        raw_result_reference: `worker://${job.id}`,
      });
    }
    if (job.status === "RUNNING") job.status = "SUCCEEDED";
    return send(200, { status: job.status });
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/work/")) {
    const id = url.pathname.split("/")[2];
    const job = jobs.get(id);
    if (job) job.status = "FAILED";
    return send(200, { cancelled: true });
  }

  send(404, { error: "not found" });
});

const port = Number(process.env.WORKER_PORT ?? "8899");
server.listen(port, "127.0.0.1", () => {
  console.log(`worker stub listening on http://127.0.0.1:${port}`);
});
