import { type Identity, type Timestamp } from 'spacetimedb';
import { SenderError } from 'spacetimedb/server';

import {
  ACTIVE_SESSION_STATE,
  parseTurnPhase,
  type FactionRow,
  type GameSessionRow,
} from './session_lifecycle.js';
import {
  LLM_REQUEST_STATUS,
  LLM_REQUEST_TYPE,
  buildQueuedLlmRequest,
  type LlmRequestRow,
} from './llm_queue_contract.js';
import {
  generateFallbackProposals,
  type FallbackProposalDraft,
} from './fallback_proposals.js';
import type {
  CityRow,
  PersonnelRow,
  ProposalRow,
} from './turn1_seed.js';

export type CommanderDecision = 'approved' | 'rejected' | 'deferred';

export const DELIBERATION_MODE = {
  queue: 'queue',
  fallback: 'fallback',
} as const;

export const DELIBERATION_MODES = [
  DELIBERATION_MODE.queue,
  DELIBERATION_MODE.fallback,
] as const;

export type DeliberationMode = typeof DELIBERATION_MODES[number];

const MODULE_SETTINGS_ID = 1;
const FALLBACK_UNAVAILABLE_CODE = 'fallback_unavailable';
const FALLBACK_SOURCE = 'deterministic_fallback';

export type ModuleSettingsRow = {
  id: number;
  deliberation_mode: string;
};

export interface RunDeliberationInput {
  faction_id: number;
}

export interface CommanderDecisionInput {
  faction_id: number;
  proposal_id: number;
  decision: string;
  allocation: number;
}

export interface SetDeliberationModeInput {
  mode: string;
}

export interface FulfillDeliberationInput {
  request_id: number;
  items_json: string;
}

export interface FailDeliberationInput {
  request_id: number;
  error: string;
  error_code: string;
}

type AdvisoryProposalItem = {
  title?: string;
  body?: string;
};

const LIVE_WORKER_SOURCE = 'live_worker';

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
      iter(): Iterable<ProposalRow>;
      insert(row: ProposalRow): ProposalRow;
    };
    cities: {
      iter(): Iterable<CityRow>;
    };
    personnel: {
      iter(): Iterable<PersonnelRow>;
    };
    llm_requests: {
      iter(): Iterable<LlmRequestRow>;
      insert(row: LlmRequestRow): LlmRequestRow;
      id: {
        find(id: number): LlmRequestRow | null;
        update(row: LlmRequestRow): LlmRequestRow;
      };
    };
    module_settings: {
      id: {
        find(id: number): ModuleSettingsRow | null;
        update(row: ModuleSettingsRow): ModuleSettingsRow;
      };
      insert(row: ModuleSettingsRow): ModuleSettingsRow;
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
  if (hasActiveDeliberationRequest(ctx, faction.id, session)) {
    return;
  }

  const mode = getDeliberationMode(ctx);

  if (mode === DELIBERATION_MODE.queue) {
    ctx.db.llm_requests.insert(buildQueuedLlmRequest({
      session_id: session.id,
      faction_id: faction.id,
      request_type: LLM_REQUEST_TYPE.proposals,
      context: buildQueueContext(session, faction),
      created_turn: session.current_turn,
    }));
    return;
  }

  runFallbackDeliberation(ctx, session, faction);
}

export function setDeliberationModeReducer(
  ctx: DecisionReducerContext,
  input: SetDeliberationModeInput
): void {
  const mode = parseDeliberationMode(input.mode);
  const existing = ctx.db.module_settings.id.find(MODULE_SETTINGS_ID);
  if (existing) {
    ctx.db.module_settings.id.update({
      ...existing,
      deliberation_mode: mode,
    });
    return;
  }
  ctx.db.module_settings.insert({
    id: MODULE_SETTINGS_ID,
    deliberation_mode: mode,
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

// Worker write-back reducer. Intentionally does NOT assert faction ownership — the external queue worker calls this with its own identity. Safe because output is advisory text overlaid on deterministic proposals.
export function fulfillDeliberationReducer(
  ctx: DecisionReducerContext,
  input: FulfillDeliberationInput
): void {
  const request = findLlmRequest(ctx, input.request_id);
  if (request.request_type !== LLM_REQUEST_TYPE.proposals) {
    throw new Error(
      `llm_request ${request.id} request_type ${request.request_type} is not supported (only proposals)`
    );
  }
  assertRequestOpen(request);

  const faction = ctx.db.factions.id.find(request.faction_id);
  if (!faction) {
    throw new Error(`faction ${request.faction_id} not found`);
  }
  const session = ctx.db.game_sessions.id.find(request.session_id);
  if (!session) {
    throw new Error(`session ${request.session_id} not found`);
  }

  const cities = collectByFaction(ctx.db.cities.iter(), faction.id);
  const personnel = collectByFaction(ctx.db.personnel.iter(), faction.id);
  const existingProposals = collectByFactionTurn(
    ctx.db.proposals.iter(),
    request.faction_id,
    request.created_turn
  );

  const drafts = generateFallbackProposals({
    session,
    faction,
    cities,
    personnel,
    existingProposals,
  });

  const items = parseAdvisoryItems(input.items_json);

  const overlayCount = Math.min(drafts.length, items.length);
  for (let i = 0; i < overlayCount; i += 1) {
    const item = items[i];
    if (typeof item.title === 'string' && item.title.length > 0) {
      drafts[i].title = item.title;
    }
    if (typeof item.body === 'string' && item.body.length > 0) {
      drafts[i].body = item.body;
    }
  }

  const insertedIds = drafts.map((draft) => insertFallbackProposal(ctx, draft).id);

  ctx.db.llm_requests.id.update({
    ...request,
    status: LLM_REQUEST_STATUS.completed,
    response_json: stableJson({
      proposal_ids: insertedIds,
      source: LIVE_WORKER_SOURCE,
    }),
    error: undefined,
    error_code: undefined,
    updated_turn: session.current_turn,
  });
}

// Worker write-back reducer. Intentionally does NOT assert faction ownership — the external queue worker calls this with its own identity. Safe because output is advisory text overlaid on deterministic proposals.
export function failDeliberationReducer(
  ctx: DecisionReducerContext,
  input: FailDeliberationInput
): void {
  const request = findLlmRequest(ctx, input.request_id);
  assertRequestOpen(request);

  ctx.db.llm_requests.id.update({
    ...request,
    status: LLM_REQUEST_STATUS.failed,
    error: input.error,
    error_code: input.error_code,
    attempt_count: request.attempt_count + 1,
    updated_turn: request.updated_turn,
  });
}

function findLlmRequest(
  ctx: DecisionReducerContext,
  requestId: number
): LlmRequestRow {
  const request = ctx.db.llm_requests.id.find(requestId);
  if (!request) {
    throw new Error(`llm_request ${requestId} not found`);
  }
  return request;
}

function assertRequestOpen(request: LlmRequestRow): void {
  if (
    request.status !== LLM_REQUEST_STATUS.queued &&
    request.status !== LLM_REQUEST_STATUS.processing
  ) {
    throw new Error(
      `llm_request ${request.id} is not open (status ${request.status})`
    );
  }
}

function parseAdvisoryItems(itemsJson: string): AdvisoryProposalItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(itemsJson);
  } catch {
    throw new Error('invalid items_json: not valid JSON');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('invalid items_json: expected an array');
  }
  return parsed as AdvisoryProposalItem[];
}

function runFallbackDeliberation(
  ctx: DecisionReducerContext,
  session: GameSessionRow,
  faction: FactionRow
): void {
  const cities = collectByFaction(ctx.db.cities.iter(), faction.id);
  const personnel = collectByFaction(ctx.db.personnel.iter(), faction.id);
  const existingProposals = collectByFactionTurn(
    ctx.db.proposals.iter(),
    faction.id,
    session.current_turn
  );

  const drafts = generateFallbackProposals({
    session,
    faction,
    cities,
    personnel,
    existingProposals,
  });

  if (drafts.length === 0) {
    ctx.db.llm_requests.insert(buildAuditLlmRequest({
      session,
      faction,
      status: LLM_REQUEST_STATUS.failed,
      response_json: undefined,
      error: 'no eligible state for deterministic fallback proposals',
      error_code: FALLBACK_UNAVAILABLE_CODE,
      attempt_count: 1,
    }));
    return;
  }

  const insertedIds = drafts.map((draft) => insertFallbackProposal(ctx, draft).id);

  ctx.db.llm_requests.insert(buildAuditLlmRequest({
    session,
    faction,
    status: LLM_REQUEST_STATUS.completed,
    response_json: stableJson({
      proposal_ids: insertedIds,
      source: FALLBACK_SOURCE,
    }),
    error: undefined,
    error_code: undefined,
    attempt_count: 0,
  }));
}

function insertFallbackProposal(
  ctx: DecisionReducerContext,
  draft: FallbackProposalDraft
): ProposalRow {
  return ctx.db.proposals.insert({
    id: 0,
    faction_id: draft.faction_id,
    turn: draft.turn,
    proposing_personnel_id: draft.proposing_personnel_id,
    department: draft.department,
    title: draft.title,
    body: draft.body,
    resource_cost: draft.resource_cost,
    confidence: draft.confidence,
    status: draft.status,
    decision: draft.decision,
  });
}

function buildAuditLlmRequest(input: {
  session: GameSessionRow;
  faction: FactionRow;
  status: string;
  response_json: string | undefined;
  error: string | undefined;
  error_code: string | undefined;
  attempt_count: number;
}): LlmRequestRow {
  return {
    id: 0,
    session_id: input.session.id,
    faction_id: input.faction.id,
    request_type: LLM_REQUEST_TYPE.proposals,
    context_json: stableJson(
      buildFallbackContext(input.session, input.faction)
    ),
    status: input.status,
    response_json: input.response_json,
    error: input.error,
    error_code: input.error_code,
    attempt_count: input.attempt_count,
    created_turn: input.session.current_turn,
    updated_turn: input.session.current_turn,
  };
}

function buildQueueContext(
  session: GameSessionRow,
  faction: FactionRow
): Record<string, unknown> {
  return {
    faction_id: faction.id,
    request: 'run_deliberation',
    session_id: session.id,
    turn: session.current_turn,
  };
}

function buildFallbackContext(
  session: GameSessionRow,
  faction: FactionRow
): Record<string, unknown> {
  return {
    faction_id: faction.id,
    mode: DELIBERATION_MODE.fallback,
    request: 'run_deliberation',
    session_id: session.id,
    turn: session.current_turn,
  };
}

function getDeliberationMode(ctx: DecisionReducerContext): DeliberationMode {
  const settings = ctx.db.module_settings.id.find(MODULE_SETTINGS_ID);
  if (!settings) {
    return DELIBERATION_MODE.queue;
  }
  return parseDeliberationMode(settings.deliberation_mode);
}

function parseDeliberationMode(value: string): DeliberationMode {
  if (DELIBERATION_MODES.includes(value as DeliberationMode)) {
    return value as DeliberationMode;
  }
  throw new Error(
    `deliberation_mode must be one of ${DELIBERATION_MODES.join(', ')}, got ${value}`
  );
}

function collectByFaction<T extends { faction_id: number }>(
  rows: Iterable<T>,
  factionId: number
): T[] {
  const out: T[] = [];
  for (const row of rows) {
    if (row.faction_id === factionId) out.push(row);
  }
  return out;
}

function collectByFactionTurn(
  rows: Iterable<ProposalRow>,
  factionId: number,
  turn: number
): ProposalRow[] {
  const out: ProposalRow[] = [];
  for (const row of rows) {
    if (row.faction_id === factionId && row.turn === turn) out.push(row);
  }
  return out;
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
    throw new SenderError(`session ${faction.session_id} not found`);
  }
  if (session.state !== ACTIVE_SESSION_STATE) {
    throw new SenderError(`session ${session.id} is not active`);
  }
  return session;
}

function assertFactionOwner(sender: Identity, faction: FactionRow): void {
  if (sender.toHexString() !== faction.player_id.toHexString()) {
    throw new SenderError(`sender does not own faction ${faction.id}`);
  }
}

function assertTurnPhase(
  session: GameSessionRow,
  expectedPhase: 'deliberation' | 'decision'
): void {
  const phase = parseTurnPhase(session.turn_phase);
  if (phase !== expectedPhase) {
    throw new SenderError(
      `session ${session.id} must be in ${expectedPhase} phase, got ${phase}`
    );
  }
}

function hasActiveDeliberationRequest(
  ctx: DecisionReducerContext,
  factionId: number,
  session: GameSessionRow
): boolean {
  for (const request of ctx.db.llm_requests.iter()) {
    if (
      request.faction_id === factionId &&
      request.session_id === session.id &&
      request.created_turn === session.current_turn &&
      request.request_type === LLM_REQUEST_TYPE.proposals &&
      request.status !== LLM_REQUEST_STATUS.failed
    ) {
      return true;
    }
  }
  return false;
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
