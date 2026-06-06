# Development Guide

Solar Dominion monorepo — three packages: `server` (SpacetimeDB module), `client` (React SPA), `orchestrator` (LLM proxy).

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | >= 20.19 or >= 22.12 | `node --version` |
| npm | >= 10 | bundled with supported Node releases |
| spacetime CLI | latest | SpacetimeDB local dev (see below) |

### Install spacetime CLI

```sh
curl -sSf https://install.spacetimedb.com | sh
spacetime --version
```

## First-Time Setup

```sh
git clone <repo>
cd SpaceTimeHackathon
npm install          # installs all workspace dependencies
```

## Key Commands

| Command | What it does | Expected output |
|---|---|---|
| `npm test` | Run all workspace tests | All test files pass |
| `npm run build` | TypeScript type-check all workspaces | No errors |
| `npm run demo` | Start the full judge-ready local demo stack in fixture mode | Ready lines for SpacetimeDB, orchestrator, and frontend |
| `npm run demo:smoke` | Start the full stack, verify readiness, then tear down | Same ready lines, then ports are released |
| `npm run dev:client` | Start Vite dev server for React frontend | http://localhost:5173 |
| `npm run dev:orchestrator` | Start LLM orchestrator in watch mode | http://localhost:8787/health |
| `npm run spacetime:build` | Compile SpacetimeDB module artifact | Build output in server/ |
| `npm run spacetime:start` | Start local SpacetimeDB | ws://localhost:3000 |
| `npm run spacetime:publish` | Publish module to running SpacetimeDB | Module registered as `solar-dominion` |
| `npm run generate` | Generate TypeScript client bindings | `client/src/module_bindings/` updated |

## SpacetimeDB Workflow

Typical backend iteration cycle:

```sh
# 1. Edit server/src/*.ts (schema, reducers)
# 2. Type-check
npm run build --workspace=server
# 3. Build module artifact
npm run spacetime:build
# 4. Start / restart local SpacetimeDB
npm run spacetime:start
# 5. Regenerate client bindings after schema changes
npm run generate
# 6. Verify frontend type-checks with new bindings
npm run build --workspace=client
```

For step-by-step workflow, see `server/scripts/dev.sh`:

```sh
cd server
./scripts/dev.sh build     # compile module
./scripts/dev.sh start     # start local server
./scripts/dev.sh generate  # regenerate bindings
```

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

```sh
cp .env.example .env
```

| Variable | Required for | Description |
|---|---|---|
| `VITE_SPACETIME_HOST` | client dev | SpacetimeDB WebSocket URL (default: `ws://localhost:3000`) |
| `VITE_SPACETIME_DB_NAME` | client dev | Published module name (default: `solar-dominion`) |
| `SPACETIME_HOST` | orchestrator | SpacetimeDB HTTP URL |
| `SPACETIME_LISTEN_ADDR` | local server | SpacetimeDB local bind address |
| `SPACETIME_DB_NAME` | orchestrator | Published module name |
| `OPENROUTER_API_KEY` | LLM mode `live` | API key for proposal generation |
| `LLM_MODE` | orchestrator | `live`, `mock`, or `fixture`; local demo defaults to `fixture` |
| `PORT` | orchestrator | HTTP port for `/health` (local demo default: `8787`) |
| `VITE_SPACETIMEDB_URI` | client dev | SpacetimeDB HTTP URL used by the current session backend |
| `VITE_SPACETIMEDB_MODULE` | client dev | Published module name used by the current session backend |

## One-Command Local Demo

Run the judge-ready local stack with:

```sh
npm run demo
```

The command preflights Node.js, npm, the spacetime CLI, workspace installs,
ports 3000/8787/5173, LLM mode configuration, fixture files, and frontend
SpacetimeDB URLs before starting long-running services. It starts SpacetimeDB,
publishes `solar-dominion`, starts the orchestrator health server, starts Vite,
then prints the demo URL. See `docs/P4E2-local-runner-operator-guide.md` for
expected output and recovery steps.

## Workspace Layout

```
/
├── server/          @solar-dominion/server — SpacetimeDB TypeScript module
│   ├── src/
│   │   ├── index.ts          SpacetimeDB CLI module entry point
│   │   ├── module.ts         Compatibility re-export for module imports
│   │   └── lib.ts            Utilities and version constant
│   └── scripts/dev.sh        Local dev helper
├── client/          @solar-dominion/client — React + Zustand SPA
│   └── src/
│       └── module_bindings/  Generated SpacetimeDB client bindings
│           └── index.ts      Re-run `npm run generate` after schema changes
├── orchestrator/    @solar-dominion/orchestrator — LLM proxy service
├── PLAN.md          Project goals and stack decisions
├── SPECS.md         Data models, API routes, UI flows
└── .env.example     Environment variable template
```

## Regenerating Client Bindings

Run after any schema change in `server/src/index.ts`:

```sh
npm run generate
# then commit the updated client/src/module_bindings/index.ts
```

The bindings file is committed to the repo so the client compiles without requiring the spacetime CLI.
