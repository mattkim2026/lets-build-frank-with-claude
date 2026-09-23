import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import ContentLayout from "@cloudscape-design/components/content-layout";
import { useCallback, useEffect, useState } from "react";
import { ToolRunner } from "../ToolRunner";
import { errorMessage, type FrankClient, type Tool } from "../mcp/client";

export function ToolsPage({ client }: { client: FrankClient }) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<Tool>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setTools(await client.listTools());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ContentLayout
      header={
        <Header variant="h1" description="Everything Frank exposes over MCP. Pick one to call it.">
          Tools
        </Header>
      }
    >
      <SpaceBetween size="l">
        {error && (
          <Alert type="error" header="Could not list Frank's tools"
            action={<Button onClick={() => void load()}>Retry</Button>}>
            {error}
          </Alert>
        )}
        <Table
          header={<Header variant="h2" counter={loading ? undefined : `(${tools.length})`}>Available tools</Header>}
          items={tools}
          loading={loading}
          loadingText="Discovering tools"
          trackBy="name"
          selectionType="single"
          selectedItems={selected ? [selected] : []}
          onSelectionChange={({ detail }) => setSelected(detail.selectedItems[0])}
          onRowClick={({ detail }) => setSelected(detail.item)}
          ariaLabels={{
            selectionGroupLabel: "Tools",
            itemSelectionLabel: (_s, item) => `Select ${item.name}`,
          }}
          columnDefinitions={[
            { id: "name", header: "Name", cell: (t) => <Box variant="code">{t.name}</Box> },
            { id: "title", header: "Title", cell: (t) => t.title ?? t.annotations?.title ?? "-" },
            { id: "description", header: "Description", cell: (t) => t.description ?? "-" },
          ]}
          empty={<Box textAlign="center">Frank exposes no tools.</Box>}
        />
        {selected && <ToolRunner key={selected.name} client={client} tool={selected} />}
      </SpaceBetween>
    </ContentLayout>
  );
}
