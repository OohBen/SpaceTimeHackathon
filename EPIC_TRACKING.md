# Epic Tracking - Solar Dominion

Generated from GitHub issues and remote `origin/epic/*` branches on 2026-06-06.

## Branch Rule

Each epic issue maps to `epic/<issue-number>-<slug>`. Every active epic below has a matching remote branch.

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

## Dependency Layers

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

## Gaps And Ambiguities

- `#40` issue body still says `Epic branch: $branch`; actual branch is `epic/33-solar-dominion`.
- `#39` has open `## Blocked By` dependencies but is missing the additive `blocked` label, so label-only queues can show false claimable work.
- Project container issues `#1` through `#5` carry `ai-approved`; claim logic must exclude label `project`.
- Epic dependency fields use names, while task dependency fields use issue numbers. This file maps names to issue numbers for stable handoff.
- P2E1 `#12` depends on P1E6 `#11`, but child task `#120` was intentionally completed early as a scaffold-only slice. Future P2E1 tasks still need backend/access-control dependencies respected.
