import { readFileSync } from 'fs';
import { resolve } from 'path';
import { type Identity, Timestamp } from 'spacetimedb';
import { describe, expect, it } from 'vitest';

import {
  commanderDecisionReducer,
  runDeliberationReducer,
  setDeliberationModeReducer,
  type DecisionReducerContext,
  type ModuleSettingsRow,
} from './turn_decisions.js';
import {
  buildTurn1Seed,
  type CityRow,
  type LlmRequestRow,
  type PersonnelRow,
} from './turn1_seed.js';
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
    cities: seed.cities.map((city) => ({ ...city })) as CityRow[],
    personnel: seed.personnel.map((person) => ({ ...person })) as PersonnelRow[],
    llmRequests: [] as LlmRequestRow[],
    moduleSettings: [] as ModuleSettingsRow[],
    nextProposalId: seed.proposals.reduce((max, proposal) => Math.max(max, proposal.id), 0) + 1,
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
        iter: () => rows.proposals.values(),
        insert: row => {
          const inserted = { ...row, id: rows.nextProposalId };
          rows.nextProposalId += 1;
          rows.proposals.push(inserted);
          return inserted;
        },
      },
      cities: {
        iter: () => rows.cities.values(),
      },
      personnel: {
        iter: () => rows.personnel.values(),
      },
      llm_requests: {
        iter: () => rows.llmRequests.values(),
        insert: row => {
          const inserted = { ...row, id: rows.llmRequests.length + 1 };
          rows.llmRequests.push(inserted);
          return inserted;
        },
      },
      module_settings: {
        id: {
          find: id => rows.moduleSettings.find(setting => setting.id === id) ?? null,
          update: row => {
            const idx = rows.moduleSettings.findIndex(setting => setting.id === row.id);
            if (idx === -1) throw new Error(`module_settings ${row.id} not found`);
            rows.moduleSettings[idx] = row;
            return row;
          },
        },
        insert: row => {
          rows.moduleSettings.push({ ...row });
          return row;
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
    expect(src).toMatch(/export\s+const\s+set_deliberation_mode\s*=/);
    expect(src).toContain('allocation: t.i32()');
  });
});

describe('run_deliberation reducer — fallback mode', () => {
  it('inserts deterministic fallback proposals when configured mode is fallback', () => {
    const rows = makeRows('deliberation');
    rows.moduleSettings.push({ id: 1, deliberation_mode: 'fallback' });
    const faction = rows.factions[0];
    const session = rows.sessions[0];
    const beforeProposalCount = rows.proposals.filter(
      proposal => proposal.faction_id === faction.id && proposal.turn === session.current_turn
    ).length;

    runDeliberationReducer(makeDecisionCtx(faction.player_id, rows), {
      faction_id: faction.id,
    });

    const fallbackProposals = rows.proposals.filter(
      proposal => proposal.faction_id === faction.id && proposal.turn === session.current_turn
    );
    expect(fallbackProposals.length).toBeGreaterThan(beforeProposalCount);

    expect(rows.llmRequests).toHaveLength(1);
    const audit = rows.llmRequests[0];
    expect(audit).toMatchObject({
      session_id: session.id,
      faction_id: faction.id,
      request_type: 'proposals',
      status: 'completed',
      error: undefined,
      error_code: undefined,
      created_turn: session.current_turn,
      updated_turn: session.current_turn,
    });
    expect(audit.response_json).toBeDefined();
    const response = JSON.parse(audit.response_json!);
    expect(response.source).toBe('deterministic_fallback');
    expect(Array.isArray(response.proposal_ids)).toBe(true);
    expect(response.proposal_ids.length).toBeGreaterThan(0);
    expect(JSON.parse(audit.context_json)).toEqual({
      faction_id: faction.id,
      mode: 'fallback',
      request: 'run_deliberation',
      session_id: session.id,
      turn: session.current_turn,
    });
  });

  it('records failed audit row when fallback has no eligible state and does not stall the turn', () => {
    const rows = makeRows('deliberation');
    rows.moduleSettings.push({ id: 1, deliberation_mode: 'fallback' });
    const faction = rows.factions[0];
    rows.cities = rows.cities.filter(city => city.faction_id !== faction.id);
    rows.personnel = rows.personnel.filter(person => person.faction_id !== faction.id);

    expect(() =>
      runDeliberationReducer(makeDecisionCtx(faction.player_id, rows), {
        faction_id: faction.id,
      })
    ).not.toThrow();

    expect(rows.llmRequests).toHaveLength(1);
    expect(rows.llmRequests[0]).toMatchObject({
      session_id: faction.session_id,
      faction_id: faction.id,
      request_type: 'proposals',
      status: 'failed',
      error_code: 'fallback_unavailable',
    });
    expect(rows.llmRequests[0].error).toBeDefined();
  });

  it('rejects unknown configured modes so secrets cannot bypass the contract', () => {
    const rows = makeRows('deliberation');
    rows.moduleSettings.push({ id: 1, deliberation_mode: 'live_via_secret' });
    const faction = rows.factions[0];

    expect(() =>
      runDeliberationReducer(makeDecisionCtx(faction.player_id, rows), {
        faction_id: faction.id,
      })
    ).toThrow(/deliberation_mode must be/);
  });
});

describe('set_deliberation_mode reducer', () => {
  it('inserts the singleton settings row when absent', () => {
    const rows = makeRows('deliberation');
    const faction = rows.factions[0];

    setDeliberationModeReducer(makeDecisionCtx(faction.player_id, rows), {
      mode: 'fallback',
    });

    expect(rows.moduleSettings).toHaveLength(1);
    expect(rows.moduleSettings[0]).toMatchObject({
      id: 1,
      deliberation_mode: 'fallback',
    });
  });

  it('updates an existing settings row in place', () => {
    const rows = makeRows('deliberation');
    rows.moduleSettings.push({ id: 1, deliberation_mode: 'queue' });
    const faction = rows.factions[0];

    setDeliberationModeReducer(makeDecisionCtx(faction.player_id, rows), {
      mode: 'fallback',
    });

    expect(rows.moduleSettings).toHaveLength(1);
    expect(rows.moduleSettings[0].deliberation_mode).toBe('fallback');
  });

  it('rejects unknown modes', () => {
    const rows = makeRows('deliberation');
    const faction = rows.factions[0];

    expect(() =>
      setDeliberationModeReducer(makeDecisionCtx(faction.player_id, rows), {
        mode: 'live_via_secret',
      })
    ).toThrow(/deliberation_mode must be/);
  });
});
