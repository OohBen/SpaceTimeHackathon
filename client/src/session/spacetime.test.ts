import { describe, expect, it } from 'vitest';
import { createSessionBackend, deriveSessionChoices, deriveSlotChoices, findOwnedSlot } from './spacetime';
import type { DbConnection } from '../module_bindings';
import type { Factions, GameSessions } from '../module_bindings/types';
import { reducerRegistry } from '../spacetime/reducers';

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
  name = slotKey === 'player_a' ? 'United Earth' : 'Mars Compact'
): Factions {
  return {
    id,
    sessionId: 7,
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

describe('createSessionBackend wiring', () => {
  it('exposes a SpacetimeClient backed by the live DbConnection when conn is present', () => {
    const calls: Array<{ method: string; args: unknown }> = [];
    const reducers = new Proxy({}, {
      get(_target, prop: string) {
        return (args: unknown) => {
          calls.push({ method: prop, args });
        };
      },
    }) as Record<string, (args: unknown) => unknown>;
    const conn = {
      reducers,
      subscriptionBuilder: () => ({ subscribe: () => undefined }),
    } as unknown as DbConnection;

    const backend = createSessionBackend({
      conn,
      isConnected: true,
      identity: 'identity-a',
      sessions: [],
      factions: [],
    });

    expect(backend.client).not.toBeNull();
    backend.client?.connect();
    backend.client?.callReducer(reducerRegistry.submitTurn({ factionId: 7 }));
    backend.client?.callReducer(
      reducerRegistry.commanderDecision({
        factionId: 7,
        proposalId: 11,
        decision: 'approved',
        allocation: 50,
      }),
    );

    expect(calls).toEqual([
      { method: 'submitTurn', args: { factionId: 7 } },
      {
        method: 'commanderDecision',
        args: { factionId: 7, proposalId: 11, decision: 'approved', allocation: 50 },
      },
    ]);
  });

  it('returns client=null when conn is not yet connected', () => {
    const backend = createSessionBackend({
      conn: null,
      isConnected: false,
      identity: null,
      sessions: [],
      factions: [],
    });

    expect(backend.client).toBeNull();
  });
});
