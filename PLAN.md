# Project Plan

Source of truth: `solar-dominion-master.md`.

## Vision

Solar Dominion is a 2-player competitive strategy game about colonizing the solar system. Players do not directly build ships or structures; they lead a command organization that generates proposals. The core experience is choosing advisors, approving proposals, allocating resources, and watching both factions evolve through simultaneous turns in a shared SpacetimeDB world.

## Demo Goal

A user can open two browser windows as Player 1 and Player 2, play a real simultaneous-turn Solar Dominion match locally, approve officer-generated proposals, see SpacetimeDB sync both clients in real time, and then deploy the same playable app to a hosted web URL.

## Stack

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Framework | React SPA + Zustand |
| Database | SpacetimeDB TypeScript module |
| Auth | Local demo sessions first; anonymous/faction-scoped hosted sessions acceptable for demo |
| Hosting/deployment | Local demo first, hosted web app last |
| Key external APIs / services | OpenRouter using `inception/mercury-2` for LLM proposal text |
| Test command | `npm test`; agents may add workspace-specific unit/integration commands; browser E2E required before demo close-out |

## Projects

### Project 1: P1 - SpacetimeDB Game Core

Goal: Build the authoritative multiplayer simulation, schema, reducers, seed data, and deterministic turn engine so parallel frontend work can connect early.

Features (each becomes one epic):
1. SpacetimeDB module scaffold, generated client bindings, local run scripts, and baseline tests.
2. Core tables for sessions, factions, bodies, cities, personnel, proposals, inbox, fleets, colony ships, projects, intel, events, and trade.
3. Match/session setup for two factions, seeded solar system, seeded Turn 1 state, and pre-staged Turn 8 demo state.
4. Simultaneous turn phase reducers: world update, deliberation request queue, commander decisions, ready/timeout handling, simulation, summary, victory checks.
5. Deterministic simulation rules for resources, city development, morale, personnel drift, doctrine drift, colony ship travel, fleet strength, and control score.
6. Access control and subscriptions so each player sees shared public world state plus private faction state only.

### Project 2: P2 - React Command Experience

Goal: Build the playable command interface against real/generated SpacetimeDB bindings, with dense operational UI and two-browser usability.

Features (each becomes one epic):
1. React app scaffold with SpacetimeDB client, Zustand stores, typed reducer wrappers, and subscription wiring.
2. Landing/setup/session loading flow for local P1/P2 browser sessions.
3. Persistent Command Center shell with global header, turn timer, left sidebar, faction status, and panel model.
4. Solar system map with bodies, city control, fleets/ships, travel status, and city detail overlay.
5. Commander inbox and proposal reader with approve/reject/defer, resource allocation, and decision submission.
6. Personnel, resources, intelligence, diplomacy, doctrine, turn resolution, and end-game panels sufficient for full demo flow.

### Project 3: P3 - LLM Proposal Orchestrator

Goal: Generate grounded officer proposal text through OpenRouter while keeping all simulation outcomes deterministic in SpacetimeDB.

Features (each becomes one epic):
1. LLM request queue schema/integration boundary and deterministic fallback proposal generator.
2. OpenRouter client using model `inception/mercury-2`, env-based API key, retries, timeouts, and JSON validation.
3. Proposal prompt builder from officer traits, faction doctrine, city state, recent events, intel summary, and outstanding requests.
4. Inbox/event narrative generation for briefings, resume summaries, and turn-resolution flavor text.
5. Local mock mode and fixture mode so tests and demos work without spending tokens or exposing secrets.

### Project 4: P4 - Local Playable Demo and Glue Epic

Goal: Wire P1, P2, and P3 into a complete local demo with E2E coverage and a reliable judge script.

Features (each becomes one epic):
1. Integration / Glue Epic: connect backend, frontend, and LLM boundaries end-to-end with browser E2E tests.
2. Local demo runner that starts SpacetimeDB, orchestrator, and frontend with one documented command.
3. Two-browser P1/P2 demo flow: start/resume match, approve proposal, sync opponent, submit both turns, resolve turn.
4. Seeded Turn 8 judge scenario with Mars contested and Jupiter/Callisto opportunity visible.
5. Demo script, screenshots/video checklist, and smoke tests for the exact presentation path.

### Project 5: P5 - Hosting, Hardening, and Stretch Waves

Goal: Host the playable app, harden quality gates, and park nonessential feature depth for later waves if time remains.

Features (each becomes one epic):
1. Hosted web deployment for frontend plus reachable SpacetimeDB/orchestrator configuration.
2. Production env documentation, `.env.example`, secret handling, CORS, and deployment smoke test.
3. Security/quality gates: gitleaks, dependency review, CodeQL, actionlint, markdownlint, contract checks.
4. Browser E2E coverage expansion for critical gameplay paths beyond the judge script.
5. Stretch wave: deeper diplomacy, trade, intelligence, propaganda, talent poaching, advanced military, richer events, and polish.

## Out of Scope

- Direct player control of ships, buildings, or combat outside the proposal/command system.
- Fully balanced commercial-grade strategy depth before the demo.
- Real-money economy, subscriptions, or persistent account system.
- Native mobile app.
- LLM-controlled simulation outcomes; reducers remain authoritative and deterministic.
- Building every stretch mechanic before the local playable demo is proven.

## Open Questions

- Final hosted target/provider.
- Final production SpacetimeDB deployment topology.
- Whether hosted auth remains anonymous/faction-scoped or gets real accounts after demo.
- Exact CI/browser E2E framework; agents may choose based on repo shape.

## Decisions Log

| Date | Decision | Reason |
|---|---|---|
| 2026-06-06 | Use `solar-dominion-master.md` as source of truth | User confirmed master design doc is authoritative |
| 2026-06-06 | MVP is playable 2-player game, not a static slice | User confirmed playable MVP goal |
| 2026-06-06 | Use React, Zustand, SpacetimeDB TypeScript, OpenRouter `inception/mercury-2` | User confirmed stack and LLM provider/model |
| 2026-06-06 | Build local demo first, hosted app last | User prioritized local demo then hosted deployment |
| 2026-06-06 | Split work into parallel P1/P2 and later waves | User wants multiple sessions productive immediately and stretch scope deferred if time runs out |
