import { describe, expect, it } from 'vitest';
import {
  createSessionStore,
  selectActiveSession,
  selectConnectionStatus,
  selectCurrentPlayerSlot,
  selectPrivateFactionState,
  selectPublicGameState,
  selectReducerCall,
} from './session-store';

describe('session store', () => {
  it('normalizes hydrated subscription rows into typed session selectors', () => {
    const store = createSessionStore();

    store.getState().actions.setConnection({
      status: 'connected',
      identity: 'identity-player-1',
    });
    store.getState().actions.hydrateSubscription({
      sessions: [
        {
          id: 'session-1',
          code: 'SOL-001',
          status: 'active',
          currentTurn: 3,
          phase: 'planning',
        },
      ],
      playerSlots: [
        {
          sessionId: 'session-1',
          slot: 1,
          identity: 'identity-player-1',
          factionId: 'earth',
          factionName: 'Earth Directorate',
          playerName: 'Atlas',
          occupied: true,
          visibility: 'own',
        },
      ],
      publicGameStates: [
        {
          sessionId: 'session-1',
          turn: 3,
          year: 2142,
          phase: 'planning',
          controlScores: { earth: 41, mars: 37 },
          visibleFactionIds: ['earth', 'mars'],
        },
      ],
      privateFactionStates: [
        {
          sessionId: 'session-1',
          factionId: 'earth',
          resources: { energy: 120, metals: 80, science: 12 },
          morale: 74,
          doctrine: 'industrial',
          visibility: 'ownFaction',
        },
      ],
    });

    expect(selectConnectionStatus(store.getState())).toBe('connected');
    expect(selectActiveSession(store.getState())?.code).toBe('SOL-001');
    expect(selectCurrentPlayerSlot(store.getState())?.factionName).toBe('Earth Directorate');
    expect(selectPublicGameState(store.getState())?.controlScores.mars).toBe(37);
    expect(selectPrivateFactionState(store.getState(), 'earth')?.resources.energy).toBe(120);
  });

  it('applies subscription upsert and delete events without component glue', () => {
    const store = createSessionStore();

    store.getState().actions.applySubscriptionEvent({
      table: 'sessions',
      op: 'upsert',
      row: {
        id: 'session-2',
        code: 'SOL-002',
        status: 'lobby',
        currentTurn: 1,
        phase: 'lobby',
      },
    });
    store.getState().actions.applySubscriptionEvent({
      table: 'sessions',
      op: 'upsert',
      row: {
        id: 'session-2',
        code: 'SOL-002',
        status: 'active',
        currentTurn: 2,
        phase: 'planning',
      },
    });

    expect(selectActiveSession(store.getState())?.status).toBe('active');
    expect(selectActiveSession(store.getState())?.currentTurn).toBe(2);

    store.getState().actions.applySubscriptionEvent({
      table: 'sessions',
      op: 'delete',
      id: 'session-2',
    });

    expect(selectActiveSession(store.getState())).toBeNull();
  });

  it('keeps private faction rows separate from public game state', () => {
    const store = createSessionStore();

    store.getState().actions.hydrateSubscription({
      sessions: [
        {
          id: 'session-3',
          code: 'SOL-003',
          status: 'active',
          currentTurn: 4,
          phase: 'resolution',
        },
      ],
      playerSlots: [],
      publicGameStates: [
        {
          sessionId: 'session-3',
          turn: 4,
          year: 2143,
          phase: 'resolution',
          controlScores: { earth: 45, mars: 44 },
          visibleFactionIds: ['earth', 'mars'],
        },
      ],
      privateFactionStates: [
        {
          sessionId: 'session-3',
          factionId: 'mars',
          resources: { energy: 45, metals: 140, science: 18 },
          morale: 63,
          doctrine: 'expansion',
          visibility: 'ownFaction',
        },
      ],
    });

    expect(selectPublicGameState(store.getState())).not.toHaveProperty('resources');
    expect(selectPrivateFactionState(store.getState(), 'mars')?.resources.metals).toBe(140);
  });

  it('tracks reducer loading, optimism, success, and errors coherently', () => {
    const store = createSessionStore();

    store.getState().actions.beginReducerCall(
      'createSession',
      { reducer: 'create_session', args: { playerName: 'Atlas' } },
      {
        kind: 'session',
        session: {
          id: 'optimistic-create',
          code: 'pending',
          status: 'creating',
          currentTurn: 0,
          phase: 'creating',
        },
      },
    );

    expect(selectReducerCall(store.getState(), 'createSession')?.status).toBe('loading');
    expect(selectActiveSession(store.getState())?.status).toBe('creating');

    store.getState().actions.completeReducerCall('createSession');
    expect(selectReducerCall(store.getState(), 'createSession')?.status).toBe('success');

    store.getState().actions.beginReducerCall('joinSession', {
      reducer: 'join_session',
      args: { sessionId: 'missing', playerName: 'Atlas' },
    });
    store.getState().actions.failReducerCall('joinSession', new Error('session not found'));

    expect(selectReducerCall(store.getState(), 'joinSession')?.status).toBe('error');
    expect(selectReducerCall(store.getState(), 'joinSession')?.error).toBe('session not found');
  });
});
