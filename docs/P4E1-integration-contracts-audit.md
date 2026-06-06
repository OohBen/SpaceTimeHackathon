# P4E1 Task 1 — Integration Contracts Audit

Scope: the **playable single-turn path** that the P4 glue epic must wire end-to-end:
`session join → world update → deliberation → decision → submit turn → resolution → summary acknowledgement`.

This document maps the contracts each layer of the stack already declares (server
reducers, generated SpacetimeDB bindings, hand-rolled client glue, orchestrator
service) and identifies every mismatch that blocks the playable demo flow, with a
concrete remediation note per finding. Companion tasks #116, #117, #118 implement
the fixes; verify task #114 confirms the end-to-end behaviour.

Sources read while preparing this audit:

- `server/src/index.ts`, `server/src/schema.ts`, `server/src/session_lifecycle.ts`,
  `server/src/turn_decisions.ts`, `server/src/turn_advancement.ts`,
  `server/src/turn_resolution.ts`, `server/src/llm_queue_contract.ts`,
  `server/src/public_world_projection.ts`.
- `client/src/module_bindings/*` (generated), `client/src/session/spacetime.ts`,
  `client/src/spacetime/session-actions.ts`, `client/src/spacetime/reducers.ts`,
  `client/src/spacetime/session-subscriptions.ts`,
  `client/src/state/session-store.ts`.
- `orchestrator/src/index.ts`, `docs/llm-queue-boundary.md`, `SPECS.md`, `PLAN.md`.

## Reducer contract surface

The SpacetimeDB module exports the following reducers via `server/src/index.ts`.
All reducer args are SpacetimeDB schemas (snake_case); the JS SDK accepts
camelCase keys on the client through generated bindings under
`client/src/module_bindings/`.

| Server reducer | Args | Pre-condition | Writes |
|---|---|---|---|
| `create_session` | `player_a_name: string`, `player_b_name: string` | no duplicate setup session for the same slot-name pair | one `game_sessions` row (state `setup`), two `factions` rows with slot metadata in `doctrine_vector` |
| `join_or_resume_session` | `session_id: u32`, `player_slot: "player_a" \| "player_b"` | session in `setup` or `active`; sender owns the slot or slot is claimable | `factions.player_id` rebound to sender; when both slots claimed, session flips to `active` and phase to `world_update` |
| `advance_world` | `session_id: u32` | session `active` + phase `world_update` | runs `runWorldUpdate` once per turn; inserts a `world_advanced` event; transitions phase to `deliberation` |
| `run_deliberation` | `faction_id: u32` | session active + phase `deliberation`; no duplicate `proposals` request | mode = `queue`: inserts one `llm_requests` row with `status=queued`; mode = `fallback`: writes proposals + completed audit row |
| `set_deliberation_mode` | `mode: "queue" \| "fallback"` | — | upserts the singleton `module_settings` row (`id = 1`) |
| `commander_decision` | `faction_id`, `proposal_id`, `decision: "approved" \| "rejected" \| "deferred"`, `allocation: i32` | session active + phase `decision`; proposal is current turn and undecided; allocation rules enforced | updates proposal `status` + `decision` blob; deducts credits on approval |
| `submit_turn` | `faction_id: u32` | session active + phase `decision`; simulation not yet triggered this turn | flips `factions.ready_for_turn`; when both factions ready, inserts `simulation_triggered` event and transitions phase to `resolution` |
| `expire_turn` | `session_id: u32` | session in decision phase; deadline elapsed; sender owns a session faction | auto-defers open proposals; force-readies both factions; triggers simulation |
| `simulate_turn` | `session_id: u32` | session active + phase `resolution`; `simulation_triggered` event exists; no current `turn_summaries` rows | inserts two per-faction `turn_summaries` rows; inserts `victory_checked` + `turn_summary_ready` events; transitions phase to `summary` |
| `ack_resolution` | `faction_id: u32` | session active + phase `summary`; sender owns faction; summary not yet acknowledged | sets `acknowledged=true` on that faction's summary; inserts `resolution_acknowledged` event; when both factions ack, advances turn (or completes session on victory) |
| `check_victory` | `session_id: u32` | session active + phase `summary` | re-emits `victory_checked` event; flips session to `complete` when there is a winner |
| `advance_turn_phase` | `session_id: u32`, `next_phase: string` | strict whitelist in `ALLOWED_TURN_PHASE_TRANSITIONS` | mainly diagnostic; the live flow drives phase transitions through the reducers above |

Generated client bindings cover all of the above (`client/src/module_bindings/*_reducer.ts`).

## Subscription contract surface

Server-side public surface in `server/src/index.ts`:

- Public tables (raw rows for anyone connected): `game_sessions`, `factions`,
  `celestial_bodies`, `cities`, `personnel`, `personnel_relationships`,
  `proposals`, `commander_inbox`, `fleets`, `colony_ships`, `projects`,
  `intelligence_records`, `events`, `turn_summaries`, `trade_agreements`,
  `llm_requests`, `module_settings`.
- Public **anonymous views** (projected, intentionally narrow):
  `public_factions`, `public_cities`, `public_fleets`, `public_colony_ships`,
  `public_events`.

There is no `sessions`, `player_slots`, `public_game_state`, or
`private_faction_state` table or view in the module. Private-state filtering
lives client-side in `server/src/private_state_filters.ts` and is consumed only
in tests today.

Active client subscription paths:

| Caller | Subscribes to | Source |
|---|---|---|
| `useSpacetimeSessionBackend` | `tables.game_sessions`, `tables.factions` via the generated DbConnection subscription builder | `client/src/session/spacetime.ts:74` |
| `wireSessionSubscriptions` (unused in routes today) | SQL strings `SELECT * FROM sessions`, `... player_slots`, `... public_game_state`, `... public_factions`, `... private_faction_state`, `... proposals` | `SESSION_SUBSCRIPTION_QUERIES` in `client/src/spacetime/session-subscriptions.ts` |

The active route flow (`useSpacetimeSessionBackend`) subscribes only to
`game_sessions` + `factions`; the sketched `SESSION_SUBSCRIPTION_QUERIES`
targets table names that do not exist on the server.

## Orchestrator contract surface

`orchestrator/src/index.ts` is a stub: it exports `ORCHESTRATOR_VERSION = "0.0.0"`
and nothing else. There are no HTTP endpoints, no SpacetimeDB SDK connection, no
queue consumer.

`docs/llm-queue-boundary.md` and `LLM_QUEUE_AUTHORITATIVE_CONTRACT`
(`server/src/llm_queue_contract.ts`) declare the boundary the orchestrator must
respect:

- `live_model_required: false` — module never blocks on a live LLM.
- Authoritative outputs come from `game_sessions`, `factions`, `proposals`,
  `turn_summaries`. Worker output is `advisory_text_only`.
- Queue rows live in `llm_requests` with statuses
  `queued → processing → completed | failed | cancelled`.
- Mode is read from singleton `module_settings.id = 1`, toggled via
  `set_deliberation_mode`.

What the orchestrator must own when wired:

1. Subscribe to `llm_requests` with `status='queued'`.
2. For each row, claim it by updating to `processing` (idempotency via
   `attempt_count`).
3. Resolve advisory text per `request_type` (`proposals`, `inbox`,
   `event_narrative`, `resume_briefing`).
4. Write completion with `response_json` populated, or `failed` with `error` +
   `error_code`.

For the **minimum playable demo** the orchestrator is not on the critical path:
`set_deliberation_mode({ mode: "fallback" })` makes `run_deliberation` synthesise
proposals via `generateFallbackProposals` inside the module and the playable
flow advances with zero orchestrator involvement.

## Identified mismatches

### M1 — Hand-rolled `reducerRegistry` ships wrong names and argument shapes

- `client/src/spacetime/reducers.ts` declares `createSession({ playerName })`,
  `joinSession({ sessionId, playerName })`, `commanderDecision`, `submitTurn`,
  `expireTurn`.
- `server/src/index.ts` exports `create_session({ player_a_name, player_b_name })`,
  `join_or_resume_session({ session_id, player_slot })`, etc.
- The reducer `join_session` does not exist on the server. The single-name
  `create_session({ playerName })` shape would fail validation.
- These descriptors are consumed by `createSessionAction`, `joinSessionAction`,
  `commanderDecisionAction`, `submitTurnAction`, `expireTurnAction` in
  `client/src/spacetime/session-actions.ts`, which are unreferenced by any route
  today, but exist as the documented integration surface for the command shell.

#### Implementation note (M1)

Delete the hand-rolled descriptors and route every call through the generated
`module_bindings/*_reducer.ts`. The working pattern is in
`createSessionBackend` (`client/src/session/spacetime.ts`), where
`conn.reducers` is cast to a typed `SessionReducers` and called with the
real names and arg shapes. Companion task #116 (session lifecycle and turn
actions through the shared path) owns this refactor; #117 picks up the
proposal-decision pathway.

### M2 — `SESSION_SUBSCRIPTION_QUERIES` references nonexistent tables

`SESSION_SUBSCRIPTION_QUERIES` in
`client/src/spacetime/session-subscriptions.ts` subscribes to `sessions`,
`player_slots`, `public_game_state`, `private_faction_state`. None of those
exist in `server/src/schema.ts` or in the public-view exports. `player_slots`
is encoded as JSON inside `factions.doctrine_vector` (see
`FactionSlotMetadata`); there is no dedicated table or view. Private faction
state has no public surface and must remain server-resident.

#### Implementation note (M2)

Re-target the subscription set to the actual tables the playable path needs:

- `game_sessions` and `factions` (already subscribed by `createSessionBackend`).
- `proposals`, `commander_inbox`, `turn_summaries`, `events`, `llm_requests`,
  `module_settings`.
- For map/world surface (used by epic #15 and downstream P3 epics) add
  `cities`, `celestial_bodies`, and the `public_*` projection views.

Replace the SQL-string contract with the typed `tables.<name>` references from
`module_bindings/index.ts` so a schema rename breaks compile, not runtime.
Owned by task #116.

### M3 — Two competing client integration paths

The repository contains two parallel client integration sketches that
contradict each other:

- **Authoritative**: `client/src/session/spacetime.ts` (used by Setup route)
  uses generated `DbConnection`, correct reducer names
  (`joinOrResumeSession`, `createSession`), proper SubscriptionBuilder usage.
- **Stale sketch**: `client/src/spacetime/{client,reducers,session-actions,
  session-subscriptions}.ts` plus `client/src/state/session-store.ts` —
  hand-rolled descriptors with broken names, unused Zustand store with row
  schemas that do not match the server.

#### Implementation note (M3)

Pick one path and delete the other before piling on more wiring. Recommendation
for the glue epic: keep `createSessionBackend` as the connection adapter,
absorb the Zustand session-store responsibilities into a thin selector layer
that reads from the generated `useTable` hooks, and remove the stale sketch.
This is owned by task #116 as a pre-requisite to wiring the turn pipeline.

### M4 — No client driver for the turn pipeline beyond `create` / `join`

Generated bindings exist for `advance_world`, `advance_turn_phase`,
`run_deliberation`, `set_deliberation_mode`, `submit_turn`, `expire_turn`,
`simulate_turn`, `ack_resolution`, `check_victory`, `commander_decision`, but
no route, action, or hook calls them. The shell can create or join a session
but cannot push it through a turn.

#### Implementation note (M4)

Phase-keyed action helpers in `client/src/session/spacetime.ts` (mirroring
the `createAndJoin` / `joinOrResume` style) for each transition the UI is
allowed to drive:

- `world_update` phase: caller is the active faction's owner; UI invokes
  `advance_world({ session_id })` after Setup completes.
- `deliberation` phase: each faction's UI calls
  `run_deliberation({ faction_id })` once per turn. Default to `queue` mode at
  bootstrap and offer a developer toggle that calls `set_deliberation_mode`.
- `decision` phase: UI surfaces proposals from the `proposals` subscription and
  calls `commander_decision` per proposal.
- Submit: UI calls `submit_turn({ faction_id })` and shows
  `factions.ready_for_turn` until both sides flip.
- Resolution + summary: UI calls `simulate_turn` when phase enters
  `resolution`, displays the per-faction `turn_summaries.summary_json`, then
  calls `ack_resolution({ faction_id })` from each browser. `check_victory` is
  idempotent and safe to fire on entering `summary`.

Tasks #117 (proposal-decision and submit flow) and #118 (contract close-out)
implement this; #114 verifies it.

### M5 — Identity binding depends on slot identities the UI never surfaces

`buildSlotIdentity(sessionId, slotKey)` is a deterministic, namespaced
`Identity` used as the placeholder `player_id` on freshly-created factions
(`server/src/session_lifecycle.ts:565`). The client's first call to
`join_or_resume_session` rebinds the slot to the live connection identity.
This is correct, but means:

- The UI must drive `join_or_resume_session` from the same browser that will
  control that slot for the rest of the demo. Identity is currently stored as
  a token in `localStorage` (`AUTH_TOKEN_KEY` in
  `client/src/session/spacetime.ts`).
- All `commander_decision`, `submit_turn`, `ack_resolution`, and
  `run_deliberation` calls check sender == `faction.player_id`, so any session
  that loses local storage cannot resume the slot.

#### Implementation note (M5)

Document the token-pinning behaviour in the demo runbook so the judge
machine reuses the same browser profile per slot. For the two-browser flow
(epic #25), allow `?token=...` resume on the URL so the second browser does
not have to share local storage. Wiring lives in `connection-lifecycle.ts`
and is owned downstream of #116; flagging here so #114 can verify the
expected behaviour.

### M6 — Orchestrator service is empty

`orchestrator/src/index.ts` ships only `ORCHESTRATOR_VERSION = "0.0.0"`. There
is no consumer for queued `llm_requests` rows, no HTTP endpoints, and no
SpacetimeDB SDK wiring. `docs/llm-queue-boundary.md` documents
`LLM_MODE=mock|fixture|live` and `SPACETIME_HOST` / `SPACETIME_DB_NAME`, all of
which the service must read at bootstrap.

#### Implementation note (M6)

For the playable demo, P4E1 does not need a live orchestrator: flipping
`module_settings` to `fallback` keeps every authoritative outcome on the
deterministic path inside the module. The orchestrator gap is therefore not
on the playable-path critical line — but the glue epic should still:

1. Boot a stub orchestrator that polls `llm_requests` and short-circuits to a
   `mock` response so `LLM_MODE=mock` is verifiable.
2. Provide an env-driven preflight that fails loudly if `LLM_MODE=live`
   without `OPENROUTER_API_KEY` / `OPENROUTER_MODEL`.

Schedule under P4E2 (one-command local runner) rather than blocking #116/#117.

## Playable-path flow coverage

The target single-turn flow is: session join → proposal decision → submit
turn → resolution. Coverage today:

### Session join

- Server: `create_session` + `join_or_resume_session` complete; both slots
  claimed flips state to `active` and phase to `world_update`.
- Client: `createSessionBackend.joinOrResume` and `createAndJoin` exercise the
  correct reducers. Generated bindings expose typed wrappers.
- Gap: stale `joinSessionAction` and `SESSION_SUBSCRIPTION_QUERIES` (M1, M2,
  M3). Owned by #116.

### World update → deliberation

- Server: `advance_world` reducer runs `runWorldUpdate`, emits `world_advanced`
  event, transitions phase to `deliberation`. `run_deliberation` per faction
  queues an `llm_requests` row or runs the deterministic fallback.
- Client: not driven. No call site for `advance_world` or `run_deliberation`.
- Gap: M4. Owned by #116/#117.

### Proposal decision

- Server: `commander_decision` validates owner + phase, checks allocation
  bounds, updates `proposals.status` + `decision`, deducts credits on approval.
- Client: hand-rolled `commanderDecisionAction` uses the broken
  `reducerRegistry`. Generated `commander_decision` reducer binding exists in
  `client/src/module_bindings/commander_decision_reducer.ts`.
- Gap: M1, M3. Owned by #117.

### Submit turn

- Server: `submit_turn` flips `ready_for_turn`; when both factions ready,
  inserts `simulation_triggered` event and transitions phase to `resolution`.
  `expire_turn` provides the timeout path with auto-defer.
- Client: hand-rolled `submitTurnAction` + `expireTurnAction` use the broken
  registry; no UI integration.
- Gap: M1, M3, M4. Owned by #117.

### Resolution + summary

- Server: `simulate_turn` writes per-faction `turn_summaries`, plus
  `victory_checked` + `turn_summary_ready` events; `ack_resolution` per faction
  acknowledges and (on both ack) advances `current_turn` or completes the
  session. `check_victory` is a safe idempotent re-emit.
- Client: nothing.
- Gap: M4 (driver), plus subscription expansion to `turn_summaries`, `events`,
  and `llm_requests` (M2). Owned by #117 / #118; verified by #114.

## Summary

The single-contract surface the P4 glue epic must converge on is:

1. **Reducer access**: the generated `module_bindings/*_reducer.ts` wrappers,
   surfaced through `conn.reducers` in `createSessionBackend`.
2. **Subscription access**: typed `tables.*` references via the
   SpacetimeDB `subscriptionBuilder`, expanded to cover proposals, inbox,
   events, turn_summaries, llm_requests, module_settings, and the public
   world-projection views.
3. **State store**: derive UI state from `useTable` hooks; retire the stale
   Zustand sketch.
4. **Orchestrator**: out of the playable-path critical line under
   `fallback` mode; track a stub queue worker in P4E2 to exercise queue mode
   end-to-end without blocking #116/#117.

Companion tasks #116, #117, #118 deliver the wiring against this contract;
#114 verifies the full playable turn from a fresh local stack.
