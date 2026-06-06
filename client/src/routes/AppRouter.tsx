import { useState } from 'react';
import { Landing } from './Landing';
import { Setup } from './Setup';
import type { SetupParams, SetupState } from './types';

type View = 'landing' | 'setup';

interface RouterState {
  view: View;
  setupParams?: SetupParams;
}

interface AppRouterProps {
  onSessionReady?: (state: SetupState) => void;
}

export function AppRouter({ onSessionReady }: AppRouterProps) {
  const [router, setRouter] = useState<RouterState>({ view: 'landing' });

  if (router.view === 'setup' && router.setupParams) {
    return (
      <Setup
        mode={router.setupParams.mode}
        onBack={() => setRouter({ view: 'landing' })}
        onConfirm={(state) => onSessionReady?.(state)}
      />
    );
  }

  return (
    <Landing
      onNavigate={(view, params) => setRouter({ view, setupParams: params })}
    />
  );
}
