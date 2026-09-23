import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { fakeConsole, testConfig } from "./helpers.js";

describe("HTTP surface", () => {
  it("GET /healthz returns 200", async () => {
    const res = await request(createApp(testConfig())).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("says the console is not built when there is none", async () => {
    const res = await request(createApp(testConfig())).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/console has not been built yet/);
  });

  it("serves the console at / when it exists", async () => {
    const ui = fakeConsole();
    try {
      const res = await request(createApp(testConfig({ consoleDir: ui.dir }))).get("/");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Frank console");
    } finally {
      ui.cleanup();
    }
  });

  it("keeps /mcp and /healthz working when a console is served", async () => {
    const ui = fakeConsole();
    try {
      const app = createApp(testConfig({ consoleDir: ui.dir }));
      expect((await request(app).get("/healthz")).status).toBe(200);
      expect((await request(app).get("/mcp")).status).toBe(405);
    } finally {
      ui.cleanup();
    }
  });

  it("rejects GET and DELETE on /mcp with 405", async () => {
    const app = createApp(testConfig());
    for (const method of ["get", "delete"] as const) {
      const res = await request(app)[method]("/mcp");
      expect(res.status).toBe(405);
      expect(res.headers.allow).toBe("POST");
    }
  });

  it("answers malformed JSON with a parse error and no stack trace", async () => {
    const res = await request(createApp(testConfig()))
      .post("/mcp")
      .set("content-type", "application/json")
      .set("accept", "application/json, text/event-stream")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(-32700);
    expect(res.text).not.toMatch(/at .*\.(js|ts):\d+/);
  });
});
