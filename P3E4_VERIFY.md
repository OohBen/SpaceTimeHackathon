# P3E4 Verification Notes

Issue: #59 - Verify Narrative Request Types, Fallbacks, and Safe Attachment Flow

## Commands

- `.\success_check.ps1`
  - Temporary issue 59 behavior test: 2 passed.
  - Root project success script: `npm test`.
  - Server: 24 files passed, 214 tests passed.
  - Client: 15 files passed, 122 tests passed.
  - Orchestrator: 13 files passed, 112 tests passed.

## Modes

- `LLM_MODE=<unset>`; orchestrator mode defaults to mock for local tests.
- `VITE_LLM_MODE=<unset>`; client tests did not require live LLM mode.
- No live OpenRouter call or API key was required.

## Sample Scenarios

- Inbox fallback: `request_type=inbox`, `surface=inbox`, faction 2, session 7, turn 4.
- Briefing fallback: `request_type=inbox`, `surface=briefing`, faction 2, session 7, turn 4.
- Resume fallback: `request_type=resume_briefing`, `surface=resume`, faction 2, session 7, turn 4.
- Resolution fallback: `request_type=event_narrative`, `surface=resolution`, faction 2, session 7, turn 4.

## Closeout Findings

- Narrative fallback payloads validate as `authoritative=false`, `display_only=true`, `privacy_scope=own_faction`.
- Prompt and fallback builders now keep generated prose on surfaces allowed by each request contract. Incompatible context surfaces fall back to the contract default.
- Existing attachment tests verify generated prose is stored on non-authoritative surfaces:
  - Inbox rows keep `body`, `requires_decision`, and `status`; prose goes to `narrative_json`.
  - Turn summaries keep `control_score` and `simulation_outputs`; prose is namespaced under `summary_json.narrative`.
  - Event payloads keep simulation fields; prose is namespaced under `payload.narrative`.
