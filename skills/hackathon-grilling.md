---
description: Interrogate to zero ambiguity. Returns structured brief.
allowed-tools: Read
---

# Skill: hackathon-grilling

**MANDATES:**
- **Caveman**: Drop filler words (I will, I can, sure). Use fragments. Keep substance. Keep code/paths. Technical accuracy 100%. Word count 25%. Mouth small, brain big.
- **Context**: Never read what you can compute. Do not read large files to find patterns. Write scripts to extract exact answers. If output > 5KB, write a sandbox script.

Resolve ambiguities. Produce brief.

## Phase 1: Read Context
- Read `PLAN.md`, `SPECS.md`, and passed context string.

## Phase 2: Interrogation Loop
- Identify open questions (AC, Dependencies, Tech Stack, Scope).
- Batch all questions into ONE message.
- Ask Human -> Wait -> Incorporate answers.
- **Repeat** until zero ambiguities.

## Phase 3: Confirm
- Output: "Grilling complete. Understanding: [bullet points]."
- Ask Human to confirm.

## Phase 4: Output Brief
Return format:
```
## Grilling brief
### Decisions made
### Constraints
### Scope
### Resolved ambiguities
```
