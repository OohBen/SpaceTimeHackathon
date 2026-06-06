import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ReducerCallDescriptor } from '../spacetime/reducers';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
export type SessionStatus = 'creating' | 'lobby' | 'active' | 'complete';
export type VisibilityScope = 'public' | 'own' | 'ownFaction';

export interface ConnectionState {
  status: ConnectionStatus;
  identity: string | null;
  error: string | null;
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

export interface SubscriptionSnapshot {
  sessions?: SessionRow[];
  playerSlots?: PlayerSlotRow[];
  publicGameStates?: PublicGameStateRow[];
  privateFactionStates?: PrivateFactionStateRow[];
}

export type SubscriptionEvent =
  | { table: 'sessions'; op: 'upsert'; row: SessionRow }
  | { table: 'sessions'; op: 'delete'; id: string }
  | { table: 'playerSlots'; op: 'upsert'; row: PlayerSlotRow }
  | { table: 'playerSlots'; op: 'delete'; sessionId: string; slot: number }
  | { table: 'publicGameStates'; op: 'upsert'; row: PublicGameStateRow }
  | { table: 'publicGameStates'; op: 'delete'; sessionId: string }
  | { table: 'privateFactionStates'; op: 'upsert'; row: PrivateFactionStateRow }
  | { table: 'privateFactionStates'; op: 'delete'; sessionId: string; factionId: string };

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
};

export function createSessionStore(): SessionStore {
  return createStore<SessionState>()((set) => ({
    connection: initialConnection,
    activeSessionId: null,
    sessionsById: {},
    playerSlotsByKey: {},
    publicGameStateBySessionId: {},
    privateFactionStateByKey: {},
    reducerCalls: {},
    actions: {
      setConnection(connection) {
        set((state) => ({
          connection: {
            ...state.connection,
            ...connection,
            error: connection.error ?? null,
          },
        }));
      },

      hydrateSubscription(snapshot) {
        set((state) => {
          const sessionsById = { ...state.sessionsById };
          const playerSlotsByKey = { ...state.playerSlotsByKey };
          const publicGameStateBySessionId = { ...state.publicGameStateBySessionId };
          const privateFactionStateByKey = { ...state.privateFactionStateByKey };

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

          return {
            sessionsById,
            playerSlotsByKey,
            publicGameStateBySessionId,
            privateFactionStateByKey,
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

  const privateFactionStateByKey = { ...state.privateFactionStateByKey };
  if (event.op === 'delete') {
    delete privateFactionStateByKey[privateFactionKey(event.sessionId, event.factionId)];
  } else {
    privateFactionStateByKey[privateFactionKey(event.row.sessionId, event.row.factionId)] =
      event.row;
  }
  return { privateFactionStateByKey };
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

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'unknown reducer error';
}
