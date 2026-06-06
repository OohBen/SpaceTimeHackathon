---
description: Epic finalization. Verify E2E, audit, merge Epic->Main (regular merge, NO squash).
allowed-tools: mcp__github__*, Read, Bash
---

# Skill: hackathon-verify

**MANDATES:**
- **Caveman**: Drop filler words (I will, I can, sure). Use fragments. Keep substance. Keep code/paths. Technical accuracy 100%. Word count 25%. Mouth small, brain big.
- **Context**: Never read what you can compute. Do not read large files to find patterns. Write scripts to extract exact answers. If output > 5KB, write a sandbox script.

Final task per epic. E2E Verify -> Main Merge.

## Phase 0: Orient
- Load `hackathon.config.yml`. Gate: `epic_review`.
- Claim Verify task.
- Ensure all sibling tasks closed **via merged PR** (not manually closed). Open or manually closed? -> Comment reason. Unassign + ABORT.

## Phase 1: Sync & Test
- Use the `Read` tool on `skills/modules/skill-sync.md`. Follow its steps to sync the `epic` branch.
- Run test suite.
- Security audit: Use the `Read` tool on `skills/hackathon-security-audit.md`. CRITICAL = ABORT + File bugs.
- Verify AC.

## Phase 2: Verdict
- **FAIL**: 
  - Deduplicate bugs (search open issues first; skip if duplicate exists).
  - File `bug` issues. Label: `needs-human-review` if `task_breakdown.human_required: true`, else `ai-approved`.
  - Add bug issue numbers to Epic `## Child Issues`.
  - Update verify task `## Blocked By` to list all filed bug issue numbers.
  - Label verify task `blocked`. Unassign. (Unblock sweep re-queues verify when all bugs close.)
- **PASS**: 
  - Open PR: Epic -> Main. Title `[Epic #n] ready`. Body must include `Closes #<epic-number>` and `Closes #<verify-task-number>` on their own lines.
  - Task label -> `review-ready`.

## Phase 3: Execute Merge
**Human Mode**: Stop. Wait for human merge.
**Autonomous**: 
- `mcp__github__merge_pull_request`: **MERGE COMMIT** (No squash. Preserve task history).
- Verify Epic auto-closed. Remove `review-ready` label from verify task.

## Rules
- **Testing**: Run tests to verify branch.
- **Audit Trail**: Epic -> Main uses regular merge. DO NOT SQUASH.
