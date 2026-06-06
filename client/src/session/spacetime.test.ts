import { describe, expect, it, vi } from 'vitest';
import {
  createSessionBackend,
  deriveSessionChoices,
  deriveSlotChoices,
  findOwnedSlot,
  hydrateSessionStoreFromSpacetimeSnapshot,
} from './spacetime';
import type { DbConnection } from '../module_bindings';
import type { Factions, GameSessions } from '../module_bindings/types';
import { createSessionStore } from '../state/session-store';

const identityA = {
  toHexString: () => 'aaaaaaaa',
};
const identityB = {
  toHexString: () => 'bbbbbbbb',
};
const identityPlaceholder = {
  toHexString: () => 'placeholder-player-a',
};

const session: GameSessions = {
  id: 7,
  state: 'setup',
  currentYear: 2150,
  currentTurn: 1,
  playerAFactionId: 101,
  playerBFactionId: 102,
  turnPhase: 'setup',
  turnDeadline: undefined,
  winnerFactionId: undefined,
  createdAt: {} as GameSessions['createdAt'],
  updatedAt: {} as GameSessions['updatedAt'],
};

function faction(
  id: number,
  slotKey: 'player_a' | 'player_b',
  playerId: Factions['playerId'],
  claimStatus: 'claimable' | 'claimed',
  name = slotKey === 'player_a' ? 'United Earth' : 'Mars Compact',
  sessionId = 7
): Factions {
  return {
    id,
    sessionId,
    playerId,
    name,
    credits: 1000,
    politicalCapital: 50,
    doctrineVector: JSON.stringify({
      slot: {
        slot_key: slotKey,
        slot_index: slotKey === 'player_a' ? 1 : 2,
        slot_name: name,
        claim_status: claimStatus,
        placeholder_player_id: `placeholder-${slotKey}`,
      },
    }),
    controlScore: 100,
    readyForTurn: false,
  };
}

describe('slot derivation', () => {
  it('lists available, occupied, and resumable slots for a session', () => {
    const slots = deriveSlotChoices(
      session,
      [faction(101, 'player_a', identityA as Factions['playerId'], 'claimed'), faction(102, 'player_b', identityPlaceholder as Factions['playerId'], 'claimable')],
      'aaaaaaaa'
    );

    expect(slots).toEqual([
      expect.objectContaining({ key: 'player_a', label: 'P1', status: 'yours' }),
      expect.objectContaining({ key: 'player_b', label: 'P2', status: 'available' }),
    ]);
  });

  it('marks another browser claim as occupied', () => {
    const slots = deriveSlotChoices(
      session,
      [faction(101, 'player_a', identityB as Factions['playerId'], 'claimed'), faction(102, 'player_b', identityPlaceholder as Factions['playerId'], 'claimable')],
      'aaaaaaaa'
    );

    expect(slots[0]).toMatchObject({
      key: 'player_a',
      status: 'occupied',
      recovery: 'Use the browser that claimed P1 or choose P2.',
    });
  });

  it('finds the persisted identity slot for resume', () => {
    const owned = findOwnedSlot(
      [session],
      [faction(101, 'player_a', identityA as Factions['playerId'], 'claimed'), faction(102, 'player_b', identityB as Factions['playerId'], 'claimed')],
      'bbbbbbbb'
    );

    expect(owned).toMatchObject({ sessionId: 7, playerSlot: 'player_b', factionId: 102 });
  });

  it('exposes active setup sessions as selectable choices', () => {
    expect(deriveSessionChoices([session])).toEqual([
      { id: 7, label: 'Session #7 - setup', state: 'setup' },
    ]);
  });
});

describe('create session backend', () => {
  it('creates a session, claims the selected slot, and returns game context', async () => {
    const sessions: GameSessions[] = [];
    const factions: Factions[] = [];
    const reducers = {
      createSession: vi.fn(async () => {
        sessions.push({
          ...session,
          id: 11,
          playerAFactionId: 101,
          playerBFactionId: 102,
        });
        factions.push(
          faction(101, 'player_a', identityPlaceholder as Factions['playerId'], 'claimable', 'Atlas', 11),
          faction(102, 'player_b', identityPlaceholder as Factions['playerId'], 'claimable', 'Mars Compact', 11)
        );
      }),
      joinOrResumeSession: vi.fn(async ({ sessionId, playerSlot }: { sessionId: number; playerSlot: 'player_a' | 'player_b' }) => {
        const factionId = playerSlot === 'player_a' ? 101 : 102;
        const row = factions.find(f => f.sessionId === sessionId && f.id === factionId);
        if (!row) throw new Error('faction not found');

        const parsed = JSON.parse(row.doctrineVector);
        parsed.slot.claim_status = 'claimed';
        row.playerId = identityA as Factions['playerId'];
        row.doctrineVector = JSON.stringify(parsed);
      }),
    };
    const conn = {
      reducers,
      db: {
        game_sessions: { iter: () => sessions.values() },
        factions: { iter: () => factions.values() },
      },
    } as unknown as DbConnection;
    const backend = createSessionBackend({
      conn,
      isConnected: true,
      identity: 'aaaaaaaa',
      sessions: [],
      factions: [],
    });

    const result = await backend.createAndJoin({
      mode: 'create',
      playerName: 'Atlas',
      opponentName: 'Mars Compact',
      playerSlot: 'player_a',
    });

    expect(reducers.createSession).toHaveBeenCalledWith({
      playerAName: 'Atlas',
      playerBName: 'Mars Compact',
    });
    expect(reducers.joinOrResumeSession).toHaveBeenCalledWith({
      sessionId: 11,
      playerSlot: 'player_a',
    });
    expect(result).toEqual({
      sessionId: 11,
      factionId: 101,
      playerSlot: 'player_a',
      playerName: 'Atlas',
      isResume: false,
    });
  });

  it('uses a default opponent name when the create form leaves opponent blank', async () => {
    const sessions: GameSessions[] = [];
    const factions: Factions[] = [];
    const reducers = {
      createSession: vi.fn(async () => {
        sessions.push({
          ...session,
          id: 12,
          playerAFactionId: 201,
          playerBFactionId: 202,
        });
        factions.push(
          faction(201, 'player_a', identityPlaceholder as Factions['playerId'], 'claimable', 'Atlas', 12),
          faction(202, 'player_b', identityPlaceholder as Factions['playerId'], 'claimable', 'Player B', 12)
        );
      }),
      joinOrResumeSession: vi.fn(async () => undefined),
    };
    const conn = {
      reducers,
      db: {
        game_sessions: { iter: () => sessions.values() },
        factions: { iter: () => factions.values() },
      },
    } as unknown as DbConnection;
    const backend = createSessionBackend({
      conn,
      isConnected: true,
      identity: 'aaaaaaaa',
      sessions: [],
      factions: [],
    });

    await backend.createAndJoin({
      mode: 'create',
      playerName: 'Atlas',
      opponentName: '',
      playerSlot: 'player_a',
    });

    expect(reducers.createSession).toHaveBeenCalledWith({
      playerAName: 'Atlas',
      playerBName: 'Player B',
    });
  });

  it('rejects duplicate setup slot names before calling the reducer', async () => {
    const reducers = {
      createSession: vi.fn(async () => undefined),
      joinOrResumeSession: vi.fn(async () => undefined),
    };
    const existingSession = {
      ...session,
      id: 21,
      state: 'setup',
      playerAFactionId: 301,
      playerBFactionId: 302,
    };
    const existingFactions = [
      faction(301, 'player_a', identityPlaceholder as Factions['playerId'], 'claimable', 'United Earth', 21),
      faction(302, 'player_b', identityPlaceholder as Factions['playerId'], 'claimable', 'Mars Compact', 21),
    ];
    const conn = {
      reducers,
      db: {
        game_sessions: { iter: () => [existingSession].values() },
        factions: { iter: () => existingFactions.values() },
      },
    } as unknown as DbConnection;
    const backend = createSessionBackend({
      conn,
      isConnected: true,
      identity: 'aaaaaaaa',
      sessions: [existingSession],
      factions: existingFactions,
    });

    await expect(
      backend.createAndJoin({
        mode: 'create',
        playerName: ' mars compact ',
        opponentName: 'UNITED   EARTH',
        playerSlot: 'player_a',
      })
    ).rejects.toThrow(/setup session already exists/i);
    expect(reducers.createSession).not.toHaveBeenCalled();
  });
});

describe('live SpacetimeDB store hydration', () => {
  it('hydrates the shared session store from generated public rows', () => {
    const store = createSessionStore();

    hydrateSessionStoreFromSpacetimeSnapshot(
      {
        isConnected: true,
        identity: 'aaaaaaaa',
        sessions: [{ ...session, id: 42, currentTurn: 3, currentYear: 2152 }],
        factions: [
          faction(101, 'player_a', identityA as Factions['playerId'], 'claimed', 'United Earth', 42),
          faction(102, 'player_b', identityB as Factions['playerId'], 'claimed', 'Mars Compact', 42),
        ],
        worldBodies: [
          {
            id: 10,
            sessionId: 42,
            name: 'Earth',
            systemTier: 'earth',
            commsLagTurns: 0,
            travelTimeTurns: 0,
            resourceDeposits: '{}',
            position: '{"x":0,"y":0}',
          },
        ],
        publicFactions: [
          { id: 101, sessionId: 42, name: 'United Earth', controlScore: 50, readyForTurn: false },
        ],
        publicCities: [
          { id: 201, sessionId: 42, bodyId: 10, factionId: 101, name: 'New Geneva', developmentStage: 'full' },
        ],
        publicFleets: [
          { id: 301, factionId: 101, postingCityId: 201, strength: 24 },
        ],
        publicColonyShips: [
          { id: 401, factionId: 101, destinationBodyId: 10, arrivesTurn: 4, status: 'in_transit' },
        ],
        publicEvents: [
          { id: 501, sessionId: 42, turn: 3, eventType: 'session_seeded' },
        ],
      },
      store
    );

    const state = store.getState();
    expect(state.connection.status).toBe('connected');
    expect(state.connection.identity).toBe('aaaaaaaa');
    expect(state.sessionsById['42']).toMatchObject({ id: '42', currentTurn: 3, phase: 'setup' });
    expect(state.publicGameStateBySessionId['42']).toMatchObject({ year: 2152, controlScores: { '101': 50 } });
    expect(state.playerSlotsByKey['42:1']).toMatchObject({ factionName: 'United Earth', occupied: true });
    expect(state.worldBodiesById['10']).toMatchObject({ name: 'Earth', visibility: 'public' });
    expect(state.publicCitiesById['201']).toMatchObject({ name: 'New Geneva', visibility: 'public' });
    expect(state.publicFleetsById['301']).toMatchObject({ strength: 24, visibility: 'public' });
    expect(state.publicColonyShipsById['401']).toMatchObject({ status: 'in_transit', visibility: 'public' });
    expect(state.publicEventsById['501']).toMatchObject({ eventType: 'session_seeded', visibility: 'public' });
  });
});
