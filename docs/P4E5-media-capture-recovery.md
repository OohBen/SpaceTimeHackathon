# P4E5 Media Capture Checklist and Recovery Protocol

Source script: `docs/P4E5-live-demo-script.md`.

Goal: capture enough proof material to submit or continue the judge demo if the live run has a minor failure. Every media step below maps to the live script state, not an aspirational flow.

## Artifact Manifest

Store rehearsal and submission material under `artifacts/p4e5-demo/`:

| File | Type | Purpose |
| --- | --- | --- |
| `M01-startup-ready-lines.png` | screenshot | Proof that `npm run demo` reached local stack readiness. |
| `M02-turn-8-scenario-entry.png` | screenshot | Proof that both browsers loaded the same Turn 8 judge scenario. |
| `M03-player-a-callisto-action.png` | screenshot | Proof that Player A can inspect and approve the Callisto proposal. |
| `M04-player-b-jupiter-action.png` | screenshot | Proof that Player B can inspect and approve the Jupiter proposal. |
| `M05-sync-moment.mp4` | video | Proof that both clients converge after submissions. |
| `M06-resolution-summary.png` | screenshot | Proof that the resolution panel and outcome path render. |
| `M06-resolution-summary.mp4` | video | Backup clip for the final resolution beat. |
| `full-run-backup.mp4` | video | Fallback path when live browser operation stalls. |
| `terminal-ready-lines.txt` | text | Copy of the ready lines and smoke output for operator audit. |

## Media Capture Checklist

### M01-startup-ready-lines

Script beat: `[0:00] Setup`.

Capture: screenshot terminal after `npm run demo` prints all ready lines.

Must show:

- `SpacetimeDB: ready http://localhost:3000 db=solar-dominion`
- `Orchestrator: ready http://localhost:8787 mode=fixture`
- `Frontend: ready http://localhost:5173`
- Shutdown line with `Ctrl+C`

Use: proves startup, fixture mode, and no live API key dependency.

### M02-turn-8-scenario-entry

Script beat: `[0:30] Scenario Load`.

Capture: screenshot both browser windows after the seeded session loads.

Must show:

- Player A route: `http://localhost:5173/game/<session_id>/player_a`
- Player B route: `http://localhost:5173/game/<session_id>/player_b`
- Turn 8 state
- Mars pressure cue
- Callisto opportunity cue

Use: proves the scenario state aligns with the live script and is shared by both players.

### M03-player-a-callisto-action

Script beat: `[1:15] Player A Reads The Crisis` and `[2:00] Player A Acts`.

Capture: screenshot Player A command inbox with the proposal detail selected.

Must show:

- `Callisto Pre-Positioning Order`
- Defense department
- confidence/resource cost
- decision controls
- approved or submit-ready state

Use: proves the first player action path is real and maps to the script.

### M04-player-b-jupiter-action

Script beat: `[2:45] Player B Reads The Countermove` and `[3:30] Player B Acts`.

Capture: screenshot Player B command inbox with the proposal detail selected.

Must show:

- `Jupiter Foundry Expansion`
- Industry department
- confidence/resource cost
- decision controls
- approved or submit-ready state

Use: proves the second player action path is real and faction-scoped.

### M05-sync-moment

Script beat: `[4:15] Sync Moment`.

Capture: 10 to 20 second video with both browsers visible after both turns submit.

Must show:

- `player_a` and `player_b` routes
- matching session/phase/readiness state
- transition into the shared resolution path

Use: proves SpacetimeDB synchronization and the simultaneous-turn story.

### M06-resolution-summary

Script beat: `[5:00] Resolution`.

Capture: screenshot and short video of the `Turn resolution summary` or resolution review panel.

Must show:

- Turn number
- event details or outcome summary
- acknowledgement state or `Acknowledge resolution`
- stable post-resolution world state if the panel is closed

Use: proves the outcome path and final judge beat.

## Capture Order

1. Run `npm run demo:presentation-smoke`.
2. Run `npm run demo:smoke`.
3. Start the live stack with `npm run demo`.
4. Load or create the session, then run `seed_demo_turn_8 <session_id>`.
5. Capture M01.
6. Open Player A and Player B browser routes, then capture M02.
7. Drive Player A action, then capture M03.
8. Drive Player B action, then capture M04.
9. Record M05 while both clients converge.
10. Capture M06 after resolution appears.
11. Save terminal output to `terminal-ready-lines.txt`.

## Recovery Steps

### Startup Failure

Symptoms: `npm run demo` does not print all ready lines, exits early, or reports a missing prerequisite.

Steps:

1. Run `npm run demo:presentation-smoke` to verify the committed presentation surfaces.
2. Run `npm run demo:smoke` to reproduce the stack startup failure cheaply.
3. Check ports `3000`, `8787`, and `5173`; stop conflicting processes.
4. Confirm `node`, `npm`, `spacetime`, and workspace `node_modules` are available.
5. Restart with `npm run demo`.

Fallback path: if restart still fails, show `M01-startup-ready-lines.png` from the last successful rehearsal, then continue with `full-run-backup.mp4` while explaining the local runner contract.

### Stale State

Symptoms: wrong turn, old slot ownership, prior decision state, or old session rows.

Steps:

1. Open private windows or separate browser profiles.
2. Clear browser local storage for `localhost:5173` if private windows are unavailable.
3. Restart the stack if the stale state came from an interrupted run.
4. Rerun `seed_demo_turn_8 <session_id>` for the intended session.
5. Confirm both routes use the same `<session_id>` and correct `player_a` / `player_b` slots.

Fallback path: use M02 through M06 from the artifact manifest and narrate the intended live script order.

### Browser Desync

Symptoms: one browser advances while the other does not, readiness differs for too long, or a route points at the wrong slot.

Steps:

1. Confirm both browser URLs share the same session id.
2. Confirm slots are split: one `player_a`, one `player_b`.
3. Refresh the lagging browser once.
4. If state still differs, refresh both browsers after the same phase has settled.
5. If desync persists, restart browser profiles and reload the seeded scenario.

Fallback path: play `M05-sync-moment.mp4`, then continue live at the resolution panel if it is available.

### Missing Narrative Output

Symptoms: proposal prose, inbox narrative, or resolution flavor text is empty or late.

Steps:

1. Confirm fixture mode is active; the terminal should show `mode=fixture`.
2. Use the deterministic proposal titles already in the scenario: `Callisto Pre-Positioning Order` and `Jupiter Foundry Expansion`.
3. Continue through reducer-backed decisions and resolution; narrative is display-only.
4. Use event rows and the `Turn resolution summary` as the authoritative output.

Fallback path: state that narrative text is advisory, then continue with the deterministic table outcomes and `M06-resolution-summary` material.

## Rehearsal Protocol

Run this before every rehearsal or submission capture:

```sh
npm run demo:presentation-smoke
npm run demo:smoke
npm test
```

Then perform one full live run and capture the artifact manifest.

## Operator Checklist

- [ ] Ports `3000`, `8787`, and `5173` free.
- [ ] `npm run demo:presentation-smoke` passes.
- [ ] `npm run demo:smoke` passes.
- [ ] `npm test` passes or a known non-demo failure is documented.
- [ ] Terminal ready lines captured.
- [ ] Player A route uses `player_a`.
- [ ] Player B route uses `player_b`.
- [ ] Turn 8 judge scenario loaded.
- [ ] Mars pressure and Callisto opportunity visible.
- [ ] Player A action captured.
- [ ] Player B action captured.
- [ ] Sync moment video captured.
- [ ] Resolution summary captured.
- [ ] `full-run-backup.mp4` recorded after a clean rehearsal.

## Fallback Path

If a minor issue appears during judging:

1. Keep the stack running if it is still responsive.
2. Say which presentation step failed: startup, scenario entry, player action, sync moment, or resolution.
3. Switch to the matching artifact from `artifacts/p4e5-demo/`.
4. Continue the live script from the next available stable step.
5. Return to the live browser only after both windows show the same session and phase.

This keeps the presentation moving without inventing product behavior.
