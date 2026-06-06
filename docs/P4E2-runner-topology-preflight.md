# P4E2 Runner Topology and Preflight Requirements

This is the implementation contract for the one-command local demo runner. The runner must start the same graph every time, fail before partial startup when a known prerequisite is missing, and print enough state for a judge rehearsal operator to know which service is ready.

## Startup graph

1. Preflight the local machine and env.
2. Build the SpacetimeDB module with `npm run spacetime:build`.
3. Start SpacetimeDB.
4. Wait for SpacetimeDB readiness, then publish `solar-dominion`.
5. Start the orchestrator in the selected LLM mode.
6. Wait for orchestrator readiness.
7. Start the Vite frontend.
8. Wait for frontend readiness, then print the demo URL.
9. On shutdown, stop children in reverse order: frontend, orchestrator, SpacetimeDB.

## Service topology

| Service | Startup order | Command owner | Port / endpoint | Readiness signal | Shutdown expectation |
|---|---:|---|---|---|---|
| `spacetimedb` | 1 | `npm run spacetime:start` from repo root, which delegates to `server/` | HTTP `http://localhost:3000`; browser/SDK WebSocket `ws://localhost:3000` | TCP port 3000 accepts connections and `npm run spacetime:publish` succeeds against `http://localhost:3000` for database `solar-dominion` | Receive runner termination signal, exit cleanly, release port 3000, and leave the local server reusable for an immediate rerun. |
| `orchestrator` | 2 | `npm run dev:orchestrator` or the packaged runner entry in `orchestrator/` | HTTP `http://localhost:8787` using `PORT=8787` | `GET http://localhost:8787/health` returns 200 and reports `mode`, `spacetimeHost`, `dbName`, and provider readiness. If the service exits before health passes, startup fails. | Stop after frontend, before SpacetimeDB. Drain or cancel in-flight LLM work, never log `OPENROUTER_API_KEY`, and release port 8787. |
| `frontend` | 3 | `npm run dev:client` from repo root, which delegates to `client/` | HTTP `http://localhost:5173` | `GET http://localhost:5173/` returns 200 and the runner can print `http://localhost:5173` as the operator URL. | Stop first, release port 5173, and leave no watched Vite child processes running. |

`orchestrator/src/index.ts` currently exports provider code but no long-running HTTP server. The runner work in #131 must either add that server or wrap the provider in a runner-owned process that exposes the health contract above. A process that starts and exits immediately is not ready.

## Required env and config

Use these defaults unless an operator overrides them explicitly.

| Variable | Normal mode | Mock mode | Fixture demo mode | Consumer |
|---|---|---|---|---|
| `LLM_MODE` | `live` | `mock` | `fixture` | Orchestrator |
| `PORT` | `8787` | `8787` | `8787` | Orchestrator |
| `SPACETIME_HOST` | `http://localhost:3000` | `http://localhost:3000` | `http://localhost:3000` | Orchestrator |
| `SPACETIME_DB_NAME` | `solar-dominion` | `solar-dominion` | `solar-dominion` | Orchestrator |
| `OPENROUTER_API_KEY` | Required and non-empty | Must be unset or ignored | Must be unset or ignored | Orchestrator live provider |
| `OPENROUTER_MODEL` | Optional, defaults to `inception/mercury-2` | Ignored | Ignored | Orchestrator live provider |
| `OPENROUTER_BASE_URL` | Optional, defaults to `https://openrouter.ai/api/v1` | Ignored | Ignored | Orchestrator live provider |
| `OPENROUTER_TIMEOUT_MS` | Optional, positive integer up to 120000 | Ignored | Ignored | Orchestrator live provider |
| `LLM_FIXTURE_PATH` | Ignored | Ignored | Optional, defaults to `orchestrator/fixtures/scenarios.json` | Orchestrator fixture provider |
| `VITE_LLM_MODE` | `live` | `mock` | `fixture` | Frontend display/config |
| `VITE_SPACETIME_HOST` | `ws://localhost:3000` | `ws://localhost:3000` | `ws://localhost:3000` | Frontend config diagnostics |
| `VITE_SPACETIME_DB_NAME` | `solar-dominion` | `solar-dominion` | `solar-dominion` | Frontend config diagnostics |
| `VITE_SPACETIMEDB_URI` | `http://localhost:3000` | `http://localhost:3000` | `http://localhost:3000` | Current session backend connection |
| `VITE_SPACETIMEDB_MODULE` | `solar-dominion` | `solar-dominion` | `solar-dominion` | Current session backend connection |

The frontend has two SpacetimeDB env surfaces today: `client/src/spacetime/config.ts` uses `VITE_SPACETIME_HOST` / `VITE_SPACETIME_DB_NAME`, while `client/src/session/spacetime.ts` uses `VITE_SPACETIMEDB_URI` / `VITE_SPACETIMEDB_MODULE`. Until those converge, the runner must set both pairs.

## Mode behavior

| Mode | Purpose | Startup side effects | Network expectation |
|---|---|---|---|
| Normal mode | Local run against live OpenRouter text generation. | Set module deliberation mode to `queue` after orchestrator health passes. Do not seed demo data unless the operator requests it. | External network allowed only from orchestrator to OpenRouter. |
| Mock mode | Local development and CI without tokens. | Set module deliberation mode to `queue`; provider returns deterministic mock payloads. | No external network. |
| Fixture demo mode | Judge-ready rehearsal/default demo path. | Set module deliberation mode to `queue`, load fixture provider, and optionally call `spacetime call solar-dominion --server http://localhost:3000 seed_demo_world <scenario>` when the runner exposes a seed option. | No external network. |

If the orchestrator is deliberately skipped for a fallback-only rehearsal, the runner must call `spacetime call solar-dominion --server http://localhost:3000 set_deliberation_mode "fallback"` and must not claim orchestrator readiness.

## Preflight failures that must stop startup

These checks happen before launching any long-running child process unless marked as a readiness check.

| Failure | Detection | Required message / action |
|---|---|---|
| Missing `node`, `npm`, or `spacetime` CLI | Run version commands during preflight. | Name the missing executable and point to `DEVELOPMENT.md` prerequisites. |
| Missing workspace dependencies | Check for required package installs or run a fast package manager validation. | Tell operator to run `npm install` from repo root. |
| Port collision on 3000, 8787, or 5173 | Probe each port before startup. | Print the occupied port and service name. Do not start any child. |
| Invalid `LLM_MODE` | Validate one of `live`, `mock`, `fixture`. | Print accepted values and selected default. |
| `LLM_MODE=live` without `OPENROUTER_API_KEY` | Check env before startup. | Stop with `OPENROUTER_API_KEY is required when LLM_MODE=live`; never print secret values. |
| Invalid `OPENROUTER_BASE_URL` or `OPENROUTER_TIMEOUT_MS` | Reuse orchestrator config validation semantics. | Print the invalid variable and expected shape. |
| Fixture file missing or invalid | If `LLM_MODE=fixture`, resolve `LLM_FIXTURE_PATH` or default catalog and parse it before startup. | Stop with the fixture path and parse reason. |
| Empty SpacetimeDB database name | Validate `SPACETIME_DB_NAME`, `VITE_SPACETIME_DB_NAME`, and `VITE_SPACETIMEDB_MODULE`. | Stop and print `solar-dominion` as the local default. |
| Invalid frontend WebSocket URL | Validate `VITE_SPACETIME_HOST` starts with `ws://` or `wss://`. | Stop and print `ws://localhost:3000` as the local default. |
| SpacetimeDB readiness timeout | Readiness check after launch. | Stop all children, report that `http://localhost:3000` did not become reachable, and include the last SpacetimeDB log lines. |
| Publish failure | `npm run spacetime:publish` exits non-zero. | Stop SpacetimeDB, report publish failure, and include the command. |
| Orchestrator readiness timeout or early exit | Health check after launch. | Stop all children, report `http://localhost:8787/health` failure or early exit, and include last orchestrator log lines. |
| Frontend readiness timeout | HTTP check after launch. | Stop all children, report `http://localhost:5173/` failure, and include last Vite log lines. |

## Operator-ready output

When all readiness checks pass, print exactly these fields:

- `SpacetimeDB: ready http://localhost:3000 db=solar-dominion`
- `Orchestrator: ready http://localhost:8787 mode=<live|mock|fixture>`
- `Frontend: ready http://localhost:5173`
- `Shutdown: press Ctrl+C once; runner stops frontend, orchestrator, then SpacetimeDB`

The runner should keep prefixing child logs with service names after startup so failures remain attributable during a live demo.
