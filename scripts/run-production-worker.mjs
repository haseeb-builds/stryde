/**
 * Production worker supervisor:
 * Launches the browser worker server (HTTP endpoint on STRYDE_BROWSER_PORT)
 * and the continuous worker dispatcher loop.
 *
 * Security & Reliability Guarantees:
 * 1. Zero hardcoded secrets: generates secure crypto random token for internal IPC if not provided.
 * 2. Honest health checks: verifies actual child process liveness and readiness (503 if unavailable).
 * 3. Graceful shutdown: captures SIGTERM/SIGINT and shuts down children cleanly.
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import http from "node:http";

const browserPort = Number(process.env.STRYDE_BROWSER_PORT || 3103);
let browserToken = process.env.STRYDE_BROWSER_TOKEN?.trim();

if (!browserToken) {
  browserToken = crypto.randomBytes(32).toString("hex");
  process.env.STRYDE_BROWSER_TOKEN = browserToken;
  console.log("[worker-supervisor] STRYDE_BROWSER_TOKEN not set; generated secure ephemeral 256-bit token for IPC.");
} else {
  console.log("[worker-supervisor] Using configured STRYDE_BROWSER_TOKEN (masked: " + browserToken.slice(0, 6) + "...)");
}

process.env.STRYDE_BROWSER_PORT = String(browserPort);
process.env.STRYDE_BROWSER_URL = process.env.STRYDE_BROWSER_URL || `http://127.0.0.1:${browserPort}`;

console.log("[worker-supervisor] Starting Stryde production worker plane...");

let browserWorkerProcess = null;
let dispatcherProcess = null;
let isShuttingDown = false;

// 1. Start the browser worker server
browserWorkerProcess = spawn(
  "node",
  ["--experimental-strip-types", "scripts/browser-worker.ts"],
  { stdio: "inherit", env: process.env }
);

browserWorkerProcess.on("error", (err) => {
  console.error("[worker-supervisor] Browser worker process error:", err);
});

browserWorkerProcess.on("exit", (code, signal) => {
  console.error(`[worker-supervisor] Browser worker exited (code=${code}, signal=${signal})`);
  if (!isShuttingDown) {
    process.exit(code ?? 1);
  }
});

// 2. Start worker dispatcher daemon after brief warm-up
setTimeout(() => {
  if (isShuttingDown) return;
  console.log("[worker-supervisor] Starting worker dispatcher daemon...");
  dispatcherProcess = spawn(
    "node",
    ["--experimental-strip-types", "scripts/worker-dispatcher.ts"],
    { stdio: "inherit", env: process.env }
  );

  dispatcherProcess.on("error", (err) => {
    console.error("[worker-supervisor] Dispatcher error:", err);
  });

  dispatcherProcess.on("exit", (code, signal) => {
    console.error(`[worker-supervisor] Dispatcher exited (code=${code}, signal=${signal})`);
    if (!isShuttingDown) {
      process.exit(code ?? 1);
    }
  });
}, 2000);

// 3. Healthcheck endpoint on 8080 or PORT
const healthPort = Number(process.env.PORT || 8080);
const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    const isBrowserRunning = browserWorkerProcess !== null && browserWorkerProcess.exitCode === null;
    const isDispatcherRunning = dispatcherProcess !== null && dispatcherProcess.exitCode === null;
    const isHealthy = isBrowserRunning && isDispatcherRunning && !isShuttingDown;

    const payload = {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      workers: {
        browserServer: {
          running: isBrowserRunning,
          pid: browserWorkerProcess?.pid ?? null,
          exitCode: browserWorkerProcess?.exitCode ?? null,
        },
        dispatcher: {
          running: isDispatcherRunning,
          pid: dispatcherProcess?.pid ?? null,
          exitCode: dispatcherProcess?.exitCode ?? null,
        },
      },
    };

    res.writeHead(isHealthy ? 200 : 503, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload, null, 2));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(healthPort, "0.0.0.0", () => {
  console.log(`[worker-supervisor] Healthcheck server listening on port ${healthPort}`);
});

function handleShutdown(signal) {
  console.log(`[worker-supervisor] Received ${signal}, shutting down child processes...`);
  isShuttingDown = true;
  if (browserWorkerProcess) {
    browserWorkerProcess.kill("SIGTERM");
  }
  if (dispatcherProcess) {
    dispatcherProcess.kill("SIGTERM");
  }
  server.close(() => {
    console.log("[worker-supervisor] Health server closed. Exiting.");
    process.exit(0);
  });
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
