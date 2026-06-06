# P5E4 Expanded Browser E2E Plan

## Critical Scenarios

- Local demo Browser B enters session `9001`, sees only Martian League private state,
  approves `Mars dust lane interdiction`, and submits the turn after UI readiness
  changes from pending to ready.
- Direct route recovery for `/game/9001/player_b` reseeds the Browser B fixture when
  stale Browser A context exists, proving reconnect-style tab recovery does not leak
  the wrong faction.
- Decision-phase timeout sends `expire_turn`, then renders the auto-deferred proposal
  outcome so unresolved decisions fail safely.

## Mock And Fixture Strategy

- Mock mode uses jsdom plus a fake `SpacetimeClient.callReducer` transport. Assertions
  cover the reducer descriptor sent by the browser UI and the UI state after an
  authoritative snapshot is hydrated.
- Fixture mode uses the deterministic local demo route fixture in `AppRouter`. It does
  not call live SpacetimeDB and is safe for CI, local runs, and parallel agent sessions.
- Run explicit modes:
  - mock mode: `npm run test:browser:mock`
  - fixture mode: `npm run test:browser:fixture`

## Browser And CI Constraints

- Current browser coverage runs under Vitest jsdom, not Playwright. Multi-user coverage
  is modeled with isolated stores and deterministic route fixtures until hosted browser
  orchestration is available.
- No live SpacetimeDB server is required. CI only needs installed npm workspaces.
- Keep local demo session IDs and fixture data stable; changing them requires updating
  the expanded browser assertions in the same PR.

## Flake Mitigation

- Tests avoid timers, network, and server startup.
- Tests wait only for route/state transitions caused by React effects.
- Setup clears route history, local storage, the session context store, the command panel
  store, and the shared subscription store before each scenario.
