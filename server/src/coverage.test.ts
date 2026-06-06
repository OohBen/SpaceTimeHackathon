import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

import {
  turn1Faction,
  turn1Seed,
  turn1Session,
  turn8ColonyShip,
  turn8Session,
} from './fixtures.js';

const serverRoot = resolve(import.meta.dirname, '..');
const fixturesPath = resolve(serverRoot, 'src/fixtures.ts');

describe('schema coverage tests', () => {
  it('fixtures file exists', () => {
    expect(existsSync(fixturesPath)).toBe(true);
  });

  it('exports turn1Session fixture', () => {
    expect(turn1Session).toBeDefined();
  });

  it('exports turn8Session fixture', () => {
    expect(turn8Session).toBeDefined();
  });

  it('Turn 1 session fixture starts active deliberation on turn 1', () => {
    expect(turn1Session.state).toBe('active');
    expect(turn1Session.current_turn).toBe(1);
    expect(turn1Session.turn_phase).toBe('deliberation');
  });

  it('Turn 8 session fixture has current_turn=8', () => {
    expect(turn8Session.current_turn).toBe(8);
  });

  it('Turn 1 faction fixture has ready_for_turn=false', () => {
    expect(turn1Faction.ready_for_turn).toBe(false);
  });

  it('Turn 8 colony_ship fixture has departed_turn and arrives_turn', () => {
    expect(turn8ColonyShip.departed_turn).toBeDefined();
    expect(turn8ColonyShip.arrives_turn).toBeDefined();
  });

  it('winner_faction_id is undefined in Turn 1 (game not over)', () => {
    expect(turn1Session.winner_faction_id).toBeUndefined();
  });

  it('exports a full Turn 1 seed fixture', () => {
    expect(turn1Seed.game_sessions).toHaveLength(1);
    expect(turn1Seed.factions.length).toBeGreaterThanOrEqual(2);
    expect(turn1Seed.celestial_bodies.length).toBeGreaterThanOrEqual(6);
    expect(turn1Seed.cities.length).toBeGreaterThanOrEqual(3);
    expect(turn1Seed.personnel.length).toBeGreaterThanOrEqual(6);
    expect(turn1Seed.proposals.length).toBeGreaterThanOrEqual(4);
  });
});
