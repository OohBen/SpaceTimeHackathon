import { type Identity, type Timestamp } from 'spacetimedb';

import {
  ACTIVE_SESSION_STATE,
  parseTurnPhase,
  type FactionRow,
  type GameSessionRow,
} from './session_lifecycle.js';
import type {
  LlmRequestRow,
  ProposalRow,
} from './turn1_seed.js';

export type CommanderDecision = 'approved' | 'rejected' | 'deferred';

export interface RunDeliberationInput {
  faction_id: number;
}

export interface CommanderDecisionInput {
  faction_id: number;
  proposal_id: number;
  decision: string;
  allocation: number;
}

export interface DecisionReducerContext {
  sender: Identity;
  timestamp: Timestamp;
  db: {
    game_sessions: {
      id: {
        find(id: number): GameSessionRow | null;
      };
    };
    factions: {
      id: {
        find(id: number): FactionRow | null;
        update(row: FactionRow): FactionRow;
      };
    };
    proposals: {
      id: {
        find(id: number): ProposalRow | null;
        update(row: ProposalRow): ProposalRow;
      };
    };
    llm_requests: {
      iter(): Iterable<LlmRequestRow>;
      insert(row: LlmRequestRow): LlmRequestRow;
    };
  };
}

export function runDeliberationReducer(
  ctx: DecisionReducerContext,
  input: RunDeliberationInput
): void {
  const faction = findFaction(ctx, input.faction_id);
  assertFactionOwner(ctx.sender, faction);
  const session = findActiveFactionSession(ctx, faction);
  assertTurnPhase(session, 'deliberation');
  assertNoDuplicateDeliberationRequest(ctx, faction.id, session);

  ctx.db.llm_requests.insert({
    id: 0,
    session_id: session.id,
    faction_id: faction.id,
    request_type: 'proposals',
    context_json: stableJson({
      faction_id: faction.id,
      request: 'run_deliberation',
      session_id: session.id,
      turn: session.current_turn,
    }),
    status: 'queued',
    response_json: undefined,
    error: undefined,
    created_turn: session.current_turn,
  });
}

export function commanderDecisionReducer(
  ctx: DecisionReducerContext,
  input: CommanderDecisionInput
): void {
  const decision = parseCommanderDecision(input.decision);
  const allocation = assertValidAllocation(input.allocation);
  const faction = findFaction(ctx, input.faction_id);
  assertFactionOwner(ctx.sender, faction);
  const session = findActiveFactionSession(ctx, faction);
  assertTurnPhase(session, 'decision');
  const proposal = findProposal(ctx, input.proposal_id);
  assertProposalBelongsToActiveTurn(proposal, faction, session);
  assertProposalIsUndecided(proposal);

  const allocatedCredits = validateDecisionResources(
    decision,
    allocation,
    faction,
    proposal
  );

  if (allocatedCredits > 0) {
    ctx.db.factions.id.update({
      ...faction,
      credits: faction.credits - allocatedCredits,
    });
  }

  ctx.db.proposals.id.update({
    ...proposal,
    status: decision,
    decision: stableJson({
      allocated_credits: allocatedCredits,
      decision,
      decided_turn: session.current_turn,
      proposal_id: proposal.id,
      resource_cost: proposal.resource_cost,
    }),
  });
}

function findFaction(ctx: DecisionReducerContext, factionId: number): FactionRow {
  const faction = ctx.db.factions.id.find(factionId);
  if (!faction) {
    throw new Error(`faction ${factionId} not found`);
  }
  return faction;
}

function findProposal(
  ctx: DecisionReducerContext,
  proposalId: number
): ProposalRow {
  const proposal = ctx.db.proposals.id.find(proposalId);
  if (!proposal) {
    throw new Error(`proposal ${proposalId} not found`);
  }
  return proposal;
}

function findActiveFactionSession(
  ctx: DecisionReducerContext,
  faction: FactionRow
): GameSessionRow {
  const session = ctx.db.game_sessions.id.find(faction.session_id);
  if (!session) {
    throw new Error(`session ${faction.session_id} not found`);
  }
  if (session.state !== ACTIVE_SESSION_STATE) {
    throw new Error(`session ${session.id} is not active`);
  }
  return session;
}

function assertFactionOwner(sender: Identity, faction: FactionRow): void {
  if (sender.toHexString() !== faction.player_id.toHexString()) {
    throw new Error(`sender does not own faction ${faction.id}`);
  }
}

function assertTurnPhase(
  session: GameSessionRow,
  expectedPhase: 'deliberation' | 'decision'
): void {
  const phase = parseTurnPhase(session.turn_phase);
  if (phase !== expectedPhase) {
    throw new Error(
      `session ${session.id} must be in ${expectedPhase} phase, got ${phase}`
    );
  }
}

function assertNoDuplicateDeliberationRequest(
  ctx: DecisionReducerContext,
  factionId: number,
  session: GameSessionRow
): void {
  for (const request of ctx.db.llm_requests.iter()) {
    if (
      request.faction_id === factionId &&
      request.session_id === session.id &&
      request.created_turn === session.current_turn &&
      request.request_type === 'proposals' &&
      request.status !== 'failed'
    ) {
      throw new Error(
        `deliberation request already exists for faction ${factionId} turn ${session.current_turn}`
      );
    }
  }
}

function assertProposalBelongsToActiveTurn(
  proposal: ProposalRow,
  faction: FactionRow,
  session: GameSessionRow
): void {
  if (proposal.faction_id !== faction.id) {
    throw new Error(`proposal ${proposal.id} does not belong to faction ${faction.id}`);
  }
  if (proposal.turn !== session.current_turn) {
    throw new Error(
      `proposal ${proposal.id} belongs to turn ${proposal.turn}, not ${session.current_turn}`
    );
  }
}

function assertProposalIsUndecided(proposal: ProposalRow): void {
  if (proposal.decision !== undefined) {
    throw new Error(`proposal ${proposal.id} already has a decision`);
  }
  if (!['unread', 'read'].includes(proposal.status)) {
    throw new Error(`proposal ${proposal.id} is not open for decision`);
  }
}

function parseCommanderDecision(decision: string): CommanderDecision {
  if (
    decision === 'approved' ||
    decision === 'rejected' ||
    decision === 'deferred'
  ) {
    return decision;
  }
  throw new Error('decision must be approved, rejected, or deferred');
}

function assertValidAllocation(allocation: number): number {
  if (!Number.isInteger(allocation) || allocation < 0) {
    throw new Error('allocation must be a non-negative integer');
  }
  return allocation;
}

function validateDecisionResources(
  decision: CommanderDecision,
  allocation: number,
  faction: FactionRow,
  proposal: ProposalRow
): number {
  if (decision !== 'approved') {
    if (allocation !== 0) {
      throw new Error(`${decision} decisions must not allocate credits`);
    }
    return 0;
  }

  if (allocation < proposal.resource_cost) {
    throw new Error(
      `approved proposal ${proposal.id} requires at least ${proposal.resource_cost} credits`
    );
  }
  if (allocation > faction.credits) {
    throw new Error(`faction ${faction.id} cannot allocate ${allocation} credits`);
  }
  return allocation;
}

const stableJson = (value: unknown): string => JSON.stringify(stableValue(value));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
};
