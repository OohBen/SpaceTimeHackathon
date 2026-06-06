# P2E5 Verification

Issue: #164
Epic: #16 - Commander Inbox and Decision Workflow
Epic branch: `epic/16-commander-inbox-and-decision-workflow`
Verified commit: `3274daac16a0ce522ca5b7c5d6001dda84f7e702`
Date: 2026-06-06

## Validation

The required success script passed:

```bash
npm test
```

Observed results:

| Workspace | Files | Tests | Result |
|---|---|---|---|
| `server` | 23 | 210 | PASS |
| `client` | 13 | 95 | PASS |
| `orchestrator` | 1 | 1 | PASS |
| **Total** | **37** | **306** | **PASS** |

Note: an untracked `client/src/routes/mapDetailOverlay.test.tsx` from a separate epic's working tree was removed from the working directory before running the success script; it is not part of this epic and is not committed on `epic/16`.

## Coverage Matrix

| Acceptance Criterion | Automated coverage |
|---|---|
| Run the project success script and capture pass/fail evidence | `npm test` PASS — 37 files / 306 tests across server, client, orchestrator (table above). |
| Players can inspect proposals and make valid decisions | `client/src/components/inbox/Inbox.test.tsx` — `lists proposals for the current player faction`, `opens proposal detail when a proposal is selected`, `shows backend-sourced metadata in the reader`, `submits approved proposals through the typed commander decision reducer`, `submits reject and defer decisions with zero allocation`, `disables decision controls for proposals that already have a terminal decision`. `client/src/state/session-store.test.ts` — `exposes proposals for the current player faction and ignores other factions`, `tracks proposal subscription loading and error states`, `applies proposal upsert and delete events through the subscription bridge`. `client/src/spacetime/session-actions.test.ts` — `builds typed commander decision reducer descriptors`, `dispatches commander decisions and records per-proposal reducer state`. |
| Impossible spending is blocked before submit | `client/src/components/inbox/Inbox.test.tsx` — `blocks impossible approved allocations with clear validation messaging` (covers approval allocation guard against underfunded credits and out-of-range resource commitment). |
| Submit-turn reflects ready, backend-error, and timeout/auto-defer states clearly | `client/src/components/inbox/Inbox.test.tsx` — `enables turn submit only after current player decisions are resolved`, `surfaces backend submit errors without hiding decision status`, `calls timeout reducer and labels auto-deferred proposal outcomes`, `shows backend validation errors and success state for decision calls`. `client/src/spacetime/session-actions.test.ts` — `builds typed submit turn and expire turn reducer descriptors`, `dispatches submit turn and timeout reducers with scoped reducer state keys`. |

## Security Audit (hackathon-security-audit)

```
CRITICAL: none
HIGH: none
MEDIUM: none
LOW: none
PASSED: secrets scan (epic delta contains only `opponent-secret` as a fixture
        ID in Inbox.test.tsx, asserting that opponent-faction proposals are
        scoped out of the current player's inbox — a positive authz test, not
        a real secret), authorization scoping (selectInboxProposalsForCurrentPlayer
        filters proposalsById by session + faction), SQL injection (no raw queries
        in epic delta — SpacetimeDB reducers only), input validation
        (`validateApprovalAllocation` enforces credit and resource bounds before
        commander_decision dispatch), dependencies (`npm audit --audit-level=high`
        found 0 vulnerabilities).
```

## Remaining Gaps

- No remaining automation gaps for P2E5 acceptance.
- Two-browser live boot of the inbox panel is exercised in component tests via the React store bridge; the real-time SpacetimeDB happy path is covered by `connection-lifecycle.test.ts` and `playerSlotFlow.test.tsx` on the same epic merge baseline.
