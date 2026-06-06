import { Identity, Timestamp } from 'spacetimedb';
import { describe, expect, it } from 'vitest';

import { resolveIdentityScope, type IdentityScope } from './access_policy.js';
import {
  filterPrivateCommandState,
  PRIVATE_COMMAND_TABLES,
  type PrivateCommandState,
} from './private_state_filters.js';
import { buildPublicWorldProjection } from './public_world_projection.js';
import {
  commanderDecisionReducer,
  type DecisionReducerContext,
} from './turn_decisions.js';
import {
  buildTurn1Seed,
  turn1Seed,
  type CityRow,
  type LlmRequestRow,
  type ModuleSettingsRow,
  type PersonnelRow,
  type ProposalRow,
} from './turn1_seed.js';
import type { FactionRow, GameSessionRow } from './session_lifecycle.js';

const timestamp = Timestamp.UNIX_EPOCH;
const outsiderIdentity = Identity.fromString('e'.repeat(64));
const [factionA, factionB] = turn1Seed.factions;

function scopeForFaction(faction: typeof factionA): IdentityScope {
  return resolveIdentityScope({
    factions: turn1Seed.factions,
    sender: faction.player_id,
    sessionId: faction.session_id,
  });
}

function expectNoPrivateRows(state: PrivateCommandState): void {
  for (const tableName of PRIVATE_COMMAND_TABLES) {
    expect(state[tableName], `${tableName} should be hidden`).toEqual([]);
  }
}

function makeDecisionRows() {
  const seed = buildTurn1Seed();
  return {
    sessions: seed.game_sessions.map((session) => ({
      ...session,
      turn_phase: 'decision',
    })) as GameSessionRow[],
    factions: seed.factions.map((faction) => ({ ...faction })) as FactionRow[],
    cities: seed.cities.map((city) => ({ ...city })) as CityRow[],
    personnel: seed.personnel.map((person) => ({ ...person })) as PersonnelRow[],
    proposals: seed.proposals.map((proposal) => ({ ...proposal })) as ProposalRow[],
    llmRequests: [] as LlmRequestRow[],
    moduleSettings: seed.module_settings.map((setting) => ({ ...setting })) as ModuleSettingsRow[],
  };
}

function makeDecisionCtx(
  sender: Identity,
  rows: ReturnType<typeof makeDecisionRows>
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
        iter: () => rows.proposals.values(),
        insert: row => {
          const inserted = {
            ...row,
            id: rows.proposals.reduce((max, proposal) => Math.max(max, proposal.id), 0) + 1,
          };
          rows.proposals.push(inserted);
          return inserted;
        },
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
        id: {
          find: id => rows.llmRequests.find(request => request.id === id) ?? null,
          update: row => {
            const idx = rows.llmRequests.findIndex(request => request.id === row.id);
            if (idx === -1) throw new Error(`llm_request ${row.id} not found`);
            rows.llmRequests[idx] = row;
            return row;
          },
        },
      },
      module_settings: {
        id: {
          find: id => rows.moduleSettings.find(setting => setting.id === id) ?? null,
          update: row => {
            const idx = rows.moduleSettings.findIndex(setting => setting.id === row.id);
            if (idx === -1) throw new Error(`module setting ${row.id} not found`);
            rows.moduleSettings[idx] = row;
            return row;
          },
        },
        insert: row => {
          rows.moduleSettings.push(row);
          return row;
        },
      },
    },
  };
}

describe('access boundary hardening', () => {
  it('returns no hidden rows for unauthorized or wrong-session read scopes', () => {
    const publicWorld = buildPublicWorldProjection(turn1Seed, {
      sessionId: factionA.session_id,
      viewerFactionId: factionA.id,
    });
    expect(publicWorld.celestial_bodies).toHaveLength(
      turn1Seed.celestial_bodies.length
    );

    const outsiderScope = resolveIdentityScope({
      factions: turn1Seed.factions,
      sender: outsiderIdentity,
      sessionId: factionA.session_id,
    });
    expectNoPrivateRows(filterPrivateCommandState(turn1Seed, outsiderScope));

    const wrongSessionScope: IdentityScope = {
      ...scopeForFaction(factionA),
      sessionId: 999,
    };
    expectNoPrivateRows(filterPrivateCommandState(turn1Seed, wrongSessionScope));
  });

  it('keeps public subscription rows shared while private rows stay faction scoped', () => {
    const publicForA = buildPublicWorldProjection(turn1Seed, {
      sessionId: factionA.session_id,
      viewerFactionId: factionA.id,
    });
    const publicForB = buildPublicWorldProjection(turn1Seed, {
      sessionId: factionB.session_id,
      viewerFactionId: factionB.id,
    });

    expect(publicForA).toEqual(publicForB);
    expect(publicForA.factions[0]).not.toHaveProperty('credits');
    expect(publicForA.factions[0]).not.toHaveProperty('player_id');

    const privateForA = filterPrivateCommandState(
      turn1Seed,
      scopeForFaction(factionA)
    );
    const privateForB = filterPrivateCommandState(
      turn1Seed,
      scopeForFaction(factionB)
    );

    expect(privateForA.proposals.every((row) => row.faction_id === factionA.id)).toBe(true);
    expect(privateForB.proposals.every((row) => row.faction_id === factionB.id)).toBe(true);
    expect(privateForA.proposals.some((row) => row.faction_id === factionB.id)).toBe(false);
    expect(privateForB.proposals.some((row) => row.faction_id === factionA.id)).toBe(false);
  });

  it('rejects cross-faction commander decisions without mutating state', () => {
    const rows = makeDecisionRows();
    const owner = rows.factions[0];
    const otherProposal = rows.proposals.find(
      (proposal): proposal is ProposalRow =>
        proposal.faction_id === rows.factions[1].id
    )!;
    const factionBefore = { ...owner };
    const proposalBefore = { ...otherProposal };

    expect(() =>
      commanderDecisionReducer(makeDecisionCtx(owner.player_id, rows), {
        faction_id: owner.id,
        proposal_id: otherProposal.id,
        decision: 'approved',
        allocation: otherProposal.resource_cost,
      })
    ).toThrow(/does not belong to faction/);

    expect(rows.factions[0]).toEqual(factionBefore);
    expect(rows.proposals.find((proposal) => proposal.id === otherProposal.id)).toEqual(
      proposalBefore
    );
  });
});
