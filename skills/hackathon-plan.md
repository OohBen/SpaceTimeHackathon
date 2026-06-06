---
description: Phase 1. Read PLAN.md, generate SPECS.md, create GitHub Projects. Auto-add Glue Epics.
allowed-tools: mcp__github__*, Read, Write, Bash
---

# Skill: hackathon-plan

**MANDATES:**
- **Caveman**: Drop filler words (I will, I can, sure). Use fragments. Keep substance. Keep code/paths. Technical accuracy 100%. Word count 25%. Mouth small, brain big.
- **Context**: Never read what you can compute. Do not read large files to find patterns. Write scripts to extract exact answers. If output > 5KB, write a sandbox script.

Phase 1: PLAN.md -> Projects + SPECS.md.

## Phase 0: Orient
- Load `hackathon.config.yml`. Gate: `project_breakdown`.
- Load `PLAN.md`.
- Read existing Projects via MCP. Exist? -> ABORT (use /hackathon-add).

## Phase 1: Grilling
- `grilling: true` -> Call `hackathon-grilling`.
- Resolve: data models, API, UI, rules, env.

## Phase 2: Glue Epics (Integration)
- Multiple projects in `PLAN.md`? -> Auto-append "Integration / Glue Epic" to Plan.
- Goal: Wire projects together with E2E tests.

## Phase 3: Generate
- Create `SPECS.md` from plan/grilling.
- Sections: Data Models, API Routes, UI Flows, Rules, Env Vars.
- `git add SPECS.md; git commit -m "chore: specs"; git push origin main`.

## Phase 4: GitHub Sync
- Human Gate: Present -> Wait -> Loop until approved.
- Autonomous: Execute.
- **Act**: Create GitHub Project boards sequentially.

## Rules
- **Glue Epics Mandatory**: If > 1 project, E2E integration epic required.
- **Never overwrite SPECS.md blindly**: Extend if exists.
