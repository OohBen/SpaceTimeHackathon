import { useEffect, useState } from 'react';
import { Landing } from './Landing';
import { Setup } from './Setup';
import { useSessionStore } from '../session/store';
import {
  resetSessionStoreData,
  sessionStore,
} from '../state/session-store';
import {
  findOwnedSlot,
  useSpacetimeSessionBackend,
  type SessionBackend,
  type SessionBackendResult,
} from '../session/spacetime';
import { useLiveSessionBridge } from '../session/liveBridge';
import type { PlayerSlot, SetupParams, SetupState } from './types';
import TacticalCommand from '../tactical/TacticalCommand';

type View = 'landing' | 'setup' | 'game';
const LOCAL_DEMO_SESSION_ID = 9001;

const LOCAL_DEMO_SLOTS: Record<
  PlayerSlot,
  {
    factionId: number;
    factionName: string;
    identity: string;
    defaultCommander: string;
    resources: Record<string, number>;
    morale: number;
    doctrine: string;
  }
> = {
  player_a: {
    factionId: 202,
    factionName: 'Solar Republic',
    identity: 'demo-browser-a',
    defaultCommander: 'Browser A Commander',
    resources: { credits: 150, minerals: 30, science: 12 },
    morale: 80,
    doctrine: 'expansion',
  },
  player_b: {
    factionId: 303,
    factionName: 'Martian League',
    identity: 'demo-browser-b',
    defaultCommander: 'Browser B Commander',
    resources: { credits: 90, minerals: 42, science: 18 },
    morale: 76,
    doctrine: 'contested-mars',
  },
};

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
  // Mirror generated table rows into `sessionStore` so the Inbox and HUD see
  // the same live state the rest of the route flow consumes.
  useLiveSessionBridge();
  return <AppRouterView {...props} backend={backend} />;
}

function AppRouterView({
  backend,
  onSessionReady,
  onSubmit,
}: AppRouterProps & { backend: SessionBackend }) {
  const sessionClient = backend.client;
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
    if (router.view === 'game' && router.gameRoute && isLocalDemoRoute(router.gameRoute)) {
      const routeMatchesStoredContext =
        hasCompleteSessionContext(session) && storedContextMatchesRoute(session, router.gameRoute);

      if (session.status !== 'ready' || !routeMatchesStoredContext) {
        const result = seedLocalDemoSession(
          LOCAL_DEMO_SLOTS[router.gameRoute.playerSlot].defaultCommander,
          router.gameRoute.playerSlot,
        );
        session.setReady(result);
        onSessionReady?.(result.sessionId, result.playerSlot);
        return;
      }
    }

    if (router.view === 'game' && router.gameRoute && hasCompleteSessionContext(session)) {
      const routeMatchesStoredContext = storedContextMatchesRoute(session, router.gameRoute);
      const routed = findRoutedSlot(backend, router.gameRoute);

      if (routeMatchesStoredContext && routed) {
        return;
      }

      if (routed) {
        session.setReady(routed);
        onSessionReady?.(routed.sessionId, routed.playerSlot);
        return;
      }

      if (session.status === 'ready') {
        session.reset();
      }
      return;
    }

    if (session.status === 'ready') {
      return;
    }

    if (router.view === 'game' && router.gameRoute) {
      const routed = findRoutedSlot(backend, router.gameRoute);
      if (routed) {
        session.setReady(routed);
        onSessionReady?.(routed.sessionId, routed.playerSlot);
        return;
      }
    }

    const owned = findOwnedSlot(backend.sessions, backend.factions, backend.identity);
    if (!owned) {
      return;
    }

    if (router.view !== 'game') {
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
    if (state.mode === 'demo') {
      const result = seedLocalDemoSession(state.playerName, state.playerSlot ?? 'player_a');
      session.setReady(result);
      onSessionReady?.(result.sessionId, result.playerSlot);
      enterGame(result);
      return;
    }

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
        sessionClient={sessionClient}
        onJoinRoute={async (route) => {
          const slot = backend
            .getSlotChoices(route.sessionId)
            .find((choice) => choice.key === route.playerSlot);
          session.beginMutation();
          try {
            const result = await backend.joinOrResume({
              mode: 'resume',
              playerName: slot?.factionName ?? route.playerSlot,
              sessionId: route.sessionId,
              playerSlot: route.playerSlot,
            });
            session.setReady(result);
            onSessionReady?.(result.sessionId, result.playerSlot);
            enterGame(result, 'replace');
          } catch (err) {
            const msg = actionableSessionError(err);
            session.setError(msg);
          }
        }}
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

function findRoutedSlot(
  backend: SessionBackend,
  route: GameRouteParams,
): SessionBackendResult | null {
  const session = backend.sessions.find((row) => row.id === route.sessionId);
  if (!session) return null;

  const choice = backend
    .getSlotChoices(session.id)
    .find((slot) => slot.key === route.playerSlot && slot.status === 'yours');
  if (!choice || choice.factionId === undefined) return null;

  const faction = backend.factions.find((row) => row.id === choice.factionId);
  return {
    sessionId: session.id,
    factionId: choice.factionId,
    playerSlot: route.playerSlot,
    playerName: faction?.name ?? route.playerSlot,
    isResume: true,
  };
}

type SessionStoreState = ReturnType<typeof useSessionStore.getState>;
type HistoryMode = 'push' | 'replace';

function GameRoute({
  route,
  session,
  sessionClient,
  onJoinRoute,
  onBack,
}: {
  route: GameRouteParams;
  session: SessionStoreState;
  sessionClient: SessionBackend['client'];
  onJoinRoute: (route: GameRouteParams) => Promise<void>;
  onBack: () => void;
}) {
  if (!hasCompleteSessionContext(session)) {
    return (
      <RouteGuard
        message="Join or resume this session before entering the game route."
        actionLabel="Join this slot"
        actionBusyLabel="Joining..."
        actionError={session.error}
        actionPending={session.status === 'loading'}
        onAction={() => onJoinRoute(route)}
        onBack={onBack}
      />
    );
  }

  if (!storedContextMatchesRoute(session, route)) {
    return (
      <RouteGuard
        message="Route does not match stored session context. Return to the menu and join the correct slot."
        actionError={session.error}
        onBack={onBack}
      />
    );
  }

  return <TacticalShell session={session} sessionClient={sessionClient} />;
}

function TacticalShell({
  session,
  sessionClient,
}: {
  session: SessionStoreState & {
    sessionId: number;
    factionId: number;
    playerSlot: PlayerSlot;
    playerName: string;
  };
  sessionClient: SessionBackend['client'];
}) {
  // Bind the live tactical bundle to this route's session + slot so
  // useTacticalData() resolves the current player's faction.
  useEffect(() => {
    const actions = sessionStore.getState().actions;
    actions.setActiveSession(session.sessionId);
    actions.setActivePlayerSlot(session.playerSlot === 'player_b' ? 2 : 1);
  }, [session.playerSlot, session.sessionId]);

  return <TacticalCommand client={sessionClient ?? null} />;
}

function RouteGuard({
  message,
  actionLabel,
  actionBusyLabel,
  actionError,
  actionPending = false,
  onAction,
  onBack,
}: {
  message: string;
  actionLabel?: string;
  actionBusyLabel?: string;
  actionError?: string | null;
  actionPending?: boolean;
  onAction?: () => Promise<void>;
  onBack: () => void;
}) {
  return (
    <div>
      <p role="alert">{message}</p>
      {onAction ? (
        <button type="button" disabled={actionPending} onClick={() => { void onAction(); }}>
          {actionPending ? actionBusyLabel ?? actionLabel : actionLabel}
        </button>
      ) : null}
      {actionError ? <p role="alert">{actionError}</p> : null}
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

function isLocalDemoRoute(route: GameRouteParams): boolean {
  return route.sessionId === LOCAL_DEMO_SESSION_ID;
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

function seedLocalDemoSession(playerName: string, playerSlot: PlayerSlot): SessionBackendResult {
  const selected = LOCAL_DEMO_SLOTS[playerSlot];
  const commanderName = playerName.trim() || selected.defaultCommander;
  const result: SessionBackendResult = {
    sessionId: LOCAL_DEMO_SESSION_ID,
    factionId: selected.factionId,
    playerSlot,
    playerName: commanderName,
    isResume: false,
  };

  resetSessionStoreData();
  sessionStore.getState().actions.setConnection({
    status: 'connected',
    identity: selected.identity,
    error: null,
  });
  sessionStore.getState().actions.hydrateSubscription({
    sessions: [
      {
        id: String(LOCAL_DEMO_SESSION_ID),
        code: 'DEMO',
        status: 'active',
        currentTurn: 5,
        phase: 'decision',
      },
    ],
    playerSlots: [
      {
        sessionId: String(LOCAL_DEMO_SESSION_ID),
        slot: 1,
        identity: LOCAL_DEMO_SLOTS.player_a.identity,
        factionId: String(LOCAL_DEMO_SLOTS.player_a.factionId),
        factionName: LOCAL_DEMO_SLOTS.player_a.factionName,
        playerName:
          playerSlot === 'player_a'
            ? commanderName
            : LOCAL_DEMO_SLOTS.player_a.defaultCommander,
        occupied: true,
        visibility: playerSlot === 'player_a' ? 'own' : 'public',
      },
      {
        sessionId: String(LOCAL_DEMO_SESSION_ID),
        slot: 2,
        identity: LOCAL_DEMO_SLOTS.player_b.identity,
        factionId: String(LOCAL_DEMO_SLOTS.player_b.factionId),
        factionName: LOCAL_DEMO_SLOTS.player_b.factionName,
        playerName:
          playerSlot === 'player_b'
            ? commanderName
            : LOCAL_DEMO_SLOTS.player_b.defaultCommander,
        occupied: true,
        visibility: playerSlot === 'player_b' ? 'own' : 'public',
      },
    ],
    publicGameStates: [
      {
        sessionId: String(LOCAL_DEMO_SESSION_ID),
        turn: 5,
        year: 2351,
        phase: 'decision',
        controlScores: { '202': 52, '303': 38 },
        visibleFactionIds: ['202', '303'],
      },
    ],
    publicFactions: [
      {
        id: String(LOCAL_DEMO_SLOTS.player_a.factionId),
        sessionId: String(LOCAL_DEMO_SESSION_ID),
        name: LOCAL_DEMO_SLOTS.player_a.factionName,
        controlScore: 52,
        readyForTurn: false,
      },
      {
        id: String(LOCAL_DEMO_SLOTS.player_b.factionId),
        sessionId: String(LOCAL_DEMO_SESSION_ID),
        name: LOCAL_DEMO_SLOTS.player_b.factionName,
        controlScore: 38,
        readyForTurn: false,
      },
    ],
    privateFactionStates: [
      {
        sessionId: String(LOCAL_DEMO_SESSION_ID),
        factionId: String(selected.factionId),
        resources: selected.resources,
        morale: selected.morale,
        doctrine: selected.doctrine,
        visibility: 'ownFaction',
      },
    ],
    factions: [
      {
        id: '202',
        sessionId: String(LOCAL_DEMO_SESSION_ID),
        name: LOCAL_DEMO_SLOTS.player_a.factionName,
        credits: LOCAL_DEMO_SLOTS.player_a.resources.credits,
        politicalCapital: 18,
        doctrineVector: '{"strategy":72,"approach":36,"command":64,"focus":58,"style":44}',
        controlScore: 52,
        readyForTurn: false,
      },
      {
        id: '303',
        sessionId: String(LOCAL_DEMO_SESSION_ID),
        name: LOCAL_DEMO_SLOTS.player_b.factionName,
        credits: LOCAL_DEMO_SLOTS.player_b.resources.credits,
        politicalCapital: 11,
        doctrineVector: '{"strategy":44,"approach":68,"command":47,"focus":42,"style":61}',
        controlScore: 38,
        readyForTurn: false,
      },
    ],
    proposals: [
      playerSlot === 'player_a'
        ? {
            id: '9701',
            sessionId: String(LOCAL_DEMO_SESSION_ID),
            factionId: String(LOCAL_DEMO_SLOTS.player_a.factionId),
            turn: 5,
            proposingPersonnelId: '701',
            department: 'Industry',
            title: 'Solar orbital yard expansion',
            body: 'Expand orbital yard capacity to accelerate Callisto convoy production.',
            resourceCost: 45,
            confidence: 'high',
            status: 'unread',
            decision: null,
          }
        : {
            id: '9801',
            sessionId: String(LOCAL_DEMO_SESSION_ID),
            factionId: String(LOCAL_DEMO_SLOTS.player_b.factionId),
            turn: 5,
            proposingPersonnelId: '801',
            department: 'Fleet',
            title: 'Mars dust lane interdiction',
            body: 'Deploy patrol craft along the Mars dust lane before Solar convoys arrive.',
            resourceCost: 35,
            confidence: 'medium',
            status: 'unread',
            decision: null,
          },
    ],
    llmRequests: [
      {
        id: playerSlot === 'player_a' ? 'demo-llm-9701' : 'demo-llm-9801',
        sessionId: String(LOCAL_DEMO_SESSION_ID),
        factionId: String(selected.factionId),
        requestType: 'proposals',
        status: 'completed',
        responseJson: '{"source":"deterministic_fallback"}',
        error: null,
        errorCode: null,
        attemptCount: 1,
        createdTurn: 5,
        updatedTurn: 5,
      },
    ],
    intelligenceRecords: [
      {
        id: 'demo-intel-1',
        observerFactionId: '202',
        targetFactionId: '303',
        intelType: 'signals',
        value: '{"diplomatic_posture":"probing Callisto access","known_cities":["Pavonis"]}',
        accuracy: 82,
        acquiredTurn: 5,
      },
    ],
  });

  return result;
}
