import type { SessionStore } from '../state/session-store';
import type { SpacetimeClient } from './client';
import type { CreateSessionArgs, JoinSessionArgs } from './reducers';
import { reducerRegistry } from './reducers';

export function createSessionAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: CreateSessionArgs,
): void {
  const call = reducerRegistry.createSession(args);

  store.getState().actions.beginReducerCall('createSession', call, {
    kind: 'session',
    session: {
      id: 'optimistic-create',
      code: 'pending',
      status: 'creating',
      currentTurn: 0,
      phase: 'creating',
    },
  });

  try {
    client.callReducer(call);
  } catch (error) {
    store.getState().actions.failReducerCall('createSession', error);
  }
}

export function joinSessionAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: JoinSessionArgs,
): void {
  const call = reducerRegistry.joinSession(args);

  store.getState().actions.beginReducerCall('joinSession', call);

  try {
    client.callReducer(call);
  } catch (error) {
    store.getState().actions.failReducerCall('joinSession', error);
  }
}
