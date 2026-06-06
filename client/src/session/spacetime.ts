import { useEffect, useMemo } from 'react';
import { useSpacetimeDB, useTable } from 'spacetimedb/react';
import { readHostedRuntime } from '../config/hostedRuntime';
import { DbConnection, tables } from '../module_bindings';
import type {
  CelestialBodies,
  Factions,
  GameSessions,
  PublicCityProjection,
  PublicColonyShipProjection,
  PublicEventProjection,
  PublicFactionProjection,
  PublicFleetProjection,
} from '../module_bindings/types';
import type { PlayerSlot, SessionChoice, SetupState, SlotChoice } from '../routes/types';
import {
  createDbConnectionTransport,
  createSpacetimeClient,
  type DbConnectionLike,
  type SpacetimeClient,
} from '../spacetime/client';
import { defaultClientConfig } from '../spacetime/config';
import {
  sessionStore as sharedSessionStore,
  type PlayerSlotRow,
  type PublicGameStateRow,
  type PublicWorldBodyRow,
  type PublicWorldCityProjectionRow,
  type PublicColonyShipProjectionRow,
  type PublicEventProjectionRow,
  type PublicFactionProjectionRow,
  type PublicFleetProjectionRow,
  type SessionRow,
  type SessionStatus,
  type SessionStore as SharedSessionStore,
} from '../state/session-store';

const AUTH_TOKEN_KEY = 'solar-dominion-auth-token';

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
  seedDemoWorld(input: { sessionId: number }): Promise<void>;
}

interface BackendOptions {
  conn: DbConnection | null;
  isConnected: boolean;
  identity: string | null;
  sessions: readonly GameSessions[];
  factions: readonly Factions[];
}

export interface SpacetimeSessionStoreSnapshot {
  isConnected: boolean;
  identity: string | null;
  sessions: readonly GameSessions[];
  factions: readonly Factions[];
  worldBodies: readonly CelestialBodies[];
  publicFactions: readonly PublicFactionProjection[];
  publicCities: readonly PublicCityProjection[];
  publicFleets: readonly PublicFleetProjection[];
  publicColonyShips: readonly PublicColonyShipProjection[];
  publicEvents: readonly PublicEventProjection[];
}

interface SlotMetadata {
  slot_key?: string;
  slot_name?: string;
  claim_status?: string;
}

export function createConnectionBuilder() {
  const runtime = readHostedRuntime();
  return DbConnection.builder()
    .withUri(runtime.spacetimeUri)
    .withDatabaseName(runtime.spacetimeDbName)
    .withToken(readAuthToken());
}

export function useSpacetimeSessionBackend(): SessionBackend {
  const { isActive, identity, token, getConnection } = useSpacetimeDB();
  const conn = getConnection() as DbConnection | null;
  const [sessions] = useTable(tables.game_sessions);
  const [factions] = useTable(tables.factions);
  const [worldBodies] = useTable(tables.celestial_bodies);
  const [publicFactions] = useTable(tables.public_factions);
  const [publicCities] = useTable(tables.public_cities);
  const [publicFleets] = useTable(tables.public_fleets);
  const [publicColonyShips] = useTable(tables.public_colony_ships);
  const [publicEvents] = useTable(tables.public_events);

  useEffect(() => {
    if (token) {
      saveAuthToken(token);
    }
  }, [token]);

  useEffect(() => {
    if (!conn || !isActive) {
      return;
    }

    conn.subscriptionBuilder().subscribe([
      tables.game_sessions,
      tables.factions,
      tables.celestial_bodies,
      tables.public_factions,
      tables.public_cities,
      tables.public_fleets,
      tables.public_colony_ships,
      tables.public_events,
    ]);
  }, [conn, isActive]);

  useEffect(() => {
    hydrateSessionStoreFromSpacetimeSnapshot({
      isConnected: isActive,
      identity: identity?.toHexString() ?? null,
      sessions,
      factions,
      worldBodies,
      publicFactions,
      publicCities,
      publicFleets,
      publicColonyShips,
      publicEvents,
    });
  }, [
    factions,
    identity,
    isActive,
    publicCities,
    publicColonyShips,
    publicEvents,
    publicFactions,
    publicFleets,
    sessions,
    worldBodies,
  ]);

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

      const rows = readSessionRows(conn, sessions, factions);
      const sessionId = assertSessionId(state.sessionId);
      const session = assertSession(rows.sessions, sessionId);
      const playerSlot = state.playerSlot ?? firstJoinableSlot(session, rows.factions, identity);
      const slot = deriveSlotChoices(session, rows.factions, identity).find(choice => choice.key === playerSlot);

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

      const beforeRows = readSessionRows(conn, sessions, factions);
      const playerAName =
        state.playerSlot === 'player_b'
          ? normalizeCreateName(state.opponentName, 'Player A')
          : normalizeCreateName(state.playerName, 'Player A');
      const playerBName =
        state.playerSlot === 'player_b'
          ? normalizeCreateName(state.playerName, 'Player B')
          : normalizeCreateName(state.opponentName, 'Player B');

      assertDistinctSlotNames(playerAName, playerBName);
      assertNoDuplicateSetupSession({ playerAName, playerBName }, beforeRows.sessions, beforeRows.factions);
      const beforeSessionIds = new Set(beforeRows.sessions.map(session => session.id));

      try {
        await sessionReducers(conn).createSession({ playerAName, playerBName });
      } catch (err) {
        throw createActionableCreateSessionError(err);
      }

      const created = await waitForCreatedSession(conn, beforeSessionIds, sessions, factions);
      const playerSlot = state.playerSlot ?? 'player_a';
      const slot = deriveSlotChoices(created.session, created.factions, identity).find(choice => choice.key === playerSlot);

      if (!slot || slot.factionId === undefined) {
        throw new Error(`slot ${playerSlot} not found for created session ${created.session.id}`);
      }

      if (slot.status === 'occupied') {
        throw new Error(`${slot.label} is occupied. ${slot.recovery}`);
      }

      await sessionReducers(conn).joinOrResumeSession({
        sessionId: created.session.id,
        playerSlot,
      });

      // Seed a turn-1 world so the session is immediately playable (star map,
      // cities, personnel). Idempotent server-side; best-effort so a seed hiccup
      // never blocks entering the session.
      try {
        await sessionReducers(conn).seedDemoWorld({ sessionId: created.session.id });
      } catch (err) {
        console.error('seed_demo_world failed for session', created.session.id, err);
      }

      return {
        sessionId: created.session.id,
        factionId: slot.factionId,
        playerSlot,
        playerName: state.playerName,
        isResume: false,
      };
    },
  };
}

export function hydrateSessionStoreFromSpacetimeSnapshot(
  snapshot: SpacetimeSessionStoreSnapshot,
  store: SharedSessionStore = sharedSessionStore
): void {
  const actions = store.getState().actions;
  actions.setConnection({
    status: snapshot.isConnected ? 'connected' : 'disconnected',
    identity: snapshot.identity,
  });
  actions.hydrateSubscription({
    sessions: snapshot.sessions.map(toSessionRow),
    playerSlots: snapshot.factions
      .map(faction => toPlayerSlotRow(faction, snapshot.identity))
      .filter((slot): slot is PlayerSlotRow => Boolean(slot)),
    publicGameStates: toPublicGameStateRows(snapshot.sessions, snapshot.publicFactions),
    worldBodies: snapshot.worldBodies.map(row => withPublicVisibility(row)),
    publicFactions: snapshot.publicFactions.map(row => withPublicVisibility(row)),
    publicCities: snapshot.publicCities.map(row => withPublicVisibility(row)),
    publicFleets: snapshot.publicFleets.map(row => withPublicVisibility(row)),
    publicColonyShips: snapshot.publicColonyShips.map(row => withPublicVisibility(row)),
    publicEvents: snapshot.publicEvents.map(row => withPublicVisibility(row)),
  });
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

interface SessionRows {
  sessions: readonly GameSessions[];
  factions: readonly Factions[];
}

interface IterableTable<T> {
  iter(): Iterable<T>;
}

interface LiveSessionTables {
  db?: {
    game_sessions?: IterableTable<GameSessions>;
    factions?: IterableTable<Factions>;
  };
}

function readSessionRows(
  conn: DbConnection,
  fallbackSessions: readonly GameSessions[],
  fallbackFactions: readonly Factions[]
): SessionRows {
  const live = conn as unknown as LiveSessionTables;
  return {
    sessions: live.db?.game_sessions ? Array.from(live.db.game_sessions.iter()) : fallbackSessions,
    factions: live.db?.factions ? Array.from(live.db.factions.iter()) : fallbackFactions,
  };
}

async function waitForCreatedSession(
  conn: DbConnection,
  beforeSessionIds: ReadonlySet<number>,
  fallbackSessions: readonly GameSessions[],
  fallbackFactions: readonly Factions[]
): Promise<{ session: GameSessions; factions: readonly Factions[] }> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rows = readSessionRows(conn, fallbackSessions, fallbackFactions);
    const session = findCreatedSession(rows.sessions, beforeSessionIds);
    if (session) {
      return { session, factions: rows.factions };
    }

    await new Promise(resolve => setTimeout(resolve, 0));
  }

  throw new Error('created session was not visible after create_session completed');
}

function findCreatedSession(
  sessions: readonly GameSessions[],
  beforeSessionIds: ReadonlySet<number>
): GameSessions | undefined {
  return sessions
    .filter(session =>
      !beforeSessionIds.has(session.id) &&
      session.playerAFactionId !== undefined &&
      session.playerBFactionId !== undefined
    )
    .slice()
    .sort((left, right) => right.id - left.id)[0];
}

function normalizeCreateName(value: string | undefined, fallback: string): string {
  const normalized = value?.trim().replace(/\s+/g, ' ') ?? '';
  return normalized || fallback;
}

function canonicalSlotName(name: string): string {
  return normalizeCreateName(name, '').toLocaleLowerCase('en-US');
}

function canonicalSlotPair(names: readonly string[]): string {
  return names.map(canonicalSlotName).sort().join('\0');
}

function assertDistinctSlotNames(playerAName: string, playerBName: string): void {
  if (canonicalSlotName(playerAName) === canonicalSlotName(playerBName)) {
    throw new Error('player and opponent names must be different');
  }
}

function assertNoDuplicateSetupSession(
  requested: { playerAName: string; playerBName: string },
  sessions: readonly GameSessions[],
  factions: readonly Factions[]
): void {
  const requestedPair = canonicalSlotPair([requested.playerAName, requested.playerBName]);

  for (const session of sessions) {
    if (session.state !== 'setup') {
      continue;
    }

    const names = factions
      .filter(faction => faction.sessionId === session.id)
      .map(faction => faction.name);

    if (names.length === 2 && canonicalSlotPair(names) === requestedPair) {
      throw new Error('setup session already exists for these faction slots. Choose Resume Session or use different names.');
    }
  }
}

function createActionableCreateSessionError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (/fatal error|internal/i.test(msg)) {
    return new Error(
      'Create session failed before setup completed. Use non-empty, unique player and opponent names, or resume an existing setup session.'
    );
  }

  return err instanceof Error ? err : new Error(msg);
}

function toSessionRow(session: GameSessions): SessionRow {
  return {
    id: String(session.id),
    code: `SOL-${session.id}`,
    status: toSessionStatus(session.state),
    currentTurn: session.currentTurn,
    phase: session.turnPhase,
  };
}

function toSessionStatus(state: string): SessionStatus {
  if (state === 'active') return 'active';
  if (state === 'completed' || state === 'complete') return 'complete';
  if (state === 'creating') return 'creating';
  return 'lobby';
}

function toPlayerSlotRow(faction: Factions, identity: string | null): PlayerSlotRow | null {
  const metadata = parseSlotMetadata(faction);
  if (!metadata?.slot_key || !isFactionSlotKey(metadata.slot_key)) {
    return null;
  }

  const playerId = faction.playerId.toHexString();
  const occupied = metadata.claim_status === 'claimed';
  return {
    sessionId: String(faction.sessionId),
    slot: metadata.slot_key === 'player_a' ? 1 : 2,
    identity: occupied ? playerId : null,
    factionId: String(faction.id),
    factionName: metadata.slot_name ?? faction.name,
    playerName: occupied ? faction.name : null,
    occupied,
    visibility: occupied && playerId === identity ? 'own' : 'public',
  };
}

function toPublicGameStateRows(
  sessions: readonly GameSessions[],
  factions: readonly PublicFactionProjection[]
): PublicGameStateRow[] {
  return sessions.map(session => {
    const sessionId = String(session.id);
    const sessionFactions = factions.filter(faction => faction.sessionId === session.id);
    return {
      sessionId,
      turn: session.currentTurn,
      year: session.currentYear,
      phase: session.turnPhase,
      controlScores: Object.fromEntries(
        sessionFactions.map(faction => [String(faction.id), faction.controlScore])
      ),
      visibleFactionIds: sessionFactions.map(faction => String(faction.id)),
    };
  });
}

function withPublicVisibility(row: CelestialBodies): PublicWorldBodyRow;
function withPublicVisibility(row: PublicFactionProjection): PublicFactionProjectionRow;
function withPublicVisibility(row: PublicCityProjection): PublicWorldCityProjectionRow;
function withPublicVisibility(row: PublicFleetProjection): PublicFleetProjectionRow;
function withPublicVisibility(row: PublicColonyShipProjection): PublicColonyShipProjectionRow;
function withPublicVisibility(row: PublicEventProjection): PublicEventProjectionRow;
function withPublicVisibility<T extends object>(row: T): T & { visibility: 'public' } {
  return { ...row, visibility: 'public' };
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

function isFactionSlotKey(value: string): value is PlayerSlot {
  return value === 'player_a' || value === 'player_b';
}
