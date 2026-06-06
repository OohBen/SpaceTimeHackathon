# P1E6 Verification

Issue: #103
Epic: #11 - Access Control and Subscription Boundaries
Epic branch: `epic/11-access-control-and-subscription-boundaries`
Verified code commit: `060caea9c1d8714b0e0602e97980f2958c451d81`
Date: 2026-06-06

## Validation

The required success script passed:

```bash
npm test
```

Additional verification passed:

```bash
npm run build
git diff --check
```

Observed results:

| Command | Result |
|---|---|
| `npm test` | Pass: server 18 files / 139 tests, client 2 files / 6 tests, orchestrator 1 file / 1 test |
| `npm run build` | Pass: server, client, and orchestrator TypeScript builds; client Vite production build completed |
| `git diff --check` | Pass: no whitespace errors |

Environment-limited check:

| Command | Result |
|---|---|
| `npm run spacetime:build` | Not run successfully: local `spacetime` CLI is not installed on PATH |

## Coverage Matrix

| Acceptance area | Automated coverage |
|---|---|
| Visibility policy and identity model | `server/src/access_policy.test.ts` verifies table visibility classes, public projection fields, faction-private fields, reducer access policies, claimed identity scopes, and unclaimed placeholder identity behavior. |
| Unauthorized private reads | `server/src/private_state_filters.test.ts` and `server/src/access_boundary_hardening.test.ts` verify observers, unclaimed contexts, opposing faction contexts, and wrong-session scopes return no hidden command rows. |
| Mixed public/private subscriptions | `server/src/public_world_projection.test.ts` verifies shared public world projections are identical for both factions, omit private fields, and keep practical map/travel join fields. `server/src/access_boundary_hardening.test.ts` verifies the same public rows remain shared while private rows stay faction scoped. |
| Faction-private subscription filters | `server/src/private_state_filters.test.ts` verifies personnel, relationships, proposals, commander inbox, projects, intelligence, turn summaries, trade agreements, and LLM requests are filtered through owner, observer, or participant scope rules. |
| Invalid reducer decisions | `server/src/turn_decisions.test.ts`, `server/src/turn_advancement.test.ts`, and `server/src/turn_resolution.test.ts` verify non-owner, cross-faction, wrong-phase, repeated, underfunded, overspent, timeout, acknowledgement, and victory-check access failures. |
| Cross-faction mutation safety | `server/src/access_boundary_hardening.test.ts` verifies a cross-faction commander decision throws without mutating faction or proposal rows. |
| Seeded scenario coverage | `server/src/turn1_seed.test.ts` and `server/src/turn8_seed.test.ts` verify deterministic Turn 1 and Turn 8 rows, references, insert order, and scenario data used by access-boundary tests. |
| Epic end-to-end reducer path | `server/src/turn_pipeline.test.ts` exercises the decision pipeline through ready/timeout resolution and summary acknowledgement paths using seeded state. |

## Remaining Gaps

- `npm run spacetime:build` and `npm run generate` could not be verified in this local environment because the `spacetime` CLI is missing from PATH.
- Generated client bindings for the new anonymous public views should be regenerated after the CLI is available.
- No functional P1E6 gap is known in the TypeScript/unit coverage path; the remaining gap is CLI/export validation before epic review.
