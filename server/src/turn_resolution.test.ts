import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Identity, Timestamp } from 'spacetimedb';
import { describe, expect, it } from 'vitest';

import type { FactionRow, GameSessionRow } from './session_lifecycle.js';
import {
  ackResolutionReducer,
  checkVictoryReducer,
  simulateTurnReducer,
  type TurnResolutionContext,
} from './turn_resolution.js';
import { buildTurn1Seed } from './turn1_seed.js';
import type { EventRow, ProposalRow, TurnSummaryRow } from './turn1_seed.js';

const timestamp = new Timestamp(30n);
const srcPath = (file: string) => resolve(import.meta.dirname, file);
const outsiderIdentity = Identity.fromString('e'.repeat(64));

function makeRows(phase: 'resolution' | 'summary' = 'resolution') {
  const seed = buildTurn1Seed();
  const sessions: GameSessionRow[] = seed.game_sessions.map((session) => ({
    ...session,
    turn_phase: phase,
  }));
  const factions: FactionRow[] = seed.factions.map((faction) => ({
    ...faction,
    ready_for_turn: true,
  }));
  const proposals: ProposalRow[] = seed.proposals.map((proposal) => ({
    ...proposal,
  }));
  const events: EventRow[] = seed.events.map((event) => ({ ...event }));
  const turnSummaries: TurnSummaryRow[] = [];

  if (phase === 'resolution') {
    events.push(simulationTriggeredEvent(sessions[0]));
  }

  return {
    events,
    factions,
    proposals,
    sessions,
    turnSummaries,
  };
}

function makeCtx(
  sender: Identity,
  rows: ReturnType<typeof makeRows>
): TurnResolutionContext {
  return {
    sender,
    timestamp,
    db: {
      game_sessions: {
        id: {
          find: id => rows.sessions.find(session => session.id === id) ?? null,
          update: row => {
            const idx = rows.sessions.findIndex(session => session.id === row.id);
            if (idx === -1) throw new Error(`session ${row.id} not found`);
            rows.sessions[idx] = row;
            return row;
          },
        },
      },
      factions: {
        id: {
          find: id => rows.factions.find(faction => faction.id === id) ?? null,
          update: row => {
            const idx = rows.factions.findIndex(faction => faction.id === row.id);
            if (idx === -1) throw new Error(`faction ${row.id} not found`);
            rows.factions[idx] = row;
            return row;
          },
        },
      },
      proposals: {
        iter: () => rows.proposals.values(),
      },
      events: {
        iter: () => rows.events.values(),
        insert: row => {
          const inserted = { ...row, id: rows.events.length + 1 };
          rows.events.push(inserted);
          return inserted;
        },
      },
      turn_summaries: {
        iter: () => rows.turnSummaries.values(),
        insert: row => {
          const inserted = { ...row, id: rows.turnSummaries.length + 1 };
          rows.turnSummaries.push(inserted);
          return inserted;
        },
        id: {
          update: row => {
            const idx = rows.turnSummaries.findIndex(summary => summary.id === row.id);
            if (idx === -1) throw new Error(`summary ${row.id} not found`);
            rows.turnSummaries[idx] = row;
            return row;
          },
        },
      },
    },
  };
}

function simulationTriggeredEvent(session: GameSessionRow): EventRow {
  return {
    id: 100,
    session_id: session.id,
    faction_id: undefined,
    turn: session.current_turn,
    event_type: 'simulation_triggered',
    payload: JSON.stringify({
      phase: 'resolution',
      session_id: session.id,
      trigger: 'both_factions_ready',
      turn: session.current_turn,
    }),
  };
}

function worldAdvancedEvent(
  session: GameSessionRow,
  payload: Record<string, unknown> = simulationOutputPayload(session)
): EventRow {
  return {
    id: 101,
    session_id: session.id,
    faction_id: undefined,
    turn: session.current_turn,
    event_type: 'world_advanced',
    payload: JSON.stringify(payload),
  };
}

function simulationOutputPayload(session: GameSessionRow): Record<string, unknown> {
  return {
    arrived_ship_count: 1,
    completed_project_count: 0,
    contested_body_ids: [2],
    control_scores: {
      1: { after: 108, before: 105, delta: 3 },
      2: { after: 92, before: 95, delta: -3 },
    },
    credit_income: { 1: 120, 2: 90 },
    fleet_strength_changes: {
      1: { after: 480, before: 500, delta: -20 },
    },
    session_id: session.id,
    travel_progress: {
      1: {
        destination_body_id: 3,
        distance: 2.5,
        elapsed_turns: 1,
        origin_body_id: 1,
        progress_pct: 50,
        status: 'in_transit',
        total_turns: 2,
      },
    },
    turn: session.current_turn,
  };
}

const eventsOfType = (rows: ReturnType<typeof makeRows>, eventType: string) =>
  rows.events.filter(event => event.event_type === eventType);

describe('simulate_turn reducer', () => {
  it('creates per-faction summaries, checks victory, and moves to summary phase', () => {
    const rows = makeRows();
    const session = rows.sessions[0];

    simulateTurnReducer(makeCtx(rows.factions[0].player_id, rows), {
      session_id: session.id,
    });

    expect(rows.sessions[0]).toMatchObject({
      id: session.id,
      turn_phase: 'summary',
      current_turn: session.current_turn,
      current_year: session.current_year,
      winner_faction_id: undefined,
    });
    expect(rows.turnSummaries).toHaveLength(2);
    expect(rows.turnSummaries.every(summary => summary.acknowledged === false)).toBe(true);
    expect(rows.turnSummaries.map(summary => summary.faction_id)).toEqual([1, 2]);
    expect(JSON.parse(rows.turnSummaries[0].summary_json)).toMatchObject({
      event: 'turn_summary',
      faction_id: 1,
      phase: 'summary',
      session_id: session.id,
      simulation_trigger: 'both_factions_ready',
      turn: session.current_turn,
    });
    expect(eventsOfType(rows, 'victory_checked')).toHaveLength(1);
    expect(eventsOfType(rows, 'turn_summary_ready')).toHaveLength(1);
  });

  it('embeds world update outputs in every summary without translating the payload', () => {
    const rows = makeRows();
    const session = rows.sessions[0];
    const output = simulationOutputPayload(session);
    rows.events.push(worldAdvancedEvent(session, output));

    simulateTurnReducer(makeCtx(rows.factions[0].player_id, rows), {
      session_id: session.id,
    });

    const payloads = rows.turnSummaries.map(summary => JSON.parse(summary.summary_json));
    expect(payloads).toHaveLength(2);
    expect(payloads.every(payload => payload.simulation_outputs !== undefined)).toBe(true);
    expect(payloads.map(payload => payload.simulation_outputs)).toEqual([output, output]);
  });

  it('keeps summary JSON identical across repeated seeded runs with the same simulation outputs', () => {
    const run = () => {
      const rows = makeRows();
      const session = rows.sessions[0];
      rows.events.push(worldAdvancedEvent(session));

      simulateTurnReducer(makeCtx(rows.factions[0].player_id, rows), {
        session_id: session.id,
      });

      return rows.turnSummaries.map(summary => summary.summary_json);
    };

    expect(run()).toEqual(run());
  });

  it('rejects out-of-bounds simulation output before summaries are inserted', () => {
    const rows = makeRows();
    const session = rows.sessions[0];
    rows.events.push(worldAdvancedEvent(session, {
      ...simulationOutputPayload(session),
      control_scores: {
        1: { after: 250, before: 105, delta: 145 },
      },
    }));

    expect(() =>
      simulateTurnReducer(makeCtx(rows.factions[0].player_id, rows), {
        session_id: session.id,
      })
    ).toThrow(/control score.*out of bounds/);
    expect(rows.turnSummaries).toHaveLength(0);
  });

  it('rejects missing triggers, wrong phases, and duplicate summary creation', () => {
    const rows = makeRows();
    const session = rows.sessions[0];

    rows.events = rows.events.filter(event => event.event_type !== 'simulation_triggered');
    expect(() =>
      simulateTurnReducer(makeCtx(rows.factions[0].player_id, rows), {
        session_id: session.id,
      })
    ).toThrow(/simulation trigger missing/);

    rows.events.push(simulationTriggeredEvent(session));
    rows.sessions[0] = { ...rows.sessions[0], turn_phase: 'decision' };
    expect(() =>
      simulateTurnReducer(makeCtx(rows.factions[0].player_id, rows), {
        session_id: session.id,
      })
    ).toThrow(/must be in resolution phase/);

    rows.sessions[0] = { ...rows.sessions[0], turn_phase: 'resolution' };
    rows.turnSummaries.push({
      id: 1,
      session_id: session.id,
      faction_id: rows.factions[0].id,
      turn: session.current_turn,
      summary_json: '{}',
      acknowledged: false,
      acknowledged_at: undefined,
      created_at: timestamp,
      updated_at: timestamp,
    });
    expect(() =>
      simulateTurnReducer(makeCtx(rows.factions[0].player_id, rows), {
        session_id: session.id,
      })
    ).toThrow(/summaries already exist/);
  });
});

describe('ack_resolution reducer', () => {
  function summaryRows() {
    const rows = makeRows();
    simulateTurnReducer(makeCtx(rows.factions[0].player_id, rows), {
      session_id: rows.sessions[0].id,
    });
    return rows;
  }

  it('acknowledges one faction summary without advancing until both have acked', () => {
    const rows = summaryRows();
    const faction = rows.factions[0];

    ackResolutionReducer(makeCtx(faction.player_id, rows), {
      faction_id: faction.id,
    });

    expect(rows.turnSummaries[0]).toMatchObject({
      faction_id: faction.id,
      acknowledged: true,
      acknowledged_at: timestamp,
    });
    expect(rows.sessions[0].turn_phase).toBe('summary');
    expect(eventsOfType(rows, 'resolution_acknowledged')).toHaveLength(1);
  });

  it('advances to the next world update after both factions acknowledge', () => {
    const rows = summaryRows();

    ackResolutionReducer(makeCtx(rows.factions[0].player_id, rows), {
      faction_id: rows.factions[0].id,
    });
    ackResolutionReducer(makeCtx(rows.factions[1].player_id, rows), {
      faction_id: rows.factions[1].id,
    });

    expect(rows.sessions[0]).toMatchObject({
      turn_phase: 'world_update',
      current_turn: 2,
      current_year: 2151,
      winner_faction_id: undefined,
    });
    expect(rows.factions.every(faction => faction.ready_for_turn === false)).toBe(true);
    expect(eventsOfType(rows, 'turn_acknowledged')).toHaveLength(1);
  });

  it('rejects non-owners and duplicate acknowledgements', () => {
    const rows = summaryRows();
    const faction = rows.factions[0];

    expect(() =>
      ackResolutionReducer(makeCtx(outsiderIdentity, rows), {
        faction_id: faction.id,
      })
    ).toThrow(/does not own faction/);

    ackResolutionReducer(makeCtx(faction.player_id, rows), {
      faction_id: faction.id,
    });
    expect(() =>
      ackResolutionReducer(makeCtx(faction.player_id, rows), {
        faction_id: faction.id,
      })
    ).toThrow(/already acknowledged/);
  });
});

describe('check_victory reducer', () => {
  it('ends the session at the turn limit with the leading faction as winner', () => {
    const rows = makeRows('summary');
    rows.sessions[0] = { ...rows.sessions[0], current_turn: 30 };
    rows.factions[0] = { ...rows.factions[0], control_score: 135 };
    rows.factions[1] = { ...rows.factions[1], control_score: 125 };

    checkVictoryReducer(makeCtx(rows.factions[0].player_id, rows), {
      session_id: rows.sessions[0].id,
    });

    expect(rows.sessions[0]).toMatchObject({
      state: 'completed',
      turn_phase: 'complete',
      winner_faction_id: rows.factions[0].id,
    });
    expect(JSON.parse(eventsOfType(rows, 'victory_checked')[0].payload)).toMatchObject({
      reason: 'turn_limit',
      result: 'winner',
      winner_faction_id: rows.factions[0].id,
    });
  });

  it('ends after three consecutive dominance turns', () => {
    const rows = makeRows('summary');
    rows.sessions[0] = { ...rows.sessions[0], current_turn: 12 };
    rows.factions[0] = { ...rows.factions[0], control_score: 150 };
    rows.factions[1] = { ...rows.factions[1], control_score: 110 };
    rows.events.push({
      id: 200,
      session_id: rows.sessions[0].id,
      faction_id: rows.factions[0].id,
      turn: 10,
      event_type: 'victory_checked',
      payload: JSON.stringify({ dominant_faction_id: rows.factions[0].id }),
    });
    rows.events.push({
      id: 201,
      session_id: rows.sessions[0].id,
      faction_id: rows.factions[0].id,
      turn: 11,
      event_type: 'victory_checked',
      payload: JSON.stringify({ dominant_faction_id: rows.factions[0].id }),
    });

    checkVictoryReducer(makeCtx(rows.factions[0].player_id, rows), {
      session_id: rows.sessions[0].id,
    });

    expect(rows.sessions[0]).toMatchObject({
      state: 'completed',
      turn_phase: 'complete',
      winner_faction_id: rows.factions[0].id,
    });
    expect(JSON.parse(eventsOfType(rows, 'victory_checked').at(-1)!.payload)).toMatchObject({
      dominance_turns: 3,
      reason: 'three_turn_dominance',
      winner_faction_id: rows.factions[0].id,
    });
  });

  it('registers summary, acknowledgement, and victory reducers in index.ts', () => {
    const src = readFileSync(srcPath('index.ts'), 'utf8');
    expect(src).toMatch(/export\s+const\s+simulate_turn\s*=/);
    expect(src).toMatch(/export\s+const\s+ack_resolution\s*=/);
    expect(src).toMatch(/export\s+const\s+check_victory\s*=/);
  });
});
