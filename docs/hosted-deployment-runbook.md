# Hosted Deployment Runbook

## Provider/topology

Selected hosted path:

| Surface | Provider | Public URL source | Port/protocol |
| --- | --- | --- | --- |
| Frontend | Vercel static React build | `vercel.json`, plus `HOSTED_FRONTEND_URL` repository variable or `hosted_frontend_url` workflow input | HTTPS 443 |
| SpacetimeDB | Public SpacetimeDB endpoint | `SPACETIME_URI` repository variable or `spacetime_uri` workflow input | `wss://` 443 preferred, `ws://` allowed for non-production previews |
| Orchestrator | Fly.io Node service | `ORCHESTRATOR_BASE_URL` repository variable or `orchestrator_base_url` workflow input | HTTPS 443, container `PORT=4000` |

This preserves the local demo architecture: the browser still talks directly to SpacetimeDB for authoritative state, while the orchestrator remains a separate HTTP surface for LLM/mock/fixture behavior. Hosted mode changes only endpoint injection and public reachability, not the simulation authority or anonymous/faction-scoped session model.

## Domains and network assumptions

- Frontend URL: Vercel project domain such as `https://solar-dominion.vercel.app`.
- SpacetimeDB URL: browser-reachable WebSocket endpoint such as `wss://db.example.test`.
- Orchestrator URL: Fly.io HTTPS origin such as `https://solar-dominion-orchestrator.fly.dev`.
- SpacetimeDB must be reachable from browsers; the smoke script validates TCP reachability for `ws://` and `wss://`.
- Orchestrator must expose `GET /health`; response status `200` and JSON `status: "ok"` prove env parsing and mode config are valid.
- `FRONTEND_ORIGIN` on the orchestrator must match the Vercel frontend URL for CORS.

## Required environment

| Name | Surface | Required | Purpose |
| --- | --- | --- | --- |
| `HOSTED_FRONTEND_URL` | GitHub Actions | Yes | Reproducible hosted frontend URL for smoke checks |
| `SPACETIME_URI` | GitHub Actions | Yes | Hosted SpacetimeDB reachability check target |
| `ORCHESTRATOR_BASE_URL` | GitHub Actions | Yes | Hosted orchestrator reachability check target |
| `SPACETIME_DB_NAME` | GitHub Actions/client | Yes | Published module/database name, defaults to `solar-dominion` in workflow |
| `VITE_HOSTED` | Client | Yes for hosted builds | Forces hosted diagnostics/path assumptions |
| `VITE_HOSTED_FRONTEND_URL` | Client | Yes | Records frontend URL in build-time config |
| `VITE_SPACETIME_HOST` | Client | Yes | Browser SpacetimeDB endpoint; `https://` is normalized to `wss://` |
| `VITE_SPACETIME_DB_NAME` | Client | Yes | Published SpacetimeDB module/database name |
| `VITE_ORCHESTRATOR_BASE_URL` | Client | Yes | Browser-visible orchestrator endpoint |
| `VITE_DEMO_MODE` | Client | Yes | `mock`, `fixture`, or `live`; mirrors orchestrator mode expectation |
| `FRONTEND_ORIGIN` | Orchestrator | Yes hosted | Exact allowed frontend origin |
| `LLM_MODE` | Orchestrator | Yes | `mock`, `fixture`, or `live` |
| `OPENROUTER_API_KEY` | Orchestrator | Live only | Required when `LLM_MODE=live` |
| `PORT` | Orchestrator | Hosted service | Fly.io binds the Node server, default `4000` |
| `SPACETIME_HOST` | Orchestrator | Yes | HTTP SpacetimeDB host used by orchestrator-side providers |
| `SPACETIME_DB_NAME` | Orchestrator | Yes | Published module/database name |

Legacy client aliases `VITE_SPACETIMEDB_URI`, `VITE_SPACETIMEDB_MODULE`, and `VITE_LLM_MODE` still work, but hosted deployment should use the names above.

## Deploy order

1. Publish or expose SpacetimeDB with database/module name `solar-dominion`.
2. Deploy the orchestrator service to Fly.io with `PORT=4000`, `FRONTEND_ORIGIN`, `LLM_MODE`, `SPACETIME_HOST`, and `SPACETIME_DB_NAME`.
3. Confirm `GET $ORCHESTRATOR_BASE_URL/health` returns JSON with `status: "ok"`, selected mode, provider, and SpacetimeDB target.
4. Configure the Vercel project from `vercel.json`; it uses `npm ci`, `npm run build --workspace=client`, and output directory `client/dist`.
5. Set Vercel env: `VITE_HOSTED=true`, `VITE_HOSTED_FRONTEND_URL`, `VITE_SPACETIME_HOST`, `VITE_SPACETIME_DB_NAME`, `VITE_ORCHESTRATOR_BASE_URL`, and `VITE_DEMO_MODE`.
6. Deploy Vercel and copy the final URL into the GitHub repository variable `HOSTED_FRONTEND_URL`.
7. Set GitHub repository variables `SPACETIME_URI`, `ORCHESTRATOR_BASE_URL`, and `SPACETIME_DB_NAME`.
8. Run `.github/workflows/hosted-smoke.yml` manually or let it run on `main` once all hosted variables exist.

## Build and smoke

Local hosted-mode build:

```bash
VITE_HOSTED=true \
VITE_HOSTED_FRONTEND_URL=https://solar-dominion.vercel.app \
VITE_SPACETIME_HOST=wss://db.example.test \
VITE_SPACETIME_DB_NAME=solar-dominion \
VITE_ORCHESTRATOR_BASE_URL=https://solar-dominion-orchestrator.fly.dev \
VITE_DEMO_MODE=mock \
npm run build --workspace=client
```

Hosted smoke:

```bash
HOSTED_FRONTEND_URL=https://solar-dominion.vercel.app \
SPACETIME_URI=wss://db.example.test \
SPACETIME_DB_NAME=solar-dominion \
ORCHESTRATOR_BASE_URL=https://solar-dominion-orchestrator.fly.dev \
VITE_DEMO_MODE=mock \
npm run smoke:hosted
```

The smoke script checks:

- Hosted frontend returns HTTP 2xx/3xx.
- SpacetimeDB endpoint is reachable by HTTP fetch or TCP for `ws://` and `wss://`.
- Orchestrator `/health` returns HTTP 200 JSON with `status: "ok"`.
- Orchestrator mode/provider matches `VITE_DEMO_MODE` or `DEMO_MODE` when set.
- Orchestrator SpacetimeDB name matches `SPACETIME_DB_NAME` when set.

## Mock/live expectations

- `mock`: safest public demo mode; no `OPENROUTER_API_KEY` required.
- `fixture`: deterministic fixture responses for repeatable demos.
- `live`: requires `OPENROUTER_API_KEY` and should use provider logs plus orchestrator telemetry for failures.

Simulation remains deterministic in SpacetimeDB in every mode. LLM output changes proposal/narrative text only; reducers still decide authoritative state.

## Failure cases and logs

- Missing hosted variables: `scripts/hosted-smoke.mjs` exits with the missing variable name.
- Frontend deployment wrong URL: smoke reports the URL and HTTP status or fetch failure.
- SpacetimeDB not public: smoke reports TCP timeout or connection error for host and port.
- Orchestrator misconfigured: `/health` returns HTTP 500 with `status: "error"`; check `LLM_MODE`, `OPENROUTER_API_KEY` for live mode, `SPACETIME_HOST`, and `SPACETIME_DB_NAME`.
- Browser CORS failure: verify orchestrator `FRONTEND_ORIGIN` exactly matches `VITE_HOSTED_FRONTEND_URL`.
- Build-time env drift: inspect Vercel build logs for the `VITE_*` values above; the client runtime reports actionable issues for empty or invalid SpacetimeDB/orchestrator endpoints.
