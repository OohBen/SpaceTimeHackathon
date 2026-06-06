import { describe, expect, it } from 'vitest';
import {
  createSessionStore,
  selectActiveSession,
  selectConnectionStatus,
  selectCurrentPlayerSlot,
  selectIntelligenceRecords,
  selectPersonnelRoster,
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

  it('selects faction personnel rosters and intelligence records from hydrated private feeds', () => {
    const store = createSessionStore();

    store.getState().actions.hydrateSubscription({
      sessions: [
        {
          id: 'session-4',
          code: 'SOL-004',
          status: 'active',
          currentTurn: 5,
          phase: 'planning',
        },
      ],
      personnel: [
        {
          id: 'p-1',
          factionId: 'earth',
          name: 'Ada Watanabe',
          role: 'Chief Scientist',
          department: 'Research',
          postingCityId: 'city-1',
          competence: 88,
          creativity: 91,
          reliability: 76,
          ambition: 45,
          politicalSkill: 50,
          communication: 72,
          loyalty: 84,
          autonomyTolerance: 68,
          morale: 73,
          burnout: 12,
          salary: 18,
        },
        {
          id: 'p-2',
          factionId: 'mars',
          name: 'Vera Okoye',
          role: 'Defense Liaison',
          department: 'Defense',
          postingCityId: null,
          competence: 80,
          creativity: 55,
          reliability: 89,
          ambition: 64,
          politicalSkill: 70,
          communication: 67,
          loyalty: 78,
          autonomyTolerance: 40,
          morale: 66,
          burnout: 19,
          salary: 15,
        },
      ],
      intelligenceRecords: [
        {
          id: 'intel-1',
          observerFactionId: 'earth',
          targetFactionId: 'mars',
          intelType: 'scouting',
          value: '{"visible_bodies":["Mars","Luna"],"known_cities":["Pavonis"]}',
          accuracy: 82,
          acquiredTurn: 5,
        },
        {
          id: 'intel-2',
          observerFactionId: 'mars',
          targetFactionId: 'earth',
          intelType: 'signals',
          value: '{"known_cities":["New Geneva"]}',
          accuracy: 74,
          acquiredTurn: 4,
        },
      ],
    });

    expect(selectPersonnelRoster(store.getState(), 'earth').map((person) => person.name)).toEqual([
      'Ada Watanabe',
    ]);
    expect(selectPersonnelRoster(store.getState(), 'earth')[0].morale).toBe(73);
    expect(selectPersonnelRoster(store.getState(), 'earth')[0].burnout).toBe(12);
    expect(selectIntelligenceRecords(store.getState(), 'earth').map((intel) => intel.intelType)).toEqual([
      'scouting',
    ]);
    expect(selectIntelligenceRecords(store.getState(), 'earth')[0].accuracy).toBe(82);
  });

  it('applies personnel and intelligence upsert/delete events', () => {
    const store = createSessionStore();

    store.getState().actions.applySubscriptionEvent({
      table: 'personnel',
      op: 'upsert',
      row: {
        id: 'p-3',
        factionId: 'earth',
        name: 'Morgan Lee',
        role: 'Logistics Director',
        department: 'Logistics',
        postingCityId: null,
        competence: 77,
        creativity: 62,
        reliability: 86,
        ambition: 51,
        politicalSkill: 48,
        communication: 73,
        loyalty: 81,
        autonomyTolerance: 57,
        morale: 69,
        burnout: 21,
        salary: 16,
      },
    });
    store.getState().actions.applySubscriptionEvent({
      table: 'intelligenceRecords',
      op: 'upsert',
      row: {
        id: 'intel-3',
        observerFactionId: 'earth',
        targetFactionId: 'mars',
        intelType: 'survey',
        value: '{"body":"Callisto"}',
        accuracy: 67,
        acquiredTurn: 6,
      },
    });

    expect(selectPersonnelRoster(store.getState(), 'earth')).toHaveLength(1);
    expect(selectIntelligenceRecords(store.getState(), 'earth')).toHaveLength(1);

    store.getState().actions.applySubscriptionEvent({
      table: 'personnel',
      op: 'delete',
      id: 'p-3',
    });
    store.getState().actions.applySubscriptionEvent({
      table: 'intelligenceRecords',
      op: 'delete',
      id: 'intel-3',
    });

    expect(selectPersonnelRoster(store.getState(), 'earth')).toHaveLength(0);
    expect(selectIntelligenceRecords(store.getState(), 'earth')).toHaveLength(0);
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
