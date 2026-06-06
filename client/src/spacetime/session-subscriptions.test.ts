import { describe, expect, it } from 'vitest';
import type { SpacetimeClient } from './client';
import { createSessionStore, selectActiveSession } from '../state/session-store';
import { SESSION_SUBSCRIPTION_QUERIES, wireSessionSubscriptions } from './session-subscriptions';

describe('session subscription wiring', () => {
  it('subscribes to session state feeds and routes snapshots into the Zustand store', () => {
    const subscribedQueries: string[][] = [];
    const client: SpacetimeClient = {
      connect: () => ({ disconnect: () => undefined }),
      subscribe: (queries) => subscribedQueries.push(queries),
      callReducer: () => undefined,
    };
    const store = createSessionStore();

    const bridge = wireSessionSubscriptions(store, client);

    expect(subscribedQueries).toEqual([[...SESSION_SUBSCRIPTION_QUERIES]]);

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
      subscribe: () => undefined,
      callReducer: () => undefined,
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
});
