import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const serverRoot = resolve(import.meta.dirname, '..');
const schemaPath = resolve(serverRoot, 'src/schema.ts');

const REQUIRED_TABLES = [
  'game_sessions',
  'factions',
  'celestial_bodies',
  'cities',
  'personnel',
  'personnel_relationships',
  'proposals',
  'commander_inbox',
];

describe('foundational schema', () => {
  it('schema file exists', () => {
    expect(existsSync(schemaPath)).toBe(true);
  });

  it('schema exports a tables object', () => {
    const src = readFileSync(schemaPath, 'utf8');
    expect(src).toMatch(/export.*tables/);
  });

  for (const table of REQUIRED_TABLES) {
    it(`defines table: ${table}`, () => {
      const src = readFileSync(schemaPath, 'utf8');
      expect(src).toContain(table);
    });
  }

  it('CLI entrypoint imports from schema', () => {
    const src = readFileSync(resolve(serverRoot, 'src/index.ts'), 'utf8');
    expect(src).toMatch(/from ['"]\.\/schema/);
  });
});
