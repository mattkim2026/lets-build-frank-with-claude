import { describe, expect, it } from "vitest";
import { getStatus } from "../../src/tools/get-status.js";

describe("get_status", () => {
  it("returns version, uptime and a greeting", async () => {
    const result = await getStatus.handler({}, { version: "1.2.3" });
    expect(result.version).toBe("1.2.3");
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(result.greeting).not.toBe("");
    expect(result.summary).toMatch(/^Frank 1\.2\.3 is up and has been running for \d+/);
    expect(getStatus.outputSchema.safeParse(result).success).toBe(true);
  });
});
