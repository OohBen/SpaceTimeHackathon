# P4E5 Live Demo Script

Purpose: run the judge path exactly as the product supports it today. No hosted URL, no demo credentials, no live OpenRouter key. Default mode is local fixture mode.

## Preflight

Run these before rehearsal:

```sh
npm install
npm run demo:presentation-smoke
npm run demo:smoke
```

`npm run demo:presentation-smoke` is the cheap presentation smoke check. It does not start services. It verifies the startup contract, Turn 8 judge scenario, both player action paths, the turn sync moment, and the Turn resolution summary surface.

`npm run demo:smoke` starts the same managed local stack as the live demo, waits for readiness, prints the ready lines, then tears down.

Failure signal: the smoke output names the broken presentation step: `startup`, `scenario-entry`, `player-a-action`, `player-b-action`, `sync-moment`, or `resolution`.

## Live Run Setup

```sh
npm run demo
```

Wait for:

```text
SpacetimeDB: ready http://localhost:3000 db=solar-dominion
Orchestrator: ready http://localhost:8787 mode=fixture
Frontend: ready http://localhost:5173
Shutdown: press Ctrl+C once; runner stops frontend, orchestrator, then SpacetimeDB
```

Create or resume one local session, then load the Turn 8 judge scenario:

```sh
spacetime call solar-dominion --server http://localhost:3000 seed_demo_turn_8 <session_id>
```

Open two browser windows:

- Player A: `http://localhost:5173/game/<session_id>/player_a`
- Player B: `http://localhost:5173/game/<session_id>/player_b`

Use private windows or separate browser profiles if slot ownership has stale local state.

## Literal Script

### [0:00] Setup

ACTION: show terminal with `npm run demo` ready lines.

SAY: "Solar Dominion is running locally as three services: SpacetimeDB, the LLM orchestrator in fixture mode, and the React command center. Fixture mode keeps the judge path deterministic."

JUDGE SEES: startup readiness, service URLs, no external API key requirement.

JUDGE BEAT: the game is playable, not a mock slide.

### [0:30] Scenario Load

ACTION: show the seeded session in both browser windows. Player A route ends in `player_a`; Player B route ends in `player_b`.

SAY: "This is the Turn 8 judge scenario. Mars pressure is visible in the shared world, while the Callisto opportunity gives both commanders a strategic fork."

JUDGE SEES: both players in the same session, Turn 8 state, faction-specific command centers.

JUDGE BEAT: one shared world, two private command seats.

### [1:15] Player A Reads The Crisis

ACTION: in Player A, open the Commander inbox and select `Callisto Pre-Positioning Order`.

SAY: "Player A gets an officer proposal from the Defense department. The proposal asks for a Callisto pre-positioning order, trading near-term credits for position before the opponent reacts."

JUDGE SEES: proposal title, department, confidence, resource cost, decision controls.

JUDGE BEAT: LLM-style command text is advisory; reducers still own the game state.

### [2:00] Player A Acts

ACTION: approve `Callisto Pre-Positioning Order`, keep allocation at or above its resource cost, then click `Submit turn`.

SAY: "Player A approves the Callisto move and locks the turn. The submit state is faction-scoped, so Player B still has private decision work to do."

JUDGE SEES: approved proposal state, submit readiness, Player A waiting for the other slot.

JUDGE BEAT: simultaneous-turn pressure without leaking private choices.

### [2:45] Player B Reads The Countermove

ACTION: switch to Player B. Open the Commander inbox and select `Jupiter Foundry Expansion`.

SAY: "Player B sees the same public tension, but a different private command surface. The Industry proposal frames Jupiter production as the answer to the Callisto race."

JUDGE SEES: Player B route, Player B faction status, proposal detail for `Jupiter Foundry Expansion`.

JUDGE BEAT: public map sync, private inbox state.

### [3:30] Player B Acts

ACTION: approve `Jupiter Foundry Expansion`, then click `Submit turn`.

SAY: "Now both commanders are ready. The app moves from private decision work into the shared resolution path."

JUDGE SEES: Player B submit state changes; Player A and Player B converge on turn resolution.

JUDGE BEAT: both players complete a real simultaneous turn.

### [4:15] Sync Moment

ACTION: keep both windows visible. Point to the turn readiness and phase changes after both submissions.

SAY: "This is the sync moment. Both browsers receive the same session phase and turn summary data from SpacetimeDB subscriptions."

JUDGE SEES: matching phase/readiness state across `player_a` and `player_b`.

JUDGE BEAT: SpacetimeDB is the live shared state layer.

### [5:00] Resolution

ACTION: open the `Turn resolution summary` or resolution review panel. Show generated outcome text and event rows. Click `Acknowledge resolution` if available.

SAY: "The resolution panel separates presentation narrative from authoritative reducer output. The story explains the outcome; the tables carry the durable state."

JUDGE SEES: Turn resolution summary, event details, acknowledgement path.

JUDGE BEAT: narrative flavor plus deterministic game state.

### [5:45] Close

ACTION: return to the map and show Mars/Callisto cues still reflected in the world state.

SAY: "The demo loop is startup, scenario entry, two private player actions, a visible sync moment, and resolution. The same path is guarded by `npm run demo:presentation-smoke` and the stack smoke command."

JUDGE SEES: stable post-resolution world and clear next-turn setup.

JUDGE BEAT: repeatable rehearsal path, clear failure signals, no improvisation needed.

## Smoke Mapping

| Smoke step | Presentation step | Product behavior protected |
| --- | --- | --- |
| `startup` | Setup | `npm run demo` and `npm run demo:smoke` still use the managed local runner and fixture defaults. |
| `scenario-entry` | Scenario Load | `turn-8-judge` fixture, `seed_demo_turn_8`, Mars pressure, and Callisto opportunity still exist. |
| `player-a-action` | Player A Acts | `player_a` route, proposal decision controls, `commander_decision`, and `submit_turn` remain wired. |
| `player-b-action` | Player B Acts | `player_b` route uses the same action and submit path. |
| `sync-moment` | Sync Moment | session and turn summary subscriptions still feed readiness UI. |
| `resolution` | Resolution | Turn resolution summary, `ack_resolution`, and `turn_summaries` remain wired. |

## Operator Notes

- Use fixture mode unless the judge specifically asks for live OpenRouter behavior.
- Keep the terminal visible until all ready lines print.
- Use `Ctrl+C` once to stop the runner; it tears down frontend, orchestrator, then SpacetimeDB.
- If a browser has stale slot ownership, open a private window or clear local storage before rerun.
