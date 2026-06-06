import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const srcPath = (file: string) => resolve(import.meta.dirname, file);
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
  'seed_demo_world',
  'seed_demo_turn_8',
];

describe('SpacetimeDB entrypoint wiring', () => {
  it('uses the authoritative schema tables in the CLI entrypoint', () => {
    const src = readFileSync(srcPath('index.ts'), 'utf8');

    expect(src).toMatch(/from ['"]\.\/schema\.js['"]/);
    expect(src).toMatch(/schema\s*\(\s*tables\s*\)/);
    expect(src).not.toMatch(/schema\s*\(\s*\{\s*\}\s*\)/);
  });

  it('keeps module imports compatible without diverging from the CLI entrypoint', () => {
    const src = readFileSync(srcPath('module.ts'), 'utf8');

    expect(src).toMatch(/export\s+\{\s*default\s*\}\s+from ['"]\.\/index\.js['"]/);
  });

  it('exports a non-empty authoritative table map', () => {
    const src = readFileSync(srcPath('schema.ts'), 'utf8');

    expect(src).toMatch(/export\s+const\s+tables\s*=/);
    for (const tableName of REQUIRED_TABLES) {
      expect(src).toContain(tableName);
    }
  });

  it('exports supported demo seed reducers from the CLI entrypoint', () => {
    const src = readFileSync(srcPath('index.ts'), 'utf8');

    for (const reducerName of REQUIRED_REDUCERS) {
      expect(src).toContain(`export const ${reducerName}`);
    }
  });
});
