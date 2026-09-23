import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startFrank } from "./helpers.js";

describe("MCP over Streamable HTTP", () => {
  let frank: Awaited<ReturnType<typeof startFrank>>;
  beforeAll(async () => {
    frank = await startFrank();
  });
  afterAll(async () => {
    await frank.stop();
  });

  it("identifies itself as frank", () => {
    expect(frank.client.getServerVersion()).toMatchObject({ name: "frank", version: "9.9.9-test" });
  });

  it("lists get_status as a read-only tool that rejects unknown fields", async () => {
    const { tools } = await frank.client.listTools();
    const tool = tools.find((t) => t.name === "get_status");
    expect(tool).toBeDefined();
    expect(tool?.annotations?.readOnlyHint).toBe(true);
    expect(tool?.inputSchema).toMatchObject({ type: "object", additionalProperties: false });
    expect(tool?.outputSchema?.required).toContain("summary");
  });

  it("calls get_status and returns a summary plus typed fields", async () => {
    const result = await frank.client.callTool({ name: "get_status", arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      summary: expect.stringContaining("Frank 9.9.9-test is up"),
      version: "9.9.9-test",
      uptimeSeconds: expect.any(Number),
    });
  });

  it("refuses unknown arguments with isError and a readable message", async () => {
    const result = await frank.client.callTool({ name: "get_status", arguments: { resourceGroup: "someone-else" } });
    expect(result.isError).toBe(true);
    const [first] = result.content as Array<{ type: string; text: string }>;
    expect(first?.text).toMatch(/Unrecognized key/);
  });

  it("serves several clients at once (stateless transport)", async () => {
    const more = await Promise.all([startFrank(), startFrank()]);
    try {
      const results = await Promise.all(
        [frank, ...more].map((f) => f.client.callTool({ name: "get_status", arguments: {} })),
      );
      for (const r of results) expect(r.isError).toBeFalsy();
    } finally {
      await Promise.all(more.map((f) => f.stop()));
    }
  });
});
