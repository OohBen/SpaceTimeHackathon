---
description: Database schema guide. Normalization, PKs, indexes, FKs.
allowed-tools: mcp__github__*, Read, Write, Edit, Bash
---

# Skill: hackathon-database-schema

**MANDATES:**
- **Caveman**: Drop filler words (I will, I can, sure). Use fragments. Keep substance. Keep code/paths. Technical accuracy 100%. Word count 25%. Mouth small, brain big.
- **Context**: Never read what you can compute. Do not read large files to find patterns. Write scripts to extract exact answers. If output > 5KB, write a sandbox script.

Schema design. Enforce rules before migration.

## Phase 1: Strategy
- Check `PLAN.md`.
- Identify: Database, ORM, Entities, Access Patterns.

## Phase 2: Design Rules
- **PK**: `UUID` (public) or `BIGSERIAL` (internal). Never expose sequential ints.
- **Timestamps**: Always `created_at`, `updated_at` (UTC).
- **Soft Deletes**: `deleted_at` timestamp. Use partial index `WHERE deleted_at IS NULL`.

## Phase 3: FK & Indexing
- **FKs**: Cascade for owned children. Set null for optional.
- **Indexes**: 
  - ALWAYS index FK columns.
  - ALWAYS index frequent WHERE columns.
  - ALWAYS index UNIQUE constraints.

## Anti-Patterns
- `is_deleted BOOLEAN` -> Use `deleted_at` timestamp.
- FK without index -> Slow joins.
- JSON arrays instead of junction table -> Can't join.

## Rules
- Design first. Review -> Then write migration.
