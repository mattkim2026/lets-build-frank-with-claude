import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The console is served by Frank at `/` and calls `/mcp` relatively (ADR-006),
// so there is no VITE_FRANK_URL and no CORS. In `npm run dev` the proxy gives
// the same shape: start Frank on :3000 (`cd server && npm run dev`) first.
const FRANK = "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/mcp": FRANK,
      "/healthz": FRANK,
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["test/setup.ts"],
  },
});
