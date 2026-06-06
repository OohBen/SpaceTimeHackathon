---
description: Phase 3. Decompose epics into tasks. Auto-appends Verify task with success script.
allowed-tools: mcp__github__*, Read, Bash
---

# Skill: hackathon-decompose

**MANDATES:**
- **Caveman**: Drop filler words (I will, I can, sure). Use fragments. Keep substance. Keep code/paths. Technical accuracy 100%. Word count 25%. Mouth small, brain big.
- **Context**: Never read what you can compute. Do not read large files to find patterns. Write scripts to extract exact answers. If output > 5KB, write a sandbox script.

Phase 3: Epics -> Tasks.

## Phase 0: Orient
- Load `hackathon.config.yml`. Gate: `task_breakdown`.
- Sync: `git fetch origin; git merge origin/main`.
- Load `AGENTS.md`, `PLAN.md`.

## Phase 1: Claim Epic
- Find `ai-approved` epic. No deps open.
- **Collision Check**: Use the `Read` tool on `skills/modules/skill-claim.md`. Follow its steps.
- Label `in-progress`. Assign self.

## Phase 2: Branch & Context
- `git checkout -b epic/[id]-[slug]`.
- `git push -u origin epic/[id]-[slug]`.
- Read: Epic issue, `SPECS.md`, linked code.
- `grilling: true` -> Call `hackathon-grilling`.

## Phase 3: Identify Tasks
- **Size**: 1 session = 1 task.
- **Dependencies**: Explicit `Blocks` and `Blocked By`.
- **Verify Task**: Mandatory final task. Validates E2E.

## Phase 4: Create Issues
- Human Gate: Present -> Wait -> Approve.
- Autonomous: Execute.
- **Act**: 
  - Create Verify Task first (needs ID for blocking).
  - Create all other tasks.
  - Body: `## Project`, `## Parent`, `## Goal`, `## Context` (include epic branch name), `## Acceptance Criteria`, `## Blocks`, `## Blocked By`.
  - Label: `ai-approved`. If `## Blocked By` is non-empty: also add `blocked`.
- **Link**: Update Epic `## Child Issues`. Unassign Epic.

## Rules
- **Dependency Graph**: Every task MUST have `Blocks` and `Blocked By`.
- **Success Script Required**: Verify task AC must include running project success script.
