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
import { useHudData, type HudData } from './hud';
import type { PlayerSlot, SetupParams, SetupState } from './types';
import { usePanelStore, CORE_PANELS, type PanelId } from './panels';
import './CommandCenterShell.css';

type View = 'landing' | 'setup' | 'game';

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
  const { activePanel, setPanel } = usePanelStore();

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
      onPanelChange={setPanel}
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
  activePanel: PanelId;
  onPanelChange: (panel: PanelId) => void;
  onBack: () => void;
}) {
  const activeDef = CORE_PANELS.find((p) => p.id === activePanel) ?? CORE_PANELS[0];
  const hud = useHudData(String(session.factionId));

  return (
    <div className="command-shell">
      <header className="command-shell__header" aria-label="Command Center header" role="banner">
        <div className="command-shell__title-block">
          <p className="command-shell__eyebrow">Command Center</p>
          <h2>Command Center</h2>
          <p className="command-shell__session-line">Session {session.sessionId}</p>
        </div>
        <GlobalHud hud={hud} factionId={session.factionId} playerSlot={session.playerSlot} playerName={session.playerName} />
        <button className="command-shell__back" type="button" onClick={onBack}>
          Back to Menu
        </button>
      </header>

      <div className="command-shell__body">
        <aside className="command-shell__sidebar" aria-label="Command sidebar">
          <nav className="command-shell__nav" aria-label="Command panels">
            {CORE_PANELS.map((panel) => (
              <button
                key={panel.id}
                type="button"
                className="command-shell__nav-button"
                aria-pressed={activePanel === panel.id}
                onClick={() => onPanelChange(panel.id)}
              >
                {panel.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="command-shell__panel" aria-label="Command content panel">
          <div className="command-shell__panel-heading">
            <p className="command-shell__eyebrow">Active panel</p>
            <h3>{activeDef.label}</h3>
          </div>
          <PanelContent panel={activePanel} session={session} />
        </section>
      </div>
    </div>
  );
}

type SessionRouteState = SessionStoreState & {
  sessionId: number;
  factionId: number;
  playerSlot: PlayerSlot;
  playerName: string;
};

function PanelContent({
  panel,
  session,
}: {
  panel: PanelId;
  session: SessionRouteState;
}) {
  if (panel === 'overview') {
    return (
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
    );
  }

  if (panel === 'session-brief') {
    return (
      <div className="command-shell__brief">
        <p>
          Session Brief for {session.playerName}. Share Session {session.sessionId} with
          the opposing browser and keep this shell open during panel work.
        </p>
      </div>
    );
  }

  return (
    <div className="command-shell__brief" aria-label={`${panel} panel placeholder`}>
      <p>This panel is not yet available.</p>
    </div>
  );
}

function GlobalHud({
  hud,
  factionId,
  playerSlot,
  playerName,
}: {
  hud: HudData;
  factionId: number;
  playerSlot: string;
  playerName: string;
}) {
  const factionLabel = hud.factionName ?? `Faction ${factionId}`;
  const turnLabel = hud.turn != null ? `Turn ${hud.turn}` : null;
  const yearLabel = hud.year != null ? `Year ${hud.year}` : null;
  const turnYear = [turnLabel, yearLabel].filter(Boolean).join(' · ') || null;
  const resourceSummary =
    hud.resources != null
      ? Object.entries(hud.resources)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')
      : null;

  return (
    <div className="command-shell__context" aria-label="Current player context">
      <span>
        Your slot: <strong>{playerSlot}</strong>
      </span>
      <span>Commander: {playerName}</span>
      <span aria-label="Faction identity">{factionLabel}</span>
      {turnYear ? (
        <span aria-label="Turn and year">{turnYear}</span>
      ) : (
        <span aria-label="Turn and year" className="command-shell__hud-absent">
          Turn —
        </span>
      )}
      {hud.phase ? (
        <span aria-label="Phase">{hud.phase}</span>
      ) : (
        <span aria-label="Phase" className="command-shell__hud-absent">
          Phase —
        </span>
      )}
      {hud.controlScore != null ? (
        <span aria-label="Control score">Control: {hud.controlScore}</span>
      ) : (
        <span aria-label="Control score" className="command-shell__hud-absent">
          Control —
        </span>
      )}
      {resourceSummary ? (
        <span aria-label="Resources">{resourceSummary}</span>
      ) : (
        <span aria-label="Resources" className="command-shell__hud-absent">
          Resources —
        </span>
      )}
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
