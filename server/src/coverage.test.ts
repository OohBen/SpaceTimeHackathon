import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const serverRoot = resolve(import.meta.dirname, '..');
const fixturesPath = resolve(serverRoot, 'src/fixtures.ts');

describe('schema coverage tests', () => {
  it('fixtures file exists', () => {
    expect(existsSync(fixturesPath)).toBe(true);
  });

  it('exports turn1Session fixture', () => {
    const src = readFileSync(fixturesPath, 'utf8');
    expect(src).toContain('turn1Session');
  });

  it('exports turn8Session fixture', () => {
    const src = readFileSync(fixturesPath, 'utf8');
    expect(src).toContain('turn8Session');
  });

  it('Turn 1 session fixture has state=setup and current_turn=1', () => {
    const src = readFileSync(fixturesPath, 'utf8');
    expect(src).toMatch(/turn1Session[\s\S]*?state.*setup/);
    expect(src).toMatch(/turn1Session[\s\S]*?current_turn.*1/);
  });

  it('Turn 8 session fixture has current_turn=8', () => {
    const src = readFileSync(fixturesPath, 'utf8');
    expect(src).toMatch(/turn8Session[\s\S]*?current_turn.*8/);
  });

  it('Turn 1 faction fixture has ready_for_turn=false', () => {
    const src = readFileSync(fixturesPath, 'utf8');
    expect(src).toMatch(/turn1Faction[\s\S]*?ready_for_turn.*false/);
  });

  it('Turn 8 colony_ship fixture has departed_turn and arrives_turn', () => {
    const src = readFileSync(fixturesPath, 'utf8');
    expect(src).toContain('turn8ColonyShip');
    expect(src).toMatch(/turn8ColonyShip[\s\S]*?departed_turn/);
    expect(src).toMatch(/turn8ColonyShip[\s\S]*?arrives_turn/);
  });

  it('winner_faction_id is undefined in Turn 1 (game not over)', () => {
    const src = readFileSync(fixturesPath, 'utf8');
    expect(src).toMatch(/turn1Session[\s\S]*?winner_faction_id.*undefined/);
  });
});
