import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const serverRoot = resolve(import.meta.dirname, '..');
const schemaPath = resolve(serverRoot, 'src/schema.ts');

const OPERATIONAL_TABLES = [
  'fleets',
  'colony_ships',
  'projects',
  'intelligence_records',
  'events',
  'turn_summaries',
  'trade_agreements',
  'llm_requests',
];

describe('operational schema', () => {
  it('schema file exists', () => {
    expect(existsSync(schemaPath)).toBe(true);
  });

  for (const tableName of OPERATIONAL_TABLES) {
    it(`defines operational table: ${tableName}`, () => {
      const src = readFileSync(schemaPath, 'utf8');
      expect(src).toContain(tableName);
    });
  }
});
