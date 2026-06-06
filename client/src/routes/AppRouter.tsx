import { useState } from 'react';
import { Landing } from './Landing';
import { Setup } from './Setup';
import { useSessionStore } from '../session/store';
import type { SetupParams, SetupState } from './types';

type View = 'landing' | 'setup' | 'session-ready';

interface RouterState {
  view: View;
  setupParams?: SetupParams;
}

interface AppRouterProps {
  onSessionReady?: (sessionId: number, playerSlot: string) => void;
  onSubmit?: (state: SetupState) => Promise<void>;
}

export function AppRouter({ onSessionReady, onSubmit }: AppRouterProps) {
  const [router, setRouter] = useState<RouterState>({ view: 'landing' });
  const session = useSessionStore();

  const defaultSubmit = async (state: SetupState): Promise<void> => {
    session.beginMutation();
    try {
      // Stub: in production this calls DbConnection reducers.
      // create_session / join_or_resume_session are called here.
      // Demo mode uses a pre-seeded session identity.
      const sessionId = 1;
      const factionId = state.playerSlot === 'player_b' ? 2 : 1;
      const playerSlot = state.playerSlot ?? 'player_a';
      session.setReady({ sessionId, factionId, playerSlot, playerName: state.playerName });
      onSessionReady?.(sessionId, playerSlot);
      setRouter({ view: 'session-ready' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Session error';
      session.setError(msg);
      throw err;
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
