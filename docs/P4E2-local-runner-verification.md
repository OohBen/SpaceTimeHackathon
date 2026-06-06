# P4E2 Local Runner Verification

Issue: #129
Date: 2026-06-06

## Results

- `npm test: PASS`
- `npm run build: PASS`
- `npm run demo:smoke: PASS`
- `node scripts/local-demo-runner.mjs --mode=bad-mode: PASS`
- `LLM_MODE=live node scripts/local-demo-runner.mjs --smoke: PASS`
- `Docs match startup behavior: PASS`

## Evidence

`npm test` passed the full repository suite:

- Runner tests: 9 passed.
- Server tests: 25 files, 220 tests passed.
- Client tests: 17 files, 150 tests passed.
- Orchestrator tests: 13 files, 112 tests passed.

`npm run demo:smoke` ran outside the filesystem sandbox because SpacetimeDB
must bind local ports and write local data. The smoke run:

- Built the SpacetimeDB module.
- Started SpacetimeDB on `http://localhost:3000` using
  `.spacetimedb-local-data/`.
- Published `solar-dominion`.
- Started orchestrator `/health` on `http://localhost:8787`.
- Set deliberation mode to `queue`.
- Started Vite on `http://localhost:5173`.
- Printed all operator-ready lines.
- Shut down services and left ports `3000`, `8787`, and `5173` clear.

Ready output observed:

```text
SpacetimeDB: ready http://localhost:3000 db=solar-dominion
Orchestrator: ready http://localhost:8787 mode=fixture
Frontend: ready http://localhost:5173
Shutdown: press Ctrl+C once; runner stops frontend, orchestrator, then SpacetimeDB
```

Failure guidance checks:

- Invalid mode stopped in preflight with accepted values and default:
  `Invalid LLM_MODE: bad-mode. Accepted values: live, mock, fixture. Default: fixture.`
- Live mode without an API key stopped in preflight:
  `OPENROUTER_API_KEY is required when LLM_MODE=live`

## Follow-Up Fixes Made During Verification

- Runner now fails immediately when a managed child exits before readiness,
  including recent prefixed logs in the error.
- Windows teardown now uses process-tree termination for managed children.
- Runner starts SpacetimeDB with a workspace-owned `.spacetimedb-local-data/`
  directory and resets that directory before startup, avoiding stale global
  local database ownership.
- Runner starts Vite through the client workspace script so Vite receives
  `--host`, `--port`, and `--strictPort` correctly.
