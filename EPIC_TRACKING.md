# Epic Tracking - Solar Dominion

Generated from GitHub issues and remote `origin/epic/*` branches on 2026-06-06.

## Branch Rule

Each epic issue maps to `epic/<issue-number>-<slug>`. Every active epic below has a matching remote branch.

## Branch Target Contract

| Work type | Source branch | Work branch | PR target | Merge method |
|---|---|---|---|---|
| Task | Epic branch | `task/<issue-number>-<slug>` | Parent epic branch | Squash |
| Epic verify | Epic branch | `verify/<epic-issue-number>-<slug>` or task verify branch | Parent epic branch | Squash |
| Epic release | `main` plus epic branch | Epic branch | `main` | Regular merge commit |

No active epic has a missing branch plan. The branch column in `## Epic Inventory` is the normalized target for every task and verify PR under that epic.

## Task Linkage Contract

- Every task issue must name its parent epic in `## Parent`; the parent epic's branch is the task PR base.
- Every task branch must be created from the latest `origin/epic/<issue-number>-<slug>` before implementation.
- Every task PR body must include `Closes #<task-issue-number>` on its own line, but agents must still close the task issue manually after squash merge because GitHub only auto-closes issues from default-branch merges.
- Every task close-out must clear `in-progress`, `review-ready`, and `in-review` labels, then close with `state_reason=completed`.
- Every verify task is the final child in its epic and gates only the epic-to-main merge. It must not be auto-merged to `main`; `epic_review.human_required` remains true.

## Workflow Checkpoints

| Checkpoint | Required state | GitHub action |
|---|---|---|
| Claim | `ai-approved`, no `blocked`, no assignee, all `## Blocked By` issues closed | Replace state label with `in-progress`, assign self, comment claim |
| Branch | Work starts from latest parent epic branch | Push task branch immediately after claim |
| Baseline | Validation command selected before edits | Record failed/passing baseline when applicable |
| Completion | Acceptance criteria met and tests pass | Push commits, open PR to parent epic branch, label task `review-ready` |
| Review | `code_review.human_required=false` | AI review may comment PASS/changes; self-approval can be blocked by GitHub |
| Task merge | Clean review and checks | Squash merge task PR into epic branch |
| Task close | Task PR merged | Manually close issue and repair labels before claiming next task |
| Epic merge | Verify task complete, epic PR targets `main` | Human review required; regular merge commit only |

## Queue Guardrails

- Always paginate issue scans. This repository has more than 100 issues, so single-page `per_page=100` queries are incomplete.
- Exclude labels `project` and `epic` from task claim queues even if those issues also carry `ai-approved`.
- Exclude verify tasks from ordinary task-review sweeps unless the current goal is epic verification.
- Treat `blocked` as additive only. Recompute it from `## Blocked By`; add it when any dependency is open, remove it when all dependencies are closed.
- If a task PR merged into an epic branch, do not assume GitHub closed the issue. Fetch the issue, close it if still open, then unblock downstream issues.

## Maintenance Runbook

Run this before every claim sweep and after every task merge:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/audit-tracking.ps1
```

Use the report this way:

- `claimableTasks`: candidates for `hackathon-session` after excluding projects, epics, verify tasks, assignees, and open dependencies.
- `labelRepairs`: blocked-label drift. Apply manually with GitHub tools, or run `powershell -ExecutionPolicy Bypass -File scripts/audit-tracking.ps1 -ApplyLabelRepairs`.
- `dependencyLinkGaps`: issues where `A ## Blocks B` exists but `B ## Blocked By A` is missing. Fix issue metadata before trusting `claimableTasks`.
- `stateLabelViolations`: issues with zero or multiple workflow-state labels. Replace with exactly one of `needs-human-review`, `ai-approved`, `in-progress`, `review-ready`, or `in-review`.
- `closedIssueHygiene`: closed issues that still carry workflow labels, `blocked`, or assignees. Clear them before handoff.
- `projectAiApproved`: expected current project-container noise; claim logic must keep excluding `project`.

Closeout maintenance sequence:

1. Fetch merged task PR and confirm target epic branch.
2. Fetch the task issue; if still open, close it with `state_reason=completed` and clear workflow labels.
3. Run `scripts/audit-tracking.ps1`.
4. Fix `closedIssueHygiene`, `stateLabelViolations`, and `dependencyLinkGaps`, then apply only dependency-derived `blocked` label repairs.
5. Re-run the script and claim the next task from the refreshed `claimableTasks` list. A claimable task must have exactly one workflow-state label: `ai-approved`.

## Handoff Notes

Use `COORDINATION_HANDOFF.md` for the short operational handoff. It links the epic map, branch workflow, claim safety checks, closeout rules, and reviewer audit commands.

## Project Map

| Project | Issue | Blocks | Blocked by |
|---|---:|---|---|
| P1 - SpacetimeDB Game Core | #4 | P2, P3, P4, P5 | None |
| P2 - React Command Experience | #3 | P4, P5 | P1 |
| P3 - LLM Proposal Orchestrator | #5 | P4, P5 | P1 |
| P4 - Local Playable Demo and Glue Epic | #2 | P5 | P1, P2, P3 |
| P5 - Hosting, Hardening, and Stretch Waves | #1 | None | P4 |

## Epic Inventory

| Epic | Issue | Project | Branch | Depends on | Child tasks |
|---|---:|---|---|---|---|
| P1E1 - SpacetimeDB Module Scaffold and Tooling | #6 | P1 | `epic/6-spacetime-db-module-scaffold-and-tooling` | None | #35, #36, #37, #38, verify #34 |
| P1E2 - Core Authoritative Schema | #7 | P1 | `epic/7-core-authoritative-schema` | #6 | #75, #76, #77, #78, verify #74 |
| P1E3 - Session Creation and Seeded Demo States | #8 | P1 | `epic/8-session-creation-and-seeded-demo-states` | #6, #7 | #84, #86, #87, #88, verify #83 |
| P1E4 - Simultaneous Turn Reducer Pipeline | #9 | P1 | `epic/9-simultaneous-turn-reducer-pipeline` | #7, #8 | #90, #91, #92, #93, verify #89 |
| P1E5 - Deterministic Simulation Rules | #10 | P1 | `epic/10-deterministic-simulation-rules` | #9 | #95, #96, #97, #98, verify #94 |
| P1E6 - Access Control and Subscription Boundaries | #11 | P1 | `epic/11-access-control-and-subscription-boundaries` | #7, #8, #9 | #105, #106, #107, #108, verify #103 |
| P2E1 - React Client Scaffold and Spacetime Wiring | #12 | P2 | `epic/12-react-client-scaffold-and-spacetime-wiring` | #6, #11 | #120, #121, #122, #124, verify #119 |
| P2E2 - Session Entry and Player Slot Flow | #13 | P2 | `epic/13-session-entry-and-player-slot-flow` | #8, #12 | #150, #151, #152, #153, verify #149 |
| P2E3 - Command Center Shell and Global HUD | #14 | P2 | `epic/14-command-center-shell-and-global-hud` | #12, #13 | #155, #156, #157, #158, verify #154 |
| P2E4 - Solar System Map and City Detail Overlay | #15 | P2 | `epic/15-solar-system-map-and-city-detail-overlay` | #11, #14 | #160, #161, #162, #163, verify #159 |
| P2E5 - Commander Inbox and Decision Workflow | #16 | P2 | `epic/16-commander-inbox-and-decision-workflow` | #9, #14, #18 | #165, #166, #167, #168, verify #164 |
| P2E6 - Strategic Panels for Full Demo Loop | #17 | P2 | `epic/17-strategic-panels-for-full-demo-loop` | #14, #15, #16 | #170, #171, #172, #173, verify #169 |
| P3E1 - LLM Queue Boundary and Deterministic Fallback | #18 | P3 | `epic/18-llm-queue-boundary-and-deterministic-fallback` | #7, #9 | #45, #46, #47, #48, verify #44 |
| P3E2 - OpenRouter Client Reliability Layer | #19 | P3 | `epic/19-openrouter-client-reliability-layer` | #18 | #50, #51, #52, #53, verify #49 |
| P3E3 - Proposal Prompt Builder | #20 | P3 | `epic/20-proposal-prompt-builder` | #18, #19 | #55, #56, #57, #58, verify #54 |
| P3E4 - Narrative Generation for Inbox and Resolution | #21 | P3 | `epic/21-narrative-generation-for-inbox-and-resolution` | #19, #20 | #60, #61, #62, #63, verify #59 |
| P3E5 - Mock Mode and Fixture Mode | #22 | P3 | `epic/22-mock-mode-and-fixture-mode` | #18, #19 | #70, #71, #72, #73, verify #69 |
| P4E1 - End-to-End Integration Glue | #23 | P4 | `epic/23-end-to-end-integration-glue` | #9, #11, #16, #18 | #115, #116, #117, #118, verify #114 |
| P4E2 - One-Command Local Demo Runner | #24 | P4 | `epic/24-one-command-local-demo-runner` | #6, #12, #22 | #130, #131, #132, #133, verify #129 |
| P4E3 - Two-Browser Simultaneous Turn Demo Flow | #25 | P4 | `epic/25-two-browser-simultaneous-turn-demo-flow` | #11, #13, #16, #23 | #135, #136, #137, #138, verify #134 |
| P4E4 - Seeded Turn 8 Judge Scenario | #26 | P4 | `epic/26-seeded-turn-8-judge-scenario` | #8, #15, #21 | #140, #141, #142, #143, verify #139 |
| P4E5 - Demo Script, Media Checklist, and Smoke Coverage | #27 | P4 | `epic/27-demo-script-media-checklist-and-smoke-coverage` | #24, #25, #26 | #145, #146, #147, #148, verify #144 |
| P5E1 - Hosted Deployment Path | #28 | P5 | `epic/28-hosted-deployment-path` | #25 | #65, #66, #67, #68, verify #64 |
| P5E2 - Production Environment and Secret Handling | #29 | P5 | `epic/29-production-environment-and-secret-handling` | #28, #19 | #80, #81, #82, #85, verify #79 |
| P5E3 - Security and Quality Gates | #30 | P5 | `epic/30-security-and-quality-gates` | #6, #12, #22 | #100, #101, #102, #104, verify #99 |
| P5E4 - Expanded Browser E2E Coverage | #31 | P5 | `epic/31-expanded-browser-e2e-coverage` | #25, #30 | #110, #111, #112, #113, verify #109 |
| P5E5 - Stretch Systems and Polish Backlog | #32 | P5 | `epic/32-stretch-systems-and-polish-backlog` | #27 | #125, #126, #127, #128, verify #123 |

## Coordination Epic

| Epic | Issue | Branch | Depends on | Child tasks |
|---|---:|---|---|---|
| Epic Tracking - Solar Dominion | #33 | `epic/33-solar-dominion` | None | #40, #41, #42, #43, verify #39 |

## Coarse Dependency Waves

| Layer | Epics |
|---|---|
| Foundation | #6 |
| Core schema/session/reducer | #7, #8, #9 |
| Backend depth | #10, #11 |
| Frontend and orchestrator starts | #12, #18 |
| First app/orchestrator surfaces | #13, #14, #19, #20, #21, #22 |
| Playable UX surfaces | #15, #16, #17 |
| Glue and local demo | #23, #24, #25, #26, #27 |
| Hosted/hardening/stretch | #28, #29, #30, #31, #32 |

These are coarse planning waves, not parallel-safe topological layers. Use each epic's `Depends on` cell before claiming work.

## Gaps And Ambiguities

- `#40` issue body still says `Epic branch: $branch`; actual branch is `epic/33-solar-dominion`.
- `#39` had open `## Blocked By` dependencies but was missing the additive `blocked` label. Repaired on 2026-06-06; keep it blocked until #41, #42, and #43 close.
- Epic issue bodies for `#23` through `#32` have several markdown headings flattened onto single lines in GitHub output. Strict section parsers can miss `Dependencies` or `Child Issues`; prefer issue-number dependency cells in this file or normalize those bodies in a follow-up maintenance task.
- Project container issues `#1` through `#5` carry `ai-approved`; claim logic must exclude label `project`.
- Epic dependency fields use names, while task dependency fields use issue numbers. This file maps names to issue numbers for stable handoff.
- P2E1 `#12` depends on P1E6 `#11`, but child task `#120` was intentionally completed early as a scaffold-only slice. Future P2E1 tasks still need backend/access-control dependencies respected.
