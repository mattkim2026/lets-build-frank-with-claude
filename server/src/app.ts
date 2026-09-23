import { existsSync } from "node:fs";
import path from "node:path";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type ErrorRequestHandler } from "express";
import type { Config } from "./config.js";
import { createMcpServer } from "./mcp.js";

const NO_CONSOLE =
  "Frank is running, but his console has not been built yet (ADR-003).\n" +
  "MCP is at POST /mcp and health at GET /healthz.\n";

function jsonRpcError(code: number, message: string) {
  return { jsonrpc: "2.0", error: { code, message }, id: null };
}

export function createApp(config: Config) {
  const app = express();
  app.disable("x-powered-by");

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Stateless Streamable HTTP: a fresh server and transport per request, no
  // session ids. JSON responses rather than SSE, since no tool streams.
  app.post("/mcp", express.json({ limit: "1mb" }), async (req, res) => {
    const server = createMcpServer({ version: config.version });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("MCP request failed", err);
      if (!res.headersSent) res.status(500).json(jsonRpcError(-32603, "Internal server error"));
    }
  });

  // Stateless mode has no session to stream to or delete.
  app.all("/mcp", (_req, res) => {
    res.status(405).set("Allow", "POST").json(jsonRpcError(-32000, "Method not allowed. Use POST."));
  });

  // The console is optional: ui/ may not be built yet (ADR-003, Dockerfile).
  if (existsSync(path.join(config.consoleDir, "index.html"))) {
    app.use(express.static(config.consoleDir));
  } else {
    app.get("/", (_req, res) => {
      res.type("text/plain").send(NO_CONSOLE);
    });
  }

  // Malformed JSON and oversized bodies end up here. No stack traces (ADR-002).
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = typeof err?.status === "number" ? err.status : 500;
    if (status >= 500) console.error("request failed", err);
    const message = status === 400 ? "Parse error: request body is not valid JSON." : "Request failed.";
    res.status(status).json(jsonRpcError(status === 400 ? -32700 : -32603, message));
  };
  app.use(onError);

  return app;
}
