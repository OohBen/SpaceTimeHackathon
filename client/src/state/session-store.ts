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

export interface SubscriptionSnapshot {
  sessions?: SessionRow[];
  playerSlots?: PlayerSlotRow[];
  publicGameStates?: PublicGameStateRow[];
  privateFactionStates?: PrivateFactionStateRow[];
  worldBodies?: PublicWorldBodyRow[];
  publicFactions?: PublicFactionProjectionRow[];
  publicCities?: PublicWorldCityProjectionRow[];
  publicFleets?: PublicFleetProjectionRow[];
  publicColonyShips?: PublicColonyShipProjectionRow[];
  publicEvents?: PublicEventProjectionRow[];
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
  | { table: 'publicFactions'; op: 'upsert'; row: PublicFactionProjectionRow }
  | { table: 'publicFactions'; op: 'delete'; id: number }
  | { table: 'publicCities'; op: 'upsert'; row: PublicWorldCityProjectionRow }
  | { table: 'publicCities'; op: 'delete'; id: number }
  | { table: 'publicFleets'; op: 'upsert'; row: PublicFleetProjectionRow }
  | { table: 'publicFleets'; op: 'delete'; id: number }
  | { table: 'publicColonyShips'; op: 'upsert'; row: PublicColonyShipProjectionRow }
  | { table: 'publicColonyShips'; op: 'delete'; id: number }
  | { table: 'publicEvents'; op: 'upsert'; row: PublicEventProjectionRow }
  | { table: 'publicEvents'; op: 'delete'; id: number };

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
  worldBodiesById: Record<string, PublicWorldBodyRow>;
  publicFactionsById: Record<string, PublicFactionProjectionRow>;
  publicCitiesById: Record<string, PublicWorldCityProjectionRow>;
  publicFleetsById: Record<string, PublicFleetProjectionRow>;
  publicColonyShipsById: Record<string, PublicColonyShipProjectionRow>;
  publicEventsById: Record<string, PublicEventProjectionRow>;
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
    worldBodiesById: {},
    publicFactionsById: {},
    publicCitiesById: {},
    publicFleetsById: {},
    publicColonyShipsById: {},
    publicEventsById: {},
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
          const worldBodiesById = { ...state.worldBodiesById };
          const publicFactionsById = { ...state.publicFactionsById };
          const publicCitiesById = { ...state.publicCitiesById };
          const publicFleetsById = { ...state.publicFleetsById };
          const publicColonyShipsById = { ...state.publicColonyShipsById };
          const publicEventsById = { ...state.publicEventsById };

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
          indexById(worldBodiesById, snapshot.worldBodies);
          indexById(publicFactionsById, snapshot.publicFactions);
          indexById(publicCitiesById, snapshot.publicCities);
          indexById(publicFleetsById, snapshot.publicFleets);
          indexById(publicColonyShipsById, snapshot.publicColonyShips);
          indexById(publicEventsById, snapshot.publicEvents);

          return {
            sessionsById,
            playerSlotsByKey,
            publicGameStateBySessionId,
            privateFactionStateByKey,
            worldBodiesById,
            publicFactionsById,
            publicCitiesById,
            publicFleetsById,
            publicColonyShipsById,
            publicEventsById,
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

export function selectPrivateFactionState(
  state: SessionState,
  factionId: string,
): PrivateFactionStateRow | null {
  if (!state.activeSessionId) return null;
  return state.privateFactionStateByKey[privateFactionKey(state.activeSessionId, factionId)] ?? null;
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

  if (event.table === 'worldBodies') {
    const worldBodiesById = updateById(state.worldBodiesById, event);
    return { worldBodiesById };
  }
  if (event.table === 'publicFactions') {
    const publicFactionsById = updateById(state.publicFactionsById, event);
    return { publicFactionsById };
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

  const publicEventsById = updateById(state.publicEventsById, event);
  return { publicEventsById };
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

function entityKey(id: number): string {
  return String(id);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'unknown reducer error';
}
