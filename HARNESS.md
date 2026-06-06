# Adapting This Repo for Non-Claude Code Harnesses

This repo is designed for **Claude Code** (interactive mode with slash commands).
If your team uses a different agent harness (Aider, Cursor, Codex, Gemini CLI,
custom LLM runner, etc.), this document explains how to wire it up.

The coordination protocol (GitHub Issues as shared brain, label state machine,
branch-per-epic/task, PR-only close-out) is harness-agnostic. Only the invocation
and context loading differ.

---

## What stays the same (do not modify)

| File | Why |
|---|---|
| `AGENTS.md` | The coordination protocol - all harnesses follow this |
| `PLAN.md` | Project plan - filled in by the team, read by all agents |
| `SPECS.md` | Implementation detail - read by all agents |
| `skills/*.md` | Skill definitions - your harness loads these as prompts |
| `.gitignore` | Shared - add your harness directory to it |

---

## What you replace (harness-specific)

| Claude Code file | What it does | You create |
|---|---|---|
| `CLAUDE.md` | Context auto-loaded by `claude` | Your harness's equivalent context file |
| `.claude/settings.json` | Permission pre-approvals | Your harness's permission config |
| `.claude/commands/` | Slash commands | Your harness's equivalent (if any) |

Use distinct names (e.g., `GEMINI.md`, `CODEX.md`) so harnesses coexist without conflicts.

---

## Step 1 - Add your harness's local files to `.gitignore`

```
# My harness
.your-harness-config-dir/
YOURHARNESS.md          # generated context file
```

Commit the `.gitignore` change so teammates don't accidentally commit your files.

---

## Step 2 - Build your context file

Concatenate the following into a single file your harness reads as a system prompt:

```
AGENTS.md
skills/hackathon-setup.md
skills/hackathon-plan.md
skills/hackathon-epics.md
skills/hackathon-decompose.md
skills/hackathon-session.md
skills/hackathon-add.md
skills/hackathon-projects.md
skills/hackathon-review.md
skills/hackathon-debug.md
skills/hackathon-test.md
skills/hackathon-verify.md
skills/hackathon-grilling.md
skills/hackathon-frontend.md
skills/hackathon-auth.md
skills/hackathon-database-schema.md
skills/hackathon-deploy.md
skills/hackathon-seed-demo-data.md
skills/hackathon-security-audit.md
skills/hackathon-docs-demo-script.md
```

**Header to prepend:**

```
# Agent Coordination Context

You are a software agent working on a hackathon project with human review at every
major step. GitHub is the coordination layer - all state lives in GitHub Issues
and GitHub Projects. You have no memory between sessions.

Four-phase workflow:
- hackathon-setup:      run once; configure oversight, scaffold PLAN.md
- hackathon-plan:       Phase 1 - PLAN.md -> GitHub Projects + generate SPECS.md
- hackathon-epics:      Phase 2 - Projects -> Epic issues on GitHub
- hackathon-decompose:  Phase 3 - Epics -> Task issues + epic branches
- hackathon-session:    Phase 4 - Tasks -> code + PRs (loops until queue empty)
- hackathon-add:        add features/hardening/refactoring to a running project
- hackathon-projects:   check completion; close GitHub Project when all epics merge
- hackathon-review:     human-triggered; review one PR, post findings, human decides merge/changes
- hackathon-debug/test/verify: called automatically by hackathon-session

Branch discipline:
  Epic branches: epic/<n>-<slug> (created by hackathon-decompose from main)
  Task branches: task/<n>-<slug> (created by hackathon-session from the epic branch)
  Task PRs target the epic branch. The verify task opens the epic->main PR.
  Never commit to main or an epic branch directly.

Labels:
  needs-human-review -> ai-approved -> in-progress -> in-review -> (merged)

Read AGENTS.md in full before acting.
```

Save as `GEMINI.md`, `CODEX.md`, etc. Add to `.gitignore`.

---

## Step 3 - Configure GitHub access

The skills assume the **GitHub MCP** (`mcp__github__*`) for all GitHub operations.
If your harness does not support MCP:

1. Replace every `mcp__github__*` instruction with equivalent `gh` CLI commands
2. Ensure `gh` is authenticated: `gh auth login`

| MCP operation | gh CLI equivalent |
|---|---|
| Search issues | `gh issue list --label <label> --json number,title,assignees,labels` |
| Read issue | `gh issue view <number> --json body,comments,labels,assignees` |
| Create issue | `gh issue create --title "..." --body "..." --label "..."` |
| Update labels | `gh issue edit <number> --add-label "..." --remove-label "..."` |
| Add assignee | `gh issue edit <number> --add-assignee "@me"` |
| Remove assignee | `gh issue edit <number> --remove-assignee "@me"` |
| Add comment | `gh issue comment <number> --body "..."` |
| Create PR | `gh pr create --title "..." --body "..." --base <branch>` |
| List PRs | `gh pr list --label in-review --json number,title,headRefName` |
| Get PR files | `gh pr diff <number>` |
| Check mergeable | `gh pr view <number> --json mergeable` |
| Merge PR | `gh pr merge <number> --squash --delete-branch` |
| PR review | `gh pr review <number> --approve` or `--request-changes -b "..."` |

**Make all calls sequentially, never in parallel.** This rule holds regardless of harness.

---

## Step 4 - Invocation model

This system is **human-paced**, not autonomous loop-based. The agent does not need
a runner script - a human invokes each skill when appropriate:

1. Human runs `hackathon-setup` once to configure oversight and scaffold `PLAN.md`
2. Human runs `hackathon-plan` - scopes `PLAN.md` into GitHub Projects and generates `SPECS.md`
3. Human approves projects, then invokes `hackathon-epics`
4. Human approves epics, then invokes `hackathon-decompose`
5. Human approves tasks, then invokes `hackathon-session`
6. `hackathon-session` loops internally until no `ai-approved` tasks remain
7. Human invokes `hackathon-review` for each PR when ready
8. Human merges or requests changes; session picks up fixes automatically on next run
9. Human runs `hackathon-projects` to track cross-project completion

**For other harnesses:** invoke `hackathon-session` (or equivalent) when you want
the agent to work through the current `ai-approved` task queue.

---

## Step 5 - Update `.gitignore`

Add your harness's config directory and generated context file:

```
.your-harness/
YOURHARNESS.md
```

---

## Coexistence rules

If multiple harnesses are active on the same repo:

- Each harness reads the same `AGENTS.md` and `skills/*.md`
- Each harness has its own context file (different names, all gitignored)
- All agents obey the same collision-check protocol
- All agents follow the same branch discipline and PR-only close-out
- The label state machine is the single source of truth

---

## What to commit

| Commit | Do not commit |
|---|---|
| `.gitignore` (updated with your harness dir) | Your harness's config/cache dirs |
| Changes to shared source (`AGENTS.md`, `skills/`, `PLAN.md`) | `YOURHARNESS.md` context file |
| | Secrets or PATs |
