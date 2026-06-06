import { Identity, type Timestamp } from 'spacetimedb';

import { runWorldUpdate, type WorldUpdateContext } from './simulation_kernel.js';

export const INITIAL_SESSION_STATE = 'setup';
export const INITIAL_TURN_PHASE = 'setup';
export const INITIAL_YEAR = 2150;
export const INITIAL_TURN = 1;
export const INITIAL_CREDITS = 1_000;
export const INITIAL_POLITICAL_CAPITAL = 50;
export const INITIAL_CONTROL_SCORE = 100;
export const ACTIVE_SESSION_STATE = 'active';
export const COMPLETED_SESSION_STATE = 'completed';
export const TURN_PHASES = [
  'setup',
  'world_update',
  'deliberation',
  'decision',
  'resolution',
  'summary',
  'complete',
] as const;
export const ALLOWED_TURN_PHASE_TRANSITIONS: Record<
  TurnPhase,
  readonly TurnPhase[]
> = {
  setup: ['world_update'],
  world_update: ['deliberation'],
  deliberation: ['decision'],
  decision: ['resolution'],
  resolution: ['summary'],
  summary: ['world_update', 'complete'],
  complete: [],
};

const SLOT_IDENTITY_NAMESPACE =
  0x534f4c4152444f4d494e494f4e00000000000000000000000000000000n;

export type FactionSlotKey = 'player_a' | 'player_b';
export type TurnPhase = (typeof TURN_PHASES)[number];

export interface CreateSessionInput {
  player_a_name: string;
  player_b_name: string;
}

export interface GameSessionRow {
  id: number;
  state: string;
  current_year: number;
  current_turn: number;
  player_a_faction_id: number | undefined;
  player_b_faction_id: number | undefined;
  turn_phase: string;
  turn_deadline: Timestamp | undefined;
  winner_faction_id: number | undefined;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface FactionRow {
  id: number;
  session_id: number;
  player_id: Identity;
  name: string;
  credits: number;
  political_capital: number;
  doctrine_vector: string;
  control_score: number;
  ready_for_turn: boolean;
}

export interface FactionSlotMetadata {
  schema_version: 1;
  lifecycle: 'session_slot';
  slot_key: FactionSlotKey;
  slot_index: 1 | 2;
  slot_name: string;
  claim_status: 'claimable' | 'claimed';
  join_reducer: 'join_or_resume_session';
  resume_key: 'session_id+player_slot';
  placeholder_player_id: string;
}

export interface FactionDoctrineVector {
  expansion: 0.5;
  security: 0.5;
  slot: FactionSlotMetadata;
}

export interface SessionLifecycleRows {
  session: GameSessionRow;
  factions: readonly [FactionRow, FactionRow];
  slot_metadata: readonly [FactionSlotMetadata, FactionSlotMetadata];
}

export interface JoinOrResumeInput {
  session_id: number;
  player_slot: string;
}

export interface AdvanceTurnPhaseInput {
  session_id: number;
  next_phase: string;
}

export interface AdvanceWorldInput {
  session_id: number;
}

export interface SessionBootstrap {
  session_id: number;
  faction_id: number;
  slot_key: FactionSlotKey;
  opponent_faction_id: number;
  current_turn: number;
  turn_phase: string;
  is_resume: boolean;
}

export interface JoinOrResumeContext {
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
  };
}

export interface TurnPhaseContext {
  timestamp: Timestamp;
  db: {
    game_sessions: {
      id: {
        find(id: number): GameSessionRow | null;
        update(row: GameSessionRow): GameSessionRow;
      };
    };
  };
}

export interface SessionLifecycleContext {
  timestamp: Timestamp;
  db: {
    game_sessions: {
      iter(): Iterable<GameSessionRow>;
      insert(row: GameSessionRow): GameSessionRow;
      id: {
        update(row: GameSessionRow): GameSessionRow;
      };
    };
    factions: {
      iter(): Iterable<FactionRow>;
      insert(row: FactionRow): FactionRow;
    };
  };
}

export function normalizeCreateSessionInput(input: CreateSessionInput): CreateSessionInput {
  const player_a_name = normalizeSlotName(input.player_a_name);
  const player_b_name = normalizeSlotName(input.player_b_name);

  if (!player_a_name) {
    throw new Error('player_a_name is required');
  }

  if (!player_b_name) {
    throw new Error('player_b_name is required');
  }

  if (canonicalSlotName(player_a_name) === canonicalSlotName(player_b_name)) {
    throw new Error('player_a_name and player_b_name must be different');
  }

  return { player_a_name, player_b_name };
}

export function buildSessionLifecycleRows(
  input: CreateSessionInput,
  timestamp: Timestamp,
  sessionId: number,
  factionIds: readonly [number | undefined, number | undefined] = [
    undefined,
    undefined,
  ]
): SessionLifecycleRows {
  const normalized = normalizeCreateSessionInput(input);
  const playerAIdentity = buildSlotIdentity(sessionId, 'player_a');
  const playerBIdentity = buildSlotIdentity(sessionId, 'player_b');
  const playerAMetadata = buildSlotMetadata(
    'player_a',
    normalized.player_a_name,
    playerAIdentity
  );
  const playerBMetadata = buildSlotMetadata(
    'player_b',
    normalized.player_b_name,
    playerBIdentity
  );

  return {
    session: {
      id: sessionId,
      state: INITIAL_SESSION_STATE,
      current_year: INITIAL_YEAR,
      current_turn: INITIAL_TURN,
      player_a_faction_id: factionIds[0],
      player_b_faction_id: factionIds[1],
      turn_phase: INITIAL_TURN_PHASE,
      turn_deadline: undefined,
      winner_faction_id: undefined,
      created_at: timestamp,
      updated_at: timestamp,
    },
    factions: [
      buildFactionRow(
        sessionId,
        factionIds[0] ?? 0,
        normalized.player_a_name,
        playerAIdentity,
        playerAMetadata
      ),
      buildFactionRow(
        sessionId,
        factionIds[1] ?? 0,
        normalized.player_b_name,
        playerBIdentity,
        playerBMetadata
      ),
    ],
    slot_metadata: [playerAMetadata, playerBMetadata],
  };
}

export function assertNoDuplicateSetupSession(
  input: CreateSessionInput,
  existingSessions: Iterable<GameSessionRow>,
  existingFactions: Iterable<FactionRow>
): void {
  const normalized = normalizeCreateSessionInput(input);
  const requestedPair = canonicalSlotPair([
    normalized.player_a_name,
    normalized.player_b_name,
  ]);
  const factionsBySession = groupFactionNamesBySession(existingFactions);

  for (const session of existingSessions) {
    if (session.state !== INITIAL_SESSION_STATE) {
      continue;
    }

    const slotNames = factionsBySession.get(session.id) ?? [];
    if (slotNames.length !== 2) {
      continue;
    }

    if (canonicalSlotPair(slotNames) === requestedPair) {
      throw new Error('setup session already exists for these faction slots');
    }
  }
}

export function createSessionReducer(
  ctx: SessionLifecycleContext,
  input: CreateSessionInput
): void {
  assertNoDuplicateSetupSession(
    input,
    ctx.db.game_sessions.iter(),
    ctx.db.factions.iter()
  );

  const draft = buildSessionLifecycleRows(input, ctx.timestamp, 0);
  const insertedSession = ctx.db.game_sessions.insert(draft.session);
  const slotRows = buildSessionLifecycleRows(
    input,
    ctx.timestamp,
    insertedSession.id
  );
  const playerAFaction = ctx.db.factions.insert(slotRows.factions[0]);
  const playerBFaction = ctx.db.factions.insert(slotRows.factions[1]);

  ctx.db.game_sessions.id.update({
    ...insertedSession,
    player_a_faction_id: playerAFaction.id,
    player_b_faction_id: playerBFaction.id,
    updated_at: ctx.timestamp,
  });
}

export function joinOrResumeSessionReducer(
  ctx: JoinOrResumeContext,
  input: JoinOrResumeInput
): void {
  joinOrResumeSession(ctx, input);
}

export function advanceTurnPhaseReducer(
  ctx: TurnPhaseContext,
  input: AdvanceTurnPhaseInput
): void {
  const session = findSessionForPhaseUpdate(ctx, input.session_id);
  ctx.db.game_sessions.id.update(
    transitionTurnPhase(session, input.next_phase, ctx.timestamp)
  );
}

export function advanceWorldReducer(
  ctx: WorldUpdateContext,
  input: AdvanceWorldInput
): void {
  const session = findSessionForPhaseUpdate(ctx, input.session_id);
  assertActiveSessionForWorldUpdate(session);
  // Validate phase transition before running kernel so phase errors surface before simulation.
  const nextSession = transitionTurnPhase(session, 'deliberation', ctx.timestamp);
  runWorldUpdate(ctx, session);
  ctx.db.game_sessions.id.update(nextSession);
}

export function transitionTurnPhase(
  session: GameSessionRow,
  nextPhaseInput: string,
  timestamp: Timestamp
): GameSessionRow {
  const currentPhase = parseTurnPhase(session.turn_phase);
  const nextPhase = parseTurnPhase(nextPhaseInput);
  assertSessionCanTransition(session);
  assertInitializedForActivePhase(session, nextPhase);
  assertAllowedTurnPhaseTransition(currentPhase, nextPhase);

  return {
    ...session,
    state: stateForPhase(session.state, nextPhase),
    turn_phase: nextPhase,
    turn_deadline: nextPhase === 'decision' ? session.turn_deadline : undefined,
    updated_at: timestamp,
  };
}

export function parseTurnPhase(phase: string): TurnPhase {
  if (isTurnPhase(phase)) {
    return phase;
  }

  throw new Error(`unknown turn phase ${phase}`);
}

export function assertAllowedTurnPhaseTransition(
  currentPhase: TurnPhase,
  nextPhase: TurnPhase
): void {
  if (!ALLOWED_TURN_PHASE_TRANSITIONS[currentPhase].includes(nextPhase)) {
    throw new Error(
      `invalid turn phase transition ${currentPhase} -> ${nextPhase}`
    );
  }
}

export function joinOrResumeSession(
  ctx: JoinOrResumeContext,
  input: JoinOrResumeInput
): SessionBootstrap {
  const playerSlot = parseFactionSlotKey(input.player_slot);
  const session = ctx.db.game_sessions.id.find(input.session_id);
  if (!session) {
    throw new Error(`session ${input.session_id} not found`);
  }

  if (session.state !== INITIAL_SESSION_STATE && session.state !== ACTIVE_SESSION_STATE) {
    throw new Error(
      `session ${input.session_id} cannot be joined or resumed from state ${session.state}`
    );
  }

  const factionId =
    playerSlot === 'player_a'
      ? session.player_a_faction_id
      : session.player_b_faction_id;
  const opponentFactionId =
    playerSlot === 'player_a'
      ? session.player_b_faction_id
      : session.player_a_faction_id;

  if (factionId === undefined || opponentFactionId === undefined) {
    throw new Error(`session ${input.session_id} is not fully initialized`);
  }

  const faction = ctx.db.factions.id.find(factionId);
  if (!faction) {
    throw new Error(`faction ${factionId} not found`);
  }

  const doctrineVector: FactionDoctrineVector = JSON.parse(faction.doctrine_vector);
  const slot = doctrineVector.slot;

  if (slot.slot_key !== playerSlot) {
    throw new Error(`faction ${factionId} is not bound to slot ${playerSlot}`);
  }

  if (slot.claim_status === 'claimed') {
    if (faction.player_id.toHexString() !== ctx.sender.toHexString()) {
      throw new Error(`slot ${playerSlot} is already claimed by another player`);
    }
    return {
      session_id: session.id,
      faction_id: faction.id,
      slot_key: playerSlot,
      opponent_faction_id: opponentFactionId,
      current_turn: session.current_turn,
      turn_phase: session.turn_phase,
      is_resume: true,
    };
  }

  if (slot.claim_status !== 'claimable') {
    throw new Error(`slot ${playerSlot} has unsupported claim status`);
  }

  if (faction.player_id.toHexString() !== slot.placeholder_player_id) {
    throw new Error(`slot ${playerSlot} placeholder identity mismatch`);
  }

  const updatedSlot: FactionSlotMetadata = { ...slot, claim_status: 'claimed' };
  const updatedDoctrine: FactionDoctrineVector = { ...doctrineVector, slot: updatedSlot };
  const updatedFaction: FactionRow = {
    ...faction,
    player_id: ctx.sender,
    doctrine_vector: JSON.stringify(updatedDoctrine),
  };
  ctx.db.factions.id.update(updatedFaction);

  const bothClaimed = checkBothSlotsClaimed(
    ctx,
    opponentFactionId
  );

  if (bothClaimed) {
    ctx.db.game_sessions.id.update({
      ...transitionTurnPhase(session, 'world_update', ctx.timestamp),
      state: ACTIVE_SESSION_STATE,
      updated_at: ctx.timestamp,
    });
  }

  return {
    session_id: session.id,
    faction_id: faction.id,
    slot_key: playerSlot,
    opponent_faction_id: opponentFactionId,
    current_turn: session.current_turn,
    turn_phase: session.turn_phase,
    is_resume: false,
  };
}

function checkBothSlotsClaimed(
  ctx: JoinOrResumeContext,
  opponentFactionId: number
): boolean {
  const opponentFaction = ctx.db.factions.id.find(opponentFactionId);
  if (!opponentFaction) return false;
  const opponentDoctrine: FactionDoctrineVector = JSON.parse(opponentFaction.doctrine_vector);
  return opponentDoctrine.slot.claim_status === 'claimed';
}

function findSessionForPhaseUpdate(
  ctx: TurnPhaseContext,
  sessionId: number
): GameSessionRow {
  const session = ctx.db.game_sessions.id.find(sessionId);
  if (!session) {
    throw new Error(`session ${sessionId} not found`);
  }

  return session;
}

function isTurnPhase(phase: string): phase is TurnPhase {
  return (TURN_PHASES as readonly string[]).includes(phase);
}

function assertSessionCanTransition(session: GameSessionRow): void {
  if (session.state === COMPLETED_SESSION_STATE || session.turn_phase === 'complete') {
    throw new Error(`session ${session.id} is already complete`);
  }
}

function assertActiveSessionForWorldUpdate(session: GameSessionRow): void {
  if (session.state !== ACTIVE_SESSION_STATE) {
    throw new Error(
      `session ${session.id} must be active before world update can advance`
    );
  }
}

function assertInitializedForActivePhase(
  session: GameSessionRow,
  nextPhase: TurnPhase
): void {
  if (
    nextPhase !== 'setup' &&
    (session.player_a_faction_id === undefined ||
      session.player_b_faction_id === undefined)
  ) {
    throw new Error(`session ${session.id} is not fully initialized`);
  }
}

function stateForPhase(currentState: string, nextPhase: TurnPhase): string {
  if (nextPhase === 'complete') {
    return COMPLETED_SESSION_STATE;
  }

  if (nextPhase === 'world_update' && currentState === INITIAL_SESSION_STATE) {
    return ACTIVE_SESSION_STATE;
  }

  return currentState;
}

function parseFactionSlotKey(playerSlot: string): FactionSlotKey {
  if (playerSlot === 'player_a' || playerSlot === 'player_b') {
    return playerSlot;
  }

  throw new Error('player_slot must be player_a or player_b');
}

export function buildSlotIdentity(
  sessionId: number,
  slotKey: FactionSlotKey
): Identity {
  assertNonNegativeInteger(sessionId, 'sessionId');
  const slotIndex = slotKey === 'player_a' ? 1n : 2n;

  return new Identity(
    SLOT_IDENTITY_NAMESPACE + BigInt(sessionId) * 0x100n + slotIndex
  );
}

function buildFactionRow(
  sessionId: number,
  factionId: number,
  name: string,
  playerId: Identity,
  slotMetadata: FactionSlotMetadata
): FactionRow {
  return {
    id: factionId,
    session_id: sessionId,
    player_id: playerId,
    name,
    credits: INITIAL_CREDITS,
    political_capital: INITIAL_POLITICAL_CAPITAL,
    doctrine_vector: JSON.stringify(buildDoctrineVector(slotMetadata)),
    control_score: INITIAL_CONTROL_SCORE,
    ready_for_turn: false,
  };
}

function buildDoctrineVector(
  slotMetadata: FactionSlotMetadata
): FactionDoctrineVector {
  return {
    expansion: 0.5,
    security: 0.5,
    slot: slotMetadata,
  };
}

function buildSlotMetadata(
  slotKey: FactionSlotKey,
  slotName: string,
  playerId: Identity
): FactionSlotMetadata {
  return {
    schema_version: 1,
    lifecycle: 'session_slot',
    slot_key: slotKey,
    slot_index: slotKey === 'player_a' ? 1 : 2,
    slot_name: slotName,
    claim_status: 'claimable',
    join_reducer: 'join_or_resume_session',
    resume_key: 'session_id+player_slot',
    placeholder_player_id: playerId.toHexString(),
  };
}

function normalizeSlotName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function canonicalSlotName(name: string): string {
  return normalizeSlotName(name).toLocaleLowerCase('en-US');
}

function canonicalSlotPair(names: readonly string[]): string {
  return names.map(canonicalSlotName).sort().join('\0');
}

function groupFactionNamesBySession(
  factions: Iterable<FactionRow>
): Map<number, string[]> {
  const bySession = new Map<number, string[]>();

  for (const faction of factions) {
    const names = bySession.get(faction.session_id) ?? [];
    names.push(faction.name);
    bySession.set(faction.session_id, names);
  }

  return bySession;
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}
