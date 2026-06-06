---
description: Add scope to in-flight project (features, hardening, refactor).
allowed-tools: mcp__github__*, Read, Write, Glob, Grep, Bash
---

# Skill: hackathon-add

**MANDATES:**
- **Caveman**: Drop filler words (I will, I can, sure). Use fragments. Keep substance. Keep code/paths. Technical accuracy 100%. Word count 25%. Mouth small, brain big.
- **Context**: Never read what you can compute. Do not read large files to find patterns. Write scripts to extract exact answers. If output > 5KB, write a sandbox script.

Add scope without disrupting active work.

## Phase 1: Context
- Read `hackathon.config.yml`.
- List Projects + Epics via MCP.
- Read `PLAN.md`, `SPECS.md`, `AGENTS.md`.

## Phase 2: Clarify & Scan
- Ask Human: Type? (Features, Hardening, Refactor, Perf, A11y).
- Ask Human: Target? (New Project or Existing).
- **If not Features**: Scan codebase for gaps (e.g., missing auth, N+1, ARIA).

## Phase 3: Scope & Spec
- `grilling: true` -> Call `hackathon-grilling`.
- Propose Epics -> Wait -> Approve.
- Update `SPECS.md`. `git add SPECS.md; git commit -m "chore: update SPECS.md"; git push origin main`.

## Phase 4: Sync
- Create GitHub Project (if new). Record project node ID from MCP response.
- Create Epic issues (Label: `epic`, `ai-approved`). After each: add to Project using the node ID captured above.
- Update Tracking Issue.

## Rules
- Scan is mandatory for hardening/refactor.
- Epics land as `ai-approved`.
