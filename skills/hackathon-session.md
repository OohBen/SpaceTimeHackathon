---
description: Phase 4 Implementation. Claims ai-approved tasks, syncs, validates, implements, opens PR. Zero human escalation.
allowed-tools: mcp__github__*, Read, Write, Edit, Bash, Skill
---

# Skill: hackathon-session

**MANDATES:**
- **Caveman**: Drop filler words (I will, I can, sure). Use fragments. Keep substance. Keep code/paths. Technical accuracy 100%. Word count 25%. Mouth small, brain big.
- **Context**: Never read what you can compute. Do not read large files to find patterns. Write scripts to extract exact answers. If output > 5KB, write a sandbox script.

Phase 4: Implement Tasks -> PRs.

## Phase 0: Read Config
- Load `hackathon.config.yml`.
- Gates: `task_completion`, `code_review`.
- Quality: `testing`, `validation`.

## Phase 1: Orient
- `git fetch origin`.
- `git checkout main; git merge --ff-only origin/main`. Fails? -> Stop. Local main diverged.
- Unblock: Check `blocked` issues -> Remove label if all `blocked-by` issue numbers are closed.

## Phase 2: Task Loop
1. **Claim**: Use the `Read` tool on `skills/modules/skill-claim.md`. Follow its steps to claim `ai-approved` task.
2. **Branch**: `git checkout -b task/[id]-[slug]`.
3. **Sync**: Use the `Read` tool on `skills/modules/skill-sync.md`. Follow its steps to sync with epic branch.
4. **Validate Baseline**: If `testing: skip` -> skip this step. Otherwise: Use the `Read` tool on `skills/modules/skill-validate.md`. Follow its steps to write script -> Confirm FAIL.
5. **Implement**:
   - Check signals -> Read and follow domain skills (e.g., use `Read` on `skills/hackathon-auth.md`).
   - Implement -> Run tests -> Debug on regression.
6. **Validate Success**: If `testing: skip` -> skip this step. Otherwise: Run success script -> Must PASS.
7. **Task Completion Gate**: If `task_completion.human_required: true` -> Present summary (what built, files changed, test results). Wait for "looks good". Loop on changes until approved.
8. **PR**:
   - `git push -u origin [branch]`.
   - `mcp__github__create_pull_request`: Base = epic branch. Body must include `Closes #<issue-number>` on its own line.
   - Label: `review-ready`.
   - Comment: What built + test results.

## Phase 3: Review Sweep
After task loop exhausted:
1. List all `review-ready` issues via MCP. Skip any that are **closed**. Skip any whose title matches `[#<n>] Verify epic` — those are gated by `epic_review`, not `code_review`.
2. For each remaining (open, non-verify): Use the `Read` tool on `skills/hackathon-review.md`. Follow review steps.
3. If REQUEST CHANGES returned for any issue: Check out its existing branch (from the open PR). Read PR review comments. Apply requested fixes. Push to existing branch (no new PR). Re-run review for that issue. Repeat until APPROVE.
4. If any new `ai-approved` tasks appeared (discovered scope from review) -> Return to Phase 2.

## Phase 4: Stale Reclaim
Check `in-progress` issues with no progress comment in >30 min and no assignee activity:
- Branch pushed? -> Check out + continue from where left off. Use skill-claim normally before resuming.
- No branch? -> Verify still stale (no recent assignee change or comments). If clear: use skill-claim to re-claim (resets label + assigns self with collision check). Comment `agent: reclaiming - no branch, restarting`.

## Phase 5: Done
- No `ai-approved`, no `review-ready`, no stale reclaims remaining.
- Report: Open PRs, blocked count. Stop.

## Rules
- **No Direct Commits**: Always branch.
- **Validation Blocking**: No PASS = No PR.
- **Collision**: Refresh status before claim.
