// A minimal first-party MCP (Model Context Protocol) stdio client.
//
// Stryde treats MCP as capability transport, not architecture (Issue #6
// decision on MCP): an MCP server is a source of tools with declared
// metadata, and this client is the smallest primitive that can start one,
// discover its tools, and call one — over the stdio transport, speaking
// JSON-RPC 2.0 newline-delimited. No SDK, no daemon: the worker plane owns
// process lifetime per job, exactly like the other worker types.
//
// Spec conformance is deliberately scoped to what the transport contract
// needs: `initialize` handshake, `notifications/initialized`, `tools/list`,
// `tools/call`. Responses are matched by id; non-JSON output lines from the
// server are tolerated (some servers log to stdout).

export type McpToolDescriptor = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

export type McpCallResult = {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
  structuredContent?: unknown;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
};

export class McpStdioClient {
  private child: ReturnType<typeof import("node:child_process").spawn> | null = null;
  private buffer = "";
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private readonly command: string;
  private readonly args: string[];
  private readonly requestTimeoutMs: number;

  constructor(command: string, args: string[], requestTimeoutMs = 30_000) {
    this.command = command;
    this.args = args;
    this.requestTimeoutMs = requestTimeoutMs;
  }

  async start(): Promise<void> {
    const { spawn } = await import("node:child_process");
    this.child = spawn(this.command, this.args, { stdio: ["pipe", "pipe", "pipe"] });
    this.child.stdout!.on("data", (chunk: Buffer) => this.onData(String(chunk)));
    let stderrTail = "";
    this.child.stderr!.on("data", (chunk: Buffer) => {
      stderrTail = (stderrTail + String(chunk)).slice(-4_000);
    });
    this.child.on("error", (error: Error) => this.rejectAll(error));
    this.child.on("close", () => this.rejectAll(new Error(`MCP server exited. stderr: ${stderrTail.trim()}`)));

    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "stryde-mcp-transport", version: "v1" },
    });
    this.notify("notifications/initialized", {});
  }

  private onData(chunk: string) {
    this.buffer += chunk;
    let newlineIndex = this.buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (line) this.onLine(line);
      newlineIndex = this.buffer.indexOf("\n");
    }
  }

  private onLine(line: string) {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(line);
    } catch {
      return; // servers may log to stdout; tolerate non-protocol lines
    }
    const id = typeof message.id === "number" ? message.id : null;
    if (id === null) return; // notification from the server
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    clearTimeout(pending.timer);
    if (message.error) {
      const err = message.error as { code?: unknown; message?: unknown };
      pending.reject(new Error(`MCP error ${String(err.code ?? "")}: ${String(err.message ?? "unknown")}`));
    } else {
      pending.resolve(message.result);
    }
  }

  private rejectAll(error: Error) {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private request(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.child) throw new Error("MCP client is not started");
    const id = this.nextId++;
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request ${method} timed out`));
      }, this.requestTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      const stdin = this.child!.stdin;
      if (!stdin) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new Error("MCP client stdin is unavailable"));
        return;
      }
      stdin.write(payload + "\n", (error?: Error | null) => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  private notify(method: string, params: Record<string, unknown>) {
    if (!this.child) throw new Error("MCP client is not started");
    const stdin = this.child.stdin;
    if (!stdin) throw new Error("MCP client stdin is unavailable");
    stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  async listTools(): Promise<McpToolDescriptor[]> {
    const result = (await this.request("tools/list", {})) as { tools?: McpToolDescriptor[] };
    return Array.isArray(result?.tools) ? result.tools : [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
    const result = (await this.request("tools/call", { name, arguments: args })) as McpCallResult;
    return {
      content: Array.isArray(result?.content) ? result.content : [],
      isError: Boolean(result?.isError),
      structuredContent: result?.structuredContent,
    };
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    const child = this.child;
    this.child = null;
    this.rejectAll(new Error("MCP client stopped"));
    child.stdin?.end();
    // Give the server a beat to exit cleanly, then force it.
    const kill = setTimeout(() => {
      if (process.platform === "win32" && child.pid) {
        try {
          void import("node:child_process").then(({ spawn }) =>
            spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }));
        } catch { /* best effort */ }
      } else {
        child.kill("SIGKILL");
      }
    }, 2_000);
    child.once("close", () => clearTimeout(kill));
  }
}

// Server configuration: STRYDE_MCP_SERVERS is a JSON object mapping a server
// name to its stdio launch ({ "command": "...", "args": [...] }). Absent or
// malformed configuration fails closed at job time with an honest error.
export function parseMcpServerConfig(raw: string | undefined): Map<string, { command: string; args: string[] }> {
  const servers = new Map<string, { command: string; args: string[] }>();
  if (!raw?.trim()) return servers;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("STRYDE_MCP_SERVERS is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("STRYDE_MCP_SERVERS must be an object of name -> {command, args}");
  }
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) throw new Error(`MCP server ${name} must be an object`);
    const record = value as Record<string, unknown>;
    if (typeof record.command !== "string" || !record.command.trim()) {
      throw new Error(`MCP server ${name} needs a command`);
    }
    servers.set(name, {
      command: record.command,
      args: Array.isArray(record.args) ? record.args.map(String) : [],
    });
  }
  return servers;
}
