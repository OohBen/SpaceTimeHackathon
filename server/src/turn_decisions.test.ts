import { readFileSync } from 'fs';
import { resolve } from 'path';
import { type Identity, Timestamp } from 'spacetimedb';
import { describe, expect, it } from 'vitest';

import {
  commanderDecisionReducer,
  runDeliberationReducer,
  type DecisionReducerContext,
} from './turn_decisions.js';
import { buildTurn1Seed, type LlmRequestRow } from './turn1_seed.js';
import type { FactionRow, GameSessionRow } from './session_lifecycle.js';
import type { ProposalRow } from './turn1_seed.js';

const timestamp = Timestamp.UNIX_EPOCH;
const srcPath = (file: string) => resolve(import.meta.dirname, file);

function makeRows(phase: 'deliberation' | 'decision' = 'deliberation') {
  const seed = buildTurn1Seed();
  return {
    sessions: seed.game_sessions.map((session) => ({ ...session, turn_phase: phase })),
    factions: seed.factions.map((faction) => ({ ...faction })),
    proposals: seed.proposals.map((proposal) => ({ ...proposal })),
    llmRequests: [] as LlmRequestRow[],
  };
}

function makeDecisionCtx(
  sender: Identity,
  rows: ReturnType<typeof makeRows>
): DecisionReducerContext {
  return {
    sender,
    timestamp,
    db: {
      game_sessions: {
        id: {
          find: id => rows.sessions.find(session => session.id === id) ?? null,
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
        id: {
          find: id => rows.proposals.find(proposal => proposal.id === id) ?? null,
          update: row => {
            const idx = rows.proposals.findIndex(proposal => proposal.id === row.id);
            if (idx === -1) throw new Error(`proposal ${row.id} not found`);
            rows.proposals[idx] = row;
            return row;
          },
        },
      },
      llm_requests: {
        iter: () => rows.llmRequests.values(),
        insert: row => {
          const inserted = { ...row, id: rows.llmRequests.length + 1 };
          rows.llmRequests.push(inserted);
          return inserted;
        },
      },
    },
  };
}

describe('run_deliberation reducer', () => {
  it('queues one proposal-generation request for the faction active turn', () => {
    const rows = makeRows('deliberation');
    const faction = rows.factions[0];

    runDeliberationReducer(makeDecisionCtx(faction.player_id, rows), {
      faction_id: faction.id,
    });

    expect(rows.llmRequests).toHaveLength(1);
    expect(rows.llmRequests[0]).toMatchObject({
      session_id: faction.session_id,
      faction_id: faction.id,
      request_type: 'proposals',
      status: 'queued',
      response_json: undefined,
      error: undefined,
      created_turn: rows.sessions[0].current_turn,
    });
    expect(JSON.parse(rows.llmRequests[0].context_json)).toEqual({
      faction_id: faction.id,
      request: 'run_deliberation',
      session_id: faction.session_id,
      turn: rows.sessions[0].current_turn,
    });
  });

  it('rejects duplicate non-failed deliberation queue requests', () => {
    const rows = makeRows('deliberation');
    const faction = rows.factions[0];
    const ctx = makeDecisionCtx(faction.player_id, rows);

    runDeliberationReducer(ctx, { faction_id: faction.id });

    expect(() =>
      runDeliberationReducer(ctx, { faction_id: faction.id })
    ).toThrow(/already exists/);
  });

  it('rejects queue requests from non-owners and wrong phases', () => {
    const rows = makeRows('deliberation');
    const faction = rows.factions[0];
    const otherPlayer = rows.factions[1].player_id;

    expect(() =>
      runDeliberationReducer(makeDecisionCtx(otherPlayer, rows), {
        faction_id: faction.id,
      })
    ).toThrow(/does not own faction/);

    rows.sessions[0] = { ...rows.sessions[0], turn_phase: 'decision' };
    expect(() =>
      runDeliberationReducer(makeDecisionCtx(faction.player_id, rows), {
        faction_id: faction.id,
      })
    ).toThrow(/must be in deliberation phase/);
  });
});

describe('commander_decision reducer', () => {
  function approvedRows(): {
    rows: ReturnType<typeof makeRows>;
    faction: FactionRow;
    proposal: ProposalRow;
    session: GameSessionRow;
  } {
    const rows = makeRows('decision');
    return {
      rows,
      faction: rows.factions[0],
      proposal: rows.proposals.find(proposal => proposal.faction_id === 1)!,
      session: rows.sessions[0],
    };
  }

  it('approves owned proposals, deducts credits, and persists deterministic decision state', () => {
    const { rows, faction, proposal, session } = approvedRows();

    commanderDecisionReducer(makeDecisionCtx(faction.player_id, rows), {
      faction_id: faction.id,
      proposal_id: proposal.id,
      decision: 'approved',
      allocation: proposal.resource_cost,
    });

    expect(rows.factions[0].credits).toBe(faction.credits - proposal.resource_cost);
    expect(rows.proposals[0]).toMatchObject({
      id: proposal.id,
      status: 'approved',
    });
    expect(JSON.parse(rows.proposals[0].decision!)).toEqual({
      allocated_credits: proposal.resource_cost,
      decision: 'approved',
      decided_turn: session.current_turn,
      proposal_id: proposal.id,
      resource_cost: proposal.resource_cost,
    });
  });

  it('rejects and defers without spending credits', () => {
    const { rows, faction, proposal, session } = approvedRows();

    commanderDecisionReducer(makeDecisionCtx(faction.player_id, rows), {
      faction_id: faction.id,
      proposal_id: proposal.id,
      decision: 'rejected',
      allocation: 0,
    });

    expect(rows.factions[0].credits).toBe(faction.credits);
    expect(rows.proposals[0].status).toBe('rejected');
    expect(JSON.parse(rows.proposals[0].decision!)).toEqual({
      allocated_credits: 0,
      decision: 'rejected',
      decided_turn: session.current_turn,
      proposal_id: proposal.id,
      resource_cost: proposal.resource_cost,
    });

    const nextProposal = rows.proposals.find(
      row => row.faction_id === faction.id && row.decision === undefined
    )!;
    commanderDecisionReducer(makeDecisionCtx(faction.player_id, rows), {
      faction_id: faction.id,
      proposal_id: nextProposal.id,
      decision: 'deferred',
      allocation: 0,
    });

    expect(rows.proposals.find(row => row.id === nextProposal.id)!.status).toBe(
      'deferred'
    );
  });

  it('rejects wrong owners, cross-faction proposals, and wrong phases', () => {
    const { rows, faction, proposal } = approvedRows();
    const otherFaction = rows.factions[1];
    const otherProposal = rows.proposals.find(row => row.faction_id === otherFaction.id)!;

    expect(() =>
      commanderDecisionReducer(makeDecisionCtx(otherFaction.player_id, rows), {
        faction_id: faction.id,
        proposal_id: proposal.id,
        decision: 'approved',
        allocation: proposal.resource_cost,
      })
    ).toThrow(/does not own faction/);

    expect(() =>
      commanderDecisionReducer(makeDecisionCtx(faction.player_id, rows), {
        faction_id: faction.id,
        proposal_id: otherProposal.id,
        decision: 'approved',
        allocation: otherProposal.resource_cost,
      })
    ).toThrow(/does not belong to faction/);

    rows.sessions[0] = { ...rows.sessions[0], turn_phase: 'deliberation' };
    expect(() =>
      commanderDecisionReducer(makeDecisionCtx(faction.player_id, rows), {
        faction_id: faction.id,
        proposal_id: proposal.id,
        decision: 'approved',
        allocation: proposal.resource_cost,
      })
    ).toThrow(/must be in decision phase/);
  });

  it('rejects overspent, underfunded, invalid, and repeated decisions', () => {
    const { rows, faction, proposal } = approvedRows();
    const ctx = makeDecisionCtx(faction.player_id, rows);

    expect(() =>
      commanderDecisionReducer(ctx, {
        faction_id: faction.id,
        proposal_id: proposal.id,
        decision: 'approved',
        allocation: faction.credits + 1,
      })
    ).toThrow(/cannot allocate/);

    expect(() =>
      commanderDecisionReducer(ctx, {
        faction_id: faction.id,
        proposal_id: proposal.id,
        decision: 'approved',
        allocation: proposal.resource_cost - 1,
      })
    ).toThrow(/requires at least/);

    expect(() =>
      commanderDecisionReducer(ctx, {
        faction_id: faction.id,
        proposal_id: proposal.id,
        decision: 'rejected',
        allocation: 1,
      })
    ).toThrow(/must not allocate/);

    expect(() =>
      commanderDecisionReducer(ctx, {
        faction_id: faction.id,
        proposal_id: proposal.id,
        decision: 'maybe',
        allocation: 0,
      })
    ).toThrow(/decision must/);

    commanderDecisionReducer(ctx, {
      faction_id: faction.id,
      proposal_id: proposal.id,
      decision: 'approved',
      allocation: proposal.resource_cost,
    });
    expect(() =>
      commanderDecisionReducer(ctx, {
        faction_id: faction.id,
        proposal_id: proposal.id,
        decision: 'approved',
        allocation: proposal.resource_cost,
      })
    ).toThrow(/already has a decision/);
  });

  it('registers decision reducers in index.ts', () => {
    const src = readFileSync(srcPath('index.ts'), 'utf8');
    expect(src).toMatch(/export\s+const\s+run_deliberation\s*=/);
    expect(src).toMatch(/export\s+const\s+commander_decision\s*=/);
    expect(src).toContain('allocation: t.i32()');
  });
});
