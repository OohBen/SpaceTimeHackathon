import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Timestamp, type Identity } from 'spacetimedb';
import { describe, expect, it } from 'vitest';

import {
  advanceWorldReducer,
  advanceTurnPhaseReducer,
  type TurnPhaseContext,
} from './session_lifecycle.js';
import {
  commanderDecisionReducer,
  runDeliberationReducer,
  type DecisionReducerContext,
} from './turn_decisions.js';
import {
  expireTurnReducer,
  submitTurnReducer,
  type TurnAdvancementContext,
} from './turn_advancement.js';
import {
  ackResolutionReducer,
  simulateTurnReducer,
  type TurnResolutionContext,
} from './turn_resolution.js';
import type { WorldUpdateContext } from './simulation_kernel.js';
import { buildTurn1Seed, type EventRow, type Turn1SeedRows } from './turn1_seed.js';

const timestamp = new Timestamp(20n);
const futureDeadline = new Timestamp(30n);
const expiredDeadline = new Timestamp(10n);
const srcPath = (file: string) => resolve(import.meta.dirname, file);

type RowWithId = { id: number };
type PipelineRows = ReturnType<typeof makeRows>;
type PipelineReducerContext = {
  sender: Identity;
  timestamp: Timestamp;
  db: ReturnType<typeof makeDb>;
};

function makeRows(
  phase: 'world_update' | 'deliberation' | 'decision' = 'deliberation'
) {
  const seed = buildTurn1Seed();
  return {
    game_sessions: seed.game_sessions.map((session) => ({
      ...session,
      turn_phase: phase,
      turn_deadline: phase === 'decision' ? expiredDeadline : undefined,
    })),
    factions: seed.factions.map((faction) => ({ ...faction, ready_for_turn: false })),
    celestial_bodies: clone(seed.celestial_bodies),
    cities: clone(seed.cities),
    personnel: clone(seed.personnel),
    personnel_relationships: clone(seed.personnel_relationships),
    proposals: clone(seed.proposals),
    commander_inbox: clone(seed.commander_inbox),
    fleets: clone(seed.fleets),
    colony_ships: clone(seed.colony_ships),
    projects: clone(seed.projects),
    intelligence_records: clone(seed.intelligence_records),
    events: clone(seed.events),
    turn_summaries: clone(seed.turn_summaries),
    trade_agreements: clone(seed.trade_agreements),
    llm_requests: [],
  } satisfies Turn1SeedRows;
}

function clone<T extends object>(rows: readonly T[]): T[] {
  return rows.map((row) => ({ ...row }));
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
      find: (id: number) => rows.find(row => row.id === id) ?? null,
      update: (row: T): T => {
        const idx = rows.findIndex(existing => existing.id === row.id);
        if (idx === -1) throw new Error(`row ${row.id} not found`);
        rows[idx] = row;
        return row;
      },
    },
  };
}

function makeDb(rows: PipelineRows) {
  return {
    game_sessions: makeTable(rows.game_sessions),
    factions: makeTable(rows.factions),
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
  };
}

function makePipelineCtx(
  sender: Identity,
  rows: PipelineRows,
  now: Timestamp = timestamp
): PipelineReducerContext {
  return {
    sender,
    timestamp: now,
    db: makeDb(rows),
  };
}

function makeDecisionCtx(sender: Identity, rows: PipelineRows): DecisionReducerContext {
  return makePipelineCtx(sender, rows) as unknown as DecisionReducerContext;
}

function makeAdvancementCtx(
  sender: Identity,
  rows: PipelineRows,
  now: Timestamp = timestamp
): TurnAdvancementContext {
  return makePipelineCtx(sender, rows, now) as unknown as TurnAdvancementContext;
}

function makePhaseCtx(rows: PipelineRows): TurnPhaseContext {
  return makePipelineCtx(rows.factions[0].player_id, rows) as unknown as TurnPhaseContext;
}

function makeWorldCtx(rows: PipelineRows): WorldUpdateContext {
  return makePipelineCtx(rows.factions[0].player_id, rows) as unknown as WorldUpdateContext;
}

function makeResolutionCtx(
  sender: Identity,
  rows: PipelineRows
): TurnResolutionContext {
  return makePipelineCtx(sender, rows) as unknown as TurnResolutionContext;
}

function enterDecision(rows: PipelineRows): void {
  rows.game_sessions[0] = {
    ...rows.game_sessions[0],
    turn_deadline: futureDeadline,
  };
  advanceTurnPhaseReducer(makePhaseCtx(rows), {
    session_id: rows.game_sessions[0].id,
    next_phase: 'decision',
  });
}

function queueDeliberationForBothFactions(rows: PipelineRows): void {
  for (const faction of rows.factions) {
    runDeliberationReducer(makeDecisionCtx(faction.player_id, rows), {
      faction_id: faction.id,
    });
  }
}

function decideFirstOpenProposal(
  rows: PipelineRows,
  factionId: number,
  decision: 'approved' | 'rejected' | 'deferred'
): void {
  const faction = rows.factions.find(row => row.id === factionId);
  if (!faction) throw new Error(`faction ${factionId} not found`);

  const proposal = rows.proposals.find(row =>
    row.faction_id === factionId &&
    row.decision === undefined &&
    ['unread', 'read'].includes(row.status)
  );
  if (!proposal) throw new Error(`open proposal for faction ${factionId} not found`);

  commanderDecisionReducer(makeDecisionCtx(faction.player_id, rows), {
    faction_id: faction.id,
    proposal_id: proposal.id,
    decision,
    allocation: decision === 'approved' ? proposal.resource_cost : 0,
  });
}

function simulationEvents(rows: PipelineRows): EventRow[] {
  return rows.events.filter(event => event.event_type === 'simulation_triggered');
}

function summaryReadyEvents(rows: PipelineRows): EventRow[] {
  return rows.events.filter(event => event.event_type === 'turn_summary_ready');
}

function worldAdvancedEvents(rows: PipelineRows): EventRow[] {
  return rows.events.filter(event => event.event_type === 'world_advanced');
}

function ackEvents(rows: PipelineRows): EventRow[] {
  return rows.events.filter(event => event.event_type === 'resolution_acknowledged');
}

function runSeededWorldUpdateToSummary() {
  const rows = makeRows('world_update');
  const [factionA, factionB] = rows.factions;

  advanceWorldReducer(makeWorldCtx(rows), {
    session_id: rows.game_sessions[0].id,
  });
  queueDeliberationForBothFactions(rows);
  enterDecision(rows);
  decideFirstOpenProposal(rows, factionA.id, 'approved');
  decideFirstOpenProposal(rows, factionB.id, 'rejected');
  submitTurnReducer(makeAdvancementCtx(factionA.player_id, rows), {
    faction_id: factionA.id,
  });
  submitTurnReducer(makeAdvancementCtx(factionB.player_id, rows), {
    faction_id: factionB.id,
  });
  simulateTurnReducer(makeResolutionCtx(factionA.player_id, rows), {
    session_id: rows.game_sessions[0].id,
  });

  return {
    summaryJson: rows.turn_summaries.map(summary => summary.summary_json),
    worldPayload: JSON.parse(worldAdvancedEvents(rows)[0].payload),
  };
}

describe('turn pipeline reducers', () => {
  it('runs deliberation, decisions, both-ready resolution, summary, and acknowledgements', async () => {
    const rows = makeRows('deliberation');
    const [factionA, factionB] = rows.factions;

    queueDeliberationForBothFactions(rows);
    expect(rows.llm_requests).toHaveLength(2);

    enterDecision(rows);
    decideFirstOpenProposal(rows, factionA.id, 'approved');
    decideFirstOpenProposal(rows, factionB.id, 'rejected');

    submitTurnReducer(makeAdvancementCtx(factionA.player_id, rows), {
      faction_id: factionA.id,
    });
    expect(rows.game_sessions[0].turn_phase).toBe('decision');
    expect(simulationEvents(rows)).toHaveLength(0);

    submitTurnReducer(makeAdvancementCtx(factionB.player_id, rows), {
      faction_id: factionB.id,
    });
    expect(rows.game_sessions[0].turn_phase).toBe('resolution');
    expect(simulationEvents(rows)).toHaveLength(1);

    simulateTurnReducer(makeResolutionCtx(factionA.player_id, rows), {
      session_id: rows.game_sessions[0].id,
    });
    expect(rows.game_sessions[0].turn_phase).toBe('summary');
    expect(rows.turn_summaries).toHaveLength(2);
    expect(summaryReadyEvents(rows)).toHaveLength(1);
    expect(JSON.parse(summaryReadyEvents(rows)[0].payload)).toMatchObject({
      session_id: rows.game_sessions[0].id,
      turn: 1,
    });
    expect(
      JSON.parse(rows.turn_summaries.find(row => row.faction_id === factionA.id)!.summary_json)
    ).toMatchObject({
      event: 'turn_summary',
      phase: 'summary',
      proposal_outcomes: { approved: 1 },
      session_id: rows.game_sessions[0].id,
      simulation_trigger: 'both_factions_ready',
      turn: 1,
    });

    ackResolutionReducer(makeResolutionCtx(factionA.player_id, rows), {
      faction_id: factionA.id,
    });
    expect(rows.game_sessions[0].turn_phase).toBe('summary');
    expect(ackEvents(rows)).toHaveLength(1);
    expect(rows.turn_summaries.find(row => row.faction_id === factionA.id)!.acknowledged)
      .toBe(true);

    ackResolutionReducer(makeResolutionCtx(factionB.player_id, rows), {
      faction_id: factionB.id,
    });
    expect(rows.game_sessions[0].turn_phase).toBe('world_update');
    expect(rows.game_sessions[0].current_turn).toBe(2);
    expect(rows.game_sessions[0].current_year).toBe(2151);
    expect(rows.factions.every(faction => !faction.ready_for_turn)).toBe(true);
  });

  it('carries seeded world update outputs into deterministic turn summaries', () => {
    const first = runSeededWorldUpdateToSummary();
    const second = runSeededWorldUpdateToSummary();

    expect(first.worldPayload).toEqual(second.worldPayload);
    expect(first.summaryJson).toEqual(second.summaryJson);
    expect(
      first.summaryJson.map(summary => JSON.parse(summary).simulation_outputs)
    ).toEqual([first.worldPayload, first.worldPayload]);
  });

  it('auto-defers timeout proposals before simulation summary and acknowledgements', async () => {
    const rows = makeRows('decision');
    const [factionA, factionB] = rows.factions;
    const openProposalIds = rows.proposals
      .filter(proposal => ['unread', 'read'].includes(proposal.status))
      .map(proposal => proposal.id);

    expireTurnReducer(makeAdvancementCtx(factionA.player_id, rows), {
      session_id: rows.game_sessions[0].id,
    });

    expect(rows.game_sessions[0].turn_phase).toBe('resolution');
    expect(simulationEvents(rows)).toHaveLength(1);
    expect(
      rows.proposals
        .filter(proposal => openProposalIds.includes(proposal.id))
        .every(proposal => proposal.status === 'auto_deferred')
    ).toBe(true);

    simulateTurnReducer(makeResolutionCtx(factionA.player_id, rows), {
      session_id: rows.game_sessions[0].id,
    });
    expect(rows.game_sessions[0].turn_phase).toBe('summary');
    expect(rows.turn_summaries).toHaveLength(2);
    expect(
      rows.turn_summaries
        .map(summary => JSON.parse(summary.summary_json))
        .every(payload => payload.simulation_trigger === 'deadline_expired')
    ).toBe(true);
    expect(
      rows.turn_summaries
        .map(summary => JSON.parse(summary.summary_json).proposal_outcomes.auto_deferred)
        .reduce((sum, count) => sum + count, 0)
    ).toBe(openProposalIds.length);

    ackResolutionReducer(makeResolutionCtx(factionA.player_id, rows), {
      faction_id: factionA.id,
    });
    ackResolutionReducer(makeResolutionCtx(factionB.player_id, rows), {
      faction_id: factionB.id,
    });

    expect(rows.game_sessions[0].turn_phase).toBe('world_update');
    expect(rows.game_sessions[0].current_turn).toBe(2);
    expect(rows.factions.every(faction => !faction.ready_for_turn)).toBe(true);
  });

  it('registers simulation and acknowledgement reducers in index.ts', () => {
    const src = readFileSync(srcPath('index.ts'), 'utf8');

    expect(src).toMatch(/export\s+const\s+simulate_turn\s*=/);
    expect(src).toMatch(/export\s+const\s+ack_resolution\s*=/);
  });
});
