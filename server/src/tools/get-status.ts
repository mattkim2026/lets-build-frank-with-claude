import { z } from "zod";
import { defineTool } from "./define.js";

export const inputSchema = z.strictObject({});

export const outputSchema = z.object({
  summary: z.string().describe("One line a person or model can read."),
  version: z.string().describe("Frank's package version."),
  uptimeSeconds: z.number().describe("Seconds since this Frank process started."),
  greeting: z.string().describe("A hello from Frank."),
});

export const getStatus = defineTool({
  name: "get_status",
  title: "Frank's status",
  description:
    "Returns Frank's version, how long he has been running, and a greeting. " +
    "Use it to check that Frank is reachable; it reads nothing outside Frank himself.",
  inputSchema,
  outputSchema,
  handler: async (_args, ctx) => {
    const uptimeSeconds = Math.floor(process.uptime());
    return {
      summary: `Frank ${ctx.version} is up and has been running for ${formatDuration(uptimeSeconds)}.`,
      version: ctx.version,
      uptimeSeconds,
      greeting: "Hi, I'm Frank. I can look, but I don't touch.",
    };
  },
});

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
