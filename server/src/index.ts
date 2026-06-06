import { schema, t } from 'spacetimedb/server';
import { tables } from './schema.js';
import { createSessionReducer, joinOrResumeSessionReducer } from './session_lifecycle.js';

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

export default spacetimedb;
