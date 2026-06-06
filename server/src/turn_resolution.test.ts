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
