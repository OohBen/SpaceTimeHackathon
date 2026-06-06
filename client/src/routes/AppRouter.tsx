import { useEffect, useState } from 'react';
import { Landing } from './Landing';
import { Setup } from './Setup';
import { useSessionStore } from '../session/store';
import {
  findOwnedSlot,
  useSpacetimeSessionBackend,
  type SessionBackend,
} from '../session/spacetime';
import type { SetupParams, SetupState } from './types';

type View = 'landing' | 'setup' | 'session-ready';

interface RouterState {
  view: View;
  setupParams?: SetupParams;
}

interface AppRouterProps {
  backend?: SessionBackend;
  onSessionReady?: (sessionId: number, playerSlot: string) => void;
  onSubmit?: (state: SetupState) => Promise<void>;
}

export function AppRouter(props: AppRouterProps) {
  if (props.backend) {
    return <AppRouterView {...props} backend={props.backend} />;
  }

  return <LiveAppRouter {...props} />;
}

function LiveAppRouter(props: Omit<AppRouterProps, 'backend'>) {
  const backend = useSpacetimeSessionBackend();
  return <AppRouterView {...props} backend={backend} />;
}

function AppRouterView({
  backend,
  onSessionReady,
  onSubmit,
}: AppRouterProps & { backend: SessionBackend }) {
  const [router, setRouter] = useState<RouterState>({ view: 'landing' });
  const session = useSessionStore();

  useEffect(() => {
    if (session.status === 'ready') {
      return;
    }

    const owned = findOwnedSlot(backend.sessions, backend.factions, backend.identity);
    if (!owned) {
      return;
    }

    session.setReady(owned);
    onSessionReady?.(owned.sessionId, owned.playerSlot);
    setRouter({ view: 'session-ready' });
  }, [backend.factions, backend.identity, backend.sessions, onSessionReady, session]);

  const defaultSubmit = async (state: SetupState): Promise<void> => {
    session.beginMutation();
    try {
      const result =
        state.mode === 'create'
          ? await backend.createAndJoin(state)
          : await backend.joinOrResume(state);
      session.setReady(result);
      onSessionReady?.(result.sessionId, result.playerSlot);
      setRouter({ view: 'session-ready' });
    } catch (err) {
      const msg = actionableSessionError(err);
      session.setError(msg);
      throw new Error(msg);
    }
  };

  const handleSubmit = onSubmit ?? defaultSubmit;

  if (router.view === 'session-ready' && session.status === 'ready') {
    return (
      <div>
        <h2>Session Ready</h2>
        <p>Session ID: <strong>{session.sessionId}</strong></p>
        <p>Your slot: <strong>{session.playerSlot}</strong></p>
        <p>Share the session ID with your opponent to start.</p>
        <button onClick={() => { session.reset(); setRouter({ view: 'landing' }); }}>
          Back to Menu
        </button>
      </div>
    );
  }

  if (router.view === 'setup' && router.setupParams) {
    return (
      <Setup
        mode={router.setupParams.mode}
        backend={backend}
        onBack={() => setRouter({ view: 'landing' })}
        onSubmit={handleSubmit}
      />
    );
  }

  return (
    <Landing
      onNavigate={(view, params) => setRouter({ view, setupParams: params })}
    />
  );
}

function actionableSessionError(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Session error';
  if (/not found|valid session|session id/i.test(msg)) {
    return `${msg}. Check the session ID or create a new session.`;
  }

  if (/occupied|already claimed/i.test(msg)) {
    return `${msg}. Choose an available slot, or reopen the browser that already claimed it.`;
  }

  return msg;
}
