import { Timestamp } from 'spacetimedb';
import { describe, expect, it } from 'vitest';

import type { FactionRow, GameSessionRow } from './session_lifecycle.js';
import { ACTIVE_SESSION_STATE } from './session_lifecycle.js';
import {
  runWorldUpdate,
  type WorldUpdateContext,
  type WorldUpdateSnapshot,
} from './simulation_kernel.js';
import type { CityRow, ColonyShipRow, EventRow, ProjectRow, ProposalRow } from './turn1_seed.js';
import { buildTurn1Seed } from './turn1_seed.js';

const timestamp = new Timestamp(100n);

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<GameSessionRow> = {}): GameSessionRow {
  return {
    id: 1,
    state: ACTIVE_SESSION_STATE,
    current_year: 2150,
    current_turn: 1,
    player_a_faction_id: 1,
    player_b_faction_id: 2,
    turn_phase: 'world_update',
    turn_deadline: undefined,
    winner_faction_id: undefined,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

function makeFaction(id: number, credits = 1000): FactionRow {
  return {
    id,
    session_id: 1,
    player_id: { toHexString: () => id.toString().padStart(64, '0') } as any,
    name: `Faction ${id}`,
    credits,
    political_capital: 50,
    doctrine_vector: '{}',
    control_score: 100,
    ready_for_turn: false,
  };
}

function makeCity(id: number, factionId: number, industrialOutput: number): CityRow {
  return {
    id,
    session_id: 1,
    body_id: id,
    faction_id: factionId,
    name: `City ${id}`,
    population: 1_000_000n,
    infrastructure_level: 3,
    morale: 70,
    industrial_output: industrialOutput,
    research_output: 50,
    garrison_strength: 200,
    supply_status: 'stable',
    development_stage: 'full',
  };
}

function makeColonyShip(
  id: number,
  factionId: number,
  arrivesTurn: number,
  status = 'in_transit'
): ColonyShipRow {
  return {
    id,
    faction_id: factionId,
    origin_city_id: 1,
    destination_body_id: id + 10,
    manifest: '{}',
    departed_turn: 1,
    arrives_turn: arrivesTurn,
    status,
  };
}

function makeProject(
  id: number,
  factionId: number,
  progress: number,
  resourcesAssigned: number,
  status = 'in_progress'
): ProjectRow {
  return {
    id,
    faction_id: factionId,
    city_id: 1,
    type: 'industry',
    name: `Project ${id}`,
    progress,
    resources_assigned: resourcesAssigned,
    est_completion: 5,
    status,
  };
}

function makeCtx(
  factions: FactionRow[],
  cities: CityRow[],
  colonyShips: ColonyShipRow[],
  projects: ProjectRow[]
): WorldUpdateContext & { events: EventRow[] } {
  const events: EventRow[] = [];
  const factionMap = new Map(factions.map(f => [f.id, { ...f }]));
  const shipMap = new Map(colonyShips.map(s => [s.id, { ...s }]));
  const projectMap = new Map(projects.map(p => [p.id, { ...p }]));

  return {
    timestamp,
    events,
    db: {
      game_sessions: {
        id: {
          find: () => null,
          update: (row: GameSessionRow) => row,
        },
      },
      factions: {
        id: {
          find: (id: number) => factionMap.get(id) ?? null,
          update: (row: FactionRow) => {
            factionMap.set(row.id, { ...row });
            return row;
          },
        },
      },
      cities: {
        iter: () => cities.values(),
        id: { update: (row: CityRow) => row },
      },
      colony_ships: {
        iter: () => colonyShips.values(),
        id: {
          update: (row: ColonyShipRow) => {
            shipMap.set(row.id, { ...row });
            colonyShips[colonyShips.findIndex(s => s.id === row.id)] = { ...row };
            return row;
          },
        },
      },
      projects: {
        iter: () => projects.values(),
        id: {
          update: (row: ProjectRow) => {
            projectMap.set(row.id, { ...row });
            projects[projects.findIndex(p => p.id === row.id)] = { ...row };
            return row;
          },
        },
      },
      proposals: { iter: () => ([] as ProposalRow[]).values() },
      events: {
        insert: (row: EventRow) => {
          const inserted = { ...row, id: events.length + 1 };
          events.push(inserted);
          return inserted;
        },
      },
    },
    getFaction: (id: number) => factionMap.get(id),
  } as any;
}

// Helper to read updated faction credits after runWorldUpdate
function getFactionCredits(
  ctx: ReturnType<typeof makeCtx>,
  factionId: number
): number {
  return (ctx as any).db.factions.id.find(factionId)?.credits ?? 0;
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('simulation_kernel: city income', () => {
  it('adds industrial_output of each city to owning faction credits', () => {
    const factions = [makeFaction(1, 500), makeFaction(2, 500)];
    const cities = [
      makeCity(1, 1, 220),
      makeCity(2, 1, 145),
      makeCity(3, 2, 180),
    ];
    const ctx = makeCtx(factions, cities, [], []);
    const session = makeSession();

    runWorldUpdate(ctx, session);

    expect(getFactionCredits(ctx, 1)).toBe(500 + 220 + 145);
    expect(getFactionCredits(ctx, 2)).toBe(500 + 180);
  });

  it('ignores cities with zero or negative industrial_output', () => {
    const factions = [makeFaction(1, 1000), makeFaction(2, 1000)];
    const cities = [makeCity(1, 1, 0), makeCity(2, 1, -50), makeCity(3, 2, 100)];
    const ctx = makeCtx(factions, cities, [], []);

    runWorldUpdate(ctx, makeSession());

    expect(getFactionCredits(ctx, 1)).toBe(1000);
    expect(getFactionCredits(ctx, 2)).toBe(1100);
  });

  it('ignores cities belonging to factions outside the session', () => {
    const factions = [makeFaction(1, 500), makeFaction(2, 500)];
    const outsiderCity = makeCity(9, 99, 9999);
    const ctx = makeCtx(factions, [outsiderCity], [], []);

    runWorldUpdate(ctx, makeSession());

    expect(getFactionCredits(ctx, 1)).toBe(500);
    expect(getFactionCredits(ctx, 2)).toBe(500);
  });

  it('produces identical credit totals regardless of city iteration order', () => {
    const factions = [makeFaction(1, 0), makeFaction(2, 0)];
    const citiesForward = [makeCity(1, 1, 100), makeCity(2, 1, 200), makeCity(3, 2, 150)];
    const citiesReverse = [...citiesForward].reverse();

    const ctxA = makeCtx([makeFaction(1, 0), makeFaction(2, 0)], citiesForward, [], []);
    const ctxB = makeCtx([makeFaction(1, 0), makeFaction(2, 0)], citiesReverse, [], []);

    runWorldUpdate(ctxA, makeSession());
    runWorldUpdate(ctxB, makeSession());

    expect(getFactionCredits(ctxA, 1)).toBe(getFactionCredits(ctxB, 1));
    expect(getFactionCredits(ctxA, 2)).toBe(getFactionCredits(ctxB, 2));
  });
});

describe('simulation_kernel: colony ship arrivals', () => {
  it('marks in_transit ships arriving on or before current_turn as arrived', () => {
    const factions = [makeFaction(1, 500), makeFaction(2, 500)];
    const ships = [
      makeColonyShip(1, 1, 1),
      makeColonyShip(2, 2, 1),
    ];
    const ctx = makeCtx(factions, [], ships, []);

    const snap = runWorldUpdate(ctx, makeSession({ current_turn: 1 }));

    expect(ships[0].status).toBe('arrived');
    expect(ships[1].status).toBe('arrived');
    expect(snap.arrived_ship_ids).toEqual([1, 2]);
  });

  it('does not mark ships that arrive in a future turn', () => {
    const factions = [makeFaction(1, 500), makeFaction(2, 500)];
    const ships = [makeColonyShip(1, 1, 5)];
    const ctx = makeCtx(factions, [], ships, []);

    const snap = runWorldUpdate(ctx, makeSession({ current_turn: 1 }));

    expect(ships[0].status).toBe('in_transit');
    expect(snap.arrived_ship_ids).toEqual([]);
  });

  it('skips ships already arrived or with other statuses', () => {
    const factions = [makeFaction(1, 500), makeFaction(2, 500)];
    const ships = [
      makeColonyShip(1, 1, 1, 'arrived'),
      makeColonyShip(2, 1, 1, 'lost'),
    ];
    const ctx = makeCtx(factions, [], ships, []);

    const snap = runWorldUpdate(ctx, makeSession({ current_turn: 1 }));

    expect(snap.arrived_ship_ids).toEqual([]);
  });

  it('arrived ship ids are returned sorted by id regardless of insertion order', () => {
    const factions = [makeFaction(1, 500), makeFaction(2, 500)];
    const ships = [makeColonyShip(3, 1, 1), makeColonyShip(1, 1, 1), makeColonyShip(2, 2, 1)];
    const ctx = makeCtx(factions, [], ships, []);

    const snap = runWorldUpdate(ctx, makeSession({ current_turn: 1 }));

    expect(snap.arrived_ship_ids).toEqual([1, 2, 3]);
  });
});

describe('simulation_kernel: project advancement', () => {
  it('advances in_progress project progress by resources_assigned', () => {
    const factions = [makeFaction(1, 500), makeFaction(2, 500)];
    const projects = [makeProject(1, 1, 10, 25), makeProject(2, 2, 0, 30)];
    const ctx = makeCtx(factions, [], [], projects);

    runWorldUpdate(ctx, makeSession());

    expect(projects[0].progress).toBe(35);
    expect(projects[0].status).toBe('in_progress');
    expect(projects[1].progress).toBe(30);
  });

  it('marks project complete when progress reaches 100', () => {
    const factions = [makeFaction(1, 500), makeFaction(2, 500)];
    const projects = [makeProject(1, 1, 80, 30)];
    const ctx = makeCtx(factions, [], [], projects);

    const snap = runWorldUpdate(ctx, makeSession());

    expect(projects[0].progress).toBe(100);
    expect(projects[0].status).toBe('complete');
    expect(snap.completed_project_ids).toEqual([1]);
  });

  it('caps project progress at 100', () => {
    const factions = [makeFaction(1, 500), makeFaction(2, 500)];
    const projects = [makeProject(1, 1, 90, 50)];
    const ctx = makeCtx(factions, [], [], projects);

    runWorldUpdate(ctx, makeSession());

    expect(projects[0].progress).toBe(100);
  });

  it('skips projects with status other than in_progress', () => {
    const factions = [makeFaction(1, 500), makeFaction(2, 500)];
    const projects = [
      makeProject(1, 1, 0, 50, 'proposed'),
      makeProject(2, 1, 50, 50, 'complete'),
    ];
    const ctx = makeCtx(factions, [], [], projects);

    const snap = runWorldUpdate(ctx, makeSession());

    expect(projects[0].progress).toBe(0);
    expect(projects[1].progress).toBe(50);
    expect(snap.completed_project_ids).toEqual([]);
  });

  it('completed project ids are sorted by id', () => {
    const factions = [makeFaction(1, 500), makeFaction(2, 500)];
    const projects = [makeProject(3, 1, 90, 20), makeProject(1, 2, 80, 30), makeProject(2, 1, 95, 10)];
    const ctx = makeCtx(factions, [], [], projects);

    const snap = runWorldUpdate(ctx, makeSession());

    expect(snap.completed_project_ids).toEqual([1, 2, 3]);
  });
});

describe('simulation_kernel: world_advanced event', () => {
  it('inserts a world_advanced event for the session turn', () => {
    const factions = [makeFaction(1, 500), makeFaction(2, 500)];
    const ctx = makeCtx(factions, [], [], []);

    runWorldUpdate(ctx, makeSession({ current_turn: 3 }));

    const event = (ctx as any).events.find((e: EventRow) => e.event_type === 'world_advanced');
    expect(event).toBeDefined();
    const payload = JSON.parse(event.payload);
    expect(payload.session_id).toBe(1);
    expect(payload.turn).toBe(3);
  });

  it('event payload keys are sorted stably for determinism', () => {
    const factions = [makeFaction(1, 500), makeFaction(2, 500)];
    const ctx = makeCtx(factions, [], [], []);

    runWorldUpdate(ctx, makeSession());

    const event = (ctx as any).events.find((e: EventRow) => e.event_type === 'world_advanced');
    const keys = Object.keys(JSON.parse(event.payload));
    expect(keys).toEqual([...keys].sort());
  });

  it('identical inputs produce identical event payloads', () => {
    const makeSetup = () => {
      const factions = [makeFaction(1, 500), makeFaction(2, 500)];
      const cities = [makeCity(1, 1, 100), makeCity(2, 2, 80)];
      const ships = [makeColonyShip(1, 1, 1)];
      return makeCtx(factions, cities, ships, []);
    };

    const ctxA = makeSetup();
    const ctxB = makeSetup();
    const session = makeSession({ current_turn: 1 });

    runWorldUpdate(ctxA, session);
    runWorldUpdate(ctxB, session);

    const eventA = (ctxA as any).events.find((e: EventRow) => e.event_type === 'world_advanced');
    const eventB = (ctxB as any).events.find((e: EventRow) => e.event_type === 'world_advanced');
    expect(eventA.payload).toBe(eventB.payload);
  });
});

describe('simulation_kernel: execution ordering', () => {
  it('applies city income before colony arrivals and projects in snapshot', () => {
    const factions = [makeFaction(1, 0), makeFaction(2, 0)];
    const cities = [makeCity(1, 1, 300), makeCity(2, 2, 200)];
    const ships = [makeColonyShip(1, 1, 1)];
    const projects = [makeProject(1, 1, 90, 15)];
    const ctx = makeCtx(factions, cities, ships, projects);

    const snap = runWorldUpdate(ctx, makeSession({ current_turn: 1 }));

    // City income applied
    expect(getFactionCredits(ctx, 1)).toBe(300);
    expect(getFactionCredits(ctx, 2)).toBe(200);
    // Colony ship arrived
    expect(snap.arrived_ship_ids).toEqual([1]);
    // Project completed
    expect(snap.completed_project_ids).toEqual([1]);
  });

  it('throws if session has no faction ids', () => {
    const ctx = makeCtx([], [], [], []);
    const session = makeSession({ player_a_faction_id: undefined, player_b_faction_id: undefined });

    expect(() => runWorldUpdate(ctx, session)).toThrow(/not fully initialized/);
  });

  it('uses turn1 seed data and produces deterministic results', () => {
    const seed = buildTurn1Seed();
    const factions: FactionRow[] = seed.factions.map(f => ({ ...f }));
    const factionMapA = new Map(factions.map(f => [f.id, { ...f }]));
    const factionMapB = new Map(factions.map(f => [f.id, { ...f }]));

    const makeCtxFromSeed = (factionMap: Map<number, FactionRow>) => ({
      timestamp,
      db: {
        game_sessions: { id: { find: () => null, update: (r: any) => r } },
        factions: {
          id: {
            find: (id: number) => factionMap.get(id) ?? null,
            update: (row: FactionRow) => { factionMap.set(row.id, { ...row }); return row; },
          },
        },
        cities: { iter: () => seed.cities.values(), id: { update: (r: any) => r } },
        colony_ships: { iter: () => [].values(), id: { update: (r: any) => r } },
        projects: { iter: () => [].values(), id: { update: (r: any) => r } },
        proposals: { iter: () => [].values() },
        events: { insert: (r: any) => ({ ...r, id: 1 }) },
      },
    } as WorldUpdateContext);

    const snapA = runWorldUpdate(makeCtxFromSeed(factionMapA), seed.game_sessions[0]);
    const snapB = runWorldUpdate(makeCtxFromSeed(factionMapB), seed.game_sessions[0]);

    expect(snapA).toEqual(snapB);
    expect(factionMapA.get(1)?.credits).toBe(factionMapB.get(1)?.credits);
    expect(factionMapA.get(2)?.credits).toBe(factionMapB.get(2)?.credits);
  });
});
