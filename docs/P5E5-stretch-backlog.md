# P5E5 Stretch Systems and Polish Backlog

Purpose: organize optional deeper-system and polish work that is **not** required for the hosted demo. This backlog exists so judges and operators can tell at a glance which features can land late, which can ship as follow-ons, and which can be cut without weakening the demo.

Source plan: [`PLAN.md`](../PLAN.md) § "Stretch wave". Source epic: [#32](https://github.com/OohBen/SpaceTimeHackathon/issues/32).

## Stretch Guardrails

These rules separate must-have from optional. Every stretch item below must respect all four.

1. **No stretch item blocks the hosted demo.** The judge path (P4E5 demo script + hosted P5E1 path) must remain green even if zero stretch items land.
2. **No stretch item modifies a reducer that the demo path depends on.** Touching `commander_decision`, `submit_turn`, `ack_resolution`, `seed_demo_turn_8`, or `turn_resolution` is out of scope.
3. **Every stretch item is independently revertible.** Each chunk lands behind a feature flag (env var or fixture toggle) and can be flipped off without breaking the smoke path.
4. **Stretch items are sequenced within their wave.** Cross-wave dependencies are explicit; intra-wave ordering is explicit; nothing in a later wave blocks an earlier wave.

## Prioritization Framework

Each chunk is scored on two axes:

| Axis | Scale | What it means |
| --- | --- | --- |
| Judge impact | low / medium / high | How much the chunk visibly changes the judge story. High = a new judge beat. Medium = enriches an existing beat. Low = polish only. |
| Effort | XS / S / M / L | XS ≤ 2 h. S ≤ 1 day. M ≤ 2 days. L ≤ 4 days. |

Selection rule: **prefer high-impact / low-effort first; never schedule L-effort until all M-effort items in earlier waves are done**.

Cross-wave dependency rules:

- Wave 1 is a prerequisite for Wave 2's diplomacy-aware military and Wave 3's diplomacy-driven events. Wave 1 ships first.
- Wave 2 is independent of Wave 3 once Wave 1 lands; Waves 2 and 3 can run in parallel.
- Polish-only items inside Wave 3 must not gate the gameplay items inside Wave 3.

## Wave 1 — Diplomacy, Trade, Intel, Propaganda

Theme: deeper inter-faction surfaces. These hook into existing tables (`trade_agreements`, `intelligence_records`) without changing turn resolution semantics.

Sequencing inside the wave: **W1.1 → W1.2 → (W1.3 ∥ W1.4)**. W1.3 and W1.4 can land in either order once W1.2 ships.

### W1.1 — Diplomacy proposal surface

- **Why optional**: the judge path already shows command proposals; diplomacy proposals are an additive category.
- **Demo value**: lets the judge see a "negotiate vs invade" decision in addition to Callisto/Jupiter.
- **Judge impact**: medium. **Effort**: M.
- **Dependencies**: none beyond the merged proposal pipeline.
- **Feature flag**: `STRETCH_DIPLOMACY_PROPOSALS=1` toggles the diplomacy department in `commander inbox`.
- **AC**: at least one diplomacy proposal fixture; inbox renders it under a `Diplomacy` department; approve/reject still routes through the existing `commander_decision` reducer with no schema change.

### W1.2 — Trade agreement read surface

- **Why optional**: `trade_agreements` already exists in SPECS; only a read panel is missing.
- **Demo value**: enables a "shared world economy" judge beat without writing new game logic.
- **Judge impact**: medium. **Effort**: S.
- **Dependencies**: W1.1 ships first so the diplomacy panel can link out to trade.
- **Feature flag**: `STRETCH_TRADE_PANEL=1` toggles the panel in the diplomacy view.
- **AC**: trade panel renders zero or more agreements from the existing table; read-only; no reducer changes.

### W1.3 — Intelligence summary panel

- **Why optional**: `intelligence_records` exists; current demo does not surface it.
- **Demo value**: gives the judge a one-screen "what each commander knows about the other" beat.
- **Judge impact**: high. **Effort**: M.
- **Dependencies**: W1.2 (intel panel borrows the diplomacy panel's layout primitives).
- **Feature flag**: `STRETCH_INTEL_PANEL=1`.
- **AC**: intel panel shows observer-scoped records only; respects existing row-level visibility; read-only.

### W1.4 — Propaganda event ticker

- **Why optional**: propaganda is narrative; it does not gate any reducer.
- **Demo value**: gives the judge a passive flavor stream during the simultaneous-turn waiting window.
- **Judge impact**: low. **Effort**: S.
- **Dependencies**: W1.2 (same layout primitives).
- **Feature flag**: `STRETCH_PROPAGANDA_TICKER=1`.
- **AC**: ticker pulls from a deterministic fixture; no new reducer; clears on turn resolve.

## Wave 2 — Talent Poaching and Advanced Military

Theme: deeper personnel and combat mechanics. These remain advisory: reducers still resolve outcomes deterministically.

Sequencing inside the wave: **W2.1 → W2.2 → W2.3**. W2.3 depends on diplomacy posture from W1.1, so Wave 1 must land first.

### W2.1 — Talent poaching proposal type

- **Why optional**: existing personnel proposals are sufficient for the demo.
- **Demo value**: gives the judge a "poach the rival's lead officer" beat.
- **Judge impact**: medium. **Effort**: M.
- **Dependencies**: none beyond the proposal pipeline.
- **Feature flag**: `STRETCH_TALENT_POACHING=1`.
- **AC**: at least one poaching proposal fixture; approve routes through `commander_decision`; outcome surfaces in the existing personnel panel without changing personnel schema.

### W2.2 — Advanced military doctrine modifiers

- **Why optional**: turn resolution already produces deterministic outcomes; doctrine modifiers are flavor + tuning.
- **Demo value**: lets the judge see "doctrine choice shapes battle text" without changing the win/loss table.
- **Judge impact**: medium. **Effort**: M.
- **Dependencies**: W2.1 (doctrine modifiers reuse the personnel-loaded officer trait surface).
- **Feature flag**: `STRETCH_DOCTRINE_MODIFIERS=1`.
- **AC**: doctrine flags read from existing faction state; modify only outcome narrative, not numeric resolution.

### W2.3 — Diplomacy-aware military proposals

- **Why optional**: military proposals currently ignore diplomacy posture.
- **Demo value**: gives the judge a "war is harder when treaties exist" beat.
- **Judge impact**: high. **Effort**: L. **Schedule rule**: do not start until every M-effort item in Waves 1 and 2 is shipped.
- **Dependencies**: W1.1, W2.1.
- **Feature flag**: `STRETCH_DIPLOMACY_AWARE_MILITARY=1`.
- **AC**: military proposal prompt builder reads diplomacy posture from existing tables; no reducer change; deterministic fixture for the diplomacy-modified prompt.

## Wave 3 — Richer Events and Polish

Theme: presentation polish and event richness. Polish items must not gate gameplay items.

Sequencing inside the wave: gameplay items first (**W3.1**), then polish (**W3.2 → W3.3 → W3.4**). W3.2, W3.3, W3.4 follow the polish priority order below.

### W3.1 — Richer event timeline

- **Why optional**: the current event list is enough for the demo; richer events are flavor.
- **Demo value**: gives the judge a Turn 1 → Turn 8 narrative recap.
- **Judge impact**: medium. **Effort**: M.
- **Dependencies**: none.
- **Feature flag**: `STRETCH_RICH_EVENT_TIMELINE=1`.
- **AC**: timeline panel reads `events` table; deterministic ordering; renders read-only timeline.

### W3.2 — Resolution narrative polish (Polish priority 1)

- **Why optional**: existing resolution text is functional; this raises production value.
- **Demo value**: makes the final judge beat feel more authored.
- **Judge impact**: medium. **Effort**: S.
- **Dependencies**: none.
- **Feature flag**: `STRETCH_RESOLUTION_POLISH=1`.
- **AC**: extra narrative copy gated behind flag; does not modify event row content.

### W3.3 — Map detail overlay polish (Polish priority 2)

- **Why optional**: the current map overlay is readable; this improves contrast and legibility.
- **Demo value**: helps the judge read the public map at a glance.
- **Judge impact**: low. **Effort**: S.
- **Dependencies**: none.
- **Feature flag**: none — pure CSS / asset polish that can ship as a normal change.
- **AC**: lighthouse / contrast budget reported in the PR; no functional change.

### W3.4 — Inbox empty/loading state polish (Polish priority 3)

- **Why optional**: the current empty state works; this softens the no-proposals window.
- **Demo value**: smooths the moment between turn submission and resolution.
- **Judge impact**: low. **Effort**: XS.
- **Dependencies**: none.
- **Feature flag**: none — pure UI tweak.
- **AC**: empty state visible in the existing inbox component test fixtures; no logic change.

## Polish Priority Order

When multiple polish items are eligible to land in the same window, take them in this order. The order reflects "judge can see it from the back row" descending.

1. **W3.2 Resolution narrative polish** — directly affects the final judge beat.
2. **W3.3 Map detail overlay polish** — affects every shared-world frame the judge sees.
3. **W3.4 Inbox empty/loading state polish** — affects the wait window.

Polish that does not appear in this list is not in scope until the listed items ship.

## Out of Scope (Explicitly Not Stretch)

These ideas surfaced during planning and are **not** part of P5E5. They are tracked here so they do not silently expand the stretch surface.

- Real-time multiplayer combat resolution (changes reducer semantics — violates Guardrail #2).
- LLM-controlled simulation outcomes (violates the PLAN.md "reducers remain authoritative" rule).
- Persistent user accounts or auth beyond fixture/local mode (separate hosted concern).
- Live OpenRouter calls in the judge path (deterministic fixture mode remains the demo default).
- Native mobile app (PLAN.md Out of Scope).

## How to Pull from This Backlog

1. Confirm the hosted demo path is green (P4E5 + P5E1 smoke).
2. Pick the highest-priority chunk in the lowest-numbered wave that has its dependencies met.
3. Verify the chunk's feature flag is OFF by default on the demo branch.
4. Implement, gate behind the flag, ship as a normal task PR against `main`.
5. If the flag is ON in fixture mode, the presentation smoke (`scripts/presentation-smoke.mjs`) must still pass.
