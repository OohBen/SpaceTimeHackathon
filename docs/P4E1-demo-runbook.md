# P4E1 Local Demo Runbook

This runbook closes out the "local demo path can be exercised repeatedly without
manual patching" acceptance criterion of P4E1 task #118. It records the moving
pieces a fresh local stack relies on, the two unfinished integration mismatches
the audit (`docs/P4E1-integration-contracts-audit.md`) deliberately deferred,
and the operational rules for re-running a demo between attempts.

## Stack pieces touched by the playable path

| Surface | What it owns | Notes |
|---|---|---|
| `server/src/index.ts` | Authoritative SpacetimeDB module. Reducers, public views. | Compile + publish via `npm run spacetime:build && npm run spacetime:publish`. |
| `client/src/session/spacetime.ts` | Live `DbConnection` + `SessionBackend`. | Subscribes to `game_sessions` + `factions`; the rest are subscribed via `useLiveSessionBridge`. |
| `client/src/session/liveBridge.ts` | Translates generated row shapes into the `sessionStore` snapshot consumed by Inbox/HUD. | Closes the "Inbox renders loading forever" gap in the live route. |
| `client/src/components/inbox/Inbox.tsx` | Proposals, decision controls, turn submission, resolution panel. | Wired in `AppRouter` with the live `client` so reducer dispatch actually reaches the server. |
| `orchestrator/src/index.ts` | Stub. Carries only `ORCHESTRATOR_VERSION`. | Out of the playable-path critical line under fallback mode. |

## Boot a fresh local demo (clean slate)

```bash
# Terminal 1 — module
npm run spacetime:build
npm run spacetime:start

# Terminal 2 — publish + generate bindings
npm run spacetime:publish
npm run generate

# Terminal 3 — client
npm run dev:client
```

Then visit `http://localhost:5173` in **two separate browser profiles** (see
"Identity pinning" below). Player A creates the session from one profile, then
joins as `player_a`. Player B opens the second profile, picks the same session
from the dropdown, and joins as `player_b`.

Once both slots are claimed, load the Turn 8 judge scenario onto the live
session so the Mars pressure / Callisto opportunity state, briefings, proposals,
and narrative hooks are ready without manual database surgery:

```bash
spacetime call solar-dominion --server http://localhost:3000 seed_demo_turn_8 <session_id>
spacetime call solar-dominion --server http://localhost:3000 set_deliberation_mode '"fallback"'
```

Without `seed_demo_turn_8`, a freshly-created session only has the session row
plus two factions. The reducer is reproducible: re-calling it replaces the
session-scoped scenario rows and restores the deterministic Turn 8 state.
`seed_demo_world` remains available when you specifically need the older Turn 1
world overlay.

## Identity pinning (audit M5)

`buildSlotIdentity(sessionId, slotKey)` writes a deterministic placeholder
identity onto each freshly-created faction. The first call to
`join_or_resume_session` from a browser **rebinds** the slot to the connection
identity. From that point on, every `commander_decision`, `submit_turn`,
`ack_resolution`, and `run_deliberation` call validates `sender ==
faction.player_id`.

Operational consequence: a slot belongs to the browser profile that joined it,
**identified by the auth token in `localStorage` under `solar-dominion-auth-token`**.
For repeated demos:

1. Use distinct browser profiles (separate Chrome users, or one Chrome + one
   Firefox). Do not run both windows in the same profile — they share the
   token and SpacetimeDB will hand out the same identity, so the second
   "join" silently rebinds the first slot.
2. To restart cleanly between demos: open a private window for each side, or
   `localStorage.clear()` between runs.
3. Two-machine demos: each judge laptop must keep its own profile from
   start-to-end. There is no cross-machine resume yet; that affordance lives
   under epic #25 (`?token=...` URL resume) and is intentionally out of scope
   for #118.

## Deterministic fallback for orchestrator (audit M6)

The orchestrator stub (`orchestrator/src/index.ts`) intentionally does **not**
poll `llm_requests`. The module never blocks on it: with
`module_settings.deliberation_mode = 'fallback'` (the local-demo default),
`run_deliberation` runs `generateFallbackProposals` inline and the playable
loop never waits on an external worker.

Operational consequence:

1. `set_deliberation_mode({ mode: 'fallback' })` is the safe default for local
   demos. The current UI does not surface a developer toggle for this; if you
   need to override, call the reducer manually through `spacetime call
   solar-dominion set_deliberation_mode '{"mode":"fallback"}'`.
2. If a future P4E2 task brings up a stub worker that drains
   `llm_requests`, the Inbox will surface its status through
   `OrchestratorStatus` (already wired in `Inbox.tsx`). Keep the deterministic
   fallback prose so the command flow stays playable while the worker is
   delayed.

## Repeated-run readiness checklist

Before re-running a demo without restarting the SpacetimeDB module:

- [ ] Both browser profiles cleared their `localStorage` (or you intend to
      resume the same session).
- [ ] `module_settings.deliberation_mode = 'fallback'` (or your orchestrator
      stub is running).
- [ ] Module logs show no stuck `llm_requests` row (status `processing`).
- [ ] No leftover `simulation_triggered` event from a half-resolved turn —
      `simulate_turn` is idempotent only for the same turn; if the previous
      run ended mid-resolution, prefer `spacetime delete-database` and a
      fresh publish.

## Closed and deferred audit mismatches

`docs/P4E1-integration-contracts-audit.md` enumerates six mismatches.
Disposition for #118:

| Audit | Disposition |
|---|---|
| **M1** (broken hand-rolled `reducerRegistry`) | Closed in #116 — descriptors match server reducer names + arg shapes. |
| **M2** (subscription queries pointed at nonexistent tables) | Closed in #116 + this task — `SESSION_SUBSCRIPTION_QUERIES` retargeted; live route uses typed `tables.*` references via `useLiveSessionBridge`. |
| **M3** (two competing client integration paths) | Partially closed. Both paths still ship: live route uses generated bindings; Inbox + HUD read the `sessionStore` populated by `liveBridge`. Full retirement of the Zustand sketch is tracked as a follow-up scoped outside the glue epic to avoid rewriting Inbox/HUD tests mid-demo prep. |
| **M4** (no client driver for the turn pipeline beyond create/join) | Closed in #116 + #117 + this task. Turn actions dispatch through `SessionBackend.client`; Inbox dispatches via passed-through `client` in `AppRouter`. |
| **M5** (token-pinning constraint for two-browser flow) | Documented above. URL `?token=...` resume tracked under epic #25. |
| **M6** (orchestrator service is empty) | Deferred to P4E2 (one-command local runner). Fallback mode keeps the demo playable. |
