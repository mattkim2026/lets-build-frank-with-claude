import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import type { CallToolResult, FrankClient, Tool } from "../src/mcp/client";

const status = {
  summary: "Frank 0.1.0 is up and has been running for 5s.",
  version: "0.1.0",
  uptimeSeconds: 5,
  greeting: "Hi, I'm Frank.",
};

const tools: Tool[] = [
  {
    name: "get_status",
    title: "Frank's status",
    description: "Returns Frank's version.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "search_things",
    description: "Finds things.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: { query: { type: "string", description: "What to find." } },
    },
  },
];

function fakeClient(overrides: Partial<FrankClient> = {}): FrankClient {
  return {
    health: vi.fn(async () => true),
    listTools: vi.fn(async () => tools),
    callTool: vi.fn(async (name: string): Promise<CallToolResult> =>
      name === "get_status"
        ? { content: [{ type: "text", text: JSON.stringify(status) }], structuredContent: status }
        : { content: [{ type: "text", text: "Nothing matched." }], isError: true },
    ),
    ...overrides,
  };
}

afterEach(() => {
  window.location.hash = "";
});

describe("Overview", () => {
  it("shows get_status and connection health", async () => {
    render(<App client={fakeClient()} />);
    expect(await screen.findByText(status.summary)).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
  });

  it("says plainly when Frank cannot be reached", async () => {
    const client = fakeClient({
      health: vi.fn(async () => false),
      callTool: vi.fn(async () => { throw new Error("Failed to fetch"); }),
    });
    render(<App client={client} />);
    expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Unreachable")).toBeInTheDocument());
  });
});

describe("Tools", () => {
  it("lists tools and runs one from a form built from its schema", async () => {
    window.location.hash = "#/tools";
    const client = fakeClient();
    const user = userEvent.setup();
    render(<App client={client} />);

    await user.click(await screen.findByText("get_status"));
    await user.click(screen.getByRole("button", { name: "Call get_status" }));

    const result = await screen.findByTestId("tool-result");
    expect(JSON.parse(result.textContent ?? "")).toEqual(status);
    expect(client.callTool).toHaveBeenLastCalledWith("get_status", {});
  });

  it("validates required fields before calling, then shows a tool error", async () => {
    window.location.hash = "#/tools";
    const client = fakeClient();
    const user = userEvent.setup();
    render(<App client={client} />);

    await user.click(await screen.findByText("search_things"));
    const call = screen.getByRole("button", { name: "Call search_things" });
    await user.click(call);
    expect(screen.getByText("Required.")).toBeInTheDocument();
    expect(client.callTool).not.toHaveBeenCalledWith("search_things", expect.anything());

    await user.type(screen.getByRole("textbox", { name: /query/ }), "vm");
    await user.click(call);
    expect(await screen.findByText("Nothing matched.")).toBeInTheDocument();
    expect(client.callTool).toHaveBeenLastCalledWith("search_things", { query: "vm" });
  });

  it("offers a retry when tools cannot be listed", async () => {
    window.location.hash = "#/tools";
    render(<App client={fakeClient({ listTools: vi.fn(async () => { throw new Error("offline"); }) })} />);
    expect(await screen.findByText("offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
