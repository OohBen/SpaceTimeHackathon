# P5E2 Verify Report

Issue: [#79](https://github.com/OohBen/SpaceTimeHackathon/issues/79) - Verify Production Config, Secret Handling, and Smoke Path.

Scope: validate env docs, secret handling, CORS / origin policy, and the deployment smoke checks for hosted operation.

Date: 2026-06-06.
Branch verified: `epic/29-production-environment-and-secret-handling` (tip `7019587`).
Subject docs:

- `docs/P5E2-production-env-handbook.md` (landed via PR #338, #80).
- `docs/hosted-deployment-runbook.md` + `docs/hosted-deployment-verification.md` (landed via PR #334, #28).

## AC 1 — `npm test` baseline on production-config branch

Command run from repo root on the epic tip:

| Suite | Result |
| --- | --- |
| Script tests (`presentation-artifacts` 2, `presentation-smoke` 2, `local-demo-runner` 9) | PASS 13/13 |
| Server vitest | PASS 228/228 across 26 files |
| Client vitest | PASS 171/171 across 20 files |
| Orchestrator vitest | PASS 112/112 across 13 files |
| `ci:quality` (lint workflows 9, markdown 58, secrets 258 files, `npm audit` 0 vulns, contracts, hosted-smoke 1/1) | PASS |

No regressions vs the most recent main baseline (post-#338). Test totals identical to the post-#332 + #334 baseline on main.

## AC 2 — Documented smoke validation for hosted config

The documented smoke path is `scripts/hosted-smoke.mjs`, exercised end-to-end by `scripts/hosted-smoke.test.mjs` and `.github/workflows/hosted-smoke.yml`.

- `npm run test:hosted-smoke` — PASS (1/1). Spawns the smoke script against mock HTTP servers and verifies all four checks: frontend HEAD, SpacetimeDB HTTP probe, orchestrator `/health` payload validation (status / mode / provider / dbName matches), exit code.
- `npm run smoke:hosted` — not exercised on this run because `HOSTED_FRONTEND_URL`, `ORCHESTRATOR_BASE_URL`, `SPACETIME_URI`, `SPACETIME_DB_NAME` are not configured as repo Actions Variables. Tracking issue #326 covers configuring them; this verify treats hosted smoke as documented and contract-tested but not live-tested.

Per `docs/P5E2-production-env-handbook.md` § Smoke Checklist, steps 1–3 (local stack, presentation smoke, full `npm test`) cover everything the demo path needs. Step 4 (live hosted smoke) is gated on the four Action Variables; #326 captures that follow-up explicitly.

## AC 3 — `.env.example`, secret guidance, and origin policy docs match implementation

Cross-checked the handbook's claims against the actual code paths:

| Claim | Implementation | Verified |
| --- | --- | --- |
| `LLM_MODE=fixture` is default; loader handles `live` / `mock` / `fixture` | `orchestrator/src/openrouter_client.ts` `readLlmProviderConfig` returns one of `LiveLlmProviderConfig` / `MockLlmProviderConfig` / `FixtureLlmProviderConfig` | PASS |
| `OPENROUTER_API_KEY` required in `live` mode, throws config error otherwise | `OpenRouterConfigError` thrown when missing key + `LLM_MODE=live` | PASS |
| `redactSecret` + `summarizeRequest` keep secrets out of logs | `orchestrator/src/logging.ts` exports both; `proposal_advisory.ts` and reliability layer use them | PASS |
| Vercel `/health` rewrites to `/api/health` | `vercel.json` `rewrites` array confirmed | PASS |
| `/api/health` returns `status: "ok"`, `mode`, `provider`, `spacetime.dbName`, `spacetime.host` | `orchestrator/src/http_server.ts` `buildHealthPayload` shape matches; `api/health.ts` invokes it | PASS |
| `hostedRuntime.ts` flags `ws://`/`wss://` requirement and `http://`/`https://` for orchestrator | `validateHostedConfig` returns the documented `issues[]` strings | PASS |
| `FRONTEND_ORIGIN=*` is local-dev only; hosted requires a specific URL | `docs/hosted-deployment-runbook.md` documents the policy; `.env.example` ships with `http://localhost:5173` as the local default | PASS |
| Repository Variables `HOSTED_FRONTEND_URL`, `ORCHESTRATOR_BASE_URL`, `SPACETIME_URI`, `SPACETIME_DB_NAME` | named in handbook and in `.github/workflows/hosted-smoke.yml` | PASS |

Vars listed in `.env.example` are exactly the union of:

- everything `orchestrator/src/openrouter_client.ts` reads (server-side)
- everything `client/src/config/hostedRuntime.ts` reads (`VITE_*`)
- everything `scripts/local-demo-runner.mjs` reads
- the local `PORT` for the orchestrator HTTP server

No variable is documented in the handbook that does not appear in `.env.example` or the loaders. No variable is in `.env.example` that the handbook ignores.

## AC 4 — Remaining config gaps captured as explicit blocker issues

Open follow-up:

- **#326 P5E1 follow-up — Configure hosted smoke deployment variables.** Tracks setting `HOSTED_FRONTEND_URL`, `ORCHESTRATOR_BASE_URL`, `SPACETIME_URI`, `SPACETIME_DB_NAME` as repo Actions Variables, then running `.github/workflows/hosted-smoke.yml` against the deployed environment. This is the only outstanding hosted-config gap; everything else listed in the handbook is implemented.

State of #326 at the time of this verify: **closed by Victor-Casado at 2026-06-06T18:38:49Z** — the user resolved it outside the autonomous loop. The hosted smoke contract is therefore ready for live exercise on demand.

No new blocker issues filed.

## Verdict

All four acceptance criteria PASS on the epic tip `7019587`.

- Tests: green (no regressions vs main baseline).
- Smoke contract: documented, self-tested, ready for live targets.
- Env / secret / origin docs: every claim cross-checked against the implementation.
- Open gaps: zero new; #326 already handled by the user.

No bugs filed. No follow-up issues opened.
