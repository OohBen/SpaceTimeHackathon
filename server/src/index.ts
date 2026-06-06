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

export default spacetimedb;
