import { describe, expect, it } from 'vitest';
import {
  createSessionStore,
  selectActiveSession,
  selectConnectionStatus,
  selectCurrentPlayerSlot,
  selectInboxProposalsForCurrentPlayer,
  selectPrivateFactionState,
  selectProposalById,
  selectProposalsSubscriptionStatus,
  selectPublicGameState,
  selectReducerCall,
  selectLlmRequestsForCurrentPlayer,
  selectTurnSummaryForCurrentPlayer,
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

  it('exposes proposals for the current player faction and ignores other factions', () => {
    const store = createSessionStore();
    store.getState().actions.setConnection({
      status: 'connected',
      identity: 'identity-player-1',
    });
    store.getState().actions.hydrateSubscription({
      sessions: [
        {
          id: 'session-prop',
          code: 'SOL-prop',
          status: 'active',
          currentTurn: 5,
          phase: 'planning',
        },
      ],
      playerSlots: [
        {
          sessionId: 'session-prop',
          slot: 1,
          identity: 'identity-player-1',
          factionId: 'earth',
          factionName: 'Earth Directorate',
          playerName: 'Atlas',
          occupied: true,
          visibility: 'own',
        },
      ],
      proposals: [
        {
          id: 'prop-1',
          sessionId: 'session-prop',
          factionId: 'earth',
          turn: 5,
          proposingPersonnelId: 'officer-1',
          department: 'Industry',
          title: 'Refit Ceres',
          body: 'Refit details',
          resourceCost: 10,
          confidence: 'high',
          status: 'pending',
          decision: null,
        },
        {
          id: 'prop-2',
          sessionId: 'session-prop',
          factionId: 'mars',
          turn: 5,
          proposingPersonnelId: 'officer-9',
          department: 'Espionage',
          title: 'Sabotage convoy',
          body: 'Mars internal proposal',
          resourceCost: 4,
          confidence: 'medium',
          status: 'pending',
          decision: null,
        },
      ],
    });

    const proposals = selectInboxProposalsForCurrentPlayer(store.getState());
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.id).toBe('prop-1');
    expect(selectProposalById(store.getState(), 'prop-1')?.title).toBe('Refit Ceres');
    expect(selectProposalsSubscriptionStatus(store.getState())).toEqual({ status: 'ready' });
  });

  it('tracks proposal subscription loading and error states', () => {
    const store = createSessionStore();
    expect(selectProposalsSubscriptionStatus(store.getState())).toEqual({ status: 'idle' });

    store.getState().actions.setProposalsSubscription({ status: 'loading' });
    expect(selectProposalsSubscriptionStatus(store.getState())).toEqual({ status: 'loading' });

    store.getState().actions.setProposalsSubscription({
      status: 'error',
      error: 'subscription closed',
    });
    expect(selectProposalsSubscriptionStatus(store.getState())).toEqual({
      status: 'error',
      error: 'subscription closed',
    });
  });

  it('applies proposal upsert and delete events through the subscription bridge', () => {
    const store = createSessionStore();
    store.getState().actions.setConnection({
      status: 'connected',
      identity: 'identity-player-1',
    });
    store.getState().actions.hydrateSubscription({
      sessions: [
        {
          id: 'session-evt',
          code: 'SOL-evt',
          status: 'active',
          currentTurn: 6,
          phase: 'planning',
        },
      ],
      playerSlots: [
        {
          sessionId: 'session-evt',
          slot: 1,
          identity: 'identity-player-1',
          factionId: 'earth',
          factionName: 'Earth Directorate',
          playerName: 'Atlas',
          occupied: true,
          visibility: 'own',
        },
      ],
    });

    store.getState().actions.applySubscriptionEvent({
      table: 'proposals',
      op: 'upsert',
      row: {
        id: 'prop-evt',
        sessionId: 'session-evt',
        factionId: 'earth',
        turn: 6,
        proposingPersonnelId: 'officer-3',
        department: 'Diplomacy',
        title: 'Open trade with Callisto',
        body: 'Send envoys to Callisto',
        resourceCost: 8,
        confidence: 'medium',
        status: 'pending',
        decision: null,
      },
    });

    expect(selectInboxProposalsForCurrentPlayer(store.getState())).toHaveLength(1);

    store.getState().actions.applySubscriptionEvent({
      table: 'proposals',
      op: 'delete',
      id: 'prop-evt',
    });
    expect(selectInboxProposalsForCurrentPlayer(store.getState())).toHaveLength(0);
  });

  it('hydrates LLM request audits and current-player turn summaries', () => {
    const store = createSessionStore();
    store.getState().actions.setConnection({
      status: 'connected',
      identity: 'identity-player-1',
    });
    store.getState().actions.hydrateSubscription({
      sessions: [
        {
          id: 'session-summary',
          code: 'SOL-summary',
          status: 'active',
          currentTurn: 8,
          phase: 'summary',
        },
      ],
      playerSlots: [
        {
          sessionId: 'session-summary',
          slot: 1,
          identity: 'identity-player-1',
          factionId: '7',
          factionName: 'Earth Directorate',
          playerName: 'Atlas',
          occupied: true,
          visibility: 'own',
        },
      ],
      turnSummaries: [
        {
          id: 'summary-1',
          sessionId: 'session-summary',
          factionId: '7',
          turn: 8,
          summaryJson: '{"event":"turn_summary","proposal_outcomes":{"approved":1}}',
          acknowledged: false,
          acknowledgedAt: null,
        },
      ],
      llmRequests: [
        {
          id: 'llm-1',
          sessionId: 'session-summary',
          factionId: '7',
          requestType: 'proposals',
          status: 'completed',
          responseJson: '{"source":"deterministic_fallback","proposal_ids":[101]}',
          error: null,
          errorCode: null,
          attemptCount: 1,
          createdTurn: 8,
          updatedTurn: 8,
        },
      ],
    });

    expect(selectTurnSummaryForCurrentPlayer(store.getState())?.id).toBe('summary-1');
    expect(selectLlmRequestsForCurrentPlayer(store.getState())).toHaveLength(1);

    store.getState().actions.applySubscriptionEvent({
      table: 'turnSummaries',
      op: 'upsert',
      row: {
        id: 'summary-1',
        sessionId: 'session-summary',
        factionId: '7',
        turn: 8,
        summaryJson: '{"event":"turn_summary","proposal_outcomes":{"approved":2}}',
        acknowledged: true,
        acknowledgedAt: '2026-06-06T12:00:00Z',
      },
    });

    expect(selectTurnSummaryForCurrentPlayer(store.getState())?.acknowledged).toBe(true);
  });
});
