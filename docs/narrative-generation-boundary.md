# Narrative Generation Boundary

Narrative requests use the shared LLM request boundary for `inbox`, `event_narrative`, and `resume_briefing`. Proposal generation remains advisory candidate generation. All narrative prose is display-only.

Authoritative state stays in SpacetimeDB reducers and simulation payloads. Narrative output must set `authoritative: false`, `display_only: true`, and `metadata.privacy_scope: "own_faction"`. It must not include state patches, decisions, resource deltas, winners, or control score outputs.

The safe attachment channel is namespaced:

- Inbox rows keep authoritative `subject`, `body`, `requires_decision`, and `status`; generated prose goes in `narrative_json`.
- Event payloads keep simulation fields and may include `payload.narrative` plus `narrative_json`.
- Turn summaries keep `summary_json` simulation fields and may include `summary_json.narrative` plus `narrative_json`.

Fallback is required for every narrative type. When live generation is unavailable or invalid, deterministic fallback text must be used for inbox briefing, event/resolution flavor, and resume briefing surfaces. Fallbacks never block core turn flow.

Privacy boundary: generated text may only describe the owning faction's visible or private context. It must not reveal opponent-private data. Consumers can distinguish generated prose by checking the `display_only` and `authoritative` flags before rendering it.
