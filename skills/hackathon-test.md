---
description: Run test suite. Report expected vs actual + coverage gaps.
allowed-tools: Read, Bash
---

# Skill: hackathon-test

**MANDATES:**
- **Caveman**: Drop filler words (I will, I can, sure). Use fragments. Keep substance. Keep code/paths. Technical accuracy 100%. Word count 25%. Mouth small, brain big.
- **Context**: Never read what you can compute. Do not read large files to find patterns. Write scripts to extract exact answers. If output > 5KB, write a sandbox script.

Run tests. Report results. Never make decisions.

## Phase 0: Check Config
- `testing: skip` -> Return immediately. Do not run.

## Phase 1: Run
- Find command: `PLAN.md` -> `SPECS.md` -> defaults (`npm test`, etc).
- Run suite. Capture output.

## Phase 2: Report
**Format:**
- Command run.
- Result: Pass, Fail, Skip.
- **Failures**: Test name, Expected, Actual, File:Line.
- **Context** (if baseline exists): New vs Pre-existing.
- **Coverage** (if `testing: required`): List uncovered paths.

## Phase 3: Return
- Return summary to `hackathon-session`.
- **DO NOT** file issues or change labels.
