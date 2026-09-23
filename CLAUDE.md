# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Course material for a one-day class: build **Frank**, a read-only MCP server with a Cloudscape console, and deploy it to Azure Container Apps. `server/` and `ui/` start **empty on purpose**. Agents build them from the ADRs in `docs/adr/`, so read the relevant ADRs before writing code, and cite them by number.

Precedence when documents disagree: a later ADR that **supersedes** an earlier one wins (006 partly supersedes 003/004/005; 010 supersedes 006's credential model). `Dockerfile` and `.github/workflows/deploy.yml` show the current contract. Each superseded ADR's Status line names exactly which clauses still stand. Examples: ADR-004's scale-to-zero (min 0 / max 1), `/healthz` probe and single region, and ADR-005's "PRs build and test only".

Known conflict: ADR-004 (still in force on this point) gives the Container App a system-assigned **managed identity**, and a Dockerfile comment repeats that. ADR-010 says it "removes the managed identity" and that Frank authenticates with the classroom credential via env vars, and `deploy.yml` creates no identity. Follow ADR-010 and `deploy.yml`. ADR-010 does not formally declare that it supersedes ADR-004's identity clause, so raise this if it becomes relevant (e.g., when drafting ADR-009). ADR-007 (MCP auth) is **Rejected**. Do not implement it, and do not treat its `FRANK_MCP_TOKEN` / test-helper details as instructions.

## Commands

`server/` and `ui/` are self-contained npm packages (ADR-001, ADR-003). The Dockerfile and CI run `npm ci && npm test && npm run build` in each.

```bash
cd server   # or ui
npm ci
npm run dev          # server: tsx watch on :3000. ui: Vite, proxying /mcp and /healthz to :3000
npm test             # vitest
npm run typecheck    # server also type-checks test/ (the build only compiles src/)
npm run build        # server: tsc -> dist/. ui: tsc --noEmit + vite build -> dist/
npx vitest run test/conventions.test.ts   # single test file
```

Local image build and run (build context is the **repo root**, not `server/`):

```bash
docker build -t frank . && docker run -p 3000:3000 frank
curl localhost:3000/healthz
```

After deploy, connect with `claude mcp add --transport http frank https://<fqdn>/mcp`, then restart `claude`.

## Architecture (as decided in the ADRs)

- **One container** (ADR-006). The Express app in `server/` serves MCP over Streamable HTTP at `POST /mcp`, `GET /healthz`, and the built console as static files at `/`. The console calls `/mcp` **relatively**, so there is no CORS and no `VITE_FRANK_URL` (ADR-003's version of those is superseded).
- **Stack** (ADR-001): TypeScript on Node 22, the official `@modelcontextprotocol/sdk` (no hand-rolled protocol code), Express, and zod. All config comes from env vars. `PORT` defaults to **3000**, and that value must match `Dockerfile` `ENV PORT` and deploy.yml `--target-port 3000`.
- **Dockerfile expectations**: the server compiles to `server/dist/index.js`. At runtime the console lives at `<package root>/public` (i.e. `/app/public`). The console is **optional**: if `ui/package.json` is missing, the UI stage produces an empty dist, and the server must handle an absent console by saying so at `/` instead of crashing. `server/package-lock.json` must exist, because the Dockerfile copies it unconditionally.
- **Test gate**: `npm test` runs *inside* the Docker build for both packages. On `main`, the image build is the only build and the only test gate, so a red suite blocks deploy. On PRs, the separate `build-server` / `build-ui` jobs run, and they only activate once that package's `package-lock.json` is committed.
- **Deploy** (ADR-010): pushing to `main` deploys, and PRs only build and test. The workflow fetches a deliberately public, short-lived classroom credential and deploys to shared `rg-frank-class` as `frank-<github-owner>`. It passes `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_CLIENT_SECRET` into the container for `DefaultAzureCredential`. There is no managed identity. Keep using `az acr build` and `az containerapp create/update`, not `az containerapp up --source` (that crashes on some azure-cli builds).
- **Azure-reading tools (ADR-009, written in class)** read the resource group from `AZURE_RESOURCE_GROUP` at boot. Tools must **not** take a resource-group/scope parameter, so callers cannot redirect Frank. ADR-007's acceptance of an unauthenticated endpoint depends on this.

## MCP tool rules (ADR-002, enforced by the `frank-tools` skill and `tool-conventions` agent)

- One module per tool in `server/src/tools/`, each exporting its zod input schema and **registered in `server/src/tools/index.ts`**. The `tool-conventions` agent treats `index.ts` and `define.ts` as non-tool files. Unknown fields are rejected, and every parameter has a description.
- Every tool has a test under `server/test/`. Adding a new verb also requires a conventions test.
- Names are `verb_noun` snake_case, and the verb must come from the closed set **`get`, `list`, `search`, `summarize`**. If a tool seems to need `create`/`update`/`delete`/`run`, stop and say so. That takes a new ADR, not a tool.
- Output is structured JSON with a top-level `summary` string plus typed fields. Errors return `isError: true` with a plain-language message and never a stack trace.
- **Read-only**: no tool mutates Azure, GitHub, or the filesystem beyond temp space.
- The first tool is `get_status` (version, uptime, greeting).

## ADR workflow (ADR-000)

- Use `/adr <title>` to scaffold one. The flow is: Claude drafts, Copilot attacks, a human decides. New ADRs are `Status: Proposed` and stay uncommitted until a human accepts them.
- Keep each ADR to about one page, roughly 290–375 words like ADR-001 to ADR-005. Put exact signatures and error strings in code, not in the ADR.
- **Accepted ADRs are immutable.** Change course by writing a superseding ADR. The only permitted edit to an old ADR is its Status line, to note that it was superseded.
- When adding or changing an ADR, update the ADR tables in **both** `docs/adr/README.md` and `README.md`.
- Name the `adr-reviewer` agent explicitly when an ADR needs review. Description-based delegation is not reliable. Show its `ADR-REVIEWER FINDINGS` block verbatim, then say which findings you accept or reject and why.

## Repo-specific cautions

- Pushing to `main` deploys to Azure. Work on branches and merge through PRs.
- The classroom credential URL in `deploy.yml` is committed on purpose (ADR-010). Never commit the decoded credential, and never unmask it in workflow logs, because fork Actions logs are public. Run the `secret-scanner` agent before commits and PRs. Local env values go in `.env`, which is gitignored. Only `.env.example` is committed.
- `.claude/agents/*` are restricted to `Read, Grep, Glob` on purpose. Reviewers must not edit.
