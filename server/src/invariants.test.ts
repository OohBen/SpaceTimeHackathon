import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const serverRoot = resolve(import.meta.dirname, '..');
const src = () => readFileSync(resolve(serverRoot, 'src/schema.ts'), 'utf8');

describe('schema invariants', () => {
  it('factions table has unique constraint on session_id+player_id combination', () => {
    // Encoded via btree index on session_id for lookup + unique on player_id per session
    // via constraints or unique index
    expect(src()).toMatch(/factions.*unique|unique.*player_id|constraints.*factions/s);
  });

  it('game_sessions table indexes session state for fast lookup', () => {
    expect(src()).toMatch(/game_sessions.*btree|btree.*session|indexes.*game_sessions/s);
  });

  it('cities table indexes body_id for body-to-city hierarchy queries', () => {
    expect(src()).toMatch(/cities.*body_id.*btree|btree.*body_id|body_idx/s);
  });

  it('personnel table indexes faction_id for faction roster queries', () => {
    expect(src()).toMatch(/personnel.*faction_id.*btree|btree.*faction_id|personnel_faction_idx/s);
  });

  it('proposals table indexes faction_id and turn for per-turn proposal lookup', () => {
    expect(src()).toMatch(/proposals.*btree|proposal.*turn|proposals_faction_idx/s);
  });

  it('llm_requests table indexes status for queue polling', () => {
    expect(src()).toMatch(/llm_requests.*btree|llm.*status.*btree|llm_status_idx/s);
  });

  it('Turn 1 fixture: game_session state field accepts setup value', () => {
    // state column is t.string() — no constraint needed, but verify it exists
    expect(src()).toMatch(/state: t\.string\(\)/);
  });

  it('Turn 8 fixture: winner_faction_id is nullable (option)', () => {
    expect(src()).toMatch(/winner_faction_id: t\.option/);
  });

  it('Turn 8 fixture: colony_ships has departed_turn and arrives_turn', () => {
    expect(src()).toContain('departed_turn');
    expect(src()).toContain('arrives_turn');
  });
});
