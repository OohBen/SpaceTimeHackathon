import { useEffect, useState } from 'react';
import { Landing } from './Landing';
import { Setup } from './Setup';
import { useSessionStore } from '../session/store';
import {
  findOwnedSlot,
  useSpacetimeSessionBackend,
  type SessionBackend,
  type SessionBackendResult,
} from '../session/spacetime';
import type { PlayerSlot, SetupParams, SetupState } from './types';
import './CommandCenterShell.css';

type View = 'landing' | 'setup' | 'game';
type ShellPanel = 'overview' | 'session-brief';

interface GameRouteParams {
  sessionId: number;
  playerSlot: PlayerSlot;
}

interface RouterState {
  view: View;
  setupParams?: SetupParams;
  gameRoute?: GameRouteParams;
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
  const [router, setRouter] = useState<RouterState>(() => routeFromPath(readPathname()));
  const session = useSessionStore();

  const resetToLanding = () => {
    session.reset();
    updatePath('/', 'push');
    setRouter({ view: 'landing' });
  };

  const enterGame = (result: SessionBackendResult, historyMode: HistoryMode = 'push') => {
    const gameRoute = { sessionId: result.sessionId, playerSlot: result.playerSlot };
    updatePath(gamePath(gameRoute), historyMode);
    setRouter({ view: 'game', gameRoute });
  };

  useEffect(() => {
    const onPopState = () => setRouter(routeFromPath(readPathname()));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (session.status === 'ready') {
      return;
    }

    if (router.view === 'game' && router.gameRoute && hasCompleteSessionContext(session)) {
      if (!storedContextMatchesRoute(session, router.gameRoute)) {
        return;
      }

      session.setReady({
        sessionId: session.sessionId,
        factionId: session.factionId,
        playerSlot: session.playerSlot,
        playerName: session.playerName,
      });
      return;
    }

    const owned = findOwnedSlot(backend.sessions, backend.factions, backend.identity);
    if (!owned) {
      return;
    }

    if (router.view === 'game' && router.gameRoute && !matchesGameRoute(router.gameRoute, owned)) {
      return;
    }

    session.setReady(owned);
    onSessionReady?.(owned.sessionId, owned.playerSlot);
    enterGame(owned, router.view === 'game' ? 'replace' : 'push');
  }, [backend.factions, backend.identity, backend.sessions, onSessionReady, router, session]);

  const defaultSubmit = async (state: SetupState): Promise<void> => {
    session.beginMutation();
    try {
      const result =
        state.mode === 'create'
          ? await backend.createAndJoin(state)
          : await backend.joinOrResume(state);
      session.setReady(result);
      onSessionReady?.(result.sessionId, result.playerSlot);
      enterGame(result);
    } catch (err) {
      const msg = actionableSessionError(err);
      session.setError(msg);
      throw new Error(msg);
    }
  };

  const handleSubmit = onSubmit ?? defaultSubmit;

  if (router.view === 'game' && router.gameRoute) {
    return (
      <GameRoute
        route={router.gameRoute}
        session={session}
        onBack={resetToLanding}
      />
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

type SessionStoreState = ReturnType<typeof useSessionStore.getState>;
type HistoryMode = 'push' | 'replace';

function GameRoute({
  route,
  session,
  onBack,
}: {
  route: GameRouteParams;
  session: SessionStoreState;
  onBack: () => void;
}) {
  const [activePanel, setActivePanel] = useState<ShellPanel>('overview');

  if (!hasCompleteSessionContext(session)) {
    return (
      <RouteGuard
        message="Join or resume this session before entering the game route."
        onBack={onBack}
      />
    );
  }

  if (!storedContextMatchesRoute(session, route)) {
    return (
      <RouteGuard
        message="Route does not match stored session context. Return to the menu and join the correct slot."
        onBack={onBack}
      />
    );
  }

  return (
    <CommandCenterShell
      session={session}
      activePanel={activePanel}
      onPanelChange={setActivePanel}
      onBack={onBack}
    />
  );
}

function CommandCenterShell({
  session,
  activePanel,
  onPanelChange,
  onBack,
}: {
  session: SessionStoreState & {
    sessionId: number;
    factionId: number;
    playerSlot: PlayerSlot;
    playerName: string;
  };
  activePanel: ShellPanel;
  onPanelChange: (panel: ShellPanel) => void;
  onBack: () => void;
}) {
  const panelTitle = activePanel === 'overview' ? 'Command Overview' : 'Session Brief';

  return (
    <div className="command-shell">
      <header className="command-shell__header" aria-label="Command Center header" role="banner">
        <div className="command-shell__title-block">
          <p className="command-shell__eyebrow">Command Center</p>
          <h2>Command Center</h2>
          <p className="command-shell__session-line">Session {session.sessionId}</p>
        </div>
        <div className="command-shell__context" aria-label="Current player context">
          <span>
            Your slot: <strong>{session.playerSlot}</strong>
          </span>
          <span>Commander: {session.playerName}</span>
          <span>Faction {session.factionId}</span>
        </div>
        <button className="command-shell__back" type="button" onClick={onBack}>
          Back to Menu
        </button>
      </header>

      <div className="command-shell__body">
        <aside className="command-shell__sidebar" aria-label="Command sidebar">
          <nav className="command-shell__nav" aria-label="Command panels">
            <button
              type="button"
              className="command-shell__nav-button"
              aria-pressed={activePanel === 'overview'}
              onClick={() => onPanelChange('overview')}
            >
              Command Overview
            </button>
            <button
              type="button"
              className="command-shell__nav-button"
              aria-pressed={activePanel === 'session-brief'}
              onClick={() => onPanelChange('session-brief')}
            >
              Session Brief
            </button>
          </nav>
        </aside>

        <section className="command-shell__panel" aria-label="Command content panel">
          <div className="command-shell__panel-heading">
            <p className="command-shell__eyebrow">Active panel</p>
            <h3>{panelTitle}</h3>
          </div>
          {activePanel === 'overview' ? (
            <div className="command-shell__status-grid">
              <div>
                <span>Session</span>
                <strong>{session.sessionId}</strong>
              </div>
              <div>
                <span>Slot status</span>
                <strong>Joined</strong>
              </div>
              <div>
                <span>Commander</span>
                <strong>{session.playerName}</strong>
              </div>
            </div>
          ) : (
            <div className="command-shell__brief">
              <p>
                Session Brief for {session.playerName}. Share Session {session.sessionId} with
                the opposing browser and keep this shell open during panel work.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RouteGuard({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div>
      <p role="alert">{message}</p>
      <button onClick={onBack}>Back to Menu</button>
    </div>
  );
}

function readPathname(): string {
  return typeof window === 'undefined' ? '/' : window.location.pathname;
}

function routeFromPath(pathname: string): RouterState {
  const match = /^\/game\/([1-9]\d*)\/(player_a|player_b)\/?$/.exec(pathname);
  if (!match) {
    return { view: 'landing' };
  }

  return {
    view: 'game',
    gameRoute: {
      sessionId: Number(match[1]),
      playerSlot: match[2] as PlayerSlot,
    },
  };
}

function gamePath(route: GameRouteParams): string {
  return `/game/${route.sessionId}/${route.playerSlot}`;
}

function updatePath(path: string, mode: HistoryMode): void {
  if (typeof window === 'undefined' || window.location.pathname === path) {
    return;
  }

  if (mode === 'replace') {
    window.history.replaceState(null, '', path);
    return;
  }

  window.history.pushState(null, '', path);
}

function hasCompleteSessionContext(
  session: SessionStoreState
): session is SessionStoreState & {
  sessionId: number;
  factionId: number;
  playerSlot: PlayerSlot;
  playerName: string;
} {
  return (
    session.sessionId !== null &&
    session.factionId !== null &&
    isPlayerSlot(session.playerSlot) &&
    session.playerName !== null
  );
}

function storedContextMatchesRoute(
  session: SessionStoreState & { sessionId: number; playerSlot: PlayerSlot },
  route: GameRouteParams
): boolean {
  return session.sessionId === route.sessionId && session.playerSlot === route.playerSlot;
}

function matchesGameRoute(route: GameRouteParams, result: SessionBackendResult): boolean {
  return route.sessionId === result.sessionId && route.playerSlot === result.playerSlot;
}

function isPlayerSlot(value: unknown): value is PlayerSlot {
  return value === 'player_a' || value === 'player_b';
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
