import { schema, t } from 'spacetimedb/server';
import { tables } from './schema.js';
import {
  advanceTurnPhaseReducer,
  advanceWorldReducer,
  createSessionReducer,
  joinOrResumeSessionReducer,
} from './session_lifecycle.js';
import {
  commanderDecisionReducer,
  runDeliberationReducer,
  setDeliberationModeReducer,
} from './turn_decisions.js';
import {
  expireTurnReducer,
  submitTurnReducer,
} from './turn_advancement.js';
import {
  ackResolutionReducer,
  checkVictoryReducer,
  simulateTurnReducer,
} from './turn_resolution.js';
import { seedDemoWorldReducer } from './seed_demo_world.js';
import {
  projectCity,
  projectColonyShip,
  projectEvent,
  projectFaction,
  projectFleet,
} from './public_world_projection.js';

// SpacetimeDB CLI entry point for the Solar Dominion module.
const spacetimedb = schema(tables);

export const create_session = spacetimedb.reducer(
  {
    player_a_name: t.string(),
    player_b_name: t.string(),
  },
  createSessionReducer
);

export const join_or_resume_session = spacetimedb.reducer(
  {
    session_id: t.u32(),
    player_slot: t.string(),
  },
  joinOrResumeSessionReducer
);

export const advance_turn_phase = spacetimedb.reducer(
  {
    session_id: t.u32(),
    next_phase: t.string(),
  },
  advanceTurnPhaseReducer
);

export const advance_world = spacetimedb.reducer(
  {
    session_id: t.u32(),
  },
  advanceWorldReducer
);

export const run_deliberation = spacetimedb.reducer(
  {
    faction_id: t.u32(),
  },
  runDeliberationReducer
);

export const commander_decision = spacetimedb.reducer(
  {
    faction_id: t.u32(),
    proposal_id: t.u32(),
    decision: t.string(),
    allocation: t.i32(),
  },
  commanderDecisionReducer
);

export const set_deliberation_mode = spacetimedb.reducer(
  {
    mode: t.string(),
  },
  setDeliberationModeReducer
);

export const submit_turn = spacetimedb.reducer(
  {
    faction_id: t.u32(),
  },
  submitTurnReducer
);

export const expire_turn = spacetimedb.reducer(
  {
    session_id: t.u32(),
  },
  expireTurnReducer
);

export const simulate_turn = spacetimedb.reducer(
  {
    session_id: t.u32(),
  },
  simulateTurnReducer
);

export const ack_resolution = spacetimedb.reducer(
  {
    faction_id: t.u32(),
  },
  ackResolutionReducer
);

export const check_victory = spacetimedb.reducer(
  {
    session_id: t.u32(),
  },
  checkVictoryReducer
);

export const seed_demo_world = spacetimedb.reducer(
  {
    session_id: t.u32(),
  },
  seedDemoWorldReducer
);

const publicFactionRowType = t.object('PublicFactionProjection', {
  id: t.u32(),
  session_id: t.u32(),
  name: t.string(),
  control_score: t.i32(),
  ready_for_turn: t.bool(),
});

const publicCityRowType = t.object('PublicCityProjection', {
  id: t.u32(),
  session_id: t.u32(),
  body_id: t.u32(),
  faction_id: t.u32(),
  name: t.string(),
  development_stage: t.string(),
});

const publicFleetRowType = t.object('PublicFleetProjection', {
  id: t.u32(),
  faction_id: t.u32(),
  posting_city_id: t.u32(),
  strength: t.i32(),
});

const publicColonyShipRowType = t.object('PublicColonyShipProjection', {
  id: t.u32(),
  faction_id: t.u32(),
  destination_body_id: t.u32(),
  arrives_turn: t.u32(),
  status: t.string(),
});

const publicEventRowType = t.object('PublicEventProjection', {
  id: t.u32(),
  session_id: t.u32(),
  turn: t.u32(),
  event_type: t.string(),
});

export const public_factions = spacetimedb.anonymousView(
  { name: 'public_factions', public: true },
  t.array(publicFactionRowType),
  (ctx) => [...ctx.db.factions.iter()].map(projectFaction)
);

export const public_cities = spacetimedb.anonymousView(
  { name: 'public_cities', public: true },
  t.array(publicCityRowType),
  (ctx) => [...ctx.db.cities.iter()].map(projectCity)
);

export const public_fleets = spacetimedb.anonymousView(
  { name: 'public_fleets', public: true },
  t.array(publicFleetRowType),
  (ctx) => [...ctx.db.fleets.iter()].map(projectFleet)
);

export const public_colony_ships = spacetimedb.anonymousView(
  { name: 'public_colony_ships', public: true },
  t.array(publicColonyShipRowType),
  (ctx) => [...ctx.db.colony_ships.iter()].map(projectColonyShip)
);

export const public_events = spacetimedb.anonymousView(
  { name: 'public_events', public: true },
  t.array(publicEventRowType),
  (ctx) => [...ctx.db.events.iter()].map(projectEvent)
);

export default spacetimedb;
