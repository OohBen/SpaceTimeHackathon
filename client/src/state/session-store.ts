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

export interface PublicFactionRow {
  id: string;
  sessionId: string;
  name: string;
  controlScore: number;
  readyForTurn: boolean;
}

export interface PrivateFactionStateRow {
  sessionId: string;
  factionId: string;
  resources: Record<string, number>;
  morale: number;
  doctrine: string;
  visibility: Extract<VisibilityScope, 'ownFaction'>;
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

export interface SubscriptionSnapshot {
  sessions?: SessionRow[];
  playerSlots?: PlayerSlotRow[];
  publicGameStates?: PublicGameStateRow[];
  publicFactions?: PublicFactionRow[];
  privateFactionStates?: PrivateFactionStateRow[];
  proposals?: ProposalRow[];
}

export type SubscriptionEvent =
  | { table: 'sessions'; op: 'upsert'; row: SessionRow }
  | { table: 'sessions'; op: 'delete'; id: string }
  | { table: 'playerSlots'; op: 'upsert'; row: PlayerSlotRow }
  | { table: 'playerSlots'; op: 'delete'; sessionId: string; slot: number }
  | { table: 'publicGameStates'; op: 'upsert'; row: PublicGameStateRow }
  | { table: 'publicGameStates'; op: 'delete'; sessionId: string }
  | { table: 'publicFactions'; op: 'upsert'; row: PublicFactionRow }
  | { table: 'publicFactions'; op: 'delete'; sessionId: string; id: string }
  | { table: 'privateFactionStates'; op: 'upsert'; row: PrivateFactionStateRow }
  | { table: 'privateFactionStates'; op: 'delete'; sessionId: string; factionId: string }
  | { table: 'proposals'; op: 'upsert'; row: ProposalRow }
  | { table: 'proposals'; op: 'delete'; id: string };

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
  publicFactionsByKey: Record<string, PublicFactionRow>;
  privateFactionStateByKey: Record<string, PrivateFactionStateRow>;
  proposalsById: Record<string, ProposalRow>;
  proposalsSubscription: SubscriptionLoadStatus;
  reducerCalls: Record<string, ReducerCallState>;
  actions: SessionStoreActions;
}

export interface SessionStoreActions {
  setConnection: (connection: Partial<ConnectionState>) => void;
  hydrateSubscription: (snapshot: SubscriptionSnapshot) => void;
  applySubscriptionEvent: (event: SubscriptionEvent) => void;
  setProposalsSubscription: (status: SubscriptionLoadStatus) => void;
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
    publicFactionsByKey: {},
    privateFactionStateByKey: {},
    proposalsById: {},
    proposalsSubscription: { status: 'idle' },
    reducerCalls: {},
    actions: {
      setProposalsSubscription(status) {
        set(() => ({ proposalsSubscription: status }));
      },

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
          const publicFactionsByKey = { ...state.publicFactionsByKey };
          const privateFactionStateByKey = { ...state.privateFactionStateByKey };
          const proposalsById = { ...state.proposalsById };

          for (const session of snapshot.sessions ?? []) {
            sessionsById[session.id] = session;
          }
          for (const slot of snapshot.playerSlots ?? []) {
            playerSlotsByKey[playerSlotKey(slot.sessionId, slot.slot)] = slot;
          }
          for (const gameState of snapshot.publicGameStates ?? []) {
            publicGameStateBySessionId[gameState.sessionId] = gameState;
          }
          for (const faction of snapshot.publicFactions ?? []) {
            publicFactionsByKey[publicFactionKey(faction.sessionId, faction.id)] = faction;
          }
          for (const factionState of snapshot.privateFactionStates ?? []) {
            privateFactionStateByKey[
              privateFactionKey(factionState.sessionId, factionState.factionId)
            ] = factionState;
          }
          for (const proposal of snapshot.proposals ?? []) {
            proposalsById[proposal.id] = proposal;
          }

          const proposalsSubscription: SubscriptionLoadStatus =
            snapshot.proposals !== undefined ? { status: 'ready' } : state.proposalsSubscription;

          return {
            sessionsById,
            playerSlotsByKey,
            publicGameStateBySessionId,
            publicFactionsByKey,
            privateFactionStateByKey,
            proposalsById,
            proposalsSubscription,
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

export function selectPublicFactionsForActiveSession(state: SessionState): PublicFactionRow[] {
  if (!state.activeSessionId) return [];

  return Object.values(state.publicFactionsByKey)
    .filter((faction) => faction.sessionId === state.activeSessionId)
    .sort((a, b) => a.id.localeCompare(b.id));
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

export function selectProposalsSubscriptionStatus(state: SessionState): SubscriptionLoadStatus {
  return state.proposalsSubscription;
}

export function selectProposalById(state: SessionState, id: string): ProposalRow | null {
  return state.proposalsById[id] ?? null;
}

export function selectInboxProposalsForCurrentPlayer(state: SessionState): ProposalRow[] {
  const activeSessionId = state.activeSessionId;
  const slot = selectCurrentPlayerSlot(state);
  if (!activeSessionId || !slot) return [];

  return Object.values(state.proposalsById)
    .filter(
      (proposal) =>
        proposal.sessionId === activeSessionId && proposal.factionId === slot.factionId,
    )
    .sort((a, b) => {
      if (a.turn !== b.turn) return b.turn - a.turn;
      return a.id.localeCompare(b.id);
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

  if (event.table === 'publicFactions') {
    const publicFactionsByKey = { ...state.publicFactionsByKey };
    if (event.op === 'delete') {
      delete publicFactionsByKey[publicFactionKey(event.sessionId, event.id)];
    } else {
      publicFactionsByKey[publicFactionKey(event.row.sessionId, event.row.id)] = event.row;
    }
    return { publicFactionsByKey };
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

  const proposalsById = { ...state.proposalsById };
  if (event.op === 'delete') {
    delete proposalsById[event.id];
  } else {
    proposalsById[event.row.id] = event.row;
  }
  return { proposalsById };
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

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'unknown reducer error';
}
