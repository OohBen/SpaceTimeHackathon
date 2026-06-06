import { Identity, Timestamp } from 'spacetimedb';
import { describe, expect, it } from 'vitest';

import {
  TURN8_SEED_INSERT_ORDER,
  TURN8_JUDGE_SCENARIO_DELTAS,
  buildTurn8Seed,
  getTurn8SeedInsertPlan,
  turn8Seed,
  type Turn8SeedRows,
} from './turn8_seed.js';
import { buildTurn1Seed } from './turn1_seed.js';
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

const parseJson = <T>(value: string): T => JSON.parse(value) as T;

const expectNumberDelta = (
  delta: Readonly<{ from: number; to: number; delta: number }>,
  from: number,
  to: number
) => {
  expect(delta).toEqual({ from, to, delta: to - from });
};

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

  it('Mars city shows contested pressure (strained supply, low morale, high garrison)', () => {
    const seed = buildTurn8Seed();
    const marsBody = seed.celestial_bodies.find((b) => b.name === 'Mars');
    expect(marsBody).toBeDefined();

    const marsCity = seed.cities.find((c) => c.body_id === marsBody!.id);
    expect(marsCity).toBeDefined();
    expect(marsCity).toMatchObject({
      name: 'Pavonis Hub',
      morale: 44,
      garrison_strength: 680,
      supply_status: 'strained',
    });

    const contestedIntel = seed.intelligence_records.find(
      (record) => record.intel_type === 'contested_territory'
    );
    expect(contestedIntel).toBeDefined();
    expect(parseJson(contestedIntel!.value)).toEqual({
      body: 'Mars',
      city: 'Pavonis Hub',
      fleet_strength: 580,
      garrison_strength: 680,
      morale: 44,
      pressure: 'supply_relief_required',
      supply_status: 'strained',
    });
  });

  it('Callisto shows attractive expansion opportunity with explicit resource upside', () => {
    const seed = buildTurn8Seed();
    const callisto = seed.celestial_bodies.find((b) => b.name === 'Callisto');
    expect(callisto).toBeDefined();
    expect(parseJson(callisto!.resource_deposits)).toEqual(
      TURN8_JUDGE_SCENARIO_DELTAS.resources.Callisto.deposits
    );

    const callistoCity = seed.cities.find((c) => c.body_id === callisto!.id);
    expect(callistoCity).toMatchObject({
      name: 'Callisto Outpost',
      faction_id: 1,
      population: 120_000n,
      development_stage: 'establishment',
      supply_status: 'stable',
    });

    const opportunityIntel = seed.intelligence_records
      .filter((record) => record.intel_type === 'opportunity')
      .map((record) => parseJson<Record<string, unknown>>(record.value));

    expect(opportunityIntel).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: 'Callisto',
          resource_deposits: TURN8_JUDGE_SCENARIO_DELTAS.resources.Callisto.deposits,
        }),
      ])
    );
  });

  it('makes required world-state deltas from Turn 1 baseline explicit and testable', () => {
    const baseline = buildTurn1Seed();
    const seed = buildTurn8Seed();
    const deltaEvent = seed.events.find(
      (event) => event.event_type === 'turn8_judge_scenario_seeded'
    );

    expect(deltaEvent).toMatchObject({ turn: 8, faction_id: undefined });
    expect(parseJson(deltaEvent!.payload)).toEqual(TURN8_JUDGE_SCENARIO_DELTAS);

    const baselineSession = baseline.game_sessions[0];
    const turn8Session = seed.game_sessions[0];
    expectNumberDelta(
      TURN8_JUDGE_SCENARIO_DELTAS.turn_state.current_year,
      baselineSession.current_year,
      turn8Session.current_year
    );
    expectNumberDelta(
      TURN8_JUDGE_SCENARIO_DELTAS.turn_state.current_turn,
      baselineSession.current_turn,
      turn8Session.current_turn
    );
    expect(TURN8_JUDGE_SCENARIO_DELTAS.turn_state.turn_phase).toBe(turn8Session.turn_phase);

    const factionById = (rows: Turn8SeedRows, factionId: number) => {
      const faction = rows.factions.find((row) => row.id === factionId);
      expect(faction).toBeDefined();
      return faction!;
    };
    const baselineFactionA = factionById(baseline, 1);
    const baselineFactionB = factionById(baseline, 2);
    const turn8FactionA = factionById(seed, 1);
    const turn8FactionB = factionById(seed, 2);

    expectNumberDelta(
      TURN8_JUDGE_SCENARIO_DELTAS.factions['1'].credits,
      baselineFactionA.credits,
      turn8FactionA.credits
    );
    expectNumberDelta(
      TURN8_JUDGE_SCENARIO_DELTAS.factions['1'].political_capital,
      baselineFactionA.political_capital,
      turn8FactionA.political_capital
    );
    expectNumberDelta(
      TURN8_JUDGE_SCENARIO_DELTAS.factions['1'].control_score,
      baselineFactionA.control_score,
      turn8FactionA.control_score
    );
    expectNumberDelta(
      TURN8_JUDGE_SCENARIO_DELTAS.factions['2'].credits,
      baselineFactionB.credits,
      turn8FactionB.credits
    );
    expectNumberDelta(
      TURN8_JUDGE_SCENARIO_DELTAS.factions['2'].political_capital,
      baselineFactionB.political_capital,
      turn8FactionB.political_capital
    );
    expectNumberDelta(
      TURN8_JUDGE_SCENARIO_DELTAS.factions['2'].control_score,
      baselineFactionB.control_score,
      turn8FactionB.control_score
    );

    const cityByName = (rows: Turn8SeedRows, cityName: string) => {
      const city = rows.cities.find((row) => row.name === cityName);
      expect(city).toBeDefined();
      return city!;
    };
    const baselinePavonis = cityByName(baseline, 'Pavonis Hub');
    const turn8Pavonis = cityByName(seed, 'Pavonis Hub');

    expectNumberDelta(
      TURN8_JUDGE_SCENARIO_DELTAS.cities['Pavonis Hub'].morale,
      baselinePavonis.morale,
      turn8Pavonis.morale
    );
    expectNumberDelta(
      TURN8_JUDGE_SCENARIO_DELTAS.cities['Pavonis Hub'].industrial_output,
      baselinePavonis.industrial_output,
      turn8Pavonis.industrial_output
    );
    expectNumberDelta(
      TURN8_JUDGE_SCENARIO_DELTAS.cities['Pavonis Hub'].garrison_strength,
      baselinePavonis.garrison_strength,
      turn8Pavonis.garrison_strength
    );
    expect(TURN8_JUDGE_SCENARIO_DELTAS.cities['Pavonis Hub'].supply_status).toEqual({
      from: baselinePavonis.supply_status,
      to: turn8Pavonis.supply_status,
    });

    expect(baseline.cities.find((city) => city.name === 'Callisto Outpost')).toBeUndefined();
    const callistoOutpost = cityByName(seed, 'Callisto Outpost');
    expect(TURN8_JUDGE_SCENARIO_DELTAS.cities['Callisto Outpost']).toEqual({
      baseline: 'absent',
      faction_id: callistoOutpost.faction_id,
      population: Number(callistoOutpost.population),
      development_stage: callistoOutpost.development_stage,
      supply_status: callistoOutpost.supply_status,
    });

    const fleetByPosting = (rows: Turn8SeedRows, cityName: string, factionId: number) => {
      const city = cityByName(rows, cityName);
      const fleet = rows.fleets.find(
        (row) => row.posting_city_id === city.id && row.faction_id === factionId
      );
      expect(fleet).toBeDefined();
      return fleet!;
    };
    const baselineEarthFleet = fleetByPosting(baseline, 'New Geneva', 1);
    const turn8EarthFleet = fleetByPosting(seed, 'New Geneva', 1);
    const baselinePavonisFleet = fleetByPosting(baseline, 'Pavonis Hub', 2);
    const turn8PavonisFleet = fleetByPosting(seed, 'Pavonis Hub', 2);
    const callistoFleet = fleetByPosting(seed, 'Callisto Outpost', 1);

    expectNumberDelta(
      TURN8_JUDGE_SCENARIO_DELTAS.fleets['New Geneva home guard'].strength,
      baselineEarthFleet.strength,
      turn8EarthFleet.strength
    );
    expect(TURN8_JUDGE_SCENARIO_DELTAS.fleets['New Geneva home guard'].orders).toEqual({
      from: baselineEarthFleet.orders,
      to: turn8EarthFleet.orders,
    });
    expectNumberDelta(
      TURN8_JUDGE_SCENARIO_DELTAS.fleets['Pavonis perimeter defense'].strength,
      baselinePavonisFleet.strength,
      turn8PavonisFleet.strength
    );
    expect(TURN8_JUDGE_SCENARIO_DELTAS.fleets['Pavonis perimeter defense'].orders).toEqual({
      from: baselinePavonisFleet.orders,
      to: turn8PavonisFleet.orders,
    });
    expect(TURN8_JUDGE_SCENARIO_DELTAS.fleets['Callisto outpost guard']).toEqual({
      baseline: 'absent',
      faction_id: callistoFleet.faction_id,
      city: 'Callisto Outpost',
      strength: callistoFleet.strength,
      orders: callistoFleet.orders,
    });

    const depositsByBodyName = (rows: Turn8SeedRows, bodyName: string) => {
      const body = rows.celestial_bodies.find((row) => row.name === bodyName);
      expect(body).toBeDefined();
      return parseJson<Record<string, number>>(body!.resource_deposits);
    };

    expect(TURN8_JUDGE_SCENARIO_DELTAS.resources.Mars.deposits).toEqual(
      depositsByBodyName(baseline, 'Mars')
    );
    expect(TURN8_JUDGE_SCENARIO_DELTAS.resources.Mars.deposits).toEqual(
      depositsByBodyName(seed, 'Mars')
    );
    expect(TURN8_JUDGE_SCENARIO_DELTAS.resources.Mars.pressure).toEqual({
      city: 'Pavonis Hub',
      supply_status: turn8Pavonis.supply_status,
      garrison_strength: turn8Pavonis.garrison_strength,
    });
    expect(TURN8_JUDGE_SCENARIO_DELTAS.resources.Callisto.deposits).toEqual(
      depositsByBodyName(seed, 'Callisto')
    );
    expect(TURN8_JUDGE_SCENARIO_DELTAS.resources.Callisto.opportunity).toEqual({
      city: 'Callisto Outpost',
      development_stage: callistoOutpost.development_stage,
    });
  });

  it('has a colony ship in transit (departed < 8, arrives > 8)', () => {
    const seed = buildTurn8Seed();

    expect(seed.colony_ships.length).toBeGreaterThan(0);
    const inTransit = seed.colony_ships.find((s) => s.status === 'in_transit');
    expect(inTransit).toBeDefined();
    expect(inTransit!.departed_turn).toBeLessThan(8);
    expect(inTransit!.arrives_turn).toBeGreaterThan(8);
  });

  it('faction doctrine_vector has slot metadata supporting resume via joinOrResumeSession', () => {
    const seed = buildTurn8Seed();
    const [factionA, factionB] = seed.factions;
    const session = seed.game_sessions[0];

    const slotA = JSON.parse(factionA.doctrine_vector).slot;
    const slotB = JSON.parse(factionB.doctrine_vector).slot;

    expect(slotA).toMatchObject({ slot_key: 'player_a', claim_status: 'claimable' });
    expect(slotB).toMatchObject({ slot_key: 'player_b', claim_status: 'claimable' });
    expect(slotA.placeholder_player_id).toBe(factionA.player_id.toHexString());
    expect(slotB.placeholder_player_id).toBe(factionB.player_id.toHexString());

    const judge = Identity.fromString('a'.padStart(64, '0'));
    const factions = [...seed.factions];
    const sessions = [...seed.game_sessions];

    const ctx = {
      sender: judge,
      timestamp: new Timestamp(0n),
      db: {
        game_sessions: {
          id: {
            find: (id: number) => sessions.find((s) => s.id === id) ?? null,
            update: (row: typeof sessions[0]) => {
              const idx = sessions.findIndex((s) => s.id === row.id);
              sessions[idx] = row;
              return row;
            },
          },
        },
        factions: {
          id: {
            find: (id: number) => factions.find((f) => f.id === id) ?? null,
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

    const resumed = joinOrResumeSession(ctx, {
      session_id: session.id,
      player_slot: 'player_a',
    });

    expect(resumed.is_resume).toBe(true);
    expect(resumed.session_id).toBe(session.id);
    expect(resumed.current_turn).toBe(8);
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
    expect(canonicalSeed(turn8Seed)).toEqual(canonicalSeed(buildTurn8Seed()));
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
