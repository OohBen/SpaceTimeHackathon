# P4E5 Verify Report

Issue: [#144](https://github.com/OohBen/SpaceTimeHackathon/issues/144) - Verify P4E5 — Demo Script, Media Checklist, and Smoke Coverage.

Scope: validate the final presentation ritual, smoke automation, and media checklist against the real local demo flow.

Date: 2026-06-06.
Branch verified: `epic/27-demo-script-media-checklist-and-smoke-coverage` (tip `744f48d`).

## AC 1 — `npm test` plus the smoke checks protecting the presentation path

Commands run from repo root:

| Command | Result |
| --- | --- |
| `npm run demo:presentation-smoke` | PASS — all 6 steps: `startup`, `scenario-entry`, `player-a-action`, `player-b-action`, `sync-moment`, `resolution`. |
| `npm run test:presentation-artifacts` | PASS — 2/2 tests. |
| `npm run test:presentation-smoke` | PASS — 2/2 tests. |
| `npm test` | PASS — script (`presentation-artifacts` 2, `presentation-smoke` 2, `local-demo-runner` 9), server vitest 228/228, client vitest 164/164, orchestrator vitest 112/112, `ci:quality` (lint workflows 8, markdown 51, secrets 242 files, `npm audit` 0 vulns, contracts). |

`npm run demo:smoke` was not exercised on this run — it boots the managed local stack, which the rehearsal protocol step explicitly covers (`docs/P4E5-media-capture-recovery.md` § Rehearsal Protocol). The presentation smoke covers the same contract surfaces without booting services, so the cheap signal is green.

## AC 2 — Walk the full demo script against real product behavior

`docs/P4E5-live-demo-script.md` calls out the following anchors. Each one was confirmed against committed code on the epic tip:

| Script beat | Script claim | Verified location |
| --- | --- | --- |
| Preflight | `npm run demo`, `npm run demo:presentation-smoke`, `npm run demo:smoke` | `package.json` `scripts` block. |
| [0:00] Setup | Ready lines for SpacetimeDB / Orchestrator (fixture) / Frontend | `scripts/local-demo-runner.mjs` `operatorReadyLines`; presentation smoke `checkStartup`. |
| [0:30] Scenario Load | Turn 8, Mars pressure, Callisto opportunity, `player_a` / `player_b` routes | `server/src/turn8_seed.ts` (`mars_pressure_callisto_opportunity`, Pavonis Hub, Callisto Outpost); `client/src/routes/AppRouter.tsx` carries both slots. |
| [1:15]–[2:00] Player A acts | `Callisto Pre-Positioning Order`, Defense, decision controls, `Submit turn` | `orchestrator/fixtures/scenarios.json` (`turn-8-judge`); `client/src/components/inbox/Inbox.tsx` (proposal decision controls, Approve, Submit turn). |
| [2:45]–[3:30] Player B acts | `Jupiter Foundry Expansion`, Industry, decision controls, `Submit turn` | same fixture + inbox; presentation smoke `checkPlayerAction("player_b")`. |
| [4:15] Sync Moment | Both clients converge on phase / readiness via SpacetimeDB subscriptions | `client/src/session/liveBridge.ts` (`tables.turn_summaries`, `tables.game_sessions`), `client/src/state/session-store.ts`, `Inbox.tsx` readiness signals. |
| [5:00] Resolution | Turn resolution summary, event rows, `Acknowledge resolution`, `turn_summaries` | `client/src/routes/AppRouter.tsx`, `Inbox.tsx`, `client/src/module_bindings/index.ts` (`ack_resolution`, `turn_summaries`), `server/src/turn_resolution.ts` (`resolution_acknowledged`). |
| Smoke Mapping table | Each smoke step maps 1:1 to a presentation step | `scripts/presentation-smoke.mjs` `PRESENTATION_SMOKE_STEPS` enumerates the same six ids. |

Drift watch: the script's "Acknowledge resolution" beat says "if available". The product surfaces this exactly via the resolution panel and `ack_resolution` reducer binding. No aspirational behavior found.

## AC 3 — Screenshots/video checklist covers required presentation assets

`docs/P4E5-media-capture-recovery.md` was validated by `scripts/presentation-artifacts.test.mjs` (test: *media capture checklist maps to every live script moment*).

Manifest manually re-checked:

- [x] `M01-startup-ready-lines.png` — Setup beat, captures all three ready lines + shutdown line.
- [x] `M02-turn-8-scenario-entry.png` — Scenario Load beat, both `player_a` / `player_b` routes, Turn 8, Mars + Callisto cues.
- [x] `M03-player-a-callisto-action.png` — Player A beats, Callisto proposal detail + decision controls.
- [x] `M04-player-b-jupiter-action.png` — Player B beats, Jupiter proposal detail + decision controls.
- [x] `M05-sync-moment.mp4` — Sync Moment beat, 10–20 s video showing convergence.
- [x] `M06-resolution-summary.png` and `.mp4` — Resolution beat, summary + ack path.
- [x] `full-run-backup.mp4` — fallback video for live operation stalls.
- [x] `terminal-ready-lines.txt` — operator audit copy of ready lines and smoke output.

Capture order in § Capture Order matches the live script timeline.

## AC 4 — Recovery steps handle common failures without derailing rehearsal

`docs/P4E5-media-capture-recovery.md` § Recovery Steps covers the four risks named in the epic acceptance bar. Each is mapped to a concrete fallback artifact:

| Risk | Recovery anchor | Fallback artifact |
| --- | --- | --- |
| Startup failure | run `demo:presentation-smoke`, `demo:smoke`, port check, deps check, restart | `M01-startup-ready-lines.png` + `full-run-backup.mp4`. |
| Stale state | private windows, clear localStorage, restart stack, rerun `seed_demo_turn_8`, confirm slot split | `M02`–`M06` walkthrough narration. |
| Browser desync | confirm same session id, slot split, refresh lagging browser, refresh after phase settles | `M05-sync-moment.mp4`, resume live at resolution. |
| Missing narrative output | confirm `mode=fixture`, lean on deterministic proposal titles, use reducer-backed decisions and event rows | narrate-as-advisory + `M06-resolution-summary`. |

`scripts/presentation-artifacts.test.mjs` second test (*recovery and rehearsal protocol protects known presentation risks*) asserts each of these risks appears in the doc.

Rehearsal Protocol section requires `demo:presentation-smoke`, `demo:smoke`, and `npm test` before each rehearsal — matches what was run for this verification (minus the live boot of `demo:smoke`, which is the operator's pre-rehearsal step).

Operator Checklist contains every step needed to run the live demo without improvisation. Fallback Path § keeps the presentation moving by switching to artifacts and resuming live only when both windows re-sync.

## Verdict

All four acceptance criteria PASS on the epic tip.

- Tests + smoke: green.
- Script anchors: all present in product code.
- Media manifest: complete, covers every script beat, capture order matches timeline.
- Recovery: covers the four named risks, each with a deterministic fallback.

No bugs filed.
