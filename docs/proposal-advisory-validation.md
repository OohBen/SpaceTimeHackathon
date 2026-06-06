# Proposal Advisory Validation, Repair, and Fallback Policy

Status: **v1**. Owner: orchestrator (`orchestrator/src/proposal_advisory.ts`).
Scope: live OpenRouter responses produced for `llm_requests.request_type = 'proposals'`.

This policy keeps the boundary documented in `docs/llm-queue-boundary.md` honest:
**no live LLM output is forwarded to authoritative consumers unless it passes the
schema gate below.** Anything else is repaired safely (within the allow-list) or
routed to the deterministic fallback.

## Schema (`PROPOSAL_ADVISORY_SCHEMA_VERSION = 1`)

The live model is contracted to emit a JSON object with this shape:

```json
{
  "proposals": [
    {
      "title": "string, 1..200 chars",
      "body": "string, 1..2000 chars",
      "department": "string, 1..64 chars",
      "confidence": "HIGH | MEDIUM | LOW",
      "resource_cost": "integer, 0..1000000"
    }
  ]
}
```

- `proposals` must contain between `PROPOSAL_ADVISORY_LIMITS.minProposals` (1) and
  `PROPOSAL_ADVISORY_LIMITS.maxProposals` (8) entries.
- `confidence` is trimmed and upper-cased before comparison against
  `PROPOSAL_ADVISORY_CONFIDENCE_VALUES`. Any other value is rejected with
  `value_out_of_range`.
- Successful validation returns a payload tagged with `schema_version` so downstream
  consumers can refuse mismatched versions safely.

## Repair allow-list (`PROPOSAL_ADVISORY_POLICY.repair_steps`)

Repairs are deterministic, side-effect-free string transforms. Each repair step is
only applied once per request (`max_repair_attempts = 1`). The order is fixed:

1. `strip_code_fence` — remove a single surrounding ` ```json ... ``` ` block.
2. `strip_leading_label` — drop conversational prefix before the first `{`.
3. `strip_trailing_garbage` — truncate everything after the last `}`.
4. `extract_first_json_object` — extract the first balanced `{...}` substring.

Repairs that succeed are reported as `repairsApplied` on the success outcome so they
can be observed in audit rows and tests.

## Reject categories (`PROPOSAL_ADVISORY_POLICY.reject_categories`)

Validation failure produces a stable category, never a free-form string. The
categories are:

| Category | Meaning |
|---|---|
| `empty_input` | Content was empty after trimming. |
| `invalid_json` | Could not parse JSON even after the repair allow-list. |
| `schema_mismatch` | Parsed value was not a JSON object. |
| `missing_field` | A required field was absent. |
| `type_mismatch` | A field had the wrong runtime type. |
| `value_out_of_range` | A field violated a documented bound (length, enum, numeric range). |
| `empty_proposals` | The proposals array was empty. |
| `too_many_proposals` | The proposals array exceeded the documented cap. |

## Fallback policy (`PROPOSAL_ADVISORY_POLICY.fallback_categories`)

Every reject category is also a fallback-eligible category. When the live response
cannot be validated, `createProposalAdvisoryClient` calls the configured fallback
with the original request and the failure metadata. The fallback contract:

- Must return a `ProposalAdvisoryPayload` that itself satisfies the schema above.
- Should be deterministic — the orchestrator uses the same fallback contract as the
  module's `generateFallbackProposals` in `server/src/fallback_proposals.ts`.
- Transport-level failures (timeouts, network errors, retries-exhausted) are routed
  through the same fallback path, classified as `invalid_json` for audit purposes.

## What this guarantees

- Schema-breaking output never reaches authoritative consumers unchecked.
  `createProposalAdvisoryClient` is the only blessed seam between
  `LlmTextClient.completeText` and a proposal-shaped payload.
- Validation is pure and deterministic. The same input string always produces the
  same `ProposalAdvisoryOutcome`. The replay step in `success_check.sh` pins this.
- Repairs are bounded, allow-listed, and observable. There is no "best-effort"
  rewriting of model output.

## Where to extend

- New schema fields go in `ProposalAdvisoryItem` plus the `validateProposalItem`
  branch, and must bump `PROPOSAL_ADVISORY_SCHEMA_VERSION`.
- New repair steps go in `buildRepairCandidates` plus
  `PROPOSAL_ADVISORY_POLICY.repair_steps`, and require a positive test that the
  repair is safely deterministic.
- New failure categories go in `ProposalAdvisoryFailureCategory` plus both
  `reject_categories` and `fallback_categories`. The orchestrator must never silently
  drop a malformed live response.
