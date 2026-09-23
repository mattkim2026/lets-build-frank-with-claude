import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// This file sits one level below the package root in both layouts:
// src/config.ts under `npm run dev`, and dist/config.js in the container
// (/app/dist). So `..` is the package root in both, which is where the
// Dockerfile puts package.json and the console (`public/`).
export const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

// All settings come from the environment (ADR-001). Deliberately NOT strict:
// process.env always carries unrelated variables.
const EnvSchema = z.object({
  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(3000), // must match the Dockerfile's PORT and deploy.yml's --target-port
});

export interface Config {
  port: number;
  version: string;
  /** Built console (ui/dist), served at `/` when present (ADR-006). */
  consoleDir: string;
}

export class ConfigError extends Error {}

function readVersion(): string {
  const pkg = JSON.parse(
    readFileSync(path.join(packageRoot, "package.json"), "utf8"),
  ) as { version?: string };
  return pkg.version ?? "unknown";
}

/** Reads config from the environment. Fails at boot, in plain language. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(env)"}: ${issue.message}`)
      .join("\n");
    throw new ConfigError(`Frank cannot start. Check these environment variables:\n${problems}`);
  }
  return {
    port: parsed.data.PORT,
    version: readVersion(),
    consoleDir: path.join(packageRoot, "public"),
  };
}
