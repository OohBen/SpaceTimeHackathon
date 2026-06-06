# OpenRouter Reliability Verification

Issue #49. Verification slice for epic #19, `P3E2 - OpenRouter Client
Reliability Layer`.

## Command Result

Command run from repo root on 2026-06-06:

```sh
npm test
```

Result: PASS.

Observed workspace coverage:

| Workspace | Result |
|---|---:|
| `server` | 21 test files, 163 tests passed |
| `client` | 2 test files, 6 tests passed |
| `orchestrator` | 5 test files, 62 tests passed |

## Acceptance Coverage

| Acceptance area | Evidence |
|---|---|
| Root success script covers P3 client reliability paths | `npm test` runs all workspaces and includes the orchestrator reliability suite. |
| Env config reads `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and related config | `openrouter_client.test.ts` covers live OpenRouter config with model and Spacetime defaults, keeps mock/fixture modes separate from live provider secrets, fails invalid live config clearly, and rejects unsupported provider modes. `llm_reliability.test.ts` also covers `OPENROUTER_TIMEOUT_MS` bounds and accepted env values. |
| Timeout behavior | `llm_reliability.test.ts` covers bounded timeout defaults, rejects out-of-band timeout config, aborts fetch, and surfaces `OpenRouterTimeoutError` when the timeout elapses. |
| Retry behavior | `llm_reliability.test.ts` covers deterministic exponential retry backoff, default retry bounds, transient retry attempts, terminal stop conditions, exhausted retry failures, and end-to-end recovery through the wrapped client. |
| JSON validation | `proposal_advisory.test.ts` covers valid JSON payloads, safe repair of bounded malformed output, malformed input rejection, deterministic validation results, and `json_object` response format enforcement. |
| Fallback/error classification | `llm_reliability.test.ts` covers stable categories for timeout, network, rate limit, server, unauthorized, forbidden, bad request, not found, and unknown errors. `proposal_advisory.test.ts` routes schema-breaking output and transport failure to fallback so invalid live output does not reach consumers. |
| Secret safety | `logging.test.ts` covers `redactSecret`, payload-shape summaries, prompt-safe request summaries, OpenRouter telemetry without raw API keys, network-failure logging without raw API keys, timeout logging without raw prompts, and retry/gave-up events without leaking secrets. |

## Notes

- No `.env` file or live OpenRouter credential was used for this verification.
  Live OpenRouter access is not required here because tests use mocked
  clients/fetch calls and deterministic error objects.
- Secret-safety checks assert that raw `OPENROUTER_API_KEY` values and prompt
  content stay out of telemetry and surfaced error messages.
- Fallback behavior is intentionally deterministic; provider failure or invalid
  JSON validation failure cannot make authoritative simulation state depend on
  live model output.
