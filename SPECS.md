# Specs

Auto-generated from `PLAN.md` and `solar-dominion-master.md`.

## Data Models

Authoritative state lives in SpacetimeDB. Field names may evolve during implementation, but these entities and relationships are required.

### game_sessions

- `id`: primary key
- `state`: setup, active, completed
- `current_year`: displayed in UI
- `current_turn`: 1-30
- `player_a_faction_id`, `player_b_faction_id`: faction links
- `turn_phase`: world_update, deliberation, decision, resolution, summary, complete
- `turn_deadline`: timestamp for active decision phase
- `winner_faction_id`: nullable
- `created_at`, `updated_at`

### factions

- `id`: primary key
- `session_id`: foreign key
- `player_id`: local/anonymous player identity
- `name`
- `credits`
- `political_capital`
- `doctrine_vector`: structured doctrine axes
- `control_score`
- `ready_for_turn`: boolean

### celestial_bodies

- `id`: primary key
- `session_id`
- `name`
- `system_tier`: earth, inner, belt, jupiter, saturn, deep
- `comms_lag_turns`
- `travel_time_turns`
- `resource_deposits`: structured resource map
- `position`: map/orbital display data

### cities

- `id`: primary key
- `session_id`
- `body_id`
- `faction_id`
- `name`
- `population`
- `infrastructure_level`: 1-5
- `morale`: 0-100
- `industrial_output`
- `research_output`
- `garrison_strength`
- `supply_status`
- `development_stage`: establishment, early, maturation, full

### personnel

- `id`: primary key
- `faction_id`
- `name`
- `role`
- `department`
- `posting_city_id`
- `competence`, `creativity`, `reliability`
- `ambition`, `political_skill`, `communication`
- `loyalty`, `autonomy_tolerance`
- `morale`, `burnout`, `salary`

### personnel_relationships

- `id`
- `personnel_a_id`
- `personnel_b_id`
- `type`
- `strength`

### colony_ships

- `id`
- `faction_id`
- `origin_city_id`
- `destination_body_id`
- `manifest`
- `departed_turn`
- `arrives_turn`
- `status`: preparing, in_transit, arrived, lost

### fleets

- `id`
- `faction_id`
- `posting_city_id`
- `strength`
- `orders`

### projects

- `id`
- `faction_id`
- `city_id`
- `type`
- `name`
- `progress`
- `resources_assigned`
- `est_completion`
- `status`

### proposals

- `id`
- `faction_id`
- `turn`
- `proposing_personnel_id`
- `department`
- `title`
- `body`
- `resource_cost`
- `confidence`: HIGH, MEDIUM, LOW
- `status`: unread, read, approved, rejected, deferred, auto_deferred
- `decision`

### commander_inbox

- `id`
- `faction_id`
- `turn`
- `from_personnel_id`
- `subject`
- `body`
- `requires_decision`
- `status`

### intelligence_records

- `id`
- `observer_faction_id`
- `target_faction_id`
- `intel_type`
- `value`
- `accuracy`
- `acquired_turn`

### events

- `id`
- `session_id`
- `faction_id`
- `turn`
- `event_type`
- `payload`
- `resolution`

### trade_agreements

- `id`
- `session_id`
- `faction_a_id`
- `faction_b_id`
- `terms`
- `signed_turn`
- `expires_turn`

### llm_requests

- `id`
- `session_id`
- `faction_id`
- `request_type`: proposals, inbox, event_narrative, resume_briefing
- `context_json`
- `status`: queued, processing, complete, failed
- `response_json`
- `error`
- `created_turn`

## Access Policy

Authoritative access policy version: `1`.

Identity scope is per SpacetimeDB `ctx.sender` and per game session. `join_or_resume_session(session_id, player_slot)` binds a browser identity to exactly one faction slot by replacing the claimable placeholder `factions.player_id`. A claimed slot can be resumed only by the same identity. Claimable placeholder identities are not private-data owners. Hosted mode keeps the same rule: external auth may determine the sender identity, but access is still evaluated by matching that identity to a claimed `factions.player_id` within the session.

### Subscription Visibility Matrix

| Entity | Public subscription | Faction owner subscription | Access key | Notes |
|---|---|---|---|---|
| `game_sessions` | Full | Full | `session_id` context | Shared session state: phase, turn, timer, winner, and faction links. |
| `celestial_bodies` | Full | Full | `session_id` | Shared solar-system map catalog. |
| `factions` | Projection | Full | `id` | Public projection may include name, control score, readiness; owner full row includes identity, resources, doctrine. |
| `cities` | Projection | Full | `faction_id` | Public map/control projection; owner full row includes exact operating stats. |
| `fleets` | Projection | Full | `faction_id` | Public presence/strength projection; owner full row includes orders. |
| `colony_ships` | Projection | Full | `faction_id` | Public transit/status projection; owner full row includes manifest and launch context. |
| `events` | Projection | Full | `faction_id` | Rows with no `faction_id` are shared; faction-addressed rows are private unless projected. |
| `personnel`, `proposals`, `commander_inbox`, `projects`, `turn_summaries`, `llm_requests` | None | Full | `faction_id` | Private command data for the owning faction. |
| `personnel_relationships` | None | Full | derived personnel faction | Inherits visibility from connected personnel. |
| `intelligence_records` | None | Full | `observer_faction_id` | Intel belongs to the observing faction. |
| `trade_agreements` | None | Participant full | `faction_a_id`, `faction_b_id` | Visible to participating factions unless later published as shared events. |

### Reducer Access Matrix

| Reducer | Required identity scope | Authoritative data touched |
|---|---|---|
| `create_session` | Anonymous sender allowed | Creates `game_sessions`, claimable `factions`. |
| `join_or_resume_session` | Slot claim or same claimed identity | Reads/writes `game_sessions`, `factions`. |
| `advance_turn_phase` | System-only/admin repair | Reads/writes `game_sessions`; normal gameplay should use bounded reducers. |
| `advance_world` | Session participant | Reads `game_sessions`, `factions`; advances session phase. |
| `run_deliberation` | Faction owner | Reads `factions`, `game_sessions`, `llm_requests`; writes `llm_requests`. |
| `commander_decision` | Faction owner | Reads `factions`, `game_sessions`, `proposals`; writes `factions`, `proposals`. |
| `submit_turn` | Faction owner | Reads/writes faction readiness, proposals, events, and session phase. |
| `expire_turn` | Session participant after deadline | Auto-defers proposals and triggers resolution after authoritative timeout. |
| `simulate_turn` | Session participant or automation | Reads shared turn state; writes `turn_summaries`, `events`, session phase. |
| `ack_resolution` | Faction owner | Acknowledges only the owner's `turn_summaries` row. |
| `check_victory` | Session participant or automation | Reads shared state and writes session victory state/events. |

## API Routes and Reducers

SpacetimeDB reducers are the primary API. Any HTTP service is only for external LLM orchestration.

### SpacetimeDB Reducers

- `create_session(player_a_name, player_b_name)`: creates game session, two factions, seed bodies/cities/personnel.
- `join_or_resume_session(session_id, player_slot)`: binds browser identity to P1/P2 slot for local/hosted demo.
- `seed_demo_turn_8(session_id)`: loads judge scenario with Mars contested and Jupiter/Callisto opportunity.
- `advance_world(session_id)`: advances ships, applies prior decisions, fires deterministic events.
- `run_deliberation(faction_id)`: inserts LLM request rows or fallback generated proposals.
- `commander_decision(faction_id, proposal_id, decision, allocation)`: approve/reject/defer and validate resources.
- `submit_turn(faction_id)`: marks faction ready; triggers simulation when both ready or deadline expired.
- `expire_turn(session_id)`: auto-defers unresolved proposals and advances when timer expires.
- `simulate_turn(session_id)`: deterministic execution of approved actions and state changes.
- `ack_resolution(faction_id)`: marks resolution summary seen.
- `check_victory(session_id)`: ends at Turn 30 or after 3 consecutive dominance turns.

### Orchestrator HTTP Endpoints

- `GET /health`: health check.
- `POST /llm/process`: process queued LLM requests, dev/manual trigger allowed.
- `POST /llm/proposals`: optional direct generation endpoint for tests/dev tools.

### Frontend Routes

- `/`: landing/new/continue.
- `/setup`: choose local P1/P2 session or create demo session.
- `/game/:sessionId/:playerSlot`: command center.

## UI Flows

### Local Two-Player Demo

1. User starts local demo runner.
2. Browser A opens as P1; Browser B opens as P2.
3. P1/P2 join same session and see faction-specific Command Center state.
4. Each player sees shared public map state and private proposals/resources/personnel.
5. P1 approves a proposal and allocates resources.
6. P2 sees no private P1 proposal details, but sees public state sync where appropriate.
7. Both players submit turn.
8. SpacetimeDB simulates simultaneously.
9. Both browsers receive turn-resolution summary and updated world state.

### Judge Demo Scenario

1. Load seeded Turn 8 game.
2. Show Command Center with inbox proposals from Chief of Staff, Mars Theater Commander, and Chief Scientist.
3. Open Mars proposal recommending Callisto push.
4. Show officer traits supporting the generated text.
5. Approve proposal, assign credits/construction teams, confirm.
6. Show real-time SpacetimeDB sync and turn timer.
7. Submit both turns and show resolution feed.

### Command Center

1. Persistent global header shows faction, year/turn, resources, control score, phase, timer.
2. Left icon sidebar opens panels without leaving Command Center.
3. Main map shows bodies, cities, faction control, fleets, colony ships, and alerts.
4. Right/inbox panel shows proposals and decision controls.
5. Panels include personnel, resources, intelligence, diplomacy, doctrine, city detail, resolution, end-game.

## Business Rules

- Simulation is deterministic and authoritative in SpacetimeDB.
- LLM may generate prose and structured proposal candidates, never final outcomes.
- Players make decisions simultaneously; neither can block forever.
- Turn advances when both players submit or deadline expires.
- Unresolved proposals are auto-deferred on timeout.
- Players cannot spend resources they do not have.
- Proposal decisions must be faction-owned; one player cannot decide for the other.
- Public subscriptions expose shared world state only; private faction subscriptions expose full faction detail.
- Claimable placeholder identities are setup metadata only and never authorize private reads or reducer actions.
- City morale stays in 0-100 range and affects output/control score.
- Infrastructure levels stay in 1-5 range.
- Game ends at Turn 30 or if one faction holds decisive dominance for 3 consecutive turns.
- Browser E2E must cover the local two-player flow before demo close-out.
- Hosted deployment must have a smoke test proving app, SpacetimeDB connection, and LLM/mock mode configuration.

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `OPENROUTER_API_KEY` | API key for OpenRouter proposal generation | Required for live LLM mode |
| `OPENROUTER_MODEL` | Defaults to `inception/mercury-2` | Yes |
| `LLM_MODE` | `live`, `mock`, or `fixture` | Yes |
| `SPACETIME_HOST` | SpacetimeDB host/URL for frontend/orchestrator | Yes |
| `SPACETIME_DB_NAME` | Published database/module name | Yes |
| `FRONTEND_ORIGIN` | Allowed frontend origin for hosted orchestrator | Hosted only |
| `VITE_SPACETIME_HOST` | Frontend SpacetimeDB connection URL | Yes |
| `VITE_SPACETIME_DB_NAME` | Frontend database/module name | Yes |
| `VITE_LLM_MODE` | Frontend display/config mode | Yes |
| `PORT` | Orchestrator HTTP port | Local/hosted orchestrator |

## Testing Expectations

- `npm test` is the baseline repo command.
- P1 game core needs reducer/unit tests for schema invariants, resource validation, turn resolution, timeout behavior, control score, and access control.
- P2 frontend needs component/store tests for subscriptions, decision controls, timer states, and panel state.
- P3 LLM needs mock/live-boundary tests for prompt building, JSON validation, retries, fallback, and no-secret logging.
- P4 glue needs browser E2E for P1/P2 local flow and Turn 8 judge script.
- P5 hosting needs deployment smoke test and production config validation.
