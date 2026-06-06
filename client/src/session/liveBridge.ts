// Live integration bridge between the generated SpacetimeDB bindings and the
// hand-rolled `sessionStore` consumed by `<Inbox />` and `<GlobalHud />`.
//
// Without this bridge, the route flow hydrates only session setup data, so the
// Inbox misses proposals and turn state. The bridge reads every live table the
// playable path needs via SDK `useTable`, then translates generated row shapes
// into the snapshot shape the store consumes.
//
// Two surfaces:
//   - `buildLiveSnapshot(rows)` — pure translator, fully unit-testable.
//   - `useLiveSessionBridge(...)` — React hook that ties live `useTable` output
//     to `sessionStore`.
//
// Closes the M2/M3/M4 gaps from `docs/P4E1-integration-contracts-audit.md` for
// the playable-path subscription wedge; M5 (token resume) + M6 (orchestrator
// stub) remain follow-ups tracked in `docs/P4E1-demo-runbook.md`.

import { useEffect } from 'react';
import { useSpacetimeDB, useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';
import type {
  Factions,
  GameSessions,
  LlmRequests,
  Personnel,
  Proposals,
  TurnSummaries,
} from '../module_bindings/types';
import {
  sessionStore,
  type LlmRequestRow,
  type PersonnelRow,
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
  personnel?: readonly Personnel[];
  turnSummaries: readonly TurnSummaries[];
  llmRequests: readonly LlmRequests[];
  identity: string | null;
}

export function buildLiveSnapshot(rows: LiveTableRows): SubscriptionSnapshot {
  const factions = [...rows.factions].sort(compareFactionSlots);
  const factionById = new Map<number, Factions>();
  for (const faction of factions) {
    factionById.set(faction.id, faction);
  }
  const ownedFactionIds = new Set(
    factions
      .filter(faction => ownsFaction(faction, rows.identity))
      .map(faction => faction.id),
  );

  const sessions: SessionRow[] = rows.sessions.map(translateSession);
  const playerSlots: PlayerSlotRow[] = factions.map(faction =>
    translatePlayerSlot(faction, rows.identity),
  );
  const publicFactions: PublicFactionRow[] = factions.map(translatePublicFaction);
  const privateFactionStates: PrivateFactionStateRow[] = factions
    .filter(faction => ownedFactionIds.has(faction.id))
    .map(translatePrivateFactionState);
  const proposals: ProposalRow[] = rows.proposals
    .filter(proposal => ownedFactionIds.has(proposal.factionId))
    .map(proposal => translateProposal(proposal, factionById))
    .filter((row): row is ProposalRow => row !== null);
  const personnel: PersonnelRow[] = (rows.personnel ?? [])
    .filter(person => ownedFactionIds.has(person.factionId))
    .map(translatePersonnel);
  const turnSummaries: TurnSummaryRow[] = rows.turnSummaries
    .filter(summary => ownedFactionIds.has(summary.factionId))
    .map(translateTurnSummary);
  const llmRequests: LlmRequestRow[] = rows.llmRequests
    .filter(request => ownedFactionIds.has(request.factionId))
    .map(translateLlmRequest);

  return {
    sessions,
    playerSlots,
    publicFactions,
    privateFactionStates,
    proposals,
    personnel,
    turnSummaries,
    llmRequests,
  };
}

function compareFactionSlots(left: Factions, right: Factions): number {
  const leftSlot = parseSlotMetadata(left)?.slot_key === 'player_b' ? 2 : 1;
  const rightSlot = parseSlotMetadata(right)?.slot_key === 'player_b' ? 2 : 1;
  return leftSlot - rightSlot || left.id - right.id;
}

export function useLiveSessionBridge(store: SessionStore = sessionStore): void {
  const { isActive, identity } = useSpacetimeDB();
  const identityHex = identity?.toHexString() ?? null;

  const [sessions, sessionsReady] = useTable(tables.game_sessions);
  const [factions, factionsReady] = useTable(tables.factions);
  const [proposals, proposalsReady] = useTable(tables.proposals);
  const [personnel, personnelReady] = useTable(tables.personnel);
  const [turnSummaries, turnSummariesReady] = useTable(tables.turn_summaries);
  const [llmRequests, llmRequestsReady] = useTable(tables.llm_requests);

  useEffect(() => {
    store.getState().actions.setConnection({
      status: isActive ? 'connected' : 'disconnected',
      identity: identityHex,
      error: null,
    });
  }, [isActive, identityHex, store]);

  useEffect(() => {
    const ready =
      sessionsReady &&
      factionsReady &&
      proposalsReady &&
      personnelReady &&
      turnSummariesReady &&
      llmRequestsReady;
    if (!ready) {
      store.getState().actions.setProposalsSubscription({ status: isActive ? 'loading' : 'idle' });
      return;
    }

    const snapshot = buildLiveSnapshot({
      sessions,
      factions,
      proposals,
      personnel,
      turnSummaries,
      llmRequests,
      identity: identityHex,
    });
    store.getState().actions.hydrateSubscription(snapshot);
    store.getState().actions.setProposalsSubscription({ status: 'ready' });
  }, [
    factions,
    factionsReady,
    identityHex,
    isActive,
    llmRequests,
    llmRequestsReady,
    personnel,
    personnelReady,
    proposals,
    proposalsReady,
    sessions,
    sessionsReady,
    store,
    turnSummaries,
    turnSummariesReady,
  ]);
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

function translatePlayerSlot(faction: Factions, identity?: string | null): PlayerSlotRow {
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
    visibility: occupied && ownerHex === identity ? 'own' : 'public',
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
    doctrine: displayDoctrine(faction.doctrineVector),
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

function translatePersonnel(person: Personnel): PersonnelRow {
  return {
    id: person.id,
    factionId: person.factionId,
    name: person.name,
    role: person.role,
    department: person.department,
    postingCityId: person.postingCityId,
    competence: person.competence,
    creativity: person.creativity,
    reliability: person.reliability,
    ambition: person.ambition,
    politicalSkill: person.politicalSkill,
    communication: person.communication,
    loyalty: person.loyalty,
    autonomyTolerance: person.autonomyTolerance,
    morale: person.morale,
    burnout: person.burnout,
    salary: person.salary,
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

function displayDoctrine(value: string): string {
  const parsed = parseJsonObject(value);
  if (!parsed) return 'Balanced';

  const axes = ['expansion', 'security', 'science', 'diplomacy']
    .map((key) => [key, normalizeDoctrineAxis(parsed[key])] as const)
    .filter((entry): entry is readonly [string, number] => entry[1] !== null);

  if (axes.length === 0) return 'Balanced';
  return axes
    .map(([key, amount]) => `${titleCase(key)} ${Math.round(amount * 100)}%`)
    .join(' / ');
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function normalizeDoctrineAxis(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value > 1) return Math.max(0, Math.min(100, value)) / 100;
  return Math.max(0, Math.min(1, value));
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
