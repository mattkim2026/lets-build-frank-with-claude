import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

export type { CallToolResult, Tool };

/** Everything the console needs from Frank. Pages depend on this, not on the SDK, so tests can fake it. */
export interface FrankClient {
  health(): Promise<boolean>;
  listTools(): Promise<Tool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult>;
}

/** Talks to the Frank that served this page. The console holds no secrets (ADR-003). */
export function createFrankClient(origin = window.location.origin): FrankClient {
  let connecting: Promise<Client> | undefined;

  // Frank's transport is stateless, so one initialize is enough for the tab.
  // A failed connect is forgotten so the next call retries.
  function connect(): Promise<Client> {
    connecting ??= (async () => {
      const client = new Client({ name: "frank-console", version: "0.1.0" });
      await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", origin)));
      return client;
    })().catch((err: unknown) => {
      connecting = undefined;
      throw err;
    });
    return connecting;
  }

  return {
    async health() {
      try {
        return (await fetch(new URL("/healthz", origin))).ok;
      } catch {
        return false;
      }
    },
    async listTools() {
      return (await (await connect()).listTools()).tools;
    },
    async callTool(name, args) {
      return (await (await connect()).callTool({ name, arguments: args })) as CallToolResult;
    },
  };
}

/** The text a tool returned, joined: for errors and for tools without structured output. */
export function resultText(result: CallToolResult): string {
  return result.content
    .map((c) => (c.type === "text" ? c.text : `[${c.type}]`))
    .join("\n");
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
