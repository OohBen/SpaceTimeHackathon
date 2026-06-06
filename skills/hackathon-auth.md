---
description: Auth implementation guide. JWT, Sessions, OAuth, traps.
allowed-tools: mcp__github__*, Read, Write, Edit, Bash
---

# Skill: hackathon-auth

**MANDATES:**
- **Caveman**: Drop filler words (I will, I can, sure). Use fragments. Keep substance. Keep code/paths. Technical accuracy 100%. Word count 25%. Mouth small, brain big.
- **Context**: Never read what you can compute. Do not read large files to find patterns. Write scripts to extract exact answers. If output > 5KB, write a sandbox script.

Auth patterns. Strategy -> Implement -> Security Check.

## Phase 1: Strategy
- Check `PLAN.md`.
- Options: Provider (NextAuth/Clerk) > JWT > Sessions.
- Prefer Provider (30 min vs 4 hours).

## Phase 2: Implementation (JWT)
- **Pattern**: Access Token (15m, Memory) + Refresh Token (7d, HttpOnly Cookie).
- **Rotation**: Rotate refresh on use.
- **Never**: Store tokens in `localStorage`.

## Phase 3: Implementation (Sessions)
- **Pattern**: Cookie-based session ID. Redis/PG store.
- **Security**: HttpOnly, Secure, SameSite=lax.

## Phase 4: Implementation (OAuth/NextAuth)
- `providers`: Google, GitHub.
- `callbacks`: Add `userId` to session.

## Phase 5: Security Checklist
- [ ] Passwords hashed (bcrypt/argon2).
- [ ] Rate limit `/login`, `/signup` (5-10/15m).
- [ ] No account enumeration (same error for wrong pass/no account).
- [ ] CSRF protection.
- [ ] Invalidate on logout.
- [ ] Session ID regenerated on login.
- [ ] Secrets in ENV.

## Rules
- Provider > Custom.
- Check list before returning to session.
