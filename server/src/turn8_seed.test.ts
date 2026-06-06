import { Identity, Timestamp } from 'spacetimedb';
import { describe, expect, it } from 'vitest';

import {
  TURN8_SEED_INSERT_ORDER,
  buildTurn8Seed,
  getTurn8SeedInsertPlan,
  turn8Seed,
  type Turn8SeedRows,
} from './turn8_seed.js';
import { joinOrResumeSession } from './session_lifecycle.js';

const canonicalValue = (value: unknown): unknown => {
  if (value instanceof Identity) return value.toHexString();
  if (value instanceof Timestamp) return value.microsSinceUnixEpoch.toString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)])
    );
  }
  return value;
};

const canonicalSeed = (seed: Turn8SeedRows): unknown => canonicalValue(seed);

describe('Turn 8 deterministic seed', () => {
  it('builds Turn 8 session state (turn 8, year 2157, active deliberation)', () => {
    const seed = buildTurn8Seed();

    expect(seed.game_sessions).toHaveLength(1);
    expect(seed.game_sessions[0]).toMatchObject({
      id: 1,
      state: 'active',
      current_year: 2157,
      current_turn: 8,
      player_a_faction_id: 1,
      player_b_faction_id: 2,
      turn_phase: 'deliberation',
      winner_faction_id: undefined,
    });
  });

  it('factions have evolved resources beyond Turn 1 starting values', () => {
    const seed = buildTurn8Seed();

    expect(seed.factions).toHaveLength(2);
    expect(seed.factions.every((f) => f.credits > 1_200)).toBe(true);
    expect(seed.factions.every((f) => f.control_score > 100)).toBe(true);
    expect(seed.factions.every((f) => f.player_id instanceof Identity)).toBe(true);
  });

  it('Mars city shows contested state (strained supply, high garrison)', () => {
    const seed = buildTurn8Seed();
    const marsBody = seed.celestial_bodies.find((b) => b.name === 'Mars');
    expect(marsBody).toBeDefined();

    const marsCity = seed.cities.find((c) => c.body_id === marsBody!.id);
    expect(marsCity).toBeDefined();
    expect(marsCity!.supply_status).toBe('strained');
    expect(marsCity!.garrison_strength).toBeGreaterThan(50);
  });

  it('Callisto or Jupiter shows opportunity (establishment stage or opportunity intel)', () => {
    const seed = buildTurn8Seed();
    const opportunityBodies = ['Callisto', 'Jupiter'];
    const opportunityBodyIds = seed.celestial_bodies
      .filter((b) => opportunityBodies.includes(b.name))
      .map((b) => b.id);

    const hasOpportunityCity = seed.cities.some(
      (c) => opportunityBodyIds.includes(c.body_id) && c.development_stage === 'establishment'
    );
    const hasOpportunityIntel = seed.intelligence_records.some(
      (r) => r.intel_type === 'opportunity'
    );

    expect(hasOpportunityCity || hasOpportunityIntel).toBe(true);
  });

  it('has a colony ship in transit (departed < 8, arrives > 8)', () => {
    const seed = buildTurn8Seed();

    expect(seed.colony_ships.length).toBeGreaterThan(0);
    const inTransit = seed.colony_ships.find((s) => s.status === 'in_transit');
    expect(inTransit).toBeDefined();
    expect(inTransit!.departed_turn).toBeLessThan(8);
    expect(inTransit!.arrives_turn).toBeGreaterThan(8);
  });

  it('faction doctrine_vector has slot metadata supporting resume via joinOrResumeSessionReducer', () => {
    const seed = buildTurn8Seed();
    const [factionA, factionB] = seed.factions;
    const session = seed.game_sessions[0];

    const slotA = JSON.parse(factionA.doctrine_vector).slot;
    const slotB = JSON.parse(factionB.doctrine_vector).slot;

    expect(slotA).toMatchObject({ slot_key: 'player_a', claim_status: 'claimable' });
    expect(slotB).toMatchObject({ slot_key: 'player_b', claim_status: 'claimable' });

    const judge = Identity.fromString('a'.padStart(64, '0'));
    const factions = [...seed.factions];
    const sessions = [...seed.game_sessions];

    const ctx = {
      sender: judge,
      timestamp: new Timestamp(0n),
      db: {
        game_sessions: {
          id: {
            find: (id: number) => sessions.find((s) => s.id === id),
            update: (row: typeof sessions[0]) => {
              const idx = sessions.findIndex((s) => s.id === row.id);
              sessions[idx] = row;
              return row;
            },
          },
        },
        factions: {
          id: {
            find: (id: number) => factions.find((f) => f.id === id),
            update: (row: typeof factions[0]) => {
              const idx = factions.findIndex((f) => f.id === row.id);
              factions[idx] = row;
              return row;
            },
          },
        },
      },
    };

    const result = joinOrResumeSession(ctx, {
      session_id: session.id,
      player_slot: 'player_a',
    });

    expect(result.is_resume).toBe(false);
    expect(result.session_id).toBe(session.id);
    expect(result.current_turn).toBe(8);
  });

  it('is deterministic for identical inputs', () => {
    const input = {
      session_id: 42,
      player_a_identity: 'dead',
      player_b_identity: 'beef',
    };

    const first = buildTurn8Seed(input);
    const second = buildTurn8Seed(input);

    expect(first).not.toBe(second);
    expect(canonicalSeed(first)).toEqual(canonicalSeed(second));
  });

  it('keeps FK references valid', () => {
    const seed = buildTurn8Seed();
    const sessionIds = new Set(seed.game_sessions.map((s) => s.id));
    const factionIds = new Set(seed.factions.map((f) => f.id));
    const bodyIds = new Set(seed.celestial_bodies.map((b) => b.id));
    const cityIds = new Set(seed.cities.map((c) => c.id));
    const personnelIds = new Set(seed.personnel.map((p) => p.id));

    expect(seed.factions.every((f) => sessionIds.has(f.session_id))).toBe(true);
    expect(seed.celestial_bodies.every((b) => sessionIds.has(b.session_id))).toBe(true);
    expect(seed.cities.every((c) => sessionIds.has(c.session_id))).toBe(true);
    expect(seed.cities.every((c) => bodyIds.has(c.body_id))).toBe(true);
    expect(seed.cities.every((c) => factionIds.has(c.faction_id))).toBe(true);
    expect(seed.colony_ships.every((s) => factionIds.has(s.faction_id))).toBe(true);
    expect(seed.colony_ships.every((s) => cityIds.has(s.origin_city_id))).toBe(true);
    expect(seed.colony_ships.every((s) => bodyIds.has(s.destination_body_id))).toBe(true);
    expect(seed.personnel.every((p) => factionIds.has(p.faction_id))).toBe(true);
    expect(seed.proposals.every((p) => personnelIds.has(p.proposing_personnel_id))).toBe(true);
  });

  it('exposes deterministic insert batches in dependency order', () => {
    const plan = getTurn8SeedInsertPlan(turn8Seed);

    expect(plan.map((batch) => batch.table)).toEqual(TURN8_SEED_INSERT_ORDER);
    expect(plan[0]).toEqual({ table: 'game_sessions', rows: turn8Seed.game_sessions });
    expect(plan[1]).toEqual({ table: 'factions', rows: turn8Seed.factions });
  });
});
