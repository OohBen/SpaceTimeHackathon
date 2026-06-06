import { Timestamp, type Identity } from 'spacetimedb';
import { describe, expect, it } from 'vitest';

import {
  seedDemoTurn8Reducer,
  type SeedDemoWorldContext,
} from './seed_demo_world.js';

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
    module_settings: [] as any[],
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

const parseJson = <T>(value: string): T => JSON.parse(value) as T;

function scenarioDigest(rows: ReturnType<typeof makeRows>) {
  return {
    session: {
      current_turn: rows.game_sessions[0].current_turn,
      current_year: rows.game_sessions[0].current_year,
      turn_phase: rows.game_sessions[0].turn_phase,
    },
    cities: rows.cities
      .map((city) => ({
        name: city.name,
        development_stage: city.development_stage,
        faction_id: city.faction_id,
        supply_status: city.supply_status,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    proposals: rows.proposals
      .map((proposal) => ({
        title: proposal.title,
        body: proposal.body,
        faction_id: proposal.faction_id,
        turn: proposal.turn,
      }))
      .sort((left, right) => left.title.localeCompare(right.title)),
    briefings: rows.commander_inbox
      .map((message) => ({
        subject: message.subject,
        body: message.body,
        narrative: parseJson<{ text: string }>(message.narrative_json).text,
      }))
      .sort((left, right) => left.subject.localeCompare(right.subject)),
    cueLabels: rows.events
      .filter((event) => event.event_type.startsWith('scenario_cue_'))
      .map((event) => parseJson<{ label: string }>(event.payload).label)
      .sort(),
    completedRequestSources: rows.llm_requests
      .filter((request) => request.status === 'completed')
      .map((request) => parseJson<{ source: string }>(request.response_json).source)
      .sort(),
  };
}

describe('issue 139 Turn 8 judge scenario verification', () => {
  it('loads the Turn 8 judge state with visible Mars pressure and Callisto opportunity cues', () => {
    const rows = makeRows();

    seedDemoTurn8Reducer(makeCtx(rows), { session_id: 42 });

    const digest = scenarioDigest(rows);
    expect(digest.session).toEqual({
      current_turn: 8,
      current_year: 2157,
      turn_phase: 'deliberation',
    });
    expect(digest.cueLabels).toEqual([
      'Callisto opportunity: ice and volatiles window',
      'Mars pressure: Pavonis Hub strained supply',
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
  });

  it('keeps the judge story in briefings/proposals and reproduces the same setup on reload', () => {
    const rows = makeRows();
    const ctx = makeCtx(rows);

    seedDemoTurn8Reducer(ctx, { session_id: 42 });
    const first = scenarioDigest(rows);
    const storyText = [
      ...first.proposals.map((proposal) => `${proposal.title}\n${proposal.body}`),
      ...first.briefings.map((briefing) => `${briefing.subject}\n${briefing.body}\n${briefing.narrative}`),
    ].join('\n');

    expect(first.proposals.map((proposal) => proposal.title)).toEqual(
      expect.arrayContaining([
        'Callisto subsurface survey',
        'Pavonis pressure and Callisto push',
      ])
    );
    expect(first.briefings).toHaveLength(4);
    expect(storyText).toMatch(/Mars pressure/i);
    expect(storyText).toMatch(/Pavonis Hub/i);
    expect(storyText).toMatch(/Callisto opportunity/i);
    expect(storyText).toMatch(/ice and volatiles/i);
    expect(first.completedRequestSources).toEqual([
      'deterministic_fixture',
      'deterministic_fixture',
      'deterministic_fixture',
      'deterministic_fixture',
    ]);

    rows.cities.find((city) => city.name === 'Pavonis Hub')!.supply_status = 'broken';
    rows.commander_inbox.push({
      id: 999,
      faction_id: 202,
      turn: 99,
      from_personnel_id: 0,
      subject: 'stale',
      body: 'stale',
      requires_decision: false,
      status: 'unread',
    });

    seedDemoTurn8Reducer(ctx, { session_id: 42 });

    expect(scenarioDigest(rows)).toEqual(first);
  });
});
