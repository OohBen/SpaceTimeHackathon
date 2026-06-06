# P4E2 Local Runner Operator Guide

The default judge rehearsal command is:

```sh
npm run demo
```

It starts the stack in fixture mode unless `LLM_MODE` is set. Fixture mode is
the judge-ready default because it needs no external network or OpenRouter key.

## Prerequisites

- Node.js supported by `package.json`.
- npm installed with Node.js.
- spacetime CLI available on `PATH`.
- `npm install` already run from the repository root.
- Ports `3000`, `8787`, and `5173` free.

## Startup Sequence

1. Preflight tools, dependencies, env, fixture file, URLs, and ports.
2. Build the SpacetimeDB module with `npm run spacetime:build`.
3. Start local SpacetimeDB on `http://localhost:3000`.
4. Publish `solar-dominion`.
5. Start the orchestrator on `http://localhost:8787`.
6. Confirm `GET http://localhost:8787/health` returns provider readiness.
7. Set module deliberation mode to `queue`.
8. Start the Vite frontend on `http://localhost:5173`.
9. Confirm the frontend HTTP route responds.

## Expected Output

When the stack is ready, the runner prints:

```text
SpacetimeDB: ready http://localhost:3000 db=solar-dominion
Orchestrator: ready http://localhost:8787 mode=fixture
Frontend: ready http://localhost:5173
Shutdown: press Ctrl+C once; runner stops frontend, orchestrator, then SpacetimeDB
```

Child logs stay prefixed with `[spacetimedb]`, `[orchestrator]`, or
`[frontend]` so startup and demo-time failures are attributable.

## Smoke Check

Use this before a judge rehearsal:

```sh
npm run demo:smoke
```

It performs the same startup and readiness path, prints the ready lines, then
tears down frontend, orchestrator, and SpacetimeDB in reverse order.

## Modes

```sh
npm run demo
LLM_MODE=mock npm run demo
LLM_MODE=live OPENROUTER_API_KEY=... npm run demo
```

- `fixture`: default, deterministic, no external network.
- `mock`: deterministic generated responses, no external network.
- `live`: uses OpenRouter and requires `OPENROUTER_API_KEY`.

The runner sets both frontend SpacetimeDB env surfaces:
`VITE_SPACETIME_HOST` / `VITE_SPACETIME_DB_NAME` and
`VITE_SPACETIMEDB_URI` / `VITE_SPACETIMEDB_MODULE`.

## Failure Recovery

- Missing `node`, `npm`, or `spacetime`: install the prerequisite listed in
  `DEVELOPMENT.md`.
- Missing workspace dependencies: run `npm install` from the repository root.
- Occupied port `3000`, `8787`, or `5173`: stop the process using that port,
  then rerun `npm run demo`.
- `LLM_MODE=live` without `OPENROUTER_API_KEY`: set the key or use fixture mode.
- Invalid fixture path or JSON: fix `LLM_FIXTURE_PATH` or restore
  `orchestrator/fixtures/scenarios.json`.
- Readiness timeout: the runner stops already-started children and prints the
  failing service with recent prefixed logs.

Press `Ctrl+C` once for normal shutdown. The runner stops frontend first,
orchestrator second, and SpacetimeDB last so the next run can reuse the ports.
