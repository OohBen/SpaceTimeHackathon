import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { tables, reducers } from './index.js';

const REQUIRED_TABLES = [
  'game_sessions',
  'factions',
  'celestial_bodies',
  'cities',
  'personnel',
  'personnel_relationships',
  'proposals',
  'commander_inbox',
  'fleets',
  'colony_ships',
  'projects',
  'intelligence_records',
  'events',
  'trade_agreements',
  'llm_requests',
];

const REQUIRED_REDUCERS = [
  'advance_turn_phase',
  'advance_world',
  'commander_decision',
  'create_session',
  'expire_turn',
  'join_or_resume_session',
  'run_deliberation',
  'submit_turn',
];

describe('module bindings scaffold', () => {
  it('exports tables object', () => {
    expect(tables).toBeDefined();
    expect(typeof tables).toBe('object');
  });

  it('exports reducers object', () => {
    expect(reducers).toBeDefined();
    expect(typeof reducers).toBe('object');
  });

  it('generates non-empty bindings for authoritative schema tables', () => {
    const src = readFileSync(resolve(import.meta.dirname, 'index.ts'), 'utf8');

    expect(src).not.toMatch(/const tablesSchema = __schema\(\{\s*\}\);/);
    for (const tableName of REQUIRED_TABLES) {
      expect(src).toContain(tableName);
    }
  });

  it('generates non-empty bindings for authoritative reducers', () => {
    const src = readFileSync(resolve(import.meta.dirname, 'index.ts'), 'utf8');

    expect(src).not.toMatch(/const reducersSchema = __reducers\(\s*\);/);
    for (const reducerName of REQUIRED_REDUCERS) {
      expect(src).toContain(reducerName);
    }
  });

  it('generates table types for downstream client code', () => {
    const src = readFileSync(resolve(import.meta.dirname, 'types.ts'), 'utf8');

    expect(src).toContain('GameSessions');
    expect(src).toContain('Factions');
    expect(src).toContain('LlmRequests');
  });
});
