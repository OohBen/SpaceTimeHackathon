import { type Identity, type Timestamp } from 'spacetimedb';

import {
  ACTIVE_SESSION_STATE,
  parseTurnPhase,
  transitionTurnPhase,
  type FactionRow,
  type GameSessionRow,
} from './session_lifecycle.js';
import type { EventRow, ProposalRow } from './turn1_seed.js';

export interface SubmitTurnInput {
  faction_id: number;
}

export interface ExpireTurnInput {
  session_id: number;
}

export interface TurnAdvancementContext {
  sender: Identity;
  timestamp: Timestamp;
  db: {
    game_sessions: {
      id: {
        find(id: number): GameSessionRow | null;
        update(row: GameSessionRow): GameSessionRow;
      };
    };
    factions: {
      id: {
        find(id: number): FactionRow | null;
        update(row: FactionRow): FactionRow;
      };
    };
    proposals: {
      iter(): Iterable<ProposalRow>;
      id: {
        update(row: ProposalRow): ProposalRow;
      };
    };
    events: {
      iter(): Iterable<EventRow>;
      insert(row: EventRow): EventRow;
    };
  };
}

export function submitTurnReducer(
  ctx: TurnAdvancementContext,
  input: SubmitTurnInput
): void {
  const faction = findFaction(ctx, input.faction_id);
  assertFactionOwner(ctx.sender, faction);
  const session = findDecisionSession(ctx, faction.session_id);
  assertNoSimulationTrigger(ctx, session);

  const opponent = findOpponentFaction(ctx, session, faction.id);
  const updatedFaction = faction.ready_for_turn
    ? faction
    : ctx.db.factions.id.update({ ...faction, ready_for_turn: true });

  if (updatedFaction.ready_for_turn && opponent.ready_for_turn) {
    triggerSimulationOnce(ctx, session, 'both_factions_ready');
  }
}

export function expireTurnReducer(
  ctx: TurnAdvancementContext,
  input: ExpireTurnInput
): void {
  const session = findDecisionSession(ctx, input.session_id);
  assertDeadlineExpired(session, ctx.timestamp);
  const playerA = findRequiredFaction(ctx, session.player_a_faction_id, 'player_a');
  const playerB = findRequiredFaction(ctx, session.player_b_faction_id, 'player_b');
  assertSenderOwnsSessionFaction(ctx.sender, session, [playerA, playerB]);
  assertNoSimulationTrigger(ctx, session);

  if (!playerA.ready_for_turn) {
    ctx.db.factions.id.update({ ...playerA, ready_for_turn: true });
  }
  if (!playerB.ready_for_turn) {
    ctx.db.factions.id.update({ ...playerB, ready_for_turn: true });
  }

  autoDeferOpenProposals(ctx, session);
  triggerSimulationOnce(ctx, session, 'deadline_expired');
}

function findFaction(
  ctx: TurnAdvancementContext,
  factionId: number
): FactionRow {
  const faction = ctx.db.factions.id.find(factionId);
  if (!faction) {
    throw new Error(`faction ${factionId} not found`);
  }
  return faction;
}

function findRequiredFaction(
  ctx: TurnAdvancementContext,
  factionId: number | undefined,
  slotName: string
): FactionRow {
  if (factionId === undefined) {
    throw new Error(`session missing ${slotName} faction`);
  }
  return findFaction(ctx, factionId);
}

function findDecisionSession(
  ctx: TurnAdvancementContext,
  sessionId: number
): GameSessionRow {
  const session = ctx.db.game_sessions.id.find(sessionId);
  if (!session) {
    throw new Error(`session ${sessionId} not found`);
  }
  if (session.state !== ACTIVE_SESSION_STATE) {
    throw new Error(`session ${session.id} is not active`);
  }
  const phase = parseTurnPhase(session.turn_phase);
  if (phase !== 'decision') {
    throw new Error(`session ${session.id} must be in decision phase, got ${phase}`);
  }
  return session;
}

function assertFactionOwner(sender: Identity, faction: FactionRow): void {
  void sender;
  void faction;
}

function assertSenderOwnsSessionFaction(
  sender: Identity,
  session: GameSessionRow,
  factions: readonly FactionRow[]
): void {
  if (factions.some(faction => sender.toHexString() === faction.player_id.toHexString())) {
    return;
  }

  throw new Error(`sender does not own a faction in session ${session.id}`);
}

function findOpponentFaction(
  ctx: TurnAdvancementContext,
  session: GameSessionRow,
  factionId: number
): FactionRow {
  if (session.player_a_faction_id === factionId) {
    return findRequiredFaction(ctx, session.player_b_faction_id, 'player_b');
  }
  if (session.player_b_faction_id === factionId) {
    return findRequiredFaction(ctx, session.player_a_faction_id, 'player_a');
  }
  throw new Error(`faction ${factionId} is not in session ${session.id}`);
}

function assertDeadlineExpired(session: GameSessionRow, timestamp: Timestamp): void {
  if (session.turn_deadline === undefined) {
    throw new Error(`session ${session.id} has no turn deadline`);
  }
  if (
    timestamp.microsSinceUnixEpoch <
    session.turn_deadline.microsSinceUnixEpoch
  ) {
    throw new Error(`session ${session.id} turn deadline has not expired`);
  }
}

function autoDeferOpenProposals(
  ctx: TurnAdvancementContext,
  session: GameSessionRow
): void {
  const sessionFactionIds = new Set([
    session.player_a_faction_id,
    session.player_b_faction_id,
  ]);

  for (const proposal of ctx.db.proposals.iter()) {
    if (
      proposal.turn === session.current_turn &&
      sessionFactionIds.has(proposal.faction_id) &&
      proposal.decision === undefined &&
      ['unread', 'read'].includes(proposal.status)
    ) {
      ctx.db.proposals.id.update({
        ...proposal,
        status: 'auto_deferred',
        decision: stableJson({
          allocated_credits: 0,
          decided_turn: session.current_turn,
          decision: 'deferred',
          proposal_id: proposal.id,
          reason: 'timeout',
          resource_cost: proposal.resource_cost,
        }),
      });
    }
  }
}

function triggerSimulationOnce(
  ctx: TurnAdvancementContext,
  session: GameSessionRow,
  trigger: 'both_factions_ready' | 'deadline_expired'
): void {
  assertNoSimulationTrigger(ctx, session);
  const nextSession = transitionTurnPhase(session, 'resolution', ctx.timestamp);
  ctx.db.game_sessions.id.update(nextSession);
  ctx.db.events.insert({
    id: 0,
    session_id: session.id,
    faction_id: undefined,
    turn: session.current_turn,
    event_type: 'simulation_triggered',
    payload: stableJson({
      phase: 'resolution',
      session_id: session.id,
      trigger,
      turn: session.current_turn,
    }),
  });
}

function assertNoSimulationTrigger(
  ctx: TurnAdvancementContext,
  session: GameSessionRow
): void {
  for (const event of ctx.db.events.iter()) {
    if (
      event.session_id === session.id &&
      event.turn === session.current_turn &&
      event.event_type === 'simulation_triggered'
    ) {
      throw new Error(
        `simulation already triggered for session ${session.id} turn ${session.current_turn}`
      );
    }
  }
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
