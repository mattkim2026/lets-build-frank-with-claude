import AppLayout from "@cloudscape-design/components/app-layout";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import { useEffect, useState } from "react";
import type { FrankClient } from "./mcp/client";
import { OverviewPage } from "./pages/OverviewPage";
import { ToolsPage } from "./pages/ToolsPage";

// Hash routing (#/tools) so Frank needs no catch-all route that could shadow
// /mcp or /healthz. The server just serves static files.
const PAGES = { overview: "#/", tools: "#/tools" } as const;

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash || PAGES.overview);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || PAGES.overview);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export function App({ client }: { client: FrankClient }) {
  const hash = useHash();
  const onTools = hash === PAGES.tools;

  return (
    <AppLayout
      toolsHide
      navigation={
        <SideNavigation
          header={{ href: PAGES.overview, text: "Frank" }}
          activeHref={onTools ? PAGES.tools : PAGES.overview}
          items={[
            { type: "link", text: "Overview", href: PAGES.overview },
            { type: "link", text: "Tools", href: PAGES.tools },
          ]}
        />
      }
      content={onTools ? <ToolsPage client={client} /> : <OverviewPage client={client} />}
    />
  );
}
