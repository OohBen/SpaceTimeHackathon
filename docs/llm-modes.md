# LLM Mode Selection: `live`, `mock`, `fixture`

The orchestrator selects an LLM execution mode at startup from the `LLM_MODE`
environment variable. Mode selection is the contract that lets local
development, CI, and demo runs avoid live tokens or external network calls.

## Quick reference

| Mode      | Network? | Secrets? | Determinism | When to use                                                  |
| --------- | -------- | -------- | ----------- | ------------------------------------------------------------ |
| `live`    | Yes      | Required | Per-model   | Hosted runs against OpenRouter (`inception/mercury-2`).      |
| `mock`    | No       | No       | Byte-stable | Default for unit tests, CI, and local hacking.               |
| `fixture` | No       | No       | Byte-stable | Curated scripted runs for demos, screenshots, judge scripts. |

Invalid values throw `OpenRouterConfigError` (`llm_mode_invalid`). A missing
`LLM_MODE` defaults to `mock` so anyone cloning the repo can run tests
immediately.

## Environment variables

| Variable             | Required in mode    | Purpose                                                  |
| -------------------- | ------------------- | -------------------------------------------------------- |
| `LLM_MODE`           | all                 | Mode selector. Must be `live`, `mock`, or `fixture`.     |
| `VITE_LLM_MODE`      | client (any mode)   | Mirrors `LLM_MODE` for client-side gating.               |
| `OPENROUTER_API_KEY` | `live`              | Bearer token for OpenRouter. Never logged.               |
| `OPENROUTER_MODEL`   | `live` (optional)   | Defaults to `inception/mercury-2`.                       |
| `OPENROUTER_BASE_URL`| `live` (optional)   | Override for non-prod OpenRouter endpoints.              |
| `LLM_FIXTURE_PATH`   | `fixture` (optional)| Override the bundled scenarios catalog path.             |
| `SPACETIME_HOST`     | all                 | Module HTTP endpoint. Defaults to `http://localhost:3000`.|
| `SPACETIME_DB_NAME`  | all                 | Defaults to `solar-dominion`.                            |

The contract function lives at
`orchestrator/src/openrouter_client.ts → readLlmProviderConfig`. The typed
provider factory lives at
`orchestrator/src/llm_mode_provider.ts → selectLlmModeProvider`.

## Mock mode

`createMockLlmModeProvider` (`orchestrator/src/mock_llm_provider.ts`) returns a
provider whose `completeRequest` is a pure function of the request payload. It
covers every request type (`proposals`, `inbox`, `event_narrative`,
`resume_briefing`), returns a JSON string whose shape matches the live advisory
contract, and never reads `process.env` or calls `fetch`.

Use `mock` when:

- You want unit tests, integration tests, or local module work to be hermetic.
- You don't care about narrative detail, just that the shape and determinism
  hold.
- A fresh clone of the repo should "just work" without secret setup.

Determinism guarantees:

- Identical request payloads (with object-key order normalized via
  `stableJson`) produce byte-identical `response_json`.
- `undefined` values inside context objects are normalized to `null` so
  sparse and dense contexts hash distinctly.
- Array order **is** semantic — `[a, b]` and `[b, a]` hash differently.
  If your caller produces unordered collections, sort them before passing.
- Changing the `turn` or `faction_id` changes the response.
- No randomness, no clocks, no environment reads.

## Fixture mode

`createFixtureLlmModeProvider` (`orchestrator/src/fixture_llm_provider.ts`)
serves curated responses from a JSON catalog. Scenarios are keyed by
`(request_type, scenario_id)`. Each request looks up its explicit
`scenario_id`; if missing or unknown, the provider falls back to the
`default` scenario for the same `request_type`. Missing both is a typed error
(`fixture_scenario_not_found`).

The bundled catalog lives at `orchestrator/fixtures/scenarios.json` and is
loaded by `loadFixtureCatalog(defaultFixturePath())`. Override with
`LLM_FIXTURE_PATH` when running a custom demo script. `LLM_FIXTURE_PATH` is
treated as operator-controlled — the orchestrator process reads whatever path
is set, so do not surface it to untrusted callers.

Use `fixture` when:

- Running the judge demo and the narrative needs to read the same way every
  time.
- Recording screenshots or video where outputs must be reproducible.
- Authoring acceptance criteria that depend on specific narrative beats.

### Adding a scenario

1. Open `orchestrator/fixtures/scenarios.json`.
2. Append an entry under `scenarios`:

   ```json
   {
     "request_type": "proposals",
     "scenario_id": "my-new-scenario",
     "response": {
       "schema_version": 1,
       "proposals": [
         {
           "title": "...",
           "body": "...",
           "department": "Executive",
           "confidence": "HIGH",
           "resource_cost": 80
         }
       ]
     }
   }
   ```

3. Reference the scenario by passing `scenario_id: "my-new-scenario"` on the
   incoming `LlmModeRequest`, or set it as the `default` for that request type
   if you want it to win lookups without explicit selection.
4. Run `cd orchestrator && npm test` — the parser tests assert schema and
   request-type validity at load time so a malformed scenario fails CI.

Fixture format rules (enforced by `parseFixtureCatalog`):

- Top-level `schema_version` must be `1`.
- `scenarios` is a non-null array; each entry must declare `request_type`,
  `scenario_id`, and `response`.
- `request_type` must be one of `proposals`, `inbox`, `event_narrative`,
  `resume_briefing`.
- `scenario_id` must be a non-empty string. Use `default` for the per-type
  fallback.

## Mock vs fixture: how to choose

| Question                                          | Answer            |
| ------------------------------------------------- | ----------------- |
| Do I need the same words to come out each run?    | `fixture`         |
| Am I writing a unit test that asserts shape only? | `mock`            |
| Am I in CI?                                       | `mock` (default)  |
| Am I demoing to a judge?                          | `fixture`         |
| Am I exploring a flow and don't care about words? | `mock`            |
| Am I shipping to a hosted run?                    | `live`            |

When in doubt, start with `mock`. If your test or demo starts asserting on
exact narrative content, promote it to `fixture` and curate a scenario.

## CI

`.github/workflows/orchestrator-tests.yml` runs the orchestrator and server
suites with `LLM_MODE=mock` and `OPENROUTER_API_KEY=""`. The job intentionally
sets the API key to empty to prove the test path does not depend on it.

If you add a new test that needs a curated response, drive it through the
fixture provider — never paste a live key into CI.

## Failure modes (clear and predictable)

| Failure                              | Code                        | Surface                          |
| ------------------------------------ | --------------------------- | -------------------------------- |
| `LLM_MODE` set to an unknown value   | `llm_mode_invalid`          | `OpenRouterConfigError` at boot. |
| `LLM_MODE=live` without API key      | `openrouter_api_key_missing`| `OpenRouterConfigError` at boot. |
| Unknown `request_type` in a request  | `request_type_invalid`      | `LlmModeRequestError` at call.   |
| Fixture file unreadable              | `fixture_file_unreadable`   | `FixtureLookupError` at load.    |
| Fixture file invalid JSON            | `fixture_file_invalid_json` | `FixtureLookupError` at load.    |
| Fixture catalog schema mismatch      | `fixture_file_schema_mismatch` | `FixtureLookupError` at load. |
| Fixture catalog has no scenarios     | `fixture_file_empty_scenarios` | `FixtureLookupError` at load. |
| Fixture scenario response is null    | `fixture_scenario_missing_response` | `FixtureLookupError` at load. |
| Scenario not found, no default       | `fixture_scenario_not_found`| `FixtureLookupError` at call.    |

All errors carry a `code` field so callers can branch on the failure category
without parsing message strings.
