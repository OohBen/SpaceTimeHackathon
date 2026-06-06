# P5E2 Production Environment Handbook

Covers the production env surface, secret handling, CORS / origin policy, and the post-deploy validation contract. This is the operator reference for the hosted Solar Dominion stack.

Sources of truth: `.env.example` (canonical config contract), `vercel.json` (hosted routing), `orchestrator/src/openrouter_client.ts` (config loader), `orchestrator/src/http_server.ts` (`buildHealthPayload`), `scripts/hosted-smoke.mjs` (smoke contract), `client/src/config/hostedRuntime.ts` (client validation).

Related: [`docs/hosted-deployment-runbook.md`](./hosted-deployment-runbook.md), [`docs/hosted-deployment-verification.md`](./hosted-deployment-verification.md).

## Env Inventory by Surface

### Orchestrator (Node / Vercel function)

Loaded by `readLlmProviderConfig(env)` in `orchestrator/src/openrouter_client.ts` and `readOrchestratorServerConfig(env)` in `orchestrator/src/http_server.ts`.

| Var | Required when | Carries secret | Default | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| `LLM_MODE` | always | no | `fixture` | operator | One of `live` \| `mock` \| `fixture`. Demo path uses `fixture`. Hosted prod uses `mock` for the public preview, `live` only when a key is provisioned. |
| `OPENROUTER_API_KEY` | `LLM_MODE=live` | **yes** | — | secret manager (Vercel env) | Never commit. Loader throws if missing in `live` mode. Logged only as `***` via `redactSecret`. |
| `OPENROUTER_MODEL` | `LLM_MODE=live` | no | `inception/mercury-2` | operator | Model id, public. |
| `SPACETIME_HOST` | always | no | `http://localhost:3000` | operator | HTTP endpoint of SpacetimeDB. Hosted uses `wss://maincloud.spacetimedb.com` (public). |
| `SPACETIME_DB_NAME` | always | no | `solar-dominion` | operator | Published module name. Public. |
| `SPACETIME_LISTEN_ADDR` | local only | no | `0.0.0.0:3000` | operator | Where the local SpacetimeDB server binds. Not used in hosted. |
| `PORT` | local orchestrator | no | `8787` | operator | HTTP port for the local orchestrator. Vercel sets its own runtime port. |
| `FRONTEND_ORIGIN` | hosted only | no | `*` (fallback) | operator | Used by hosted `/api/health` payload and (when present) by CORS. See [§ CORS](#cors--origin-policy). |

### Client (Vite build)

Loaded by `client/src/config/hostedRuntime.ts` from `import.meta.env` at build/runtime.

| Var | Required when | Carries secret | Default | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| `VITE_HOSTED` | hosted only | no | `false` | operator | Set `true` to switch the client into hosted-runtime mode (uses `VITE_HOSTED_FRONTEND_URL` + `VITE_ORCHESTRATOR_BASE_URL`). |
| `VITE_HOSTED_FRONTEND_URL` | hosted only | no | `http://localhost:5173` | operator | Hosted frontend canonical URL. Used by the smoke check to validate frontend reachability. |
| `VITE_ORCHESTRATOR_BASE_URL` | hosted only | no | `http://localhost:8787` | operator | Hosted orchestrator origin. Validated as `http://` or `https://` URL. |
| `VITE_SPACETIME_HOST` | always | no | `ws://localhost:3000` | operator | Browser-side SpacetimeDB endpoint. Must be `ws://` or `wss://` for browser use. |
| `VITE_SPACETIME_DB_NAME` | always | no | `solar-dominion` | operator | Browser-side published module name. |
| `VITE_LLM_MODE` / `VITE_DEMO_MODE` | always | no | `fixture` | operator | One of `live` \| `mock` \| `fixture`. Drives the demo banner and which orchestrator path the client expects. |
| `VITE_SPACETIMEDB_URI` / `VITE_SPACETIMEDB_MODULE` | legacy fallback | no | local localhost | operator | Older names still read via `readFirst` in `hostedRuntime.ts`; kept for backwards compatibility. |

### SpacetimeDB

Hosted SpacetimeDB is provisioned externally (Maincloud or self-hosted). The repo does **not** carry its credentials. The orchestrator and client treat the endpoint as a public URL.

| Var | Surface | Carries secret | Notes |
| --- | --- | --- | --- |
| `SPACETIME_URI` (Actions only) | hosted smoke workflow | no | Repository Variable that points at the production SpacetimeDB endpoint. |
| `SPACETIME_DB_NAME` (Actions only) | hosted smoke workflow | no | Repository Variable. Optional — falls back to `solar-dominion`. |
| `HOSTED_FRONTEND_URL` (Actions only) | hosted smoke workflow | no | Repository Variable for the deployed frontend. |
| `ORCHESTRATOR_BASE_URL` (Actions only) | hosted smoke workflow | no | Repository Variable for the deployed orchestrator. |

These four Repository Variables are listed as the gating dependency in follow-up issue #326. Configure under repo Settings → Secrets and variables → Actions.

### Vercel (hosted deployment)

`vercel.json` controls hosted routing only:

- `buildCommand`: `npm run build --workspace=client`
- `framework`: `vite`
- `installCommand`: `npm ci`
- `outputDirectory`: `client/dist`
- `rewrites`: `/health` → `/api/health`; SPA fallback to `index.html`.

Vercel project env vars mirror the orchestrator surface. `OPENROUTER_API_KEY` is configured as an Encrypted Production Environment Variable; everything else is plaintext.

## Secret Handling

Rules in this repo:

1. **No secrets in source.** `.env.example` uses empty values for `OPENROUTER_API_KEY`. The local secret scan (`npm run scan:secrets` → `scripts/scan-secrets-local.mjs`) and the CI gitleaks workflow (`.github/workflows/gitleaks.yml`) both fail the build if any pattern that looks like a key lands.
2. **One owner per secret.** `OPENROUTER_API_KEY` is owned by the operator who provisions the Vercel environment. Local developers leave it blank — `LLM_MODE=fixture` or `LLM_MODE=mock` work with no key.
3. **Secrets are never logged.** `orchestrator/src/logging.ts` exports `redactSecret(value)` and `redactPayloadShape(payload)`. The OpenRouter client wraps every outbound request through `summarizeRequest`, which never includes the API key. The health payload and CORS responses never include secrets.
4. **Failure paths never leak secrets.** When `readLlmProviderConfig` throws (missing key in `live` mode), the health endpoint returns `status: "error"` plus a short message — the message is the validation reason, not the env value. See `orchestrator/src/openrouter_client.ts` error classes (`OpenRouterConfigError`, `OpenRouterRequestError`, `OpenRouterNetworkError`).
5. **Smoke output is screenshot-safe.** `scripts/hosted-smoke.mjs` only prints public values (URLs, mode names, status). It never echoes `OPENROUTER_API_KEY` even on failure.

## Runtime Config Loading Path

```
.env / Vercel env
   │
   ▼
process.env (Node) / import.meta.env (Vite)
   │
   ├──► readLlmProviderConfig(env)       ← orchestrator/src/openrouter_client.ts
   │       throws OpenRouterConfigError on missing OPENROUTER_API_KEY in live mode
   │
   ├──► readOrchestratorServerConfig(env) ← orchestrator/src/http_server.ts
   │       → buildHealthPayload(config)    serves /api/health on Vercel and /health locally
   │
   ├──► resolveHostedConfig(env)         ← client/src/config/hostedRuntime.ts
   │       returns { issues[], demoMode, spacetimeUri, ... }; UI surfaces issues at boot
   │
   └──► local-demo-runner.mjs            ← scripts/local-demo-runner.mjs
           reads PORT, LLM_MODE, SPACETIME_* for the npm run demo flow
```

Each loader has a single explicit owner. Adding a new env var requires:

1. Add to `.env.example` with empty / safe-default value and a section comment.
2. Add to the relevant loader function and the relevant typed config shape.
3. Add or update a test under `orchestrator/src/*.test.ts` or `client/src/config/hostedRuntime.test.ts`.
4. Add to the table in this handbook.

## CORS / Origin Policy

The current hosted path uses Vercel's rewrite layer: the frontend, the `/api/health` function, and any future Vercel-hosted API live under one origin, so cross-origin requests are not required for the demo path. The orchestrator's local HTTP server (`http://localhost:8787`) is reachable from the dev client over loopback only.

Explicit policy:

- **No wildcard CORS on hosted endpoints.** When CORS becomes necessary (separate orchestrator host), `FRONTEND_ORIGIN` is the allow-list source. The hosted health payload echoes it back as `frontendOrigin` so smoke can verify the binding.
- **`FRONTEND_ORIGIN=*` is allowed only for local dev.** The hosted runbook (`docs/hosted-deployment-runbook.md`) requires a specific URL for production.
- **No credentials in cross-origin requests.** The demo path does not send cookies; SpacetimeDB connections are anonymous WebSockets.

## Smoke Checklist (Pre-Submit / Pre-Demo)

Run this checklist in order. Stop at first FAIL.

1. [ ] **Local stack startup:** `npm run demo:smoke` — managed runner ready lines all print, then teardown clean. Protects the demo runner and orchestrator wiring without booting the live demo.
2. [ ] **Presentation smoke:** `npm run demo:presentation-smoke` — all 6 steps (`startup`, `scenario-entry`, `player-a-action`, `player-b-action`, `sync-moment`, `resolution`) pass. Protects the judge path.
3. [ ] **Full test:** `npm test` — script tests, server vitest, client vitest, orchestrator vitest, `ci:quality` (lint, secrets, audit, contracts, hosted-smoke). No new failures vs the most recent main baseline.
4. [ ] **Hosted smoke (when targets configured):** with `HOSTED_FRONTEND_URL`, `ORCHESTRATOR_BASE_URL`, `SPACETIME_URI`, and `SPACETIME_DB_NAME` set, run `npm run smoke:hosted`. Validates: frontend reachable, SpacetimeDB reachable, orchestrator `/health` returns `status: "ok"`, mode/provider matches, dbName matches. Run via `.github/workflows/hosted-smoke.yml` on a schedule or before submission.
5. [ ] **Secret scan:** `npm run scan:secrets` and review `artifacts/gitleaks.sarif`. Zero findings expected.
6. [ ] **Branch protection:** confirm `main` rejects direct pushes; PRs require `Repository Contract` status check.

## Operator Notes

- **Where secrets live:** Vercel project env (`OPENROUTER_API_KEY`), GitHub Actions Repository Variables (`HOSTED_FRONTEND_URL`, `ORCHESTRATOR_BASE_URL`, `SPACETIME_URI`, `SPACETIME_DB_NAME`). Local dev: a private `.env` file at repo root, gitignored (see `.gitignore`).
- **Where defaults live:** `.env.example` (the canonical contract — both as documentation and as the file new developers copy).
- **Where validation runs:** `orchestrator/src/openrouter_client.ts` (server-side loader), `client/src/config/hostedRuntime.ts` (`validateHostedConfig`, returns an `issues[]` array that the UI surfaces at boot), `scripts/hosted-smoke.mjs` (post-deploy validation).
- **Where the contract is enforced:** `scripts/test-contracts.mjs` (cross-checks `SPECS.md` § env vars against `.env.example`).

## Failure Output Guidance

Every failure path is designed so the operator's first action is clear:

| Failure | Where it surfaces | Operator action |
| --- | --- | --- |
| `OPENROUTER_API_KEY` missing in `live` mode | orchestrator boot / `/health` `status: "error"` | Set `OPENROUTER_API_KEY` in Vercel env, redeploy. Or set `LLM_MODE=mock` for a key-less hosted preview. |
| `FRONTEND_ORIGIN=*` in hosted | hosted runbook reviewer | Replace with the canonical Vercel frontend URL. |
| `SPACETIME_HOST` unreachable | hosted smoke (`scripts/hosted-smoke.mjs` → `checkSpacetime`) | Confirm the SpacetimeDB deployment is up; check `SPACETIME_URI` Repository Variable. |
| `VITE_SPACETIME_HOST` not `ws://` or `wss://` | client boot (`hostedRuntime.ts` `validateHostedConfig`) | Replace `http://` with `ws://` (loopback) or `wss://` (hosted). |
| `VITE_ORCHESTRATOR_BASE_URL` empty in hosted mode | client boot validation | Set the var in the Vercel project env. |
| Hosted smoke mode mismatch (`mode=mock`, expected `mode=fixture`) | hosted-smoke output | Either update Vercel env to match smoke expectations, or run the smoke with the matching `EXPECTED_DEMO_MODE` input. |
| Secret scan finding | local `npm run scan:secrets` or CI gitleaks | Rotate the key, remove from history (`git filter-repo` or BFG), force-push only after coordinating with the team. |

None of these messages include the secret value. The failure text always names the variable, not the contents.
