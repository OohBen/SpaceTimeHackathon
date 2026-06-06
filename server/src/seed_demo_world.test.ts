import { Timestamp, type Identity } from 'spacetimedb';
import { describe, expect, it } from 'vitest';

import {
  seedDemoTurn8Reducer,
  seedDemoWorldReducer,
  type SeedDemoWorldContext,
} from './seed_demo_world.js';
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
      delete: (id: number): void => {
        const idx = rows.findIndex((existing) => existing.id === id);
        if (idx !== -1) rows.splice(idx, 1);
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
    proposals: [] as any[],
    commander_inbox: [] as any[],
    fleets: [] as any[],
    colony_ships: [] as any[],
    projects: [] as any[],
    intelligence_records: [] as any[],
    events: [] as any[],
    turn_summaries: [] as any[],
    trade_agreements: [] as any[],
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
      proposals: makeTable(rows.proposals),
      commander_inbox: makeTable(rows.commander_inbox),
      fleets: makeTable(rows.fleets),
      colony_ships: makeTable(rows.colony_ships),
      projects: makeTable(rows.projects),
      intelligence_records: makeTable(rows.intelligence_records),
      events: makeTable(rows.events),
      turn_summaries: makeTable(rows.turn_summaries),
      trade_agreements: makeTable(rows.trade_agreements),
      llm_requests: makeTable(rows.llm_requests),
      module_settings: makeTable(rows.module_settings),
    },
  };
}

function scenarioDigest(rows: ReturnType<typeof makeRows>) {
  const sortByName = <T extends { name: string }>(items: T[]) =>
    items.slice().sort((left, right) => left.name.localeCompare(right.name));
  const sortByTitle = <T extends { title: string }>(items: T[]) =>
    items.slice().sort((left, right) => left.title.localeCompare(right.title));

  return {
    session: {
      current_year: rows.game_sessions[0].current_year,
      current_turn: rows.game_sessions[0].current_turn,
      turn_phase: rows.game_sessions[0].turn_phase,
      player_a_faction_id: rows.game_sessions[0].player_a_faction_id,
      player_b_faction_id: rows.game_sessions[0].player_b_faction_id,
    },
    factions: rows.factions
      .map((faction) => ({
        id: faction.id,
        credits: faction.credits,
        political_capital: faction.political_capital,
        control_score: faction.control_score,
        ready_for_turn: faction.ready_for_turn,
      }))
      .sort((left, right) => left.id - right.id),
    bodies: sortByName(rows.celestial_bodies).map((body) => ({
      name: body.name,
      resource_deposits: body.resource_deposits,
    })),
    cities: sortByName(rows.cities).map((city) => ({
      name: city.name,
      faction_id: city.faction_id,
      development_stage: city.development_stage,
      supply_status: city.supply_status,
    })),
    proposals: sortByTitle(rows.proposals).map((proposal) => ({
      title: proposal.title,
      faction_id: proposal.faction_id,
      turn: proposal.turn,
    })),
    inbox: rows.commander_inbox
      .map((message) => ({
        subject: message.subject,
        faction_id: message.faction_id,
        hasNarrative: typeof message.narrative_json === 'string',
      }))
      .sort((left, right) => left.subject.localeCompare(right.subject)),
    cueEvents: rows.events
      .filter((event) => event.event_type.startsWith('scenario_cue_'))
      .map((event) => ({
        event_type: event.event_type,
        label: JSON.parse(event.payload).label,
      }))
      .sort((left, right) => left.event_type.localeCompare(right.event_type)),
    llmRequests: rows.llm_requests
      .map((request) => ({
        faction_id: request.faction_id,
        request_type: request.request_type,
        status: request.status,
      }))
      .sort((left, right) =>
        left.faction_id - right.faction_id ||
        left.request_type.localeCompare(right.request_type)
      ),
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

  it('loads the Turn 8 judge scenario into the supported demo reducer path', () => {
    const rows = makeRows();
    seedDemoTurn8Reducer(makeCtx(rows), { session_id: 42 });

    const digest = scenarioDigest(rows);

    expect(digest.session).toMatchObject({
      current_year: 2157,
      current_turn: 8,
      turn_phase: 'deliberation',
      player_a_faction_id: 101,
      player_b_faction_id: 202,
    });
    expect(digest.factions).toEqual([
      expect.objectContaining({
        id: 101,
        credits: 2400,
        control_score: 140,
        ready_for_turn: false,
      }),
      expect.objectContaining({
        id: 202,
        credits: 1950,
        control_score: 118,
        ready_for_turn: false,
      }),
    ]);
    expect(digest.cities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Pavonis Hub',
          faction_id: 202,
          supply_status: 'strained',
        }),
        expect.objectContaining({
          name: 'Callisto Outpost',
          faction_id: 101,
          development_stage: 'establishment',
        }),
      ])
    );
    expect(digest.proposals.map((proposal) => proposal.title)).toEqual(
      expect.arrayContaining([
        'Callisto subsurface survey',
        'Pavonis pressure and Callisto push',
      ])
    );
    expect(digest.inbox.every((message) => message.hasNarrative)).toBe(true);
    expect(digest.cueEvents.map((event) => event.label)).toEqual([
      'Callisto opportunity: ice and volatiles window',
      'Mars pressure: Pavonis Hub strained supply',
    ]);
    expect(digest.llmRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ faction_id: 101, request_type: 'inbox', status: 'completed' }),
        expect.objectContaining({ faction_id: 202, request_type: 'inbox', status: 'completed' }),
        expect.objectContaining({ faction_id: 101, request_type: 'proposals', status: 'completed' }),
        expect.objectContaining({ faction_id: 202, request_type: 'proposals', status: 'completed' }),
      ])
    );
  });

  it('reloads the Turn 8 scenario reproducibly by replacing stale session rows', () => {
    const rows = makeRows();
    const ctx = makeCtx(rows);

    seedDemoTurn8Reducer(ctx, { session_id: 42 });
    const first = scenarioDigest(rows);

    rows.cities.find((city) => city.name === 'Pavonis Hub')!.supply_status = 'broken';
    rows.proposals.push({
      id: 999,
      faction_id: 101,
      turn: 99,
      proposing_personnel_id: rows.personnel[0].id,
      department: 'Stale',
      title: 'Stale proposal',
      body: 'Should be removed by reload.',
      resource_cost: 1,
      confidence: 'LOW',
      status: 'unread',
      decision: undefined,
    });

    seedDemoTurn8Reducer(ctx, { session_id: 42 });

    expect(scenarioDigest(rows)).toEqual(first);
  });
});
