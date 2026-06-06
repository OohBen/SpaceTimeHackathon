import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ClientDiagnostics } from '../spacetime/config';
import type { ReducerCallDescriptor } from '../spacetime/reducers';

export type ConnectionStatus =
  | 'idle'
  | 'loading'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';
export type SessionStatus = 'creating' | 'lobby' | 'active' | 'complete' | 'completed';
export type VisibilityScope = 'public' | 'own' | 'ownFaction';

export interface ConnectionState {
  status: ConnectionStatus;
  identity: string | null;
  error: string | null;
  diagnostics: ClientDiagnostics;
}

export interface SessionRow {
  id: string;
  code: string;
  status: SessionStatus;
  currentTurn: number;
  phase: string;
  winnerFactionId?: string | number | null;
}

export interface PlayerSlotRow {
  sessionId: string;
  slot: number;
  identity: string | null;
  factionId: string;
  factionName: string;
  playerName: string | null;
  occupied: boolean;
  visibility: Extract<VisibilityScope, 'public' | 'own'>;
}

export interface PublicGameStateRow {
  sessionId: string;
  turn: number;
  year: number;
  phase: string;
  controlScores: Record<string, number>;
  visibleFactionIds: string[];
}

export interface PrivateFactionStateRow {
  sessionId: string;
  factionId: string;
  resources: Record<string, number>;
  morale: number;
  doctrine: string;
  visibility: Extract<VisibilityScope, 'ownFaction'>;
}

export type OperationalRowId = string | number;

export interface FactionRow {
  id: OperationalRowId;
  sessionId: OperationalRowId;
  name: string;
  credits: number;
  politicalCapital: number;
  doctrineVector: string;
  controlScore: number;
  readyForTurn: boolean;
}

export interface PersonnelRow {
  id: OperationalRowId;
  factionId: OperationalRowId;
  name: string;
  role: string;
  department: string;
  postingCityId: OperationalRowId | null | undefined;
  competence: number;
  creativity: number;
  reliability: number;
  ambition: number;
  politicalSkill: number;
  communication: number;
  loyalty: number;
  autonomyTolerance: number;
  morale: number;
  burnout: number;
  salary: number;
}

export interface IntelligenceRecordRow {
  id: OperationalRowId;
  observerFactionId: OperationalRowId;
  targetFactionId: OperationalRowId;
  intelType: string;
  value: string;
  accuracy: number;
  acquiredTurn: number;
}

export interface EventRow {
  id: OperationalRowId;
  sessionId: OperationalRowId;
  factionId: OperationalRowId | null | undefined;
  turn: number;
  eventType: string;
  payload?: string;
}

export interface TurnSummaryRow {
  id: OperationalRowId;
  sessionId: OperationalRowId;
  factionId: OperationalRowId;
  turn: number;
  summaryJson: string;
  acknowledged: boolean;
  acknowledgedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LlmRequestRow {
  id: OperationalRowId;
  sessionId: OperationalRowId;
  factionId: OperationalRowId;
  requestType: string;
  status: string;
  responseJson: string | null;
  error: string | null;
  errorCode: string | null;
  attemptCount: number;
  createdTurn: number;
  updatedTurn: number;
}

export interface PublicFactionRow {
  id: string;
  sessionId: string;
  name: string;
  controlScore: number;
  readyForTurn: boolean;
  visibility?: Extract<VisibilityScope, 'public'>;
}

export interface PublicWorldBodyRow {
  id: number;
  sessionId: number;
  name: string;
  systemTier: string;
  commsLagTurns: number;
  travelTimeTurns: number;
  resourceDeposits: string;
  position: string;
  visibility: Extract<VisibilityScope, 'public'>;
}

export interface PublicFactionProjectionRow {
  id: number;
  sessionId: number;
  name: string;
  controlScore: number;
  readyForTurn: boolean;
  visibility: Extract<VisibilityScope, 'public'>;
}

export interface PublicWorldCityProjectionRow {
  id: number;
  sessionId: number;
  bodyId: number;
  factionId: number;
  name: string;
  developmentStage: string;
  visibility: Extract<VisibilityScope, 'public'>;
}

export interface PublicFleetProjectionRow {
  id: number;
  factionId: number;
  postingCityId: number;
  strength: number;
  visibility: Extract<VisibilityScope, 'public'>;
}

export interface PublicColonyShipProjectionRow {
  id: number;
  factionId: number;
  destinationBodyId: number;
  arrivesTurn: number;
  status: string;
  visibility: Extract<VisibilityScope, 'public'>;
}

export interface PublicEventProjectionRow {
  id: number;
  sessionId: number;
  turn: number;
  eventType: string;
  visibility: Extract<VisibilityScope, 'public'>;
}

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'deferred' | string;

export interface ProposalRow {
  id: string;
  sessionId: string;
  factionId: string;
  turn: number;
  proposingPersonnelId: string;
  department: string;
  title: string;
  body: string;
  resourceCost: number;
  confidence: string;
  status: ProposalStatus;
  decision: string | null;
}

export type SubscriptionLoadStatus =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; error: string };

export type PublicFactionSnapshotRow = PublicFactionRow | PublicFactionProjectionRow;

export interface SubscriptionSnapshot {
  sessions?: SessionRow[];
  playerSlots?: PlayerSlotRow[];
  publicGameStates?: PublicGameStateRow[];
  privateFactionStates?: PrivateFactionStateRow[];
  worldBodies?: PublicWorldBodyRow[];
  publicFactions?: PublicFactionSnapshotRow[];
  publicCities?: PublicWorldCityProjectionRow[];
  publicFleets?: PublicFleetProjectionRow[];
  publicColonyShips?: PublicColonyShipProjectionRow[];
  publicEvents?: PublicEventProjectionRow[];
  proposals?: ProposalRow[];
  factions?: FactionRow[];
  personnel?: PersonnelRow[];
  intelligenceRecords?: IntelligenceRecordRow[];
  events?: EventRow[];
  turnSummaries?: TurnSummaryRow[];
  llmRequests?: LlmRequestRow[];
}

export type SubscriptionEvent =
  | { table: 'sessions'; op: 'upsert'; row: SessionRow }
  | { table: 'sessions'; op: 'delete'; id: string }
  | { table: 'playerSlots'; op: 'upsert'; row: PlayerSlotRow }
  | { table: 'playerSlots'; op: 'delete'; sessionId: string; slot: number }
  | { table: 'publicGameStates'; op: 'upsert'; row: PublicGameStateRow }
  | { table: 'publicGameStates'; op: 'delete'; sessionId: string }
  | { table: 'privateFactionStates'; op: 'upsert'; row: PrivateFactionStateRow }
  | { table: 'privateFactionStates'; op: 'delete'; sessionId: string; factionId: string }
  | { table: 'worldBodies'; op: 'upsert'; row: PublicWorldBodyRow }
  | { table: 'worldBodies'; op: 'delete'; id: number }
  | { table: 'publicFactions'; op: 'upsert'; row: PublicFactionSnapshotRow }
  | { table: 'publicFactions'; op: 'delete'; sessionId?: string | number; id: string | number }
  | { table: 'publicCities'; op: 'upsert'; row: PublicWorldCityProjectionRow }
  | { table: 'publicCities'; op: 'delete'; id: number }
  | { table: 'publicFleets'; op: 'upsert'; row: PublicFleetProjectionRow }
  | { table: 'publicFleets'; op: 'delete'; id: number }
  | { table: 'publicColonyShips'; op: 'upsert'; row: PublicColonyShipProjectionRow }
  | { table: 'publicColonyShips'; op: 'delete'; id: number }
  | { table: 'publicEvents'; op: 'upsert'; row: PublicEventProjectionRow }
  | { table: 'publicEvents'; op: 'delete'; id: number }
  | { table: 'proposals'; op: 'upsert'; row: ProposalRow }
  | { table: 'proposals'; op: 'delete'; id: string }
  | { table: 'factions'; op: 'upsert'; row: FactionRow }
  | { table: 'factions'; op: 'delete'; id: OperationalRowId }
  | { table: 'personnel'; op: 'upsert'; row: PersonnelRow }
  | { table: 'personnel'; op: 'delete'; id: OperationalRowId }
  | { table: 'intelligenceRecords'; op: 'upsert'; row: IntelligenceRecordRow }
  | { table: 'intelligenceRecords'; op: 'delete'; id: OperationalRowId }
  | { table: 'events'; op: 'upsert'; row: EventRow }
  | { table: 'events'; op: 'delete'; id: OperationalRowId }
  | { table: 'turnSummaries'; op: 'upsert'; row: TurnSummaryRow }
  | { table: 'turnSummaries'; op: 'delete'; id: OperationalRowId }
  | { table: 'llmRequests'; op: 'upsert'; row: LlmRequestRow }
  | { table: 'llmRequests'; op: 'delete'; id: OperationalRowId };

export interface OptimisticSessionUpdate {
  kind: 'session';
  session: SessionRow;
}

export interface ReducerCallState {
  status: 'loading' | 'success' | 'error';
  descriptor: ReducerCallDescriptor;
  error: string | null;
  optimisticSessionId: string | null;
  startedAt: number;
  finishedAt: number | null;
}

export interface SessionState {
  connection: ConnectionState;
  activeSessionId: string | null;
  sessionsById: Record<string, SessionRow>;
  playerSlotsByKey: Record<string, PlayerSlotRow>;
  publicGameStateBySessionId: Record<string, PublicGameStateRow>;
  privateFactionStateByKey: Record<string, PrivateFactionStateRow>;
  publicFactionsByKey: Record<string, PublicFactionRow>;
  worldBodiesById: Record<string, PublicWorldBodyRow>;
  publicFactionsById: Record<string, PublicFactionProjectionRow>;
  publicCitiesById: Record<string, PublicWorldCityProjectionRow>;
  publicFleetsById: Record<string, PublicFleetProjectionRow>;
  publicColonyShipsById: Record<string, PublicColonyShipProjectionRow>;
  publicEventsById: Record<string, PublicEventProjectionRow>;
  proposalsById: Record<string, ProposalRow>;
  proposalsSubscription: SubscriptionLoadStatus;
  factionsById: Record<string, FactionRow>;
  personnelById: Record<string, PersonnelRow>;
  intelligenceRecordsById: Record<string, IntelligenceRecordRow>;
  eventsById: Record<string, EventRow>;
  turnSummariesById: Record<string, TurnSummaryRow>;
  llmRequestsById: Record<string, LlmRequestRow>;
  reducerCalls: Record<string, ReducerCallState>;
  actions: SessionStoreActions;
}

export interface SessionStoreActions {
  setConnection: (connection: Partial<ConnectionState>) => void;
  setProposalsSubscription: (status: SubscriptionLoadStatus) => void;
  hydrateSubscription: (snapshot: SubscriptionSnapshot) => void;
  applySubscriptionEvent: (event: SubscriptionEvent) => void;
  beginReducerCall: (
    key: string,
    descriptor: ReducerCallDescriptor,
    optimistic?: OptimisticSessionUpdate,
  ) => void;
  completeReducerCall: (key: string) => void;
  failReducerCall: (key: string, error: unknown) => void;
}

export type SessionStore = StoreApi<SessionState>;

const initialConnection: ConnectionState = {
  status: 'idle',
  identity: null,
  error: null,
  diagnostics: {
    host: 'ws://localhost:3000',
    dbName: 'solar-dominion',
    issues: [],
  },
};

export function createSessionStore(): SessionStore {
  return createStore<SessionState>()((set) => ({
    connection: initialConnection,
    activeSessionId: null,
    sessionsById: {},
    playerSlotsByKey: {},
    publicGameStateBySessionId: {},
    privateFactionStateByKey: {},
    publicFactionsByKey: {},
    worldBodiesById: {},
    publicFactionsById: {},
    publicCitiesById: {},
    publicFleetsById: {},
    publicColonyShipsById: {},
    publicEventsById: {},
    proposalsById: {},
    proposalsSubscription: { status: 'idle' },
    factionsById: {},
    personnelById: {},
    intelligenceRecordsById: {},
    eventsById: {},
    turnSummariesById: {},
    llmRequestsById: {},
    reducerCalls: {},
    actions: {
      setConnection(connection) {
        set((state) => ({
          connection: {
            ...state.connection,
            ...connection,
            error: connection.error ?? null,
            diagnostics: connection.diagnostics ?? state.connection.diagnostics,
          },
        }));
      },

      setProposalsSubscription(status) {
        set(() => ({ proposalsSubscription: status }));
      },

      hydrateSubscription(snapshot) {
        set((state) => {
          const sessionsById = { ...state.sessionsById };
          const playerSlotsByKey = { ...state.playerSlotsByKey };
          const publicGameStateBySessionId = { ...state.publicGameStateBySessionId };
          const privateFactionStateByKey = { ...state.privateFactionStateByKey };
          const publicFactionsByKey = { ...state.publicFactionsByKey };
          const worldBodiesById = { ...state.worldBodiesById };
          const publicFactionsById = { ...state.publicFactionsById };
          const publicCitiesById = { ...state.publicCitiesById };
          const publicFleetsById = { ...state.publicFleetsById };
          const publicColonyShipsById = { ...state.publicColonyShipsById };
          const publicEventsById = { ...state.publicEventsById };
          const proposalsById = { ...state.proposalsById };
          const factionsById = { ...state.factionsById };
          const personnelById = { ...state.personnelById };
          const intelligenceRecordsById = { ...state.intelligenceRecordsById };
          const eventsById = { ...state.eventsById };
          const turnSummariesById = { ...state.turnSummariesById };
          const llmRequestsById = { ...state.llmRequestsById };

          for (const session of snapshot.sessions ?? []) {
            sessionsById[session.id] = session;
          }
          for (const slot of snapshot.playerSlots ?? []) {
            playerSlotsByKey[playerSlotKey(slot.sessionId, slot.slot)] = slot;
          }
          for (const gameState of snapshot.publicGameStates ?? []) {
            publicGameStateBySessionId[gameState.sessionId] = gameState;
          }
          for (const factionState of snapshot.privateFactionStates ?? []) {
            privateFactionStateByKey[
              privateFactionKey(factionState.sessionId, factionState.factionId)
            ] = factionState;
          }
          for (const faction of snapshot.publicFactions ?? []) {
            const normalized = normalizePublicFactionRow(faction);
            publicFactionsByKey[publicFactionKey(normalized.sessionId, normalized.id)] = normalized;
            if (isPublicFactionProjectionRow(faction)) {
              publicFactionsById[entityKey(faction.id)] = faction;
            }
          }
          for (const proposal of snapshot.proposals ?? []) {
            proposalsById[proposal.id] = proposal;
          }
          indexOperationalRows(factionsById, snapshot.factions);
          indexOperationalRows(personnelById, snapshot.personnel);
          indexOperationalRows(intelligenceRecordsById, snapshot.intelligenceRecords);
          indexOperationalRows(eventsById, snapshot.events);
          indexOperationalRows(turnSummariesById, snapshot.turnSummaries);
          indexOperationalRows(llmRequestsById, snapshot.llmRequests);
          indexById(worldBodiesById, snapshot.worldBodies);
          indexById(publicCitiesById, snapshot.publicCities);
          indexById(publicFleetsById, snapshot.publicFleets);
          indexById(publicColonyShipsById, snapshot.publicColonyShips);
          indexById(publicEventsById, snapshot.publicEvents);
          const proposalsSubscription: SubscriptionLoadStatus =
            snapshot.proposals !== undefined ? { status: 'ready' } : state.proposalsSubscription;

          return {
            sessionsById,
            playerSlotsByKey,
            publicGameStateBySessionId,
            privateFactionStateByKey,
            publicFactionsByKey,
            worldBodiesById,
            publicFactionsById,
            publicCitiesById,
            publicFleetsById,
            publicColonyShipsById,
            publicEventsById,
            proposalsById,
            proposalsSubscription,
            factionsById,
            personnelById,
            intelligenceRecordsById,
            eventsById,
            turnSummariesById,
            llmRequestsById,
            activeSessionId: nextActiveSessionId(state.activeSessionId, sessionsById),
          };
        });
      },

      applySubscriptionEvent(event) {
        set((state) => applyEvent(state, event));
      },

      beginReducerCall(key, descriptor, optimistic) {
        set((state) => {
          const sessionsById = { ...state.sessionsById };
          let activeSessionId = state.activeSessionId;
          let optimisticSessionId: string | null = null;

          if (optimistic?.kind === 'session') {
            sessionsById[optimistic.session.id] = optimistic.session;
            activeSessionId = optimistic.session.id;
            optimisticSessionId = optimistic.session.id;
          }

          return {
            sessionsById,
            activeSessionId,
            reducerCalls: {
              ...state.reducerCalls,
              [key]: {
                status: 'loading',
                descriptor,
                error: null,
                optimisticSessionId,
                startedAt: Date.now(),
                finishedAt: null,
              },
            },
          };
        });
      },

      completeReducerCall(key) {
        set((state) => {
          const call = state.reducerCalls[key];
          if (!call) return {};

          return {
            reducerCalls: {
              ...state.reducerCalls,
              [key]: {
                ...call,
                status: 'success',
                error: null,
                finishedAt: Date.now(),
              },
            },
          };
        });
      },

      failReducerCall(key, error) {
        set((state) => {
          const call = state.reducerCalls[key];
          if (!call) return {};

          const sessionsById = { ...state.sessionsById };
          let activeSessionId = state.activeSessionId;
          if (call.optimisticSessionId) {
            delete sessionsById[call.optimisticSessionId];
            activeSessionId = nextActiveSessionId(null, sessionsById);
          }

          return {
            sessionsById,
            activeSessionId,
            reducerCalls: {
              ...state.reducerCalls,
              [key]: {
                ...call,
                status: 'error',
                error: errorMessage(error),
                finishedAt: Date.now(),
              },
            },
          };
        });
      },
    },
  }));
}

export const sessionStore = createSessionStore();

export function selectConnectionStatus(state: SessionState): ConnectionStatus {
  return state.connection.status;
}

export function selectActiveSession(state: SessionState): SessionRow | null {
  if (!state.activeSessionId) return null;
  return state.sessionsById[state.activeSessionId] ?? null;
}

export function selectCurrentPlayerSlot(state: SessionState): PlayerSlotRow | null {
  const activeSessionId = state.activeSessionId;
  const identity = state.connection.identity;
  if (!activeSessionId || !identity) return null;

  return (
    Object.values(state.playerSlotsByKey).find(
      (slot) => slot.sessionId === activeSessionId && slot.identity === identity,
    ) ?? null
  );
}

export function selectPublicGameState(state: SessionState): PublicGameStateRow | null {
  if (!state.activeSessionId) return null;
  return state.publicGameStateBySessionId[state.activeSessionId] ?? null;
}

export function selectPublicGameStateForSession(
  state: SessionState,
  sessionId: OperationalRowId,
): PublicGameStateRow | null {
  return state.publicGameStateBySessionId[String(sessionId)] ?? null;
}

export function selectPrivateFactionState(
  state: SessionState,
  factionId: string,
): PrivateFactionStateRow | null {
  if (!state.activeSessionId) return null;
  return state.privateFactionStateByKey[privateFactionKey(state.activeSessionId, factionId)] ?? null;
}

export function selectPrivateFactionStateForSession(
  state: SessionState,
  sessionId: OperationalRowId,
  factionId: OperationalRowId,
): PrivateFactionStateRow | null {
  return state.privateFactionStateByKey[privateFactionKey(String(sessionId), String(factionId))] ?? null;
}

export function selectReducerCall(state: SessionState, key: string): ReducerCallState | null {
  return state.reducerCalls[key] ?? null;
}

export function selectFactionById(
  state: SessionState,
  factionId: OperationalRowId,
): FactionRow | null {
  return state.factionsById[String(factionId)] ?? null;
}

export function selectFactionsForSession(
  state: SessionState,
  sessionId: OperationalRowId,
): FactionRow[] {
  return Object.values(state.factionsById)
    .filter((faction) => String(faction.sessionId) === String(sessionId))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

export function selectPersonnelRoster(
  state: SessionState,
  factionId: OperationalRowId,
): PersonnelRow[] {
  return Object.values(state.personnelById)
    .filter((person) => String(person.factionId) === String(factionId))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function selectIntelligenceRecords(
  state: SessionState,
  observerFactionId: OperationalRowId,
): IntelligenceRecordRow[] {
  return Object.values(state.intelligenceRecordsById)
    .filter((record) => String(record.observerFactionId) === String(observerFactionId))
    .sort((left, right) => right.acquiredTurn - left.acquiredTurn);
}

export function selectEventsForSession(
  state: SessionState,
  sessionId: OperationalRowId,
  factionId?: OperationalRowId,
): EventRow[] {
  return Object.values(state.eventsById)
    .filter((event) => {
      if (String(event.sessionId) !== String(sessionId)) return false;
      return (
        factionId === undefined ||
        event.factionId == null ||
        String(event.factionId) === String(factionId)
      );
    })
    .sort((left, right) => right.turn - left.turn || String(left.id).localeCompare(String(right.id)));
}

export function selectLatestTurnSummaryForFaction(
  state: SessionState,
  sessionId: OperationalRowId,
  factionId: OperationalRowId,
): TurnSummaryRow | null {
  return (
    Object.values(state.turnSummariesById)
      .filter(
        (summary) =>
          String(summary.sessionId) === String(sessionId) &&
          String(summary.factionId) === String(factionId),
      )
      .sort((left, right) => right.turn - left.turn)[0] ?? null
  );
}

export function selectProposalsSubscriptionStatus(state: SessionState): SubscriptionLoadStatus {
  return state.proposalsSubscription;
}

export function selectProposalById(state: SessionState, id: string): ProposalRow | null {
  return state.proposalsById[id] ?? null;
}

export function selectInboxProposalsForCurrentPlayer(state: SessionState): ProposalRow[] {
  const slot = selectCurrentPlayerSlot(state);
  const activeSessionId = state.activeSessionId;
  if (!slot || !activeSessionId) return [];

  return Object.values(state.proposalsById)
    .filter((proposal) => proposal.sessionId === activeSessionId && proposal.factionId === slot.factionId)
    .sort((left, right) => left.turn - right.turn || left.title.localeCompare(right.title));
}

export function selectTurnSummaryForCurrentPlayer(state: SessionState): TurnSummaryRow | null {
  const activeSession = selectActiveSession(state);
  const slot = selectCurrentPlayerSlot(state);
  if (!activeSession || !slot) return null;

  const sessionId = String(activeSession.id);
  const factionId = String(slot.factionId);
  return (
    Object.values(state.turnSummariesById)
      .filter(
        (summary) =>
          String(summary.sessionId) === sessionId &&
          String(summary.factionId) === factionId &&
          summary.turn === activeSession.currentTurn,
      )
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0] ?? null
  );
}

export function selectLlmRequestsForCurrentPlayer(state: SessionState): LlmRequestRow[] {
  const activeSessionId = state.activeSessionId;
  const slot = selectCurrentPlayerSlot(state);
  if (!activeSessionId || !slot) return [];

  const factionId = String(slot.factionId);
  return Object.values(state.llmRequestsById)
    .filter(
      (request) =>
        String(request.sessionId) === activeSessionId && String(request.factionId) === factionId,
    )
    .sort((a, b) => {
      if (a.updatedTurn !== b.updatedTurn) return b.updatedTurn - a.updatedTurn;
      return String(b.id).localeCompare(String(a.id));
    });
}

function applyEvent(state: SessionState, event: SubscriptionEvent): Partial<SessionState> {
  if (event.table === 'sessions') {
    const sessionsById = { ...state.sessionsById };
    if (event.op === 'delete') {
      delete sessionsById[event.id];
    } else {
      sessionsById[event.row.id] = event.row;
    }

    return {
      sessionsById,
      activeSessionId: nextActiveSessionId(
        event.op === 'delete' && state.activeSessionId === event.id ? null : state.activeSessionId,
        sessionsById,
      ),
    };
  }

  if (event.table === 'playerSlots') {
    const playerSlotsByKey = { ...state.playerSlotsByKey };
    if (event.op === 'delete') {
      delete playerSlotsByKey[playerSlotKey(event.sessionId, event.slot)];
    } else {
      playerSlotsByKey[playerSlotKey(event.row.sessionId, event.row.slot)] = event.row;
    }
    return { playerSlotsByKey };
  }

  if (event.table === 'publicGameStates') {
    const publicGameStateBySessionId = { ...state.publicGameStateBySessionId };
    if (event.op === 'delete') {
      delete publicGameStateBySessionId[event.sessionId];
    } else {
      publicGameStateBySessionId[event.row.sessionId] = event.row;
    }
    return { publicGameStateBySessionId };
  }

  if (event.table === 'privateFactionStates') {
    const privateFactionStateByKey = { ...state.privateFactionStateByKey };
    if (event.op === 'delete') {
      delete privateFactionStateByKey[privateFactionKey(event.sessionId, event.factionId)];
    } else {
      privateFactionStateByKey[privateFactionKey(event.row.sessionId, event.row.factionId)] =
        event.row;
    }
    return { privateFactionStateByKey };
  }

  if (event.table === 'factions') {
    return { factionsById: updateOperationalById(state.factionsById, event) };
  }
  if (event.table === 'personnel') {
    return { personnelById: updateOperationalById(state.personnelById, event) };
  }
  if (event.table === 'intelligenceRecords') {
    return {
      intelligenceRecordsById: updateOperationalById(state.intelligenceRecordsById, event),
    };
  }
  if (event.table === 'events') {
    return { eventsById: updateOperationalById(state.eventsById, event) };
  }
  if (event.table === 'turnSummaries') {
    return { turnSummariesById: updateOperationalById(state.turnSummariesById, event) };
  }
  if (event.table === 'llmRequests') {
    return { llmRequestsById: updateOperationalById(state.llmRequestsById, event) };
  }

  if (event.table === 'worldBodies') {
    const worldBodiesById = updateById(state.worldBodiesById, event);
    return { worldBodiesById };
  }
  if (event.table === 'publicFactions') {
    const publicFactionsByKey = { ...state.publicFactionsByKey };
    const publicFactionsById = { ...state.publicFactionsById };
    if (event.op === 'delete') {
      if (event.sessionId !== undefined) {
        delete publicFactionsByKey[publicFactionKey(String(event.sessionId), String(event.id))];
      }
      delete publicFactionsById[entityKey(Number(event.id))];
    } else {
      const normalized = normalizePublicFactionRow(event.row);
      publicFactionsByKey[publicFactionKey(normalized.sessionId, normalized.id)] = normalized;
      if (isPublicFactionProjectionRow(event.row)) {
        publicFactionsById[entityKey(event.row.id)] = event.row;
      }
    }
    return { publicFactionsByKey, publicFactionsById };
  }
  if (event.table === 'publicCities') {
    const publicCitiesById = updateById(state.publicCitiesById, event);
    return { publicCitiesById };
  }
  if (event.table === 'publicFleets') {
    const publicFleetsById = updateById(state.publicFleetsById, event);
    return { publicFleetsById };
  }
  if (event.table === 'publicColonyShips') {
    const publicColonyShipsById = updateById(state.publicColonyShipsById, event);
    return { publicColonyShipsById };
  }
  if (event.table === 'proposals') {
    const proposalsById = { ...state.proposalsById };
    if (event.op === 'delete') {
      delete proposalsById[event.id];
    } else {
      proposalsById[event.row.id] = event.row;
    }
    return { proposalsById };
  }

  const publicEventsById = updateById(state.publicEventsById, event);
  return { publicEventsById };
}

function normalizePublicFactionRow(row: PublicFactionSnapshotRow): PublicFactionRow {
  return {
    id: String(row.id),
    sessionId: String(row.sessionId),
    name: row.name,
    controlScore: row.controlScore,
    readyForTurn: row.readyForTurn,
    visibility: row.visibility,
  };
}

function isPublicFactionProjectionRow(
  row: PublicFactionSnapshotRow,
): row is PublicFactionProjectionRow {
  return typeof row.id === 'number' && typeof row.sessionId === 'number';
}

function indexOperationalRows<T extends { id: OperationalRowId }>(
  target: Record<string, T>,
  rows: readonly T[] | undefined,
): void {
  for (const row of rows ?? []) {
    target[String(row.id)] = row;
  }
}

function indexById<T extends { id: number }>(
  target: Record<string, T>,
  rows: readonly T[] | undefined,
): void {
  for (const row of rows ?? []) {
    target[entityKey(row.id)] = row;
  }
}

function updateById<T extends { id: number }>(
  current: Record<string, T>,
  event: { op: 'upsert'; row: T } | { op: 'delete'; id: number },
): Record<string, T> {
  const next = { ...current };
  if (event.op === 'delete') {
    delete next[entityKey(event.id)];
  } else {
    next[entityKey(event.row.id)] = event.row;
  }
  return next;
}

function updateOperationalById<T extends { id: OperationalRowId }>(
  current: Record<string, T>,
  event: { op: 'upsert'; row: T } | { op: 'delete'; id: OperationalRowId },
): Record<string, T> {
  const next = { ...current };
  if (event.op === 'delete') {
    delete next[String(event.id)];
  } else {
    next[String(event.row.id)] = event.row;
  }
  return next;
}

function nextActiveSessionId(
  activeSessionId: string | null,
  sessionsById: Record<string, SessionRow>,
): string | null {
  if (activeSessionId && sessionsById[activeSessionId]) return activeSessionId;
  return Object.keys(sessionsById)[0] ?? null;
}

function playerSlotKey(sessionId: string, slot: number): string {
  return `${sessionId}:${slot}`;
}

function privateFactionKey(sessionId: string, factionId: string): string {
  return `${sessionId}:${factionId}`;
}

function publicFactionKey(sessionId: string, factionId: string): string {
  return `${sessionId}:${factionId}`;
}

function entityKey(id: number): string {
  return String(id);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'unknown reducer error';
}
