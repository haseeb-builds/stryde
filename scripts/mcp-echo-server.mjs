// A minimal MCP (Model Context Protocol) stdio server that speaks the subset
// the Stryde transport uses: initialize, notifications/initialized,
// tools/list, tools/call. Newline-delimited JSON-RPC 2.0 on stdio.
//
// Purpose: the reference stub for Stryde's MCP transport tests and E2E, and a
// worked example for connecting real MCP servers (set STRYDE_MCP_SERVERS to
// {"<name>": {"command": "node", "args": ["scripts/mcp-echo-server.mjs"]}}).
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin });

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

const TOOLS = [
  {
    name: "echo",
    description: "Returns the provided message verbatim. Used to prove the transport.",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string", description: "Text to echo back" } },
      required: ["message"],
    },
  },
  {
    name: "fail",
    description: "Always reports a tool error. Used to prove honest failure semantics.",
    inputSchema: { type: "object", properties: {} },
  },
];

rl.on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "stryde-echo-mcp-server", version: "1.0.0" },
      },
    });
    return;
  }
  if (message.method === "tools/list") {
    send({ jsonrpc: "2.0", id: message.id, result: { tools: TOOLS } });
    return;
  }
  if (message.method === "tools/call") {
    const { name, arguments: args } = message.params ?? {};
    if (name === "echo") {
      const text = typeof args?.message === "string" ? args.message : "(no message provided)";
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: { content: [{ type: "text", text: `ECHO: ${text}` }] },
      });
      return;
    }
    if (name === "fail") {
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: { content: [{ type: "text", text: "this tool always fails" }], isError: true },
      });
      return;
    }
    send({ jsonrpc: "2.0", id: message.id, error: { code: -32602, message: `unknown tool: ${name}` } });
    return;
  }
  if (message.id !== undefined) {
    send({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "method not found" } });
  }
});
