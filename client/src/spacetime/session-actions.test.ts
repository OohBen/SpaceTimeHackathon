import { describe, expect, it } from 'vitest';
import type { SpacetimeClient } from './client';
import { reducerRegistry, type ReducerCallDescriptor } from './reducers';
import { createSessionStore, selectActiveSession, selectReducerCall } from '../state/session-store';
import { commanderDecisionAction, createSessionAction, joinSessionAction } from './session-actions';

function fakeClient(onCall: (call: ReducerCallDescriptor) => void): SpacetimeClient {
  return {
    connect: () => ({ disconnect: () => undefined }),
    reconnect: () => ({ disconnect: () => undefined }),
    disconnect: () => undefined,
    subscribe: () => undefined,
    callReducer: onCall,
    diagnostics: () => ({ host: 'ws://localhost:3000', dbName: 'solar-dominion', issues: [] }),
  };
}

describe('session reducer actions', () => {
  it('dispatches createSession through typed reducer wrappers and records optimistic loading state', () => {
    const calls: ReducerCallDescriptor[] = [];
    const store = createSessionStore();
    const client = fakeClient((call) => calls.push(call));

    createSessionAction(store, client, { playerName: 'Atlas' });

    expect(calls).toEqual([{ reducer: 'create_session', args: { playerName: 'Atlas' } }]);
    expect(selectReducerCall(store.getState(), 'createSession')?.status).toBe('loading');
    expect(selectActiveSession(store.getState())?.status).toBe('creating');
  });

  it('records joinSession backend dispatch errors as reducer error state', () => {
    const store = createSessionStore();
    const client = fakeClient(() => {
      throw new Error('backend unavailable');
    });

    joinSessionAction(store, client, { sessionId: 'session-1', playerName: 'Atlas' });

    expect(selectReducerCall(store.getState(), 'joinSession')?.status).toBe('error');
    expect(selectReducerCall(store.getState(), 'joinSession')?.error).toBe('backend unavailable');
  });

  it('builds typed commander decision reducer descriptors', () => {
    expect(
      reducerRegistry.commanderDecision({
        factionId: 7,
        proposalId: 101,
        decision: 'approved',
        allocation: 25,
      }),
    ).toEqual({
      reducer: 'commander_decision',
      args: {
        factionId: 7,
        proposalId: 101,
        decision: 'approved',
        allocation: 25,
      },
    });
  });

  it('dispatches commander decisions and records per-proposal reducer state', () => {
    const calls: ReducerCallDescriptor[] = [];
    const store = createSessionStore();
    const client = fakeClient((call) => calls.push(call));

    commanderDecisionAction(store, client, {
      factionId: 7,
      proposalId: 101,
      decision: 'deferred',
      allocation: 0,
    });

    expect(calls).toEqual([
      {
        reducer: 'commander_decision',
        args: {
          factionId: 7,
          proposalId: 101,
          decision: 'deferred',
          allocation: 0,
        },
      },
    ]);
    expect(selectReducerCall(store.getState(), 'commanderDecision:101')?.status).toBe('loading');
  });
});
