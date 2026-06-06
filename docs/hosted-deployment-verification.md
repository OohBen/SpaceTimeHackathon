# Hosted Deployment Verification

Date: 2026-06-06

Issue: #64

Branch: `task/64-verify-hosted-deployment-and-smoke-path`

## Target

Repository Actions variables were checked before smoke verification. No deployed hosted
targets were configured:

- `HOSTED_FRONTEND_URL`: missing
- `ORCHESTRATOR_BASE_URL`: missing
- `SPACETIME_URI`: missing

Because no deployed URLs existed, verification used a staging-equivalent local smoke
path that exercises the same `scripts/hosted-smoke.mjs` checks against HTTP
frontend, SpacetimeDB, and orchestrator surfaces.

Follow-up deploy blocker: #326.

## Results

- Hosted-mode frontend build: PASS.
  Command: `npm run build --workspace=client` with `VITE_HOSTED=true`,
  `VITE_HOSTED_FRONTEND_URL=http://127.0.0.1:4173`,
  `VITE_SPACETIME_HOST=http://127.0.0.1:3000`,
  `VITE_SPACETIME_DB_NAME=solar-dominion`,
  `VITE_ORCHESTRATOR_BASE_URL=http://127.0.0.1:4000`, and
  `VITE_DEMO_MODE=mock`.
- Hosted smoke staging-equivalent: PASS.
  Command: `npm run test:hosted-smoke`.
- Project success script: PASS.
  Command: `npm test`.

## Coverage

- Frontend reachability covered by hosted smoke HTTP 2xx check.
- SpacetimeDB reachability covered by hosted smoke HTTP/TCP check.
- Orchestrator reachability covered by `/health` HTTP 200 JSON check.
- Mock/live mode covered by expected `VITE_DEMO_MODE` or `DEMO_MODE` match.
- Orchestrator provider covered by mode-derived provider match.
- SpacetimeDB database wiring covered by expected `SPACETIME_DB_NAME` match.

## Full Test Summary

- Server: 25 test files passed, 220 tests passed.
- Client: 18 test files passed, 164 tests passed.
- Orchestrator: 12 test files passed, 112 tests passed.
- Quality gates: workflow lint, markdown lint, secret scan, dependency audit,
  contract checks, and hosted smoke self-test passed.
