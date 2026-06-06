import type { SessionStore } from '../state/session-store';
import type { SpacetimeClient } from './client';
import type {
  CommanderDecisionArgs,
  CreateSessionArgs,
  ExpireTurnArgs,
  JoinSessionArgs,
  AckResolutionArgs,
  RunDeliberationArgs,
  SimulateTurnArgs,
  SubmitTurnArgs,
} from './reducers';
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

export function commanderDecisionKey(proposalId: number | string): string {
  return `commanderDecision:${proposalId}`;
}

export function submitTurnKey(factionId: number | string): string {
  return `submitTurn:${factionId}`;
}

export function expireTurnKey(sessionId: number | string): string {
  return `expireTurn:${sessionId}`;
}

export function runDeliberationKey(factionId: number | string): string {
  return `runDeliberation:${factionId}`;
}

export function simulateTurnKey(sessionId: number | string): string {
  return `simulateTurn:${sessionId}`;
}

export function ackResolutionKey(factionId: number | string): string {
  return `ackResolution:${factionId}`;
}

export function commanderDecisionAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: CommanderDecisionArgs,
): void {
  const call = reducerRegistry.commanderDecision(args);
  const key = commanderDecisionKey(args.proposalId);

  store.getState().actions.beginReducerCall(key, call);

  try {
    client.callReducer(call);
  } catch (error) {
    store.getState().actions.failReducerCall(key, error);
  }
}

export function submitTurnAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: SubmitTurnArgs,
): void {
  const call = reducerRegistry.submitTurn(args);
  const key = submitTurnKey(args.factionId);

  store.getState().actions.beginReducerCall(key, call);

  try {
    client.callReducer(call);
  } catch (error) {
    store.getState().actions.failReducerCall(key, error);
  }
}

export function expireTurnAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: ExpireTurnArgs,
): void {
  const call = reducerRegistry.expireTurn(args);
  const key = expireTurnKey(args.sessionId);

  store.getState().actions.beginReducerCall(key, call);

  try {
    client.callReducer(call);
  } catch (error) {
    store.getState().actions.failReducerCall(key, error);
  }
}

export function runDeliberationAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: RunDeliberationArgs,
): void {
  const call = reducerRegistry.runDeliberation(args);
  const key = runDeliberationKey(args.factionId);

  store.getState().actions.beginReducerCall(key, call);

  try {
    client.callReducer(call);
  } catch (error) {
    store.getState().actions.failReducerCall(key, error);
  }
}

export function simulateTurnAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: SimulateTurnArgs,
): void {
  const call = reducerRegistry.simulateTurn(args);
  const key = simulateTurnKey(args.sessionId);

  store.getState().actions.beginReducerCall(key, call);

  try {
    client.callReducer(call);
  } catch (error) {
    store.getState().actions.failReducerCall(key, error);
  }
}

export function ackResolutionAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: AckResolutionArgs,
): void {
  const call = reducerRegistry.ackResolution(args);
  const key = ackResolutionKey(args.factionId);

  store.getState().actions.beginReducerCall(key, call);

  try {
    client.callReducer(call);
  } catch (error) {
    store.getState().actions.failReducerCall(key, error);
  }
}
