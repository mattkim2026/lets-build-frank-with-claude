import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig, packageRoot } from "../src/config.js";

describe("loadConfig", () => {
  it("defaults PORT to 3000 (matches the Dockerfile and deploy.yml)", () => {
    expect(loadConfig({}).port).toBe(3000);
  });

  it("reads PORT and ignores unrelated variables", () => {
    expect(loadConfig({ PORT: "8080", HOSTNAME: "x", PATH: "/bin" }).port).toBe(8080);
  });

  it("fails in plain language on a bad PORT", () => {
    expect(() => loadConfig({ PORT: "eighty" })).toThrow(ConfigError);
    expect(() => loadConfig({ PORT: "eighty" })).toThrow(/Frank cannot start[\s\S]*PORT/);
  });

  it("finds package.json and the console relative to the package root", () => {
    const config = loadConfig({});
    expect(config.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(config.consoleDir).toBe(path.join(packageRoot, "public"));
  });
});
