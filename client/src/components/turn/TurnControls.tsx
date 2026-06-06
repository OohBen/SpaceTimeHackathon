import { useSyncExternalStore } from 'react';
import type { SpacetimeClient } from '../../spacetime/client';
import {
  ackResolutionAction,
  ackResolutionKey,
  advanceTurnPhaseAction,
  advanceTurnPhaseKey,
  advanceWorldAction,
  advanceWorldKey,
  checkVictoryAction,
  checkVictoryKey,
  runDeliberationAction,
  runDeliberationKey,
  simulateTurnAction,
  simulateTurnKey,
  submitTurnAction,
  submitTurnKey,
} from '../../spacetime/session-actions';
import {
  sessionStore,
  selectActiveSession,
  selectCurrentPlayerSlot,
  selectReducerCall,
  type ReducerCallState,
  type SessionState,
  type SessionStore,
} from '../../state/session-store';

export interface TurnControlsProps {
  store?: SessionStore;
  client?: SpacetimeClient;
}

interface TurnAction {
  key: string;
  label: string;
  call: ReducerCallState | null;
  appliesToPhase: boolean;
  run: () => void;
}

export function TurnControls({ store = sessionStore, client }: TurnControlsProps) {
  const activeSession = useStoreSlice(store, selectActiveSession);
  const currentSlot = useStoreSlice(store, selectCurrentPlayerSlot);

  const sessionId = activeSession ? toNonNegativeInteger(activeSession.id) : null;
  const factionId = currentSlot ? toNonNegativeInteger(currentSlot.factionId) : null;

  const deliberationCall = useStoreSlice(store, (state) =>
    factionId !== null ? selectReducerCall(state, runDeliberationKey(factionId)) : null,
  );
  const submitTurnCall = useStoreSlice(store, (state) =>
    factionId !== null ? selectReducerCall(state, submitTurnKey(factionId)) : null,
  );
  const advanceWorldCall = useStoreSlice(store, (state) =>
    sessionId !== null ? selectReducerCall(state, advanceWorldKey(sessionId)) : null,
  );
  const simulateTurnCall = useStoreSlice(store, (state) =>
    sessionId !== null ? selectReducerCall(state, simulateTurnKey(sessionId)) : null,
  );
  const advanceDecisionCall = useStoreSlice(store, (state) =>
    sessionId !== null ? selectReducerCall(state, advanceTurnPhaseKey(sessionId)) : null,
  );
  const ackResolutionCall = useStoreSlice(store, (state) =>
    factionId !== null ? selectReducerCall(state, ackResolutionKey(factionId)) : null,
  );
  const checkVictoryCall = useStoreSlice(store, (state) =>
    sessionId !== null ? selectReducerCall(state, checkVictoryKey(sessionId)) : null,
  );

  if (!activeSession || !currentSlot) {
    return (
      <section className="turn-controls" aria-label="Turn controls" data-testid="turn-controls-empty">
        <p className="turn-controls__empty">No active session.</p>
      </section>
    );
  }

  const phase = activeSession.phase;

  const actions: TurnAction[] = [
    {
      key: 'advanceWorld',
      label: 'Advance World',
      call: advanceWorldCall,
      appliesToPhase: phase === 'setup' || phase === 'world_update',
      run: () => {
        if (sessionId === null) return;
        advanceWorldAction(store, client!, { sessionId });
      },
    },
    {
      key: 'runDeliberation',
      label: 'Run Deliberation',
      call: deliberationCall,
      appliesToPhase: phase === 'deliberation',
      run: () => {
        if (factionId === null) return;
        runDeliberationAction(store, client!, { factionId });
      },
    },
    {
      key: 'advanceDecision',
      label: 'Start Decision Phase',
      call: advanceDecisionCall,
      appliesToPhase: phase === 'deliberation',
      run: () => {
        if (sessionId === null) return;
        advanceTurnPhaseAction(store, client!, { sessionId, nextPhase: 'decision' });
      },
    },
    {
      key: 'submitTurn',
      label: 'Submit Turn',
      call: submitTurnCall,
      appliesToPhase: phase === 'deliberation' || phase === 'decision',
      run: () => {
        if (factionId === null) return;
        submitTurnAction(store, client!, { factionId });
      },
    },
    {
      key: 'simulateTurn',
      label: 'Simulate Turn',
      call: simulateTurnCall,
      appliesToPhase: phase === 'resolution',
      run: () => {
        if (sessionId === null) return;
        simulateTurnAction(store, client!, { sessionId });
      },
    },
    {
      key: 'ackResolution',
      label: 'Acknowledge Resolution',
      call: ackResolutionCall,
      appliesToPhase: phase === 'resolution',
      run: () => {
        if (factionId === null) return;
        ackResolutionAction(store, client!, { factionId });
      },
    },
    {
      key: 'checkVictory',
      label: 'Check Victory',
      call: checkVictoryCall,
      appliesToPhase: phase === 'resolution',
      run: () => {
        if (sessionId === null) return;
        checkVictoryAction(store, client!, { sessionId });
      },
    },
  ];

  return (
    <section className="turn-controls" aria-label="Turn controls" data-testid="turn-controls">
      <p className="turn-controls__status" data-testid="turn-controls-status">
        Turn {activeSession.currentTurn} · {phase}
      </p>
      <ul className="turn-controls__list" role="list">
        {actions.map((action) => {
          const pending = action.call?.status === 'loading';
          const idReady =
            action.key === 'advanceWorld' ||
            action.key === 'advanceDecision' ||
            action.key === 'simulateTurn' ||
            action.key === 'checkVictory'
              ? sessionId !== null
              : factionId !== null;
          const disabled = !client || pending || !action.appliesToPhase || !idReady;
          const blockedReason = disabled
            ? turnActionBlockedReason({
                clientReady: Boolean(client),
                idReady,
                pending,
                appliesToPhase: action.appliesToPhase,
                phase,
              })
            : null;
          return (
            <li key={action.key} className="turn-controls__item">
              <button
                type="button"
                className="command-shell__nav-button"
                disabled={disabled}
                onClick={action.run}
                data-testid={`turn-action-${action.key}`}
              >
                {action.label}
                {pending ? ' …' : ''}
              </button>
              {action.call?.status === 'error' ? (
                <p
                  className="turn-controls__error"
                  role="alert"
                  data-testid={`turn-action-error-${action.key}`}
                >
                  {action.call.error}
                </p>
              ) : blockedReason ? (
                <p className="turn-controls__hint" data-testid={`turn-action-hint-${action.key}`}>
                  {blockedReason}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function turnActionBlockedReason({
  clientReady,
  idReady,
  pending,
  appliesToPhase,
  phase,
}: {
  clientReady: boolean;
  idReady: boolean;
  pending: boolean;
  appliesToPhase: boolean;
  phase: string;
}): string | null {
  if (!clientReady) return 'Waiting for SpacetimeDB connection.';
  if (!idReady) return 'Waiting for session identity.';
  if (pending) return 'Reducer call in flight.';
  if (!appliesToPhase) return `Blocked in ${phase} phase.`;
  return null;
}

function useStoreSlice<T>(store: SessionStore, selector: (state: SessionState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

function toNonNegativeInteger(value: string | number): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return null;
  return parsed;
}
