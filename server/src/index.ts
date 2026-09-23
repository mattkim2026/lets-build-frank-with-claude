import { createApp } from "./app.js";
import { ConfigError, loadConfig } from "./config.js";

let config;
try {
  config = loadConfig();
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

const server = createApp(config).listen(config.port, () => {
  console.log(`Frank ${config.version} listening on :${config.port} (MCP at POST /mcp)`);
});

// Container Apps sends SIGTERM when scaling to zero or replacing a revision.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
