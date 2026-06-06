# LLM Queue Boundary and Deterministic Fallback

Developer guide for inspecting and exercising the no-live orchestration path.

## What the boundary guarantees

The Solar Dominion module never depends on a live LLM for simulation outcomes.

- Authoritative game state (`game_sessions`, `factions`, `proposals`, `turn_summaries`) is
  produced by deterministic reducers only.
- Live model output, when present, is treated as advisory text attached to a row that
  reducers have already written. See `LLM_QUEUE_AUTHORITATIVE_CONTRACT` in
  `server/src/llm_queue_contract.ts` — `live_model_required: false`.
- The deliberation flow has two modes — both are deterministic from the module's point
  of view:
  - `queue` (default): `run_deliberation` writes one row into `llm_requests` with status
    `queued`. An external worker may pick it up later. If no worker ever runs, the turn
    still advances; the queued row simply stays `queued`.
  - `fallback`: `run_deliberation` calls `generateFallbackProposals` against
    authoritative state and inserts the resulting proposals plus a completed audit row
    into `llm_requests`. No worker involvement is needed.

Mode is stored in the `module_settings` singleton row (`id = 1`). It is flipped from a
client using the `set_deliberation_mode` reducer — never from environment variables and
never from a secret.

## Required env modes and placeholders for local work

The module itself does not read environment variables for the deliberation boundary.
Env values only matter for the optional external orchestrator service.

| Variable | Where it applies | Purpose | Local placeholder |
|---|---|---|---|
| `LLM_MODE` | orchestrator only | `live`, `mock`, or `fixture` worker behavior | `mock` |
| `VITE_LLM_MODE` | client only | Mirrors `LLM_MODE` for client-side gating | `mock` |
| `OPENROUTER_API_KEY` | orchestrator, `LLM_MODE=live` | Live model credential | leave empty for `mock`/`fixture` |
| `OPENROUTER_MODEL` | orchestrator, `LLM_MODE=live` | Live model name | unset for local work |
| `SPACETIME_HOST` | orchestrator | Module HTTP endpoint | `http://localhost:3000` |
| `SPACETIME_DB_NAME` | orchestrator | Published module name | `solar-dominion` |

For pure-module work (no client, no orchestrator) none of these matter. Set
`LLM_MODE=mock` if you want any orchestrator process you do start to refuse network
calls.

## Inspect queue rows

Use `spacetime sql` against the running local module:

```sh
# All non-terminal requests, oldest first.
spacetime sql solar-dominion \
  "select id, session_id, faction_id, request_type, status, created_turn, attempt_count \
   from llm_requests \
   where status in ('queued', 'processing') \
   order by id"

# Queued deliberation requests for one faction on the current turn.
spacetime sql solar-dominion \
  "select id, context_json, created_turn \
   from llm_requests \
   where faction_id = 1 and request_type = 'proposals' and status = 'queued'"

# Failed audit rows produced when fallback could not generate proposals.
spacetime sql solar-dominion \
  "select id, faction_id, created_turn, error, error_code \
   from llm_requests \
   where status = 'failed'"

# Completed fallback audit rows include the generated proposal ids in response_json.
spacetime sql solar-dominion \
  "select id, faction_id, response_json \
   from llm_requests \
   where status = 'completed' and request_type = 'proposals'"
```

Useful row fields:

- `context_json` — stable-sorted JSON object. Queue mode emits
  `{faction_id, request, session_id, turn}`. Fallback mode adds `mode: "fallback"` so
  you can tell which path produced an audit row.
- `response_json` — populated only after a request reaches `completed`. Fallback writes
  `{proposal_ids, source: "deterministic_fallback"}`. Live workers attach advisory text.
- `error` / `error_code` — populated on `failed`. `fallback_unavailable` means the
  faction had no eligible cities or personnel, so no fallback proposal was insertable.

## Trigger the manual process path

The manual path is the fallback mode plus a direct `run_deliberation` call. Use it when
you want proposals on the table without standing up the orchestrator service.

1. Open a SpacetimeDB sql or reducer shell against the running module.
2. Flip the deliberation mode to fallback:

   ```sh
   spacetime call solar-dominion set_deliberation_mode "fallback"
   ```

   Verify the singleton row:

   ```sh
   spacetime sql solar-dominion "select * from module_settings"
   ```

3. Call `run_deliberation` for the faction whose turn you want to advance:

   ```sh
   spacetime call solar-dominion run_deliberation 1   # faction_id = 1
   ```

4. Inspect the deterministic output:

   ```sh
   spacetime sql solar-dominion \
     "select id, title, resource_cost, confidence, status \
      from proposals \
      where faction_id = 1 and turn = (select current_turn from game_sessions limit 1)"

   spacetime sql solar-dominion \
     "select id, status, response_json from llm_requests order by id desc limit 1"
   ```

5. To go back to queueing for a real worker, call:

   ```sh
   spacetime call solar-dominion set_deliberation_mode "queue"
   ```

If you want both — queue rows for a worker plus a local fallback safety net — run
`run_deliberation` once in `queue` mode for the audit trail, then switch to `fallback`
and run it again only when the worker fails to deliver. The duplicate-request guard in
`assertNoDuplicateDeliberationRequest` allows a second call only when the prior row is
`failed`.

## Why this proves no simulation outcome depends on live randomness

- `generateFallbackProposals` is fully deterministic — it sorts inputs by stable keys
  and uses a content hash for tie-breaks. `server/src/fallback_proposals.test.ts`
  pins this by trapping `Math.random` and `Date.now` while exercising the generator.
- `runDeliberationReducer` itself is exercised by `server/src/queue_boundary.test.ts`
  under the same traps in both `queue` and `fallback` mode, and additionally under a
  `process.env` proxy that throws on any read. The `no_live_dependency` suite is the
  invariant.
- `LLM_QUEUE_AUTHORITATIVE_CONTRACT.worker_output_role` is asserted to be
  `advisory_text_only`. Reducers never branch on `response_json` shape.
- Repeated calls on identical authoritative state produce byte-identical queue rows
  and byte-identical fallback proposals (ID-stripped), pinning replay determinism.

## Quick checklist before opening a deliberation-touching PR

- [ ] No new code in `server/src/turn_decisions.ts` reads `process.env`, `Math.random`,
      or `Date.now`.
- [ ] Any new mode value is added to `DELIBERATION_MODES` and round-trips through
      `set_deliberation_mode`.
- [ ] New audit rows include a stable-sorted `context_json` that identifies the mode
      used so devs can grep `llm_requests`.
- [ ] `npx vitest run` from `server/` is clean.
