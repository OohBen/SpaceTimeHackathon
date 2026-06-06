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
} from './turn_decisions.js';

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

export default spacetimedb;
