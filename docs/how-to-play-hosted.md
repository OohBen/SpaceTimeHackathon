# Solar Dominion Hosted Play Guide

Hosted app:

https://solar-dominion-seven.vercel.app

This is a two-player turn game. Use **Turn Controls** for phase changes. Use **Inbox** for LLM proposals and decisions. Most other panels are read-only context.

## Fast Answer: Which Panel Do I Use?

| Panel | What it is for | Required to play? |
| --- | --- | --- |
| **Turn Controls** | Move the game through phases: world update, deliberation, decision, resolution. | **Yes** |
| **Inbox** | Generate and review proposals. Submit decisions when available. | **Yes** |
| **Star Map** | Inspect planets, cities, fleets, and world state. | Useful |
| **Strategic View** | High-level summary of session state. | Useful |
| **Personnel** | Read commanders/advisers. | Optional |
| **Resources** | Read credits and political capital. | Optional |
| **Intelligence** | Read discovered intel. | Optional |
| **Diplomacy** | Read diplomatic state. | Optional |
| **Doctrine** | Read strategic posture. | Optional |
| **Turn Resolution** | Read results after simulation. | Useful after resolution |

If confused, use only two panels:

```text
Turn Controls -> Inbox -> Turn Controls
```

## Player 1 Setup

1. Player 1 opens https://solar-dominion-seven.vercel.app.
2. Click **Create New Session**.
3. Enter Player 1 name.
4. Enter Player 2 name.
5. Click **Start**.
6. Browser goes to a URL like:

```text
https://solar-dominion-seven.vercel.app/game/5/player_a
```

7. Player 1 stays on that page.
8. Copy the URL for Player 2, but change `player_a` to `player_b`.

Example:

```text
Player 1 URL:
https://solar-dominion-seven.vercel.app/game/5/player_a

Player 2 URL:
https://solar-dominion-seven.vercel.app/game/5/player_b
```

## Player 2 Setup

1. Player 2 opens the `player_b` URL from Player 1.
2. Use a different device, different browser profile, or cleared browser identity.
3. Join/resume the session when prompted.
4. Player 2 should land in the command center as `player_b`.

Important:

- Same browser identity cannot own both players.
- If Player 2 sees occupied, they may be using Player 1's browser identity.
- Use another browser profile/device, or clear local storage and try again.

## First Turn: Exact Click Script

Both players should be in the command center before starting.

### Step 1: Confirm Both Players Joined

Both players:

1. Look at the header.
2. Confirm your slot says your player:
   - Player 1: `player_a`
   - Player 2: `player_b`
3. Open **Turn Controls**.

The phase likely starts as:

```text
setup
```

### Step 2: Advance World

One player only:

1. Open **Turn Controls**.
2. Click **Advance World**.
3. Wait for the phase to become:

```text
deliberation
```

If it does not change immediately, wait a few seconds or refresh.

### Step 3: Generate Proposals

Each player:

1. Open **Inbox**.
2. Click **Generate proposals**.
3. Wait a few seconds.
4. Stay in **Inbox**.
5. Proposals should appear.

Alternative:

1. Open **Turn Controls**.
2. Click **Run Deliberation**.
3. Go back to **Inbox** to read proposals.

Notes:

- This only works in `deliberation`.
- If phase is `setup`, click **Advance World** first.
- If phase is not `deliberation`, proposal generation should not fire.
- Live LLM is async: click queues work, worker calls OpenRouter, results appear later.

### Step 4: Read The Map Before Choosing

Each player:

1. Open **Star Map**.
2. Inspect bodies, cities, fleets, and control state.
3. Open **Resources** to check credits and political capital.
4. Optional: open **Personnel**, **Intelligence**, **Diplomacy**, **Doctrine** for flavor/context.
5. Return to **Inbox**.

Do not overthink these panels. They help you pick between proposals.

### Step 5: Make Decisions

Each player:

1. In **Inbox**, read proposals.
2. Choose the proposal/decision the UI allows.
3. When the inbox says no decisions are pending, continue.

If the UI has proposals but no clear choose button, current build is still incomplete there. Use this as the manual play intent:

```text
Pick one proposal mentally -> continue the turn flow from Turn Controls
```

### Step 6: Start Decision Phase

One player only:

1. Open **Turn Controls**.
2. Click **Start Decision Phase**.
3. Phase should become:

```text
decision
```

### Step 7: Submit Turn

Each player:

1. Open **Inbox** or **Turn Controls**.
2. Click **Submit turn** / **Submit Turn**.
3. Confirm your readiness says ready.

Both players must submit before resolution.

### Step 8: Simulate Turn

One player only:

1. Open **Turn Controls**.
2. When phase is `resolution`, click **Simulate Turn**.
3. Open **Turn Resolution**.
4. Read what happened.

### Step 9: Acknowledge Resolution

Each player:

1. Open **Turn Controls**.
2. Click **Acknowledge Resolution**.
3. When both acknowledge, next turn can begin.

## Full Phase Cheat Sheet

```text
setup
  Both players claim slots.
  Use: Turn Controls -> Advance World.

world_update
  Server prepares world state.
  Use: Turn Controls -> Advance World if still visible.

deliberation
  Generate LLM proposals.
  Use: Inbox -> Generate proposals.
  Use: Star Map / Resources to inspect context.

decision
  Submit choices and ready state.
  Use: Inbox or Turn Controls -> Submit turn.

resolution
  Apply the turn.
  Use: Turn Controls -> Simulate Turn.
  Use: Turn Resolution to read result.

summary
  Between turns.
  Use: Turn Controls to continue when available.
```

## Why A Button Might Do Nothing

Most buttons are phase-gated.

| Button | Works only when |
| --- | --- |
| **Advance World** | `setup` or `world_update` |
| **Generate proposals** | `deliberation` |
| **Run Deliberation** | `deliberation` |
| **Start Decision Phase** | `deliberation` |
| **Submit turn** | `decision` mostly, sometimes `deliberation` if no pending decisions |
| **Simulate Turn** | `resolution` |
| **Acknowledge Resolution** | `resolution` |

If no network request fires, first check the phase in the header.

## What Not To Use As Main Gameplay

These panels are mostly read-only:

- **Strategic View**
- **Personnel**
- **Resources**
- **Intelligence**
- **Diplomacy**
- **Doctrine**

Use them for context. They are not where the turn advances.

## Clean Restart

If the session gets weird:

1. Create a new session.
2. Give Player 1 the `player_a` URL.
3. Give Player 2 the `player_b` URL.
4. Use different browser identities.

Development note: maincloud can be reset during development if needed.

## What To Send When Reporting A Bug

Send:

- URL
- Player slot: `player_a` or `player_b`
- Current phase in header
- Panel open
- Button clicked
- What you expected
- What happened
- Any console line beginning with `[Solar Dominion]`

Ignore browser extension logs like `contentscript.js`; those are usually not app logs.
