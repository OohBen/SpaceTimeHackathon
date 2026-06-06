# Solar Dominion Hosted Play Guide

Use the hosted app:

https://solar-dominion-seven.vercel.app

## Start a Two-Player Game

1. Player 1 opens the site.
2. Click **Create New Session**.
3. Enter Player 1 name and Player 2 name.
4. Click **Start**.
5. Player 1 lands on `/game/<session-id>/player_a`.
6. Send Player 2 the same URL, but change the end to `/player_b`.

Example:

```text
Player 1: https://solar-dominion-seven.vercel.app/game/5/player_a
Player 2: https://solar-dominion-seven.vercel.app/game/5/player_b
```

Player 2 must use a different browser profile, device, or cleared browser identity. One browser identity cannot own both slots.

## Join Rules

- Player 1 owns `player_a`.
- Player 2 owns `player_b`.
- If a slot is already claimed by another browser, it is occupied.
- If you refresh, use the same browser to resume your own slot.
- If you want a totally clean run, clear browser local storage or create a fresh session.

## Turn Flow

The server phase order:

```text
setup -> world_update -> deliberation -> decision -> resolution -> summary
```

For a normal first turn:

1. Both players join.
2. Open **Turn Controls**.
3. Click **Advance World**.
4. Wait for phase `deliberation`.
5. Open **Inbox** or **Turn Controls**.
6. Click **Generate proposals** / **Run Deliberation**.
7. Wait for live LLM proposals to appear in Inbox.
8. Pick or record decisions.
9. Click **Start Decision Phase** if still in deliberation.
10. Click **Submit turn**.
11. When both players are ready, go to `resolution`.
12. Click **Simulate Turn**.
13. Review result.
14. Click **Acknowledge Resolution**.

## Why Generate Proposals May Look Like Nothing

Proposal generation only works during `deliberation`.

If the phase says `setup`, `world_update`, `decision`, or `resolution`, the button is disabled or guarded and no reducer call should fire.

Correct path:

```text
Both players joined -> Advance World -> deliberation -> Generate proposals
```

The live LLM path is async. First click queues work in SpacetimeDB. The worker then calls OpenRouter and writes proposals back. Give it a few seconds, then watch Inbox.

## What To Ignore For Now

- Raw-looking internal IDs are okay.
- Browser extension console logs like `contentscript.js` are not app logs.
- Doctrine is only a strategic posture readout. It does not replace the turn controls.

## What To Report

Send these when something breaks:

- URL
- Current phase shown in header
- Which player slot
- Exact button clicked
- Whether a WebSocket connection log appears
- Any app console line beginning with `[Solar Dominion]`
