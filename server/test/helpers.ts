import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApp } from "../src/app.js";
import type { Config } from "../src/config.js";

export function testConfig(overrides: Partial<Config> = {}): Config {
  return { port: 0, version: "9.9.9-test", consoleDir: "/nonexistent/frank-console", ...overrides };
}

/** A temp directory holding a fake built console. Call the returned cleanup. */
export function fakeConsole(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), "frank-console-"));
  writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>Frank console</title>");
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Starts Frank on an ephemeral port and connects a real MCP client over HTTP. */
export async function startFrank(config = testConfig()) {
  const server: Server = await new Promise((resolve) => {
    const s = createApp(config).listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const client = new Client({ name: "frank-test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", baseUrl)));
  return {
    baseUrl,
    client,
    async stop() {
      await client.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
