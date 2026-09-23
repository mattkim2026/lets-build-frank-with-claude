import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// ADR-002, enforced in code so a non-conforming tool fails at startup and in
// tests rather than in review. The `tool-conventions` agent checks the same
// rules from the outside.

/** The closed verb set. Adding a verb requires an ADR that supersedes ADR-002. */
export const TOOL_VERBS = ["get", "list", "search", "summarize"] as const;
export const TOOL_NAME_PATTERN = /^(get|list|search|summarize)_[a-z0-9]+(?:_[a-z0-9]+)*$/;

/** What a tool may know about Frank himself. Deliberately no request data. */
export interface ToolContext {
  version: string;
}

/** Throw this from a handler to return its message to the caller verbatim. */
export class ToolError extends Error {}

type OutputShape = { summary: z.ZodString } & z.ZodRawShape;

export interface FrankTool<
  I extends z.ZodObject = z.ZodObject,
  O extends z.ZodObject<OutputShape> = z.ZodObject<OutputShape>,
> {
  name: string;
  title: string;
  description: string;
  inputSchema: I;
  outputSchema: O;
  handler: (args: z.infer<I>, ctx: ToolContext) => Promise<z.infer<O>>;
}

/** Validates a tool against ADR-002 and returns it unchanged. Throws if it does not conform. */
export function defineTool<I extends z.ZodObject, O extends z.ZodObject<OutputShape>>(
  tool: FrankTool<I, O>,
): FrankTool<I, O> {
  const problems = conventionProblems(tool as unknown as FrankTool);
  if (problems.length > 0) {
    throw new Error(`Tool "${tool.name}" breaks ADR-002:\n  - ${problems.join("\n  - ")}`);
  }
  return tool;
}

export function conventionProblems(tool: FrankTool): string[] {
  const problems: string[] = [];
  if (!TOOL_NAME_PATTERN.test(tool.name)) {
    problems.push(`name must be verb_noun in lower snake_case with a verb from ${TOOL_VERBS.join("/")}`);
  }
  if (!tool.description.trim()) problems.push("description is empty");
  for (const [key, field] of Object.entries(tool.inputSchema.shape)) {
    if (!(field as z.ZodType).description) problems.push(`input parameter "${key}" has no description`);
  }
  // Behavioural check rather than poking at zod internals: a strict object
  // reports an unrecognized key; a default (stripping) object silently drops it.
  const probe = tool.inputSchema.safeParse({ __frank_unknown_field__: true });
  if (probe.success || !probe.error.issues.some((i) => i.code === "unrecognized_keys")) {
    problems.push("inputSchema must reject unknown fields (use z.strictObject)");
  }
  if (!(tool.outputSchema.shape.summary instanceof z.ZodString)) {
    problems.push('outputSchema needs a top-level "summary" string');
  }
  return problems;
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function registerTool(server: McpServer, tool: FrankTool, ctx: ToolContext): void {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      // Every Frank tool is read-only (ADR-002).
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args: unknown): Promise<CallToolResult> => {
      try {
        const result = await tool.handler(args as z.infer<typeof tool.inputSchema>, ctx);
        // Check the shape here so a mismatch reaches the caller as a plain
        // message, not as the SDK's raw validation output.
        const checked = tool.outputSchema.safeParse(result);
        if (!checked.success) {
          console.error(`tool ${tool.name} returned an invalid result`, checked.error.issues);
          return errorResult(`${tool.name} produced a result in an unexpected shape. This is a bug in Frank, not in your request.`);
        }
        return {
          content: [{ type: "text", text: JSON.stringify(checked.data, null, 2) }],
          structuredContent: checked.data,
        };
      } catch (err) {
        console.error(`tool ${tool.name} failed`, err);
        return errorResult(
          err instanceof ToolError ? err.message : `${tool.name} failed unexpectedly. Frank's logs have the details.`,
        );
      }
    },
  );
}
