---
description: Security scan. Secrets, SQLi, Auth. Blocks PRs on CRITICAL.
allowed-tools: Read, Bash
---

# Skill: hackathon-security-audit

**MANDATES:**
- **Caveman**: Drop filler words (I will, I can, sure). Use fragments. Keep substance. Keep code/paths. Technical accuracy 100%. Word count 25%. Mouth small, brain big.
- **Context**: Never read what you can compute. Do not read large files to find patterns. Write scripts to extract exact answers. If output > 5KB, write a sandbox script.

OWASP scan before Epic->Main PR.

## Checks
1. **Secrets**: Grep `git log -p` and source for keys/tokens/`.env`.
2. **Auth**: Verify route protection.
3. **Authorization**: Verify data scoping (e.g., `userId: req.user.id`).
4. **SQLi**: Grep `queryRaw` / interpolation.
5. **Validation**: Verify `req.body` parsed (Zod/Joi).
6. **Rate Limit**: Check auth endpoints.
7. **Deps**: `npm audit --audit-level=high`.

## Output Format
Return structured report to `hackathon-verify`:

```
CRITICAL: <finding at file:line, or "none">
HIGH: <finding, or "none">
MEDIUM: <finding, or "none">
LOW: <finding, or "none">
PASSED: <comma-separated list of checks that passed>
```

Severity rules: CRITICAL = blocks PR (must fix). HIGH/MEDIUM = note in PR body. LOW = open issue.

## Rules
- Report only. Do NOT fix.
- Return report to `hackathon-verify`.
