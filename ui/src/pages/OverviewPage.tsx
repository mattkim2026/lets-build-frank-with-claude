import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { useCallback, useEffect, useState } from "react";
import { errorMessage, resultText, type FrankClient } from "../mcp/client";

interface Status {
  summary: string;
  version: string;
  uptimeSeconds: number;
  greeting: string;
}

type Load<T> = { state: "loading" } | { state: "ok"; value: T } | { state: "error"; message: string };

export function OverviewPage({ client }: { client: FrankClient }) {
  const [health, setHealth] = useState<Load<boolean>>({ state: "loading" });
  const [status, setStatus] = useState<Load<Status>>({ state: "loading" });

  const refresh = useCallback(async () => {
    setHealth({ state: "loading" });
    setStatus({ state: "loading" });
    void client.health().then((ok) => setHealth({ state: "ok", value: ok }));
    try {
      const result = await client.callTool("get_status", {});
      if (result.isError) setStatus({ state: "error", message: resultText(result) });
      else setStatus({ state: "ok", value: result.structuredContent as unknown as Status });
    } catch (err) {
      setStatus({ state: "error", message: errorMessage(err) });
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ContentLayout
      header={
        <Header variant="h1" description="What Frank says about himself, and whether he is reachable."
          actions={<Button iconName="refresh" onClick={() => void refresh()}>Refresh</Button>}>
          Overview
        </Header>
      }
    >
      <SpaceBetween size="l">
        <Container header={<Header variant="h2">Connection</Header>}>
          <KeyValuePairs
            columns={2}
            items={[
              { label: "Health (GET /healthz)", value: <HealthIndicator health={health} /> },
              { label: "MCP (POST /mcp)", value: <McpIndicator status={status} /> },
            ]}
          />
        </Container>
        <Container header={<Header variant="h2">Status (get_status)</Header>}>
          {status.state === "loading" && <StatusIndicator type="loading">Asking Frank…</StatusIndicator>}
          {status.state === "error" && (
            <Alert type="error" header="Frank did not answer get_status">{status.message}</Alert>
          )}
          {status.state === "ok" && (
            <SpaceBetween size="m">
              <div>{status.value.summary}</div>
              <KeyValuePairs
                columns={3}
                items={[
                  { label: "Version", value: status.value.version },
                  { label: "Uptime", value: `${status.value.uptimeSeconds}s` },
                  { label: "Greeting", value: status.value.greeting },
                ]}
              />
            </SpaceBetween>
          )}
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
}

function HealthIndicator({ health }: { health: Load<boolean> }) {
  if (health.state === "loading") return <StatusIndicator type="loading">Checking</StatusIndicator>;
  if (health.state === "ok" && health.value) return <StatusIndicator type="success">Healthy</StatusIndicator>;
  return <StatusIndicator type="error">Unreachable</StatusIndicator>;
}

function McpIndicator({ status }: { status: Load<Status> }) {
  if (status.state === "loading") return <StatusIndicator type="loading">Connecting</StatusIndicator>;
  if (status.state === "ok") return <StatusIndicator type="success">Connected</StatusIndicator>;
  return <StatusIndicator type="error">Not connected</StatusIndicator>;
}
