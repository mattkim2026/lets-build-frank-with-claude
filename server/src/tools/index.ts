import type { FrankTool } from "./define.js";
import { getStatus } from "./get-status.js";

/** Every tool Frank exposes. A tool not listed here is not registered. */
export const tools: readonly FrankTool[] = [getStatus as unknown as FrankTool];

const seen = new Set<string>();
for (const tool of tools) {
  if (seen.has(tool.name)) throw new Error(`Two tools are named "${tool.name}".`);
  seen.add(tool.name);
}
