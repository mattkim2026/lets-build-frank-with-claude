import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool, type ToolContext } from "./tools/define.js";
import { tools } from "./tools/index.js";

export function createMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: "frank", version: ctx.version });
  for (const tool of tools) registerTool(server, tool, ctx);
  return server;
}
