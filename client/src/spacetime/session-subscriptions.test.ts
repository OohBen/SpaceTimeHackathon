import { describe, expect, it } from 'vitest';
import type { SpacetimeClient } from './client';
import {
  createSessionStore,
  selectActiveSession,
  selectProposalsSubscriptionStatus,
} from '../state/session-store';
import { SESSION_SUBSCRIPTION_QUERIES, wireSessionSubscriptions } from './session-subscriptions';

describe('session subscription wiring', () => {
  it('subscribes to session state feeds and routes snapshots into the Zustand store', () => {
    const subscribedQueries: string[][] = [];
    const client: SpacetimeClient = {
      connect: () => ({ disconnect: () => undefined }),
      reconnect: () => ({ disconnect: () => undefined }),
      disconnect: () => undefined,
      subscribe: (queries) => subscribedQueries.push(queries),
      callReducer: () => Promise.resolve(),
      diagnostics: () => ({ host: 'ws://localhost:3000', dbName: 'solar-dominion', issues: [] }),
    };
    const store = createSessionStore();

    const bridge = wireSessionSubscriptions(store, client);

    expect(subscribedQueries).toEqual([[...SESSION_SUBSCRIPTION_QUERIES]]);
    expect(subscribedQueries[0]).toContain('SELECT * FROM public_factions');
    expect(subscribedQueries[0]).toContain('SELECT * FROM turn_summaries');
    expect(subscribedQueries[0]).toContain('SELECT * FROM llm_requests');

    bridge.hydrate({
      sessions: [
        {
          id: 'session-bridge',
          code: 'SOL-bridge',
          status: 'lobby',
          currentTurn: 1,
          phase: 'lobby',
        },
      ],
    });

    expect(selectActiveSession(store.getState())?.id).toBe('session-bridge');
  });

  it('routes individual subscription events through the same store bridge', () => {
    const client: SpacetimeClient = {
      connect: () => ({ disconnect: () => undefined }),
      reconnect: () => ({ disconnect: () => undefined }),
      disconnect: () => undefined,
      subscribe: () => undefined,
      callReducer: () => Promise.resolve(),
      diagnostics: () => ({ host: 'ws://localhost:3000', dbName: 'solar-dominion', issues: [] }),
    };
    const store = createSessionStore();
    const bridge = wireSessionSubscriptions(store, client);

    bridge.apply({
      table: 'sessions',
      op: 'upsert',
      row: {
        id: 'session-event',
        code: 'SOL-event',
        status: 'active',
        currentTurn: 2,
        phase: 'planning',
      },
    });

    expect(selectActiveSession(store.getState())?.phase).toBe('planning');
  });

  it('subscribes to public world projections without private map tables', () => {
    expect(SESSION_SUBSCRIPTION_QUERIES).toEqual(
      expect.arrayContaining([
        'SELECT * FROM factions',
        'SELECT * FROM personnel',
        'SELECT * FROM intelligence_records',
        'SELECT * FROM events',
        'SELECT * FROM turn_summaries',
        'SELECT * FROM celestial_bodies',
        'SELECT * FROM public_factions',
        'SELECT * FROM public_cities',
        'SELECT * FROM public_fleets',
        'SELECT * FROM public_colony_ships',
        'SELECT * FROM public_events',
      ]),
    );
    expect(SESSION_SUBSCRIPTION_QUERIES).not.toEqual(
      expect.arrayContaining([
        'SELECT * FROM cities',
        'SELECT * FROM fleets',
        'SELECT * FROM colony_ships',
      ]),
    );
  });

  it('subscribes to proposals and marks the subscription as loading until a snapshot arrives', () => {
    const subscribedQueries: string[][] = [];
    const client: SpacetimeClient = {
      connect: () => ({ disconnect: () => undefined }),
      reconnect: () => ({ disconnect: () => undefined }),
      disconnect: () => undefined,
      subscribe: (queries) => subscribedQueries.push(queries),
      callReducer: () => Promise.resolve(),
      diagnostics: () => ({ host: 'ws://localhost:3000', dbName: 'solar-dominion', issues: [] }),
    };
    const store = createSessionStore();
    const bridge = wireSessionSubscriptions(store, client);

    expect(subscribedQueries[0]).toContain('SELECT * FROM proposals');
    expect(selectProposalsSubscriptionStatus(store.getState())).toEqual({ status: 'loading' });

    bridge.hydrate({ proposals: [] });
    expect(selectProposalsSubscriptionStatus(store.getState())).toEqual({ status: 'ready' });

    bridge.setProposalsSubscription({ status: 'error', error: 'feed dropped' });
    expect(selectProposalsSubscriptionStatus(store.getState())).toEqual({
      status: 'error',
      error: 'feed dropped',
    });
  });

  it('routes orchestrator audit and turn summary snapshots through the bridge', () => {
    const client: SpacetimeClient = {
      connect: () => ({ disconnect: () => undefined }),
      reconnect: () => ({ disconnect: () => undefined }),
      disconnect: () => undefined,
      subscribe: () => undefined,
      callReducer: () => Promise.resolve(),
      diagnostics: () => ({ host: 'ws://localhost:3000', dbName: 'solar-dominion', issues: [] }),
    };
    const store = createSessionStore();
    const bridge = wireSessionSubscriptions(store, client);

    bridge.hydrate({
      turnSummaries: [
        {
          id: 'summary-1',
          sessionId: 'session-bridge',
          factionId: '7',
          turn: 2,
          summaryJson: '{"event":"turn_summary"}',
          acknowledged: false,
          acknowledgedAt: null,
        },
      ],
      llmRequests: [
        {
          id: 'llm-1',
          sessionId: 'session-bridge',
          factionId: '7',
          requestType: 'proposals',
          status: 'queued',
          responseJson: null,
          error: null,
          errorCode: null,
          attemptCount: 0,
          createdTurn: 2,
          updatedTurn: 2,
        },
      ],
    });

    expect(store.getState().turnSummariesById['summary-1']?.turn).toBe(2);
    expect(store.getState().llmRequestsById['llm-1']?.status).toBe('queued');
  });
});
