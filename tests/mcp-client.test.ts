import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpStdioClient, parseMcpServerConfig } from "../lib/mcp-client.ts";
import { decideMcpOutcome } from "../scripts/mcp-worker.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ECHO_SERVER = path.join(repoRoot, "scripts", "mcp-echo-server.mjs");

test("MCP client: initialize, tools/list, and a real tools/call over stdio", async () => {
  const client = new McpStdioClient(process.execPath, [ECHO_SERVER], 15_000);
  try {
    await client.start();
    const tools = await client.listTools();
    assert.ok(tools.some((t) => t.name === "echo"));
    const result = await client.callTool("echo", { message: "transport proof" });
    assert.equal(result.isError, false);
    assert.equal(result.content[0]?.text, "ECHO: transport proof");
  } finally {
    await client.stop();
  }
});

test("MCP client: a tool error comes back as isError, and unknown tools are protocol errors", async () => {
  const client = new McpStdioClient(process.execPath, [ECHO_SERVER], 15_000);
  try {
    await client.start();
    const failed = await client.callTool("fail", {});
    assert.equal(failed.isError, true);
    await assert.rejects(() => client.callTool("no_such_tool", {}), /unknown tool/);
  } finally {
    await client.stop();
  }
});

test("MCP outcome epistemics: timeout is UNKNOWN, error is FAILED, empty is FAILED", () => {
  assert.equal(decideMcpOutcome({ called: false, timedOut: true, isError: false, contentChars: 0, error: null }).status, "UNKNOWN");
  assert.equal(decideMcpOutcome({ called: false, timedOut: false, isError: false, contentChars: 0, error: "boom" }).status, "FAILED");
  assert.equal(decideMcpOutcome({ called: true, timedOut: false, isError: true, contentChars: 10, error: null }).status, "FAILED");
  assert.equal(decideMcpOutcome({ called: true, timedOut: false, isError: false, contentChars: 0, error: null }).status, "FAILED");
  assert.equal(decideMcpOutcome({ called: true, timedOut: false, isError: false, contentChars: 42, error: null }).status, "SUCCEEDED");
});

test("MCP server config parses strictly and fails closed", () => {
  assert.equal(parseMcpServerConfig(undefined).size, 0);
  assert.throws(() => parseMcpServerConfig("not json"), /not valid JSON/);
  assert.throws(() => parseMcpServerConfig('{"a": 1}'), /must be an object/);
  const parsed = parseMcpServerConfig('{"echo": {"command": "node", "args": ["scripts/mcp-echo-server.mjs"]}}');
  assert.deepEqual(parsed.get("echo"), { command: "node", args: ["scripts/mcp-echo-server.mjs"] });
});
