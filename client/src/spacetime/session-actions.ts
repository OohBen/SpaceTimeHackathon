import type { SessionStore } from '../state/session-store';
import type { SpacetimeClient } from './client';
import type {
  AckResolutionArgs,
  AdvanceTurnPhaseArgs,
  AdvanceWorldArgs,
  CheckVictoryArgs,
  CommanderDecisionArgs,
  CreateSessionArgs,
  ExpireTurnArgs,
  JoinOrResumeSessionArgs,
  RunDeliberationArgs,
  SetDeliberationModeArgs,
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

export function joinOrResumeSessionAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: JoinOrResumeSessionArgs,
): void {
  const call = reducerRegistry.joinOrResumeSession(args);

  store.getState().actions.beginReducerCall('joinOrResumeSession', call);

  try {
    client.callReducer(call);
  } catch (error) {
    store.getState().actions.failReducerCall('joinOrResumeSession', error);
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

export function advanceWorldKey(sessionId: number | string): string {
  return `advanceWorld:${sessionId}`;
}

export function advanceTurnPhaseKey(sessionId: number | string): string {
  return `advanceTurnPhase:${sessionId}`;
}

export function simulateTurnKey(sessionId: number | string): string {
  return `simulateTurn:${sessionId}`;
}

export function ackResolutionKey(factionId: number | string): string {
  return `ackResolution:${factionId}`;
}

export function checkVictoryKey(sessionId: number | string): string {
  return `checkVictory:${sessionId}`;
}

export function setDeliberationModeKey(): string {
  return 'setDeliberationMode';
}

function dispatch(
  store: SessionStore,
  client: SpacetimeClient,
  key: string,
  call: ReturnType<(typeof reducerRegistry)[keyof typeof reducerRegistry]>,
): void {
  store.getState().actions.beginReducerCall(key, call);
  try {
    client.callReducer(call);
  } catch (error) {
    store.getState().actions.failReducerCall(key, error);
  }
}

export function commanderDecisionAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: CommanderDecisionArgs,
): void {
  dispatch(store, client, commanderDecisionKey(args.proposalId), reducerRegistry.commanderDecision(args));
}

export function submitTurnAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: SubmitTurnArgs,
): void {
  dispatch(store, client, submitTurnKey(args.factionId), reducerRegistry.submitTurn(args));
}

export function expireTurnAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: ExpireTurnArgs,
): void {
  dispatch(store, client, expireTurnKey(args.sessionId), reducerRegistry.expireTurn(args));
}

export function runDeliberationAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: RunDeliberationArgs,
): void {
  dispatch(store, client, runDeliberationKey(args.factionId), reducerRegistry.runDeliberation(args));
}

export function advanceWorldAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: AdvanceWorldArgs,
): void {
  dispatch(store, client, advanceWorldKey(args.sessionId), reducerRegistry.advanceWorld(args));
}

export function advanceTurnPhaseAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: AdvanceTurnPhaseArgs,
): void {
  dispatch(store, client, advanceTurnPhaseKey(args.sessionId), reducerRegistry.advanceTurnPhase(args));
}

export function setDeliberationModeAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: SetDeliberationModeArgs,
): void {
  dispatch(store, client, setDeliberationModeKey(), reducerRegistry.setDeliberationMode(args));
}

export function simulateTurnAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: SimulateTurnArgs,
): void {
  dispatch(store, client, simulateTurnKey(args.sessionId), reducerRegistry.simulateTurn(args));
}

export function ackResolutionAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: AckResolutionArgs,
): void {
  dispatch(store, client, ackResolutionKey(args.factionId), reducerRegistry.ackResolution(args));
}

export function checkVictoryAction(
  store: SessionStore,
  client: SpacetimeClient,
  args: CheckVictoryArgs,
): void {
  dispatch(store, client, checkVictoryKey(args.sessionId), reducerRegistry.checkVictory(args));
}
