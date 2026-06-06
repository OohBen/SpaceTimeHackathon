import { type Identity, type Timestamp } from 'spacetimedb';

import {
  ACTIVE_SESSION_STATE,
  COMPLETED_SESSION_STATE,
  parseTurnPhase,
  transitionTurnPhase,
  type FactionRow,
  type GameSessionRow,
} from './session_lifecycle.js';
import type { EventRow, ProposalRow, TurnSummaryRow } from './turn1_seed.js';

const TURN_LIMIT = 30;
const DOMINANCE_CONTROL_DELTA = 30;
const CONTROL_MIN_SCORE = 0;
const CONTROL_MAX_SCORE = 200;

export interface SimulateTurnInput {
  session_id: number;
}

export interface AckResolutionInput {
  faction_id: number;
}

export interface CheckVictoryInput {
  session_id: number;
}

export interface TurnResolutionContext {
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
    };
    events: {
      iter(): Iterable<EventRow>;
      insert(row: EventRow): EventRow;
    };
    turn_summaries: {
      iter(): Iterable<TurnSummaryRow>;
      insert(row: TurnSummaryRow): TurnSummaryRow;
      id: {
        update(row: TurnSummaryRow): TurnSummaryRow;
      };
    };
  };
}

export function simulateTurnReducer(
  ctx: TurnResolutionContext,
  input: SimulateTurnInput
): void {
  const session = findSessionInPhase(ctx, input.session_id, 'resolution');
  assertSimulationWasTriggered(ctx, session);
  assertNoCurrentSummaryRows(ctx, session);
  const factions = findSessionFactions(ctx, session);
  const victory = evaluateVictory(ctx, session, factions);
  const nextSession = {
    ...transitionTurnPhase(session, 'summary', ctx.timestamp),
    winner_faction_id: victory.winner_faction_id,
  };

  for (const faction of factions) {
    const opponent = factions.find(row => row.id !== faction.id)!;
    ctx.db.turn_summaries.insert({
      id: 0,
      session_id: session.id,
      faction_id: faction.id,
      turn: session.current_turn,
      summary_json: stableJson(buildSummaryPayload(ctx, session, faction, opponent, victory)),
      acknowledged: false,
      acknowledged_at: undefined,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
  }

  insertVictoryCheckEvent(ctx, session, victory);
  ctx.db.events.insert({
    id: 0,
    session_id: session.id,
    faction_id: undefined,
    turn: session.current_turn,
    event_type: 'turn_summary_ready',
    payload: stableJson({
      phase: 'summary',
      session_id: session.id,
      summary_count: factions.length,
      turn: session.current_turn,
      winner_faction_id: victory.winner_faction_id,
    }),
  });
  ctx.db.game_sessions.id.update(nextSession);
}

export function ackResolutionReducer(
  ctx: TurnResolutionContext,
  input: AckResolutionInput
): void {
  const faction = findFaction(ctx, input.faction_id);
  assertFactionOwner(ctx.sender, faction);
  const session = findSessionInPhase(ctx, faction.session_id, 'summary');
  const summary = findCurrentSummaryForFaction(ctx, session, faction.id);

  if (summary.acknowledged) {
    throw new Error(`summary ${summary.id} is already acknowledged`);
  }

  const updatedSummary = ctx.db.turn_summaries.id.update({
    ...summary,
    acknowledged: true,
    acknowledged_at: ctx.timestamp,
    updated_at: ctx.timestamp,
  });

  ctx.db.events.insert({
    id: 0,
    session_id: session.id,
    faction_id: faction.id,
    turn: session.current_turn,
    event_type: 'resolution_acknowledged',
    payload: stableJson({
      faction_id: faction.id,
      summary_id: updatedSummary.id,
      turn: session.current_turn,
    }),
  });

  if (!allSummariesAcknowledged(ctx, session)) {
    return;
  }

  completeAcknowledgedTurn(ctx, session);
}

export function checkVictoryReducer(
  ctx: TurnResolutionContext,
  input: CheckVictoryInput
): void {
  const session = findSessionInPhase(ctx, input.session_id, 'summary');
  const factions = findSessionFactions(ctx, session);
  const victory = evaluateVictory(ctx, session, factions);
  insertVictoryCheckEvent(ctx, session, victory);

  if (victory.winner_faction_id === undefined) {
    return;
  }

  ctx.db.game_sessions.id.update({
    ...transitionTurnPhase(session, 'complete', ctx.timestamp),
    winner_faction_id: victory.winner_faction_id,
  });
}

function findSessionInPhase(
  ctx: TurnResolutionContext,
  sessionId: number,
  expectedPhase: 'resolution' | 'summary'
): GameSessionRow {
  const session = ctx.db.game_sessions.id.find(sessionId);
  if (!session) {
    throw new Error(`session ${sessionId} not found`);
  }
  if (session.state !== ACTIVE_SESSION_STATE) {
    throw new Error(`session ${session.id} is not active`);
  }
  const phase = parseTurnPhase(session.turn_phase);
  if (phase !== expectedPhase) {
    throw new Error(`session ${session.id} must be in ${expectedPhase} phase, got ${phase}`);
  }
  return session;
}

function findFaction(ctx: TurnResolutionContext, factionId: number): FactionRow {
  const faction = ctx.db.factions.id.find(factionId);
  if (!faction) {
    throw new Error(`faction ${factionId} not found`);
  }
  return faction;
}

function findSessionFactions(
  ctx: TurnResolutionContext,
  session: GameSessionRow
): readonly [FactionRow, FactionRow] {
  if (
    session.player_a_faction_id === undefined ||
    session.player_b_faction_id === undefined
  ) {
    throw new Error(`session ${session.id} is missing faction links`);
  }

  return [
    findFaction(ctx, session.player_a_faction_id),
    findFaction(ctx, session.player_b_faction_id),
  ];
}

function assertFactionOwner(sender: Identity, faction: FactionRow): void {
  if (sender.toHexString() !== faction.player_id.toHexString()) {
    throw new Error(`sender does not own faction ${faction.id}`);
  }
}

function assertSimulationWasTriggered(
  ctx: TurnResolutionContext,
  session: GameSessionRow
): void {
  if (!findEvent(ctx, session, 'simulation_triggered')) {
    throw new Error(`simulation trigger missing for session ${session.id} turn ${session.current_turn}`);
  }
}

function assertNoCurrentSummaryRows(
  ctx: TurnResolutionContext,
  session: GameSessionRow
): void {
  const exists = Array.from(ctx.db.turn_summaries.iter()).some(summary =>
    summary.session_id === session.id && summary.turn === session.current_turn
  );
  if (exists) {
    throw new Error(`turn ${session.current_turn} summaries already exist for session ${session.id}`);
  }
}

function findCurrentSummaryForFaction(
  ctx: TurnResolutionContext,
  session: GameSessionRow,
  factionId: number
): TurnSummaryRow {
  for (const summary of ctx.db.turn_summaries.iter()) {
    if (
      summary.session_id === session.id &&
      summary.faction_id === factionId &&
      summary.turn === session.current_turn
    ) {
      return summary;
    }
  }

  throw new Error(`summary missing for faction ${factionId} turn ${session.current_turn}`);
}

function allSummariesAcknowledged(
  ctx: TurnResolutionContext,
  session: GameSessionRow
): boolean {
  const summaries = Array.from(ctx.db.turn_summaries.iter()).filter(summary =>
    summary.session_id === session.id && summary.turn === session.current_turn
  );
  return summaries.length === 2 && summaries.every(summary => summary.acknowledged);
}

function completeAcknowledgedTurn(
  ctx: TurnResolutionContext,
  session: GameSessionRow
): void {
  const nextSession =
    session.winner_faction_id === undefined
      ? {
          ...transitionTurnPhase(session, 'world_update', ctx.timestamp),
          current_turn: session.current_turn + 1,
          current_year: session.current_year + 1,
        }
      : transitionTurnPhase(session, 'complete', ctx.timestamp);
  const factions = findSessionFactions(ctx, session);

  for (const faction of factions) {
    if (faction.ready_for_turn) {
      ctx.db.factions.id.update({ ...faction, ready_for_turn: false });
    }
  }

  ctx.db.events.insert({
    id: 0,
    session_id: session.id,
    faction_id: undefined,
    turn: session.current_turn,
    event_type: 'turn_acknowledged',
    payload: stableJson({
      next_phase: nextSession.turn_phase,
      next_turn: nextSession.current_turn,
      session_id: session.id,
      turn: session.current_turn,
      winner_faction_id: nextSession.winner_faction_id,
    }),
  });
  ctx.db.game_sessions.id.update(nextSession);
}

interface VictoryOutcome {
  control_delta: number;
  dominance_turns: number;
  dominant_faction_id: number | undefined;
  reason: 'turn_limit' | 'three_turn_dominance' | undefined;
  winner_faction_id: number | undefined;
}

function evaluateVictory(
  ctx: TurnResolutionContext,
  session: GameSessionRow,
  factions: readonly [FactionRow, FactionRow]
): VictoryOutcome {
  const [leader, trailer] =
    factions[0].control_score >= factions[1].control_score
      ? [factions[0], factions[1]]
      : [factions[1], factions[0]];
  const controlDelta = leader.control_score - trailer.control_score;
  const dominantFactionId =
    controlDelta >= DOMINANCE_CONTROL_DELTA ? leader.id : undefined;
  const dominanceTurns =
    dominantFactionId === undefined
      ? 0
      : countPreviousDominanceTurns(ctx, session, dominantFactionId) + 1;

  if (session.current_turn >= TURN_LIMIT) {
    return {
      control_delta: controlDelta,
      dominance_turns: dominanceTurns,
      dominant_faction_id: dominantFactionId,
      reason: 'turn_limit',
      winner_faction_id: leader.id,
    };
  }

  if (dominantFactionId !== undefined && dominanceTurns >= 3) {
    return {
      control_delta: controlDelta,
      dominance_turns: dominanceTurns,
      dominant_faction_id: dominantFactionId,
      reason: 'three_turn_dominance',
      winner_faction_id: dominantFactionId,
    };
  }

  return {
    control_delta: controlDelta,
    dominance_turns: dominanceTurns,
    dominant_faction_id: dominantFactionId,
    reason: undefined,
    winner_faction_id: undefined,
  };
}

function countPreviousDominanceTurns(
  ctx: TurnResolutionContext,
  session: GameSessionRow,
  factionId: number
): number {
  const dominantByTurn = new Map<number, number>();

  for (const event of ctx.db.events.iter()) {
    if (
      event.session_id === session.id &&
      event.event_type === 'victory_checked' &&
      event.turn < session.current_turn
    ) {
      const payload = parsePayload(event.payload);
      if (typeof payload.dominant_faction_id === 'number') {
        dominantByTurn.set(event.turn, payload.dominant_faction_id);
      }
    }
  }

  let count = 0;
  for (let turn = session.current_turn - 1; turn > 0; turn -= 1) {
    if (dominantByTurn.get(turn) !== factionId) {
      break;
    }
    count += 1;
  }
  return count;
}

function insertVictoryCheckEvent(
  ctx: TurnResolutionContext,
  session: GameSessionRow,
  victory: VictoryOutcome
): void {
  if (findEvent(ctx, session, 'victory_checked')) {
    return;
  }

  ctx.db.events.insert({
    id: 0,
    session_id: session.id,
    faction_id: victory.winner_faction_id,
    turn: session.current_turn,
    event_type: 'victory_checked',
    payload: stableJson({
      control_delta: victory.control_delta,
      dominance_turns: victory.dominance_turns,
      dominant_faction_id: victory.dominant_faction_id,
      reason: victory.reason,
      result: victory.winner_faction_id === undefined ? 'ongoing' : 'winner',
      winner_faction_id: victory.winner_faction_id,
    }),
  });
}

function buildSummaryPayload(
  ctx: TurnResolutionContext,
  session: GameSessionRow,
  faction: FactionRow,
  opponent: FactionRow,
  victory: VictoryOutcome
): Record<string, unknown> {
  const counts = countFactionProposalOutcomes(ctx, session, faction.id);
  const trigger = findEvent(ctx, session, 'simulation_triggered');
  const simulationOutputs = readSimulationOutputs(ctx, session);

  return {
    acknowledged: false,
    control_score: faction.control_score,
    current_year: session.current_year,
    event: 'turn_summary',
    faction_id: faction.id,
    faction_name: faction.name,
    opponent_control_score: opponent.control_score,
    opponent_faction_id: opponent.id,
    phase: 'summary',
    proposal_outcomes: counts,
    session_id: session.id,
    simulation_outputs: simulationOutputs,
    simulation_trigger: trigger ? parsePayload(trigger.payload).trigger : undefined,
    turn: session.current_turn,
    victory,
  };
}

function readSimulationOutputs(
  ctx: TurnResolutionContext,
  session: GameSessionRow
): Record<string, unknown> | undefined {
  const event = findEvent(ctx, session, 'world_advanced');
  if (!event) {
    return undefined;
  }

  const payload = parsePayload(event.payload);
  validateSimulationOutputIdentity(payload, session);
  validateControlScoreOutputs(payload.control_scores);
  return payload;
}

function validateSimulationOutputIdentity(
  payload: Record<string, unknown>,
  session: GameSessionRow
): void {
  if (payload.session_id !== session.id) {
    throw new Error(`simulation output session mismatch for session ${session.id}`);
  }
  if (payload.turn !== session.current_turn) {
    throw new Error(`simulation output turn mismatch for session ${session.id}`);
  }
}

function validateControlScoreOutputs(value: unknown): void {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    throw new Error('simulation output control_scores must be an object');
  }

  for (const [factionId, change] of Object.entries(value)) {
    if (!isRecord(change)) {
      throw new Error(`control score output for faction ${factionId} must be an object`);
    }

    const before = assertFiniteNumber(change.before, `control score before for faction ${factionId}`);
    const after = assertFiniteNumber(change.after, `control score after for faction ${factionId}`);
    const delta = assertFiniteNumber(change.delta, `control score delta for faction ${factionId}`);

    if (
      before < CONTROL_MIN_SCORE ||
      before > CONTROL_MAX_SCORE ||
      after < CONTROL_MIN_SCORE ||
      after > CONTROL_MAX_SCORE
    ) {
      throw new Error(`control score output for faction ${factionId} out of bounds`);
    }
    if (after - before !== delta) {
      throw new Error(`control score output for faction ${factionId} delta mismatch`);
    }
  }
}

function assertFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`simulation output ${label} must be a finite number`);
  }
  return value;
}

function countFactionProposalOutcomes(
  ctx: TurnResolutionContext,
  session: GameSessionRow,
  factionId: number
): Record<string, number> {
  const counts: Record<string, number> = {
    approved: 0,
    auto_deferred: 0,
    deferred: 0,
    rejected: 0,
  };

  for (const proposal of ctx.db.proposals.iter()) {
    if (proposal.faction_id !== factionId || proposal.turn !== session.current_turn) {
      continue;
    }
    if (proposal.status in counts) {
      counts[proposal.status] += 1;
    }
  }
  return counts;
}

function findEvent(
  ctx: TurnResolutionContext,
  session: GameSessionRow,
  eventType: string
): EventRow | undefined {
  for (const event of ctx.db.events.iter()) {
    if (
      event.session_id === session.id &&
      event.turn === session.current_turn &&
      event.event_type === eventType
    ) {
      return event;
    }
  }
  return undefined;
}

function parsePayload(payload: string): Record<string, unknown> {
  const value = JSON.parse(payload);
  return isRecord(value) ? value : {};
}

const stableJson = (value: unknown): string => JSON.stringify(stableValue(value));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value === undefined) return null;
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
};

export const __turnResolutionTestConstants = {
  COMPLETED_SESSION_STATE,
  DOMINANCE_CONTROL_DELTA,
  TURN_LIMIT,
};
