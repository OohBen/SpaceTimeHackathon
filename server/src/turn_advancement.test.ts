import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Identity, Timestamp } from 'spacetimedb';
import { describe, expect, it } from 'vitest';

import {
  expireTurnReducer,
  submitTurnReducer,
  type TurnAdvancementContext,
} from './turn_advancement.js';
import { buildTurn1Seed } from './turn1_seed.js';
import type { EventRow, ProposalRow } from './turn1_seed.js';
import type { FactionRow, GameSessionRow } from './session_lifecycle.js';

const expiredAt = new Timestamp(10n);
const timestamp = new Timestamp(20n);
const earlyTimestamp = new Timestamp(5n);
const outsiderIdentity = Identity.fromString('f'.repeat(64));
const srcPath = (file: string) => resolve(import.meta.dirname, file);

function makeRows() {
  const seed = buildTurn1Seed();
  const sessions: GameSessionRow[] = seed.game_sessions.map((session) => ({
    ...session,
    turn_phase: 'decision',
    turn_deadline: expiredAt,
  }));
  const factions: FactionRow[] = seed.factions.map((faction) => ({
    ...faction,
    ready_for_turn: false,
  }));
  const proposals: ProposalRow[] = seed.proposals.map((proposal) => ({
    ...proposal,
  }));
  const events: EventRow[] = seed.events.map((event) => ({ ...event }));

  return {
    sessions,
    factions,
    proposals,
    events,
  };
}

function makeCtx(
  sender: Identity,
  rows: ReturnType<typeof makeRows>,
  now: Timestamp = timestamp
): TurnAdvancementContext {
  return {
    sender,
    timestamp: now,
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
        id: {
          update: row => {
            const idx = rows.proposals.findIndex(proposal => proposal.id === row.id);
            if (idx === -1) throw new Error(`proposal ${row.id} not found`);
            rows.proposals[idx] = row;
            return row;
          },
        },
      },
      events: {
        iter: () => rows.events.values(),
        insert: row => {
          const inserted = { ...row, id: rows.events.length + 1 };
          rows.events.push(inserted);
          return inserted;
        },
      },
    },
  };
}

const simulationEvents = (events: EventRow[]) =>
  events.filter(event => event.event_type === 'simulation_triggered');

const openProposals = (proposals: ProposalRow[]) =>
  proposals.filter(proposal => ['unread', 'read'].includes(proposal.status));

describe('submit_turn reducer', () => {
  it('marks the first faction ready without triggering simulation', () => {
    const rows = makeRows();
    const factionA = rows.factions[0];

    submitTurnReducer(makeCtx(factionA.player_id, rows), {
      faction_id: factionA.id,
    });

    expect(rows.factions[0].ready_for_turn).toBe(true);
    expect(rows.factions[1].ready_for_turn).toBe(false);
    expect(rows.sessions[0].turn_phase).toBe('decision');
    expect(simulationEvents(rows.events)).toHaveLength(0);
  });

  it('advances exactly once when both factions are ready', () => {
    const rows = makeRows();
    const [factionA, factionB] = rows.factions;

    submitTurnReducer(makeCtx(factionA.player_id, rows), {
      faction_id: factionA.id,
    });
    submitTurnReducer(makeCtx(factionB.player_id, rows), {
      faction_id: factionB.id,
    });

    expect(rows.factions.every(faction => faction.ready_for_turn)).toBe(true);
    expect(rows.sessions[0].turn_phase).toBe('resolution');
    expect(rows.sessions[0].turn_deadline).toBeUndefined();
    expect(simulationEvents(rows.events)).toHaveLength(1);
    expect(JSON.parse(simulationEvents(rows.events)[0].payload)).toEqual({
      phase: 'resolution',
      session_id: rows.sessions[0].id,
      trigger: 'both_factions_ready',
      turn: rows.sessions[0].current_turn,
    });

    expect(() =>
      submitTurnReducer(makeCtx(factionB.player_id, rows), {
        faction_id: factionB.id,
      })
    ).toThrow(/must be in decision phase/);
    expect(simulationEvents(rows.events)).toHaveLength(1);
  });

  it('rejects non-owners and non-decision phases', () => {
    const rows = makeRows();
    const [factionA, factionB] = rows.factions;

    expect(() =>
      submitTurnReducer(makeCtx(factionB.player_id, rows), {
        faction_id: factionA.id,
      })
    ).toThrow(/does not own faction/);

    rows.sessions[0] = { ...rows.sessions[0], turn_phase: 'deliberation' };
    expect(() =>
      submitTurnReducer(makeCtx(factionA.player_id, rows), {
        faction_id: factionA.id,
      })
    ).toThrow(/must be in decision phase/);
  });

  it('does not duplicate a pre-existing simulation trigger', () => {
    const rows = makeRows();
    const [factionA, factionB] = rows.factions;
    rows.factions[1] = { ...factionB, ready_for_turn: true };
    rows.events.push({
      id: 99,
      session_id: rows.sessions[0].id,
      faction_id: undefined,
      turn: rows.sessions[0].current_turn,
      event_type: 'simulation_triggered',
      payload: '{}',
    });

    expect(() =>
      submitTurnReducer(makeCtx(factionA.player_id, rows), {
        faction_id: factionA.id,
      })
    ).toThrow(/simulation already triggered/);
    expect(rows.factions[0].ready_for_turn).toBe(false);
    expect(simulationEvents(rows.events)).toHaveLength(1);
  });
});

describe('expire_turn reducer', () => {
  it('rejects missing or unexpired deadlines', () => {
    const rows = makeRows();

    expect(() =>
      expireTurnReducer(makeCtx(rows.factions[0].player_id, rows, earlyTimestamp), {
        session_id: rows.sessions[0].id,
      })
    ).toThrow(/deadline has not expired/);

    rows.sessions[0] = { ...rows.sessions[0], turn_deadline: undefined };
    expect(() =>
      expireTurnReducer(makeCtx(rows.factions[0].player_id, rows), {
        session_id: rows.sessions[0].id,
      })
    ).toThrow(/has no turn deadline/);
  });

  it('rejects timeout advancement from non-session owners', () => {
    const rows = makeRows();

    expect(() =>
      expireTurnReducer(makeCtx(outsiderIdentity, rows), {
        session_id: rows.sessions[0].id,
      })
    ).toThrow(/sender does not own a faction in session/);
  });

  it('auto-defers unresolved proposals and advances through the timeout path', () => {
    const rows = makeRows();
    const initiallyOpen = openProposals(rows.proposals).map(proposal => proposal.id);

    expireTurnReducer(makeCtx(rows.factions[0].player_id, rows), {
      session_id: rows.sessions[0].id,
    });

    expect(rows.factions.every(faction => faction.ready_for_turn)).toBe(true);
    expect(rows.sessions[0].turn_phase).toBe('resolution');
    expect(rows.sessions[0].turn_deadline).toBeUndefined();
    expect(simulationEvents(rows.events)).toHaveLength(1);
    expect(JSON.parse(simulationEvents(rows.events)[0].payload)).toEqual({
      phase: 'resolution',
      session_id: rows.sessions[0].id,
      trigger: 'deadline_expired',
      turn: rows.sessions[0].current_turn,
    });

    for (const proposalId of initiallyOpen) {
      const proposal = rows.proposals.find(row => row.id === proposalId)!;
      expect(proposal.status).toBe('auto_deferred');
      expect(JSON.parse(proposal.decision!)).toMatchObject({
        allocated_credits: 0,
        decided_turn: rows.sessions[0].current_turn,
        decision: 'deferred',
        proposal_id: proposal.id,
        reason: 'timeout',
      });
    }
  });

  it('rejects timeout advancement outside the decision phase', () => {
    const rows = makeRows();
    rows.sessions[0] = { ...rows.sessions[0], turn_phase: 'resolution' };

    expect(() =>
      expireTurnReducer(makeCtx(rows.factions[0].player_id, rows), {
        session_id: rows.sessions[0].id,
      })
    ).toThrow(/must be in decision phase/);
  });

  it('registers advancement reducers in index.ts', () => {
    const src = readFileSync(srcPath('index.ts'), 'utf8');
    expect(src).toMatch(/export\s+const\s+submit_turn\s*=/);
    expect(src).toMatch(/export\s+const\s+expire_turn\s*=/);
  });
});
