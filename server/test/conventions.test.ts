import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { conventionProblems, defineTool, registerTool, ToolError, type FrankTool } from "../src/tools/define.js";
import { tools } from "../src/tools/index.js";

// ADR-002 as a failing test. Every registered tool must pass all of these.
describe.each(tools.map((t) => [t.name, t] as const))("tool %s", (_name, tool) => {
  it("conforms to ADR-002", () => {
    expect(conventionProblems(tool)).toEqual([]);
  });

  it("uses a verb from the closed set", () => {
    expect(tool.name.split("_")[0]).toMatch(/^(get|list|search|summarize)$/);
  });
});

describe("defineTool", () => {
  const output = z.object({ summary: z.string() });
  const base = {
    title: "t",
    description: "Returns a thing.",
    inputSchema: z.strictObject({}),
    outputSchema: output,
    handler: async () => ({ summary: "ok" }),
  };

  it.each(["create_thing", "delete_thing", "update_thing", "run_thing", "getThing", "get", "fetch_thing"])(
    "rejects the name %s",
    (name) => {
      expect(() => defineTool({ ...base, name })).toThrow(/ADR-002/);
    },
  );

  it("rejects an input schema that strips unknown fields instead of refusing them", () => {
    expect(() => defineTool({ ...base, name: "get_thing", inputSchema: z.object({}) })).toThrow(/unknown fields/);
  });

  it("rejects an undescribed parameter", () => {
    expect(() =>
      defineTool({ ...base, name: "get_thing", inputSchema: z.strictObject({ id: z.string() }) }),
    ).toThrow(/"id" has no description/);
  });

  it("rejects an empty description", () => {
    expect(() => defineTool({ ...base, name: "get_thing", description: " " })).toThrow(/description is empty/);
  });

  it("rejects duplicate tool names", () => {
    expect(new Set(tools.map((t) => t.name)).size).toBe(tools.length);
  });
});

describe("tool errors", () => {
  async function call(handler: () => Promise<unknown>) {
    const tool = {
      name: "get_thing",
      title: "t",
      description: "Returns a thing.",
      inputSchema: z.strictObject({}),
      outputSchema: z.object({ summary: z.string() }),
      handler,
    } as unknown as FrankTool;
    const server = new McpServer({ name: "t", version: "0" });
    registerTool(server, tool, { version: "0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: "c", version: "0" });
    await client.connect(b);
    const result = await client.callTool({ name: "get_thing", arguments: {} });
    await client.close();
    return { isError: result.isError, text: (result.content as Array<{ text: string }>)[0]?.text ?? "" };
  }

  it("passes a ToolError message through verbatim", async () => {
    expect(await call(async () => { throw new ToolError("Azure did not answer in time."); })).toEqual({
      isError: true,
      text: "Azure did not answer in time.",
    });
  });

  it("hides unexpected errors and never returns a stack trace", async () => {
    const r = await call(async () => { throw new Error("boom at /secret/path.ts:12"); });
    expect(r.isError).toBe(true);
    expect(r.text).not.toContain("boom");
    expect(r.text).toMatch(/failed unexpectedly/);
  });

  it("turns a wrongly shaped result into a plain message", async () => {
    const r = await call(async () => ({ nope: 1 }));
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/unexpected shape/);
  });
});
