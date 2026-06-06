import { useEffect, useMemo } from 'react';
import { useSpacetimeDB, useTable } from 'spacetimedb/react';
import { DbConnection, tables } from '../module_bindings';
import type { Factions, GameSessions } from '../module_bindings/types';
import type { PlayerSlot, SessionChoice, SetupState, SlotChoice } from '../routes/types';
import {
  createDbConnectionTransport,
  createSpacetimeClient,
  type DbConnectionLike,
  type SpacetimeClient,
} from '../spacetime/client';
import { defaultClientConfig } from '../spacetime/config';

const AUTH_TOKEN_KEY = 'solar-dominion-auth-token';
const DEFAULT_SPACETIMEDB_URI = 'http://localhost:3000';
const DEFAULT_MODULE_NAME = 'solar-dominion';

export interface SessionBackendResult {
  sessionId: number;
  factionId: number;
  playerSlot: PlayerSlot;
  playerName: string;
  isResume: boolean;
}

export interface SessionBackend {
  isConnected: boolean;
  identity: string | null;
  sessions: readonly GameSessions[];
  factions: readonly Factions[];
  /**
   * Reducer-call client backed by the live `DbConnection` when one is
   * available, or `null` while the connection is still bootstrapping. UI code
   * dispatching turn-pipeline actions through `client/src/spacetime/session-actions`
   * pulls this off the backend so calls actually reach the server (instead of
   * the no-op `defaultTransport`).
   */
  client: SpacetimeClient | null;
  getSessionChoices(): SessionChoice[];
  getSlotChoices(sessionId?: number): SlotChoice[];
  joinOrResume(state: SetupState): Promise<SessionBackendResult>;
  createAndJoin(state: SetupState): Promise<SessionBackendResult>;
}

interface SessionReducers {
  joinOrResumeSession(input: { sessionId: number; playerSlot: PlayerSlot }): Promise<void>;
  createSession(input: { playerAName: string; playerBName: string }): Promise<void>;
}

interface BackendOptions {
  conn: DbConnection | null;
  isConnected: boolean;
  identity: string | null;
  sessions: readonly GameSessions[];
  factions: readonly Factions[];
}

interface SlotMetadata {
  slot_key?: string;
  slot_name?: string;
  claim_status?: string;
}

export function createConnectionBuilder() {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return DbConnection.builder()
    .withUri(env?.VITE_SPACETIMEDB_URI ?? DEFAULT_SPACETIMEDB_URI)
    .withDatabaseName(env?.VITE_SPACETIMEDB_MODULE ?? DEFAULT_MODULE_NAME)
    .withToken(readAuthToken());
}

export function useSpacetimeSessionBackend(): SessionBackend {
  const { isActive, identity, token, getConnection } = useSpacetimeDB();
  const conn = getConnection() as DbConnection | null;
  const [sessions] = useTable(tables.game_sessions);
  const [factions] = useTable(tables.factions);

  useEffect(() => {
    if (token) {
      saveAuthToken(token);
    }
  }, [token]);

  useEffect(() => {
    if (!conn || !isActive) {
      return;
    }

    conn.subscriptionBuilder().subscribe([tables.game_sessions, tables.factions]);
  }, [conn, isActive]);

  return useMemo(
    () =>
      createSessionBackend({
        conn,
        isConnected: isActive,
        identity: identity?.toHexString() ?? null,
        sessions,
        factions,
      }),
    [conn, factions, identity, isActive, sessions]
  );
}

export function createSessionBackend(options: BackendOptions): SessionBackend {
  const { conn, isConnected, identity, sessions, factions } = options;
  const client = conn ? buildSpacetimeClient(conn) : null;

  return {
    isConnected,
    identity,
    sessions,
    factions,
    client,
    getSessionChoices: () => deriveSessionChoices(sessions),
    getSlotChoices: (sessionId?: number) => {
      const session = resolveSession(sessions, sessionId);
      return session ? deriveSlotChoices(session, factions, identity) : defaultSlotChoices();
    },
    joinOrResume: async (state: SetupState) => {
      if (!conn || !isConnected) {
        throw new Error('SpacetimeDB connection is not ready');
      }

      const sessionId = assertSessionId(state.sessionId);
      const session = assertSession(sessions, sessionId);
      const playerSlot = state.playerSlot ?? firstJoinableSlot(session, factions, identity);
      const slot = deriveSlotChoices(session, factions, identity).find(choice => choice.key === playerSlot);

      if (!slot) {
        throw new Error(`slot ${playerSlot} not found for session ${sessionId}`);
      }

      if (slot.status === 'occupied') {
        throw new Error(`${slot.label} is occupied. ${slot.recovery}`);
      }

      await sessionReducers(conn).joinOrResumeSession({ sessionId, playerSlot });

      return {
        sessionId,
        factionId: slot.factionId ?? 0,
        playerSlot,
        playerName: state.playerName,
        isResume: slot.status === 'yours',
      };
    },
    createAndJoin: async (state: SetupState) => {
      if (!conn || !isConnected) {
        throw new Error('SpacetimeDB connection is not ready');
      }

      const playerAName = state.playerSlot === 'player_b' ? (state.opponentName ?? 'Player A') : state.playerName;
      const playerBName = state.playerSlot === 'player_b' ? state.playerName : (state.opponentName ?? 'Player B');
      await sessionReducers(conn).createSession({ playerAName, playerBName });

      throw new Error('Session created. Select the new session ID, then join a slot.');
    },
  };
}

function sessionReducers(conn: DbConnection): SessionReducers {
  return conn.reducers as unknown as SessionReducers;
}

/**
 * Build a `SpacetimeClient` whose `callReducer` dispatches through the live
 * `DbConnection` via the snake_case→camelCase transport adapter. This is the
 * production wiring that lets `client/src/spacetime/session-actions` reach the
 * real server reducers (without it, every action goes to the no-op
 * `defaultTransport` and silently drops).
 */
function buildSpacetimeClient(conn: DbConnection): SpacetimeClient {
  const transport = createDbConnectionTransport(conn as unknown as DbConnectionLike);
  return createSpacetimeClient(defaultClientConfig(), { transport });
}

export function deriveSessionChoices(sessions: readonly GameSessions[]): SessionChoice[] {
  return sessions
    .filter(session => session.state === 'setup' || session.state === 'active')
    .slice()
    .sort((a, b) => a.id - b.id)
    .map(session => ({
      id: session.id,
      label: `Session #${session.id} - ${session.state}`,
      state: session.state,
    }));
}

export function deriveSlotChoices(
  session: GameSessions,
  factions: readonly Factions[],
  identity: string | null | undefined
): SlotChoice[] {
  return slotKeys().map(slotKey => {
    const label = slotKey === 'player_a' ? 'P1' : 'P2';
    const otherLabel = slotKey === 'player_a' ? 'P2' : 'P1';
    const factionId = slotKey === 'player_a' ? session.playerAFactionId : session.playerBFactionId;
    const faction = factions.find(row => row.id === factionId);
    const metadata = faction ? parseSlotMetadata(faction) : undefined;
    const owner = faction?.playerId.toHexString();
    const status =
      metadata?.claim_status === 'claimed'
        ? owner === identity
          ? 'yours'
          : 'occupied'
        : 'available';

    return {
      key: slotKey,
      label,
      factionId,
      factionName: metadata?.slot_name ?? faction?.name ?? 'Unassigned',
      status,
      recovery:
        status === 'occupied'
          ? `Use the browser that claimed ${label} or choose ${otherLabel}.`
          : status === 'yours'
            ? `Resume ${label} in this browser.`
            : 'Join this open slot.',
    };
  });
}

export function findOwnedSlot(
  sessions: readonly GameSessions[],
  factions: readonly Factions[],
  identity: string | null | undefined
): SessionBackendResult | null {
  if (!identity) {
    return null;
  }

  for (const session of sessions) {
    for (const choice of deriveSlotChoices(session, factions, identity)) {
      if (choice.status !== 'yours' || choice.factionId === undefined) {
        continue;
      }

      const faction = factions.find(row => row.id === choice.factionId);
      return {
        sessionId: session.id,
        factionId: choice.factionId,
        playerSlot: choice.key,
        playerName: faction?.name ?? choice.factionName,
        isResume: true,
      };
    }
  }

  return null;
}

function readAuthToken(): string | undefined {
  if (typeof localStorage === 'undefined') {
    return undefined;
  }

  return localStorage.getItem(AUTH_TOKEN_KEY) ?? undefined;
}

function saveAuthToken(token: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }
}

function resolveSession(
  sessions: readonly GameSessions[],
  sessionId: number | undefined
): GameSessions | undefined {
  if (sessionId !== undefined) {
    return sessions.find(session => session.id === sessionId);
  }

  return deriveSessionChoices(sessions)
    .map(choice => sessions.find(session => session.id === choice.id))
    .find((session): session is GameSessions => Boolean(session));
}

function assertSession(sessions: readonly GameSessions[], sessionId: number): GameSessions {
  const session = sessions.find(row => row.id === sessionId);
  if (!session) {
    throw new Error(`session ${sessionId} not found`);
  }

  return session;
}

function assertSessionId(sessionId: number | undefined): number {
  if (!Number.isInteger(sessionId) || sessionId === undefined || sessionId <= 0) {
    throw new Error('valid session ID is required');
  }

  return sessionId;
}

function firstJoinableSlot(
  session: GameSessions,
  factions: readonly Factions[],
  identity: string | null
): PlayerSlot {
  const slot = deriveSlotChoices(session, factions, identity).find(choice => choice.status !== 'occupied');
  return slot?.key ?? 'player_a';
}

function defaultSlotChoices(): SlotChoice[] {
  return slotKeys().map(slotKey => ({
    key: slotKey,
    label: slotKey === 'player_a' ? 'P1' : 'P2',
    factionName: 'Unknown',
    status: 'available',
    recovery: 'Enter a valid session ID.',
  }));
}

function parseSlotMetadata(faction: Factions): SlotMetadata | undefined {
  try {
    const parsed = JSON.parse(faction.doctrineVector) as { slot?: SlotMetadata };
    return parsed.slot;
  } catch {
    return undefined;
  }
}

function slotKeys(): readonly PlayerSlot[] {
  return ['player_a', 'player_b'];
}
