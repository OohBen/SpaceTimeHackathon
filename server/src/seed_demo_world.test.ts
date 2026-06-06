import { Timestamp, type Identity } from 'spacetimedb';
import { describe, expect, it } from 'vitest';

import { seedDemoWorldReducer, type SeedDemoWorldContext } from './seed_demo_world.js';
import { runDeliberationReducer, type DecisionReducerContext } from './turn_decisions.js';

interface RowWithId {
  id: number;
}

function makeTable<T extends RowWithId>(rows: T[]) {
  return {
    iter: () => rows.values(),
    insert: (row: T): T => {
      const nextId = rows.reduce((max, existing) => Math.max(max, existing.id), 0) + 1;
      const inserted = { ...row, id: row.id === 0 ? nextId : row.id };
      rows.push(inserted);
      return inserted;
    },
    id: {
      find: (id: number) => rows.find((row) => row.id === id) ?? null,
      update: (row: T): T => {
        const idx = rows.findIndex((existing) => existing.id === row.id);
        if (idx === -1) throw new Error(`row ${row.id} not found`);
        rows[idx] = row;
        return row;
      },
    },
  };
}

const ts = new Timestamp(10n);
const identityA = { toHexString: () => 'aaaaaaaa' } as unknown as Identity;
const identityB = { toHexString: () => 'bbbbbbbb' } as unknown as Identity;

function makeRows() {
  const game_sessions = [
    {
      id: 42,
      state: 'active',
      current_year: 2150,
      current_turn: 1,
      player_a_faction_id: 101,
      player_b_faction_id: 202,
      turn_phase: 'deliberation',
      turn_deadline: undefined as Timestamp | undefined,
      winner_faction_id: undefined as number | undefined,
      created_at: ts,
      updated_at: ts,
    },
  ];
  const factions = [
    {
      id: 101,
      session_id: 42,
      player_id: identityA,
      name: 'Sol Vanguard',
      credits: 1200,
      political_capital: 50,
      doctrine_vector: '{}',
      control_score: 100,
      ready_for_turn: false,
    },
    {
      id: 202,
      session_id: 42,
      player_id: identityB,
      name: 'Belt Compact',
      credits: 1200,
      political_capital: 50,
      doctrine_vector: '{}',
      control_score: 100,
      ready_for_turn: false,
    },
  ];

  return {
    game_sessions,
    factions,
    celestial_bodies: [] as any[],
    cities: [] as any[],
    personnel: [] as any[],
    personnel_relationships: [] as any[],
    fleets: [] as any[],
    colony_ships: [] as any[],
    projects: [] as any[],
    intelligence_records: [] as any[],
    proposals: [] as any[],
    llm_requests: [] as any[],
    module_settings: [
      { id: 1, deliberation_mode: 'fallback' },
    ] as any[],
  };
}

function makeCtx(rows: ReturnType<typeof makeRows>): SeedDemoWorldContext {
  return {
    timestamp: ts,
    db: {
      game_sessions: makeTable(rows.game_sessions) as any,
      factions: makeTable(rows.factions) as any,
      celestial_bodies: makeTable(rows.celestial_bodies),
      cities: makeTable(rows.cities),
      personnel: makeTable(rows.personnel),
      personnel_relationships: makeTable(rows.personnel_relationships),
      fleets: makeTable(rows.fleets),
      colony_ships: makeTable(rows.colony_ships),
      projects: makeTable(rows.projects),
      intelligence_records: makeTable(rows.intelligence_records),
    },
  };
}

describe('seedDemoWorldReducer', () => {
  it('rebinds seeded cities/personnel/fleets/projects/intel to the live faction IDs', () => {
    const rows = makeRows();
    seedDemoWorldReducer(makeCtx(rows), { session_id: 42 });

    expect(rows.cities.length).toBeGreaterThan(0);
    expect(rows.personnel.length).toBeGreaterThan(0);
    expect(rows.fleets.length).toBeGreaterThan(0);
    expect(rows.projects.length).toBeGreaterThan(0);
    expect(rows.intelligence_records.length).toBeGreaterThan(0);

    const factionIds = new Set([101, 202]);
    for (const city of rows.cities) {
      expect(factionIds.has(city.faction_id)).toBe(true);
    }
    for (const person of rows.personnel) {
      expect(factionIds.has(person.faction_id)).toBe(true);
    }
    for (const fleet of rows.fleets) {
      expect(factionIds.has(fleet.faction_id)).toBe(true);
    }
    for (const intel of rows.intelligence_records) {
      expect(factionIds.has(intel.observer_faction_id)).toBe(true);
      expect(factionIds.has(intel.target_faction_id)).toBe(true);
    }
  });

  it('throws when the session does not exist', () => {
    const rows = makeRows();
    expect(() => seedDemoWorldReducer(makeCtx(rows), { session_id: 999 }))
      .toThrowError(/session 999 not found/);
  });

  it('throws when the session does not have exactly two factions', () => {
    const rows = makeRows();
    rows.factions.pop();
    expect(() => seedDemoWorldReducer(makeCtx(rows), { session_id: 42 }))
      .toThrowError(/exactly two factions/);
  });

  it('is idempotent: re-seeding a session with cities already present is a no-op', () => {
    const rows = makeRows();
    const ctx = makeCtx(rows);

    seedDemoWorldReducer(ctx, { session_id: 42 });
    const firstCityCount = rows.cities.length;
    const firstPersonnelCount = rows.personnel.length;

    seedDemoWorldReducer(ctx, { session_id: 42 });
    expect(rows.cities.length).toBe(firstCityCount);
    expect(rows.personnel.length).toBe(firstPersonnelCount);
  });

  it('unblocks fallback deliberation: after seeding, run_deliberation generates proposals instead of failing', () => {
    const rows = makeRows();
    const ctx = makeCtx(rows);
    seedDemoWorldReducer(ctx, { session_id: 42 });

    // run_deliberation needs a richer DecisionReducerContext shape (extra
    // tables). Re-build the ctx-equivalent for the decision call.
    const decisionDb = {
      ...ctx.db,
      proposals: makeTable(rows.proposals),
      llm_requests: makeTable(rows.llm_requests),
      module_settings: makeTable(rows.module_settings),
      commander_inbox: makeTable([] as any[]),
    };
    const decisionCtx = {
      sender: identityA,
      timestamp: ts,
      db: decisionDb,
    } as unknown as DecisionReducerContext;

    runDeliberationReducer(decisionCtx, { faction_id: 101 });

    expect(rows.proposals.length).toBeGreaterThan(0);
    expect(
      rows.llm_requests.find((r: any) => r.error_code === 'fallback_unavailable')
    ).toBeUndefined();
  });
});
