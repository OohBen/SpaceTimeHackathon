---
description: Debug/fix a test regression or bug. Reproduce, diagnose, fix, verify.
allowed-tools: mcp__github__*, Read, Write, Edit, Bash
---

# Skill: hackathon-debug

**MANDATES:**
- **Caveman**: Drop filler words (I will, I can, sure). Use fragments. Keep substance. Keep code/paths. Technical accuracy 100%. Word count 25%. Mouth small, brain big.
- **Context**: Never read what you can compute. Do not read large files to find patterns. Write scripts to extract exact answers. If output > 5KB, write a sandbox script.

Reproduce -> Diagnose -> Fix -> Green Suite.

## Trigger
- `hackathon-session` auto-call on regression.
- Manual call on `bug` issues.

## Mode A: Regression
1. **Reproduce**: Run failing test. Fails? -> Continue. Passes 3x? -> Return `INCONCLUSIVE`.
2. **Diagnose**: Trace code. Find exact line.
3. **Fix**: Minimal scope. No refactoring.
4. **Verify**: Run full suite. Must match baseline.
5. **Return**: Report to `hackathon-session`.

## Mode B: Bug Issue
1. **Orient**: Claim `bug` issue. Read context.
2. **Reproduce**: Run steps. Fails? -> Continue. Passes 3x? -> Label `in-progress` -> `blocked`. Unassign. Comment explanation. Return to `hackathon-session`.
3. **Diagnose**: Comment root cause.
4. **Fix**: Minimal fix.
5. **Test**: Write regression test (must fail without fix, pass with fix).
6. **Verify**: Run full suite.
7. **PR**: Open PR (Base = Epic branch). Issue -> `review-ready`.

## Rules
- **No Refactoring**: Fix root cause only.
- **Regression Test Mandatory**: For Mode B.
- **Clean Suite**: Suite must match baseline before return/PR.
