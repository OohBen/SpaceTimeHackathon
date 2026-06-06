// Live integration bridge between the generated SpacetimeDB bindings and the
// hand-rolled `sessionStore` consumed by `<Inbox />` and `<GlobalHud />`.
//
// Without this bridge, the route mounted at `/game/:sessionId/:playerSlot`
// subscribes only to `game_sessions` + `factions` (see `useSpacetimeSessionBackend`),
// so the Inbox renders "Loading proposals..." forever even though the server is
// emitting them. The bridge widens the subscription set to every table the
// playable path needs, then translates generated row shapes (numeric IDs,
// camelCase, `Identity` helpers) into the snapshot shape the store consumes.
//
// Two surfaces:
//   - `buildLiveSnapshot(rows)` — pure translator, fully unit-testable.
//   - `useLiveSessionBridge(...)` — React hook that ties live `useTable` output
//     to `sessionStore` and expands the connection's subscription set.
//
// Closes the M2/M3/M4 gaps from `docs/P4E1-integration-contracts-audit.md` for
// the playable-path subscription wedge; M5 (token resume) + M6 (orchestrator
// stub) remain follow-ups tracked in `docs/P4E1-demo-runbook.md`.

import { useEffect } from 'react';
import { useSpacetimeDB, useTable } from 'spacetimedb/react';
import type { DbConnection } from '../module_bindings';
import { tables } from '../module_bindings';
import type {
  Factions,
  GameSessions,
  LlmRequests,
  Proposals,
  TurnSummaries,
} from '../module_bindings/types';
import {
  sessionStore,
  type LlmRequestRow,
  type PlayerSlotRow,
  type PrivateFactionStateRow,
  type ProposalRow,
  type PublicFactionRow,
  type SessionRow,
  type SessionStatus,
  type SessionStore,
  type SubscriptionSnapshot,
  type TurnSummaryRow,
} from '../state/session-store';

interface FactionSlotMetadata {
  slot_key?: string;
  slot_index?: number;
  slot_name?: string;
  claim_status?: string;
  placeholder_player_id?: string;
}

const PLAYER_SLOT_ORDER: Record<'player_a' | 'player_b', number> = {
  player_a: 1,
  player_b: 2,
};

const SESSION_STATE_TO_STORE_STATUS: Record<string, SessionStatus> = {
  setup: 'lobby',
  active: 'active',
  complete: 'complete',
  completed: 'complete',
};

export interface LiveTableRows {
  sessions: readonly GameSessions[];
  factions: readonly Factions[];
  proposals: readonly Proposals[];
  turnSummaries: readonly TurnSummaries[];
  llmRequests: readonly LlmRequests[];
  identity: string | null;
}

export function buildLiveSnapshot(rows: LiveTableRows): SubscriptionSnapshot {
  const factionById = new Map<number, Factions>();
  for (const faction of rows.factions) {
    factionById.set(faction.id, faction);
  }

  const sessions: SessionRow[] = rows.sessions.map(translateSession);
  const playerSlots: PlayerSlotRow[] = rows.factions.map(translatePlayerSlot);
  const publicFactions: PublicFactionRow[] = rows.factions.map(translatePublicFaction);
  const privateFactionStates: PrivateFactionStateRow[] = rows.factions
    .filter(faction => ownsFaction(faction, rows.identity))
    .map(translatePrivateFactionState);
  const proposals: ProposalRow[] = rows.proposals
    .map(proposal => translateProposal(proposal, factionById))
    .filter((row): row is ProposalRow => row !== null);
  const turnSummaries: TurnSummaryRow[] = rows.turnSummaries.map(translateTurnSummary);
  const llmRequests: LlmRequestRow[] = rows.llmRequests.map(translateLlmRequest);

  return {
    sessions,
    playerSlots,
    publicFactions,
    privateFactionStates,
    proposals,
    turnSummaries,
    llmRequests,
  };
}

export function useLiveSessionBridge(store: SessionStore = sessionStore): void {
  const { isActive, identity, getConnection } = useSpacetimeDB();
  const conn = getConnection() as DbConnection | null;
  const identityHex = identity?.toHexString() ?? null;

  const [sessions] = useTable(tables.game_sessions);
  const [factions] = useTable(tables.factions);
  const [proposals] = useTable(tables.proposals);
  const [turnSummaries] = useTable(tables.turn_summaries);
  const [llmRequests] = useTable(tables.llm_requests);

  useEffect(() => {
    if (!conn || !isActive) return;
    conn.subscriptionBuilder().subscribe([
      tables.proposals,
      tables.commander_inbox,
      tables.turn_summaries,
      tables.events,
      tables.llm_requests,
      tables.module_settings,
      tables.public_factions,
    ]);
  }, [conn, isActive]);

  useEffect(() => {
    store.getState().actions.setConnection({
      status: isActive ? 'connected' : 'disconnected',
      identity: identityHex,
      error: null,
    });
  }, [isActive, identityHex, store]);

  useEffect(() => {
    const snapshot = buildLiveSnapshot({
      sessions,
      factions,
      proposals,
      turnSummaries,
      llmRequests,
      identity: identityHex,
    });
    store.getState().actions.hydrateSubscription(snapshot);
    store.getState().actions.setProposalsSubscription({ status: 'ready' });
  }, [factions, identityHex, llmRequests, proposals, sessions, store, turnSummaries]);
}

function translateSession(session: GameSessions): SessionRow {
  return {
    id: String(session.id),
    code: `SOL-${session.id}`,
    status: SESSION_STATE_TO_STORE_STATUS[session.state] ?? 'active',
    currentTurn: session.currentTurn,
    phase: session.turnPhase,
  };
}

function translatePlayerSlot(faction: Factions): PlayerSlotRow {
  const slot = parseSlotMetadata(faction);
  const slotKey = slot?.slot_key === 'player_b' ? 'player_b' : 'player_a';
  const ownerHex = faction.playerId.toHexString();
  const occupied = slot?.claim_status === 'claimed';

  return {
    sessionId: String(faction.sessionId),
    slot: PLAYER_SLOT_ORDER[slotKey],
    identity: occupied ? ownerHex : null,
    factionId: String(faction.id),
    factionName: slot?.slot_name ?? faction.name,
    playerName: faction.name,
    occupied,
    visibility: 'public',
  };
}

function translatePublicFaction(faction: Factions): PublicFactionRow {
  return {
    id: String(faction.id),
    sessionId: String(faction.sessionId),
    name: faction.name,
    controlScore: faction.controlScore,
    readyForTurn: faction.readyForTurn,
  };
}

function translatePrivateFactionState(faction: Factions): PrivateFactionStateRow {
  return {
    sessionId: String(faction.sessionId),
    factionId: String(faction.id),
    resources: {
      credits: faction.credits,
      political_capital: faction.politicalCapital,
    },
    morale: 0,
    doctrine: faction.doctrineVector,
    visibility: 'ownFaction',
  };
}

function translateProposal(
  proposal: Proposals,
  factionById: ReadonlyMap<number, Factions>,
): ProposalRow | null {
  const faction = factionById.get(proposal.factionId);
  if (!faction) return null;

  return {
    id: String(proposal.id),
    sessionId: String(faction.sessionId),
    factionId: String(proposal.factionId),
    turn: proposal.turn,
    proposingPersonnelId: String(proposal.proposingPersonnelId),
    department: proposal.department,
    title: proposal.title,
    body: proposal.body,
    resourceCost: proposal.resourceCost,
    confidence: proposal.confidence,
    status: proposal.status,
    decision: proposal.decision ?? null,
  };
}

function translateTurnSummary(summary: TurnSummaries): TurnSummaryRow {
  return {
    id: String(summary.id),
    sessionId: String(summary.sessionId),
    factionId: String(summary.factionId),
    turn: summary.turn,
    summaryJson: summary.summaryJson,
    acknowledged: summary.acknowledged,
    acknowledgedAt:
      summary.acknowledgedAt !== undefined ? String(summary.acknowledgedAt) : null,
  };
}

function translateLlmRequest(request: LlmRequests): LlmRequestRow {
  return {
    id: String(request.id),
    sessionId: String(request.sessionId),
    factionId: String(request.factionId),
    requestType: request.requestType,
    status: request.status,
    responseJson: request.responseJson ?? null,
    error: request.error ?? null,
    errorCode: request.errorCode ?? null,
    attemptCount: request.attemptCount,
    createdTurn: request.createdTurn,
    updatedTurn: request.updatedTurn,
  };
}

function parseSlotMetadata(faction: Factions): FactionSlotMetadata | undefined {
  try {
    const parsed = JSON.parse(faction.doctrineVector) as { slot?: FactionSlotMetadata };
    return parsed.slot;
  } catch {
    return undefined;
  }
}

function ownsFaction(faction: Factions, identityHex: string | null): boolean {
  if (!identityHex) return false;
  return faction.playerId.toHexString() === identityHex;
}
