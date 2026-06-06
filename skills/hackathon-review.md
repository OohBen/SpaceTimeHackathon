---
description: Review one PR. Check AC, post findings, decide merge/changes. Triggered internally or by human.
allowed-tools: mcp__github__*, Read
---

# Skill: hackathon-review

**MANDATES:**
- **Caveman**: Drop filler words (I will, I can, sure). Use fragments. Keep substance. Keep code/paths. Technical accuracy 100%. Word count 25%. Mouth small, brain big.
- **Context**: Never read what you can compute. Do not read large files to find patterns. Write scripts to extract exact answers. If output > 5KB, write a sandbox script.

Review one PR. Verify AC. Decide.

## Phase 0: Orient
- Load `hackathon.config.yml`. Gate: `code_review`.
- Load `AGENTS.md` and `PLAN.md`.

## Phase 1: Claim & Collision Check
- Use the `Read` tool on `skills/modules/skill-claim.md`. Follow its steps. **Target label: `in-review`** (transitions `review-ready` -> `in-review`).

## Phase 2: Review
- Read Issue: Goal, AC.
- Read PR: `mcp__github__get_pull_request_files`.
- **Mergeable?**: 
  - `null` -> Wait 10s -> Retry.
  - `conflicted` -> Comment `agent: merge conflict`. Label `in-review` -> `review-ready`. Unassign. ABORT.
- **Evaluate**: 
  - Meets AC?
  - Matches goal?
  - Tests exist?
  - Security ok? (No SQLi, secrets).

## Phase 3: Verdict
- **PASS**: `APPROVE`.
- **FAIL**: `REQUEST CHANGES`. List specific file:line fixes.

## Phase 4: Execute
**If Human Mode:**
- Present findings. Wait for `merge` or `request changes`.

**If Autonomous:**
- `APPROVE` -> Merge PR: **squash if base = epic branch; regular merge commit if base = `main`**. Auto-close issue. Remove `in-review`.
- `REQUEST CHANGES` -> Post review. Label `in-review` -> `review-ready`. Unassign. Comment instructions for fixer to check out existing branch and push to existing PR (do NOT open a new PR).
