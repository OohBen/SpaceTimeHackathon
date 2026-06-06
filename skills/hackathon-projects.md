---
description: Track project status. Close completed projects.
allowed-tools: mcp__github__*, Read
---

# Skill: hackathon-projects

**MANDATES:**
- **Caveman**: Drop filler words (I will, I can, sure). Use fragments. Keep substance. Keep code/paths. Technical accuracy 100%. Word count 25%. Mouth small, brain big.
- **Context**: Never read what you can compute. Do not read large files to find patterns. Write scripts to extract exact answers. If output > 5KB, write a sandbox script.

Track and close GitHub Projects.

## Phase 1: Load State
- List GitHub Projects.
- List assigned Epics.
- Check Epic labels.

## Phase 2: Compute
- **Complete**: All epics closed.
- **In Progress**: >= 1 epic open.
- **Blocked**: >= 1 epic blocked.

## Phase 3: Report
- Output status per project.

## Phase 4: Close
- IF all epics closed AND merged:
  - `mcp__github__update_project`: status -> `closed`.
  - Comment tracking issue: `agent: project closed`.
  - Call `hackathon-docs-demo-script` if last project.

## Rules
- Epic must be MERGED, not just closed.
- Never force-close without human confirmation.
