import { describe, expect, it } from 'vitest';
import type { SpacetimeClient } from './client';
import { reducerRegistry, type ReducerCallDescriptor } from './reducers';
import { createSessionStore, selectActiveSession, selectReducerCall } from '../state/session-store';
import {
  ackResolutionAction,
  advanceWorldAction,
  commanderDecisionAction,
  createSessionAction,
  expireTurnAction,
  joinOrResumeSessionAction,
  runDeliberationAction,
  setDeliberationModeAction,
  simulateTurnAction,
  submitTurnAction,
} from './session-actions';

function fakeClient(onCall: (call: ReducerCallDescriptor) => unknown): SpacetimeClient {
  return {
    connect: () => ({ disconnect: () => undefined }),
    reconnect: () => ({ disconnect: () => undefined }),
    disconnect: () => undefined,
    subscribe: () => undefined,
    callReducer: async (call) => {
      await onCall(call);
    },
    diagnostics: () => ({ host: 'ws://localhost:3000', dbName: 'solar-dominion', issues: [] }),
  };
}

describe('session reducer actions', () => {
  it('dispatches createSession with two-player args and records optimistic loading state', () => {
    const calls: ReducerCallDescriptor[] = [];
    const store = createSessionStore();
    const client = fakeClient((call) => calls.push(call));

    createSessionAction(store, client, { playerAName: 'Atlas', playerBName: 'Rex' });

    expect(calls).toEqual([
      {
        reducer: 'create_session',
        args: { playerAName: 'Atlas', playerBName: 'Rex' },
      },
    ]);
    expect(selectReducerCall(store.getState(), 'createSession')?.status).toBe('loading');
    expect(selectActiveSession(store.getState())?.status).toBe('creating');
  });

  it('records joinOrResumeSession backend dispatch errors as reducer error state', () => {
    const store = createSessionStore();
    const client = fakeClient(() => {
      throw new Error('backend unavailable');
    });

    joinOrResumeSessionAction(store, client, { sessionId: 1, playerSlot: 'player_a' });

    expect(selectReducerCall(store.getState(), 'joinOrResumeSession')?.status).toBe('error');
    expect(selectReducerCall(store.getState(), 'joinOrResumeSession')?.error).toBe('backend unavailable');
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

  it('dispatches submit turn and expire turn reducers with scoped reducer state keys', () => {
    const calls: ReducerCallDescriptor[] = [];
    const store = createSessionStore();
    const client = fakeClient((call) => calls.push(call));

    submitTurnAction(store, client, { factionId: 7 });
    expireTurnAction(store, client, { sessionId: 9001 });

    expect(calls).toEqual([
      { reducer: 'submit_turn', args: { factionId: 7 } },
      { reducer: 'expire_turn', args: { sessionId: 9001 } },
    ]);
    expect(selectReducerCall(store.getState(), 'submitTurn:7')?.status).toBe('loading');
    expect(selectReducerCall(store.getState(), 'expireTurn:9001')?.status).toBe('loading');
  });

  it('builds typed deliberation, simulation, and acknowledgement reducer descriptors', () => {
    expect(reducerRegistry.runDeliberation({ factionId: 7 })).toEqual({
      reducer: 'run_deliberation',
      args: { factionId: 7 },
    });
    expect(reducerRegistry.simulateTurn({ sessionId: 9001 })).toEqual({
      reducer: 'simulate_turn',
      args: { sessionId: 9001 },
    });
    expect(reducerRegistry.ackResolution({ factionId: 7 })).toEqual({
      reducer: 'ack_resolution',
      args: { factionId: 7 },
    });
  });

  it('dispatches the rest of the turn pipeline through scoped reducer state keys', () => {
    const calls: ReducerCallDescriptor[] = [];
    const store = createSessionStore();
    const client = fakeClient((call) => calls.push(call));

    advanceWorldAction(store, client, { sessionId: 9001 });
    runDeliberationAction(store, client, { factionId: 7 });
    setDeliberationModeAction(store, client, { mode: 'fallback' });
    simulateTurnAction(store, client, { sessionId: 9001 });
    ackResolutionAction(store, client, { factionId: 7 });

    expect(calls.map((c) => c.reducer)).toEqual([
      'advance_world',
      'run_deliberation',
      'set_deliberation_mode',
      'simulate_turn',
      'ack_resolution',
    ]);
    expect(selectReducerCall(store.getState(), 'advanceWorld:9001')?.status).toBe('loading');
    expect(selectReducerCall(store.getState(), 'runDeliberation:7')?.status).toBe('loading');
    expect(selectReducerCall(store.getState(), 'setDeliberationMode')?.status).toBe('loading');
    expect(selectReducerCall(store.getState(), 'simulateTurn:9001')?.status).toBe('loading');
    expect(selectReducerCall(store.getState(), 'ackResolution:7')?.status).toBe('loading');
  });
});
