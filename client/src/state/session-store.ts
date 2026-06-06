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
export type SessionStatus = 'creating' | 'lobby' | 'active' | 'complete';
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

export interface SubscriptionSnapshot {
  sessions?: SessionRow[];
  playerSlots?: PlayerSlotRow[];
  publicGameStates?: PublicGameStateRow[];
  privateFactionStates?: PrivateFactionStateRow[];
  factions?: FactionRow[];
  personnel?: PersonnelRow[];
  intelligenceRecords?: IntelligenceRecordRow[];
  events?: EventRow[];
  turnSummaries?: TurnSummaryRow[];
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
  | { table: 'factions'; op: 'upsert'; row: FactionRow }
  | { table: 'factions'; op: 'delete'; id: OperationalRowId }
  | { table: 'personnel'; op: 'upsert'; row: PersonnelRow }
  | { table: 'personnel'; op: 'delete'; id: OperationalRowId }
  | { table: 'intelligenceRecords'; op: 'upsert'; row: IntelligenceRecordRow }
  | { table: 'intelligenceRecords'; op: 'delete'; id: OperationalRowId }
  | { table: 'events'; op: 'upsert'; row: EventRow }
  | { table: 'events'; op: 'delete'; id: OperationalRowId }
  | { table: 'turnSummaries'; op: 'upsert'; row: TurnSummaryRow }
  | { table: 'turnSummaries'; op: 'delete'; id: OperationalRowId };

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
  factionsById: Record<string, FactionRow>;
  personnelById: Record<string, PersonnelRow>;
  intelligenceRecordsById: Record<string, IntelligenceRecordRow>;
  eventsById: Record<string, EventRow>;
  turnSummariesById: Record<string, TurnSummaryRow>;
  reducerCalls: Record<string, ReducerCallState>;
  actions: SessionStoreActions;
}

export interface SessionStoreActions {
  setConnection: (connection: Partial<ConnectionState>) => void;
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
    factionsById: {},
    personnelById: {},
    intelligenceRecordsById: {},
    eventsById: {},
    turnSummariesById: {},
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

      hydrateSubscription(snapshot) {
        set((state) => {
          const sessionsById = { ...state.sessionsById };
          const playerSlotsByKey = { ...state.playerSlotsByKey };
          const publicGameStateBySessionId = { ...state.publicGameStateBySessionId };
          const privateFactionStateByKey = { ...state.privateFactionStateByKey };
          const factionsById = { ...state.factionsById };
          const personnelById = { ...state.personnelById };
          const intelligenceRecordsById = { ...state.intelligenceRecordsById };
          const eventsById = { ...state.eventsById };
          const turnSummariesById = { ...state.turnSummariesById };

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
          for (const faction of snapshot.factions ?? []) {
            factionsById[String(faction.id)] = faction;
          }
          for (const person of snapshot.personnel ?? []) {
            personnelById[String(person.id)] = person;
          }
          for (const record of snapshot.intelligenceRecords ?? []) {
            intelligenceRecordsById[String(record.id)] = record;
          }
          for (const event of snapshot.events ?? []) {
            eventsById[String(event.id)] = event;
          }
          for (const summary of snapshot.turnSummaries ?? []) {
            turnSummariesById[String(summary.id)] = summary;
          }

          return {
            sessionsById,
            playerSlotsByKey,
            publicGameStateBySessionId,
            privateFactionStateByKey,
            factionsById,
            personnelById,
            intelligenceRecordsById,
            eventsById,
            turnSummariesById,
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
  return selectPublicGameStateForSession(state, state.activeSessionId);
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
  return selectPrivateFactionStateForSession(state, state.activeSessionId, factionId);
}

export function selectPrivateFactionStateForSession(
  state: SessionState,
  sessionId: OperationalRowId,
  factionId: OperationalRowId,
): PrivateFactionStateRow | null {
  return state.privateFactionStateByKey[privateFactionKey(String(sessionId), String(factionId))] ?? null;
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
    .sort((a, b) => compareOperationalIds(a.id, b.id));
}

export function selectPersonnelRoster(
  state: SessionState,
  factionId: OperationalRowId,
): PersonnelRow[] {
  return Object.values(state.personnelById)
    .filter((person) => String(person.factionId) === String(factionId))
    .sort((a, b) => compareOperationalIds(a.id, b.id));
}

export function selectIntelligenceRecords(
  state: SessionState,
  observerFactionId: OperationalRowId,
): IntelligenceRecordRow[] {
  return Object.values(state.intelligenceRecordsById)
    .filter((record) => String(record.observerFactionId) === String(observerFactionId))
    .sort((a, b) => b.acquiredTurn - a.acquiredTurn || compareOperationalIds(a.id, b.id));
}

export function selectEventsForSession(
  state: SessionState,
  sessionId: OperationalRowId,
  factionId?: OperationalRowId,
): EventRow[] {
  return Object.values(state.eventsById)
    .filter((event) => String(event.sessionId) === String(sessionId))
    .filter(
      (event) =>
        factionId == null ||
        event.factionId == null ||
        String(event.factionId) === String(factionId),
    )
    .sort((a, b) => b.turn - a.turn || compareOperationalIds(a.id, b.id));
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
      .sort((a, b) => b.turn - a.turn || compareOperationalIds(b.id, a.id))[0] ?? null
  );
}

export function selectReducerCall(state: SessionState, key: string): ReducerCallState | null {
  return state.reducerCalls[key] ?? null;
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
    const factionsById = { ...state.factionsById };
    if (event.op === 'delete') {
      delete factionsById[String(event.id)];
    } else {
      factionsById[String(event.row.id)] = event.row;
    }
    return { factionsById };
  }

  if (event.table === 'personnel') {
    const personnelById = { ...state.personnelById };
    if (event.op === 'delete') {
      delete personnelById[String(event.id)];
    } else {
      personnelById[String(event.row.id)] = event.row;
    }
    return { personnelById };
  }

  if (event.table === 'events') {
    const eventsById = { ...state.eventsById };
    if (event.op === 'delete') {
      delete eventsById[String(event.id)];
    } else {
      eventsById[String(event.row.id)] = event.row;
    }
    return { eventsById };
  }

  if (event.table === 'turnSummaries') {
    const turnSummariesById = { ...state.turnSummariesById };
    if (event.op === 'delete') {
      delete turnSummariesById[String(event.id)];
    } else {
      turnSummariesById[String(event.row.id)] = event.row;
    }
    return { turnSummariesById };
  }

  const intelligenceRecordsById = { ...state.intelligenceRecordsById };
  if (event.op === 'delete') {
    delete intelligenceRecordsById[String(event.id)];
  } else {
    intelligenceRecordsById[String(event.row.id)] = event.row;
  }
  return { intelligenceRecordsById };
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

function compareOperationalIds(a: OperationalRowId, b: OperationalRowId): number {
  const numericA = Number(a);
  const numericB = Number(b);
  if (Number.isFinite(numericA) && Number.isFinite(numericB)) {
    return numericA - numericB;
  }
  return String(a).localeCompare(String(b));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'unknown reducer error';
}
