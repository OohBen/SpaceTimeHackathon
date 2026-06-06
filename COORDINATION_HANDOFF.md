# Coordination Handoff

Snapshot date: 2026-06-06.

This file is the fast path for agents and reviewers who need current branch, claim, and audit rules without rediscovering the project structure.

## Source Files

| Need | Source |
|---|---|
| Epic/project map, branch targets, child task lists | `EPIC_TRACKING.md` |
| Queue drift and claimability audit | `scripts/audit-tracking.ps1` |
| Oversight gates | `hackathon.config.yml` |
| Product scope | `PLAN.md`, `SPECS.md` |

## Current Tracking Epic State

| Issue | State | Handoff meaning |
|---:|---|---|
| #40 | Closed | Epic inventory and dependency map created. |
| #41 | Closed | Branch targets, task linkage, and workflow checkpoints documented. |
| #42 | Closed | Maintenance runbook and audit script added. |
| #43 | Closed | Handoff note package merged into the coordination epic branch. |
| #39 | Closed via PR #197 | Final tracking-epic verification completed with the epic PR. |

After PR #197 merged, #33 and #39 were closed. Confirm no stale workflow labels or assignees remain, then run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/audit-tracking.ps1
```

## Safe Claim Path

1. Fetch GitHub state, not local assumptions.
2. Run `scripts/audit-tracking.ps1`; it paginates beyond 100 issues.
3. Fix `stateLabelViolations` first. An issue with zero or multiple workflow-state labels is invalid; every open issue must have exactly one.
4. Fix `dependencyLinkGaps` next. If `A ## Blocks B`, then `B ## Blocked By` must include `A`.
5. Fix `closedIssueHygiene`; closed tasks should not keep workflow labels, `blocked`, or assignees.
6. Apply `labelRepairs` only when they match issue dependencies.
7. Claim only entries in `claimableTasks`, and re-fetch the issue immediately before mutation.
8. Push the task branch immediately after claim.

Do not trust label-only queues. Project containers still carry `ai-approved`, and task PRs merged into epic branches do not reliably close issues.

## Review And Closeout Path

Task PRs target their parent epic branch and use squash merge. After merge:

Review safety before merge:

1. Fetch the task issue and PR.
2. Review only open, non-verify tasks labeled `review-ready`.
3. Replace `review-ready` with `in-review` before reading deeply, so another agent does not review the same PR.
4. Check the PR target branch is the parent epic branch, not `main`.
5. Check mergeability/conflicts, changed files, acceptance criteria, validation output, and security-sensitive diff scope.
6. Leave a PASS or requested-changes review comment. If changes are needed, keep the issue out of `review-ready` until fixes land.
7. Merge only after PASS and clean mergeability.

Closeout after merge:

1. Fetch the task issue.
2. If still open, close it with `state_reason=completed`.
3. Clear `in-progress`, `review-ready`, and `in-review`; remove assignees.
4. Re-run `scripts/audit-tracking.ps1`.
5. Repair downstream `blocked` labels and dependency metadata before claiming again.

Epic PRs target `main`, require human review, and must use a regular merge commit.

## Known Audit Follow-Ups

The audit script can report `dependencyLinkGaps` where future tasks say they block another issue but the target issue does not list the source in `## Blocked By`. These are metadata gaps. Fixing them prevents premature pickup and is safe when it does not change implementation scope.

Example already handled during this tracking epic: #76 was blocked semantically by #75, but #76 originally missed `#75` in `## Blocked By`. The issue body and `blocked` label were repaired before later closeout cleanup.

## Reviewer Health Check

Reviewers can audit tracking health without rediscovery:

```powershell
$report = powershell -ExecutionPolicy Bypass -File scripts/audit-tracking.ps1 | ConvertFrom-Json
$report.scannedOpenIssues
$report.claimableTasks
$report.labelRepairs
$report.dependencyLinkGaps
$report.stateLabelViolations
$report.closedIssueHygiene
```

Expected healthy state after PR #197 closed #33 and #39: no stale workflow labels on closed tasks, no false-claimable blocked tasks, and no remaining coordination-epic closeout work.
