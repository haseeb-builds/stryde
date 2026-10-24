/**
 * Production worker supervisor:
 * Launches the browser worker server (HTTP endpoint on STRYDE_BROWSER_PORT)
 * and the continuous worker dispatcher loop.
 */
import { spawn } from "node:child_process";
import http from "node:http";

const browserPort = Number(process.env.STRYDE_BROWSER_PORT || 3103);
const browserToken = process.env.STRYDE_BROWSER_TOKEN || "prod-browser-token";

process.env.STRYDE_BROWSER_PORT = String(browserPort);
process.env.STRYDE_BROWSER_TOKEN = browserToken;
process.env.STRYDE_BROWSER_URL = process.env.STRYDE_BROWSER_URL || `http://127.0.0.1:${browserPort}`;

console.log("[worker-supervisor] Starting Stryde production worker plane...");

// Start the browser worker server
const browserWorker = spawn(
  "node",
  ["--experimental-strip-types", "scripts/browser-worker.ts"],
  { stdio: "inherit", env: process.env }
);

browserWorker.on("error", (err) => {
  console.error("[worker-supervisor] Browser worker process error:", err);
});

browserWorker.on("exit", (code) => {
  console.error(`[worker-supervisor] Browser worker exited with code ${code}`);
  process.exit(code ?? 1);
});

// Wait 2 seconds for worker server to bind, then start dispatcher
setTimeout(() => {
  console.log("[worker-supervisor] Starting worker dispatcher daemon...");
  const dispatcher = spawn(
    "node",
    ["--experimental-strip-types", "scripts/worker-dispatcher.ts"],
    { stdio: "inherit", env: process.env }
  );

  dispatcher.on("error", (err) => {
    console.error("[worker-supervisor] Dispatcher error:", err);
  });

  dispatcher.on("exit", (code) => {
    console.error(`[worker-supervisor] Dispatcher exited with code ${code}`);
    process.exit(code ?? 1);
  });
}, 2000);

// Healthcheck endpoint on 8080 or PORT
const healthPort = Number(process.env.PORT || 8080);
const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "healthy", timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(healthPort, "0.0.0.0", () => {
  console.log(`[worker-supervisor] Healthcheck server listening on port ${healthPort}`);
});
