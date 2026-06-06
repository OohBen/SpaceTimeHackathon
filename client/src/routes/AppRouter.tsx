import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { Landing } from './Landing';
import { Setup } from './Setup';
import { useSessionStore } from '../session/store';
import {
  selectIntelligenceRecords,
  selectEventsForSession,
  selectFactionById,
  selectFactionsForSession,
  selectLatestTurnSummaryForFaction,
  selectPersonnelRoster,
  selectPrivateFactionStateForSession,
  selectPublicGameStateForSession,
  sessionStore,
  type EventRow,
  type FactionRow,
  type IntelligenceRecordRow,
  type PersonnelRow,
  type PrivateFactionStateRow,
  type PublicGameStateRow,
  type SessionRow,
  type TurnSummaryRow,
} from '../state/session-store';
import {
  findOwnedSlot,
  useSpacetimeSessionBackend,
  type SessionBackend,
  type SessionBackendResult,
} from '../session/spacetime';
import { useLiveSessionBridge } from '../session/liveBridge';
import { useHudData, type HudData } from './hud';
import type { PlayerSlot, SetupParams, SetupState } from './types';
import { usePanelStore, CORE_PANELS, findPanelDef, type PanelId } from './panels';
import { WorldMapPanel } from './WorldMapPanel';
import { Inbox } from '../components/inbox/Inbox';
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
    if (state.mode === 'demo') {
      const result = seedLocalDemoSession(state.playerName);
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
  sessionClient,
  onBack,
}: {
  route: GameRouteParams;
  session: SessionStoreState;
  sessionClient: SessionBackend['client'];
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
      sessionClient={sessionClient}
      activePanel={activePanel}
      onPanelChange={setPanel}
      onBack={onBack}
    />
  );
}

function CommandCenterShell({
  session,
  sessionClient,
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
  sessionClient: SessionBackend['client'];
  activePanel: PanelId;
  onPanelChange: (panel: PanelId) => void;
  onBack: () => void;
}) {
  const activeDef = findPanelDef(activePanel);
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
          <PanelContent panel={activePanel} session={session} sessionClient={sessionClient} />
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
  sessionClient,
}: {
  panel: PanelId;
  session: SessionRouteState;
  sessionClient: SessionBackend['client'];
}) {
  const sessionId = String(session.sessionId);
  const factionId = String(session.factionId);
  const operationalState = useStore(sessionStore);
  const activeSession = operationalState.sessionsById[sessionId] ?? null;
  const publicGameState = selectPublicGameStateForSession(operationalState, sessionId);
  const privateFactionState = selectPrivateFactionStateForSession(
    operationalState,
    sessionId,
    factionId,
  );
  const currentFaction = selectFactionById(operationalState, factionId);
  const sessionFactions = selectFactionsForSession(operationalState, sessionId);
  const personnel = selectPersonnelRoster(operationalState, factionId);
  const intelligenceRecords = selectIntelligenceRecords(operationalState, factionId);
  const sessionEvents = selectEventsForSession(operationalState, sessionId, factionId);
  const latestTurnSummary = selectLatestTurnSummaryForFaction(
    operationalState,
    sessionId,
    factionId,
  );

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

  if (panel === 'inbox') {
    return <Inbox client={sessionClient ?? undefined} />;
  }

  if (panel === 'map') {
    return <WorldMapPanel sessionId={session.sessionId} />;
  }

  if (panel === 'personnel') {
    return <PersonnelPanel personnel={personnel} />;
  }

  if (panel === 'resources') {
    return (
      <ResourcesPanel
        factionState={privateFactionState}
        publicGameState={publicGameState}
        factionId={factionId}
      />
    );
  }

  if (panel === 'intelligence') {
    return <IntelligencePanel records={intelligenceRecords} />;
  }

  if (panel === 'diplomacy') {
    return (
      <DiplomacyPanel
        sessionId={sessionId}
        factionId={factionId}
        currentFaction={currentFaction}
        factions={sessionFactions}
        publicGameState={publicGameState}
        intelligenceRecords={intelligenceRecords}
      />
    );
  }

  if (panel === 'doctrine') {
    return <DoctrinePanel factionState={privateFactionState} currentFaction={currentFaction} />;
  }

  if (panel === 'resolution') {
    return (
      <ResolutionPanel
        currentFaction={currentFaction}
        publicGameState={publicGameState}
        turnSummary={latestTurnSummary}
        events={sessionEvents}
        factions={sessionFactions}
      />
    );
  }

  if (panel === 'end-game') {
    return (
      <EndGamePanel
        session={activeSession}
        currentFaction={currentFaction}
        publicGameState={publicGameState}
        turnSummary={latestTurnSummary}
        events={sessionEvents}
        factions={sessionFactions}
      />
    );
  }

  const panelDef = findPanelDef(panel);
  return (
    <div className="command-shell__brief" aria-label={`${panelDef.label} panel placeholder`}>
      <p>
        {panelDef.label}: {panelDef.unavailableMessage ?? 'This panel is not yet available.'}{' '}
        Session {session.sessionId} remains available in the shared shell while this view waits for
        implementation data.
      </p>
    </div>
  );
}

function EndGamePanel({
  session,
  currentFaction,
  publicGameState,
  turnSummary,
  events,
  factions,
}: {
  session: SessionRow | null;
  currentFaction: FactionRow | null;
  publicGameState: PublicGameStateRow | null;
  turnSummary: TurnSummaryRow | null;
  events: EventRow[];
  factions: FactionRow[];
}) {
  const payload = parseResolutionSummary(turnSummary?.summaryJson);
  const controlScores = Object.keys(payload.controlScores).length
    ? payload.controlScores
    : publicGameState?.controlScores ?? factionControlScores(factions);
  const standings = sortedControlStandings(controlScores);
  const explicitWinnerId =
    normalizeId(session?.winnerFactionId) ?? normalizeId(victoryWinnerFactionId(events));
  const isComplete =
    session?.status === 'complete' ||
    session?.status === 'completed' ||
    session?.phase === 'complete' ||
    publicGameState?.phase === 'complete' ||
    explicitWinnerId !== null;
  const winnerId = explicitWinnerId ?? (isComplete ? standings[0]?.id : null) ?? null;
  const winnerLabel = winnerId ? factionName(factions, currentFaction, winnerId) : 'Winner pending';
  const turn = turnSummary?.turn ?? publicGameState?.turn ?? session?.currentTurn ?? null;
  const headline =
    payload.headline ??
    (isComplete ? 'Final command review ready' : 'End-game review waiting for victory check');
  const summaryEvents =
    payload.events.length > 0
      ? payload.events
      : events.slice(0, 5).map((event) => `${event.eventType}: ${formatEventPayload(event)}`);

  return (
    <div className="command-shell__data-panel" aria-label="End game review">
      <div className="command-shell__metric-grid">
        <div>
          <span>State</span>
          <strong>{isComplete ? 'Session complete' : 'Awaiting final state'}</strong>
        </div>
        <div>
          <span>Winner</span>
          <strong>{winnerId && isComplete ? `${winnerLabel} victory` : winnerLabel}</strong>
        </div>
        <div>
          <span>Final turn</span>
          <strong>{turn != null ? `Turn ${turn}` : 'Unknown'}</strong>
        </div>
      </div>

      <section className="command-shell__ledger" aria-label="Final outcome headline">
        <h4>Final report</h4>
        <p>{headline}</p>
      </section>

      <div className="command-shell__split-grid">
        <section className="command-shell__ledger" aria-label="Final control standings">
          <h4>Control standings</h4>
          {standings.length > 0 ? (
            <ol className="command-shell__plain-list">
              {standings.map(({ id, score }) => (
                <li key={id}>
                  {factionName(factions, currentFaction, id)} Control {score}
                </li>
              ))}
            </ol>
          ) : (
            <p>Final control scores have not arrived.</p>
          )}
        </section>

        <section className="command-shell__ledger" aria-label="Final event highlights">
          <h4>Highlights</h4>
          {summaryEvents.length > 0 ? (
            <ol className="command-shell__plain-list">
              {summaryEvents.slice(0, 5).map((event) => (
                <li key={event}>{event}</li>
              ))}
            </ol>
          ) : (
            <p>No final events have arrived.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function PersonnelPanel({ personnel }: { personnel: PersonnelRow[] }) {
  if (personnel.length === 0) {
    return (
      <div className="command-shell__brief" aria-label="Personnel roster unavailable">
        <p>Personnel roster data is not yet available for this faction.</p>
      </div>
    );
  }

  return (
    <div className="command-shell__data-panel" aria-label="Personnel roster">
      <table className="command-shell__table">
        <caption>Faction roster</caption>
        <thead>
          <tr>
            <th scope="col">Officer</th>
            <th scope="col">Assignment</th>
            <th scope="col">State</th>
            <th scope="col">Traits</th>
          </tr>
        </thead>
        <tbody>
          {personnel.map((person) => (
            <tr key={String(person.id)}>
              <td>
                <strong>{person.name}</strong>
                <span>Salary {person.salary}</span>
              </td>
              <td>
                <strong>{person.role}</strong>
                <span>{person.department}</span>
                <span>Posting {person.postingCityId ?? 'Unassigned'}</span>
              </td>
              <td>
                <span>Morale {person.morale}</span>
                <span>Burnout {person.burnout}</span>
                <span>Loyalty {person.loyalty}</span>
              </td>
              <td>
                <span>Competence {person.competence}</span>
                <span>Creativity {person.creativity}</span>
                <span>Reliability {person.reliability}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResourcesPanel({
  factionState,
  publicGameState,
  factionId,
}: {
  factionState: PrivateFactionStateRow | null;
  publicGameState: PublicGameStateRow | null;
  factionId: string;
}) {
  if (!factionState && !publicGameState) {
    return (
      <div className="command-shell__brief" aria-label="Resource state unavailable">
        <p>Economy and logistics state is not yet available for this faction.</p>
      </div>
    );
  }

  const resources = Object.entries(factionState?.resources ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const controlScore = publicGameState?.controlScores[factionId] ?? null;

  return (
    <div className="command-shell__data-panel" aria-label="Resource and logistics state">
      <div className="command-shell__metric-grid">
        <div>
          <span>Turn</span>
          <strong>{publicGameState ? `Turn ${publicGameState.turn}` : 'Unknown'}</strong>
        </div>
        <div>
          <span>Year</span>
          <strong>{publicGameState?.year ?? 'Unknown'}</strong>
        </div>
        <div>
          <span>Phase</span>
          <strong>{publicGameState?.phase ?? 'Unknown'}</strong>
        </div>
        <div>
          <span>Control</span>
          <strong>{controlScore != null ? `Control ${controlScore}` : 'Unknown'}</strong>
        </div>
        <div>
          <span>Morale</span>
          <strong>{factionState ? `Morale ${factionState.morale}` : 'Unknown'}</strong>
        </div>
        <div>
          <span>Doctrine</span>
          <strong>{factionState ? `Doctrine ${factionState.doctrine}` : 'Unknown'}</strong>
        </div>
      </div>

      <section className="command-shell__ledger" aria-label="Resource ledger">
        <h4>Resource ledger</h4>
        {resources.length > 0 ? (
          <dl>
            {resources.map(([name, amount]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{amount}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>No resource entries are available yet.</p>
        )}
      </section>
    </div>
  );
}

function IntelligencePanel({ records }: { records: IntelligenceRecordRow[] }) {
  if (records.length === 0) {
    return (
      <div className="command-shell__brief" aria-label="Intelligence records unavailable">
        <p>Intelligence reports are not yet available for this faction.</p>
      </div>
    );
  }

  return (
    <div className="command-shell__data-panel" aria-label="Intelligence records">
      <div className="command-shell__intel-list">
        {records.map((record) => (
          <article key={String(record.id)} className="command-shell__intel-record">
            <header>
              <h4>{record.intelType}</h4>
              <span>Accuracy {record.accuracy}%</span>
            </header>
            <p>
              Target {record.targetFactionId} - Turn {record.acquiredTurn}
            </p>
            <p>{formatIntelValue(record.value)}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function DiplomacyPanel({
  sessionId,
  factionId,
  currentFaction,
  factions,
  publicGameState,
  intelligenceRecords,
}: {
  sessionId: string;
  factionId: string;
  currentFaction: FactionRow | null;
  factions: FactionRow[];
  publicGameState: PublicGameStateRow | null;
  intelligenceRecords: IntelligenceRecordRow[];
}) {
  const visibleFactionIds = new Set(
    publicGameState?.visibleFactionIds.map(String) ?? factions.map((faction) => String(faction.id)),
  );
  const visibleFactions = factions.filter((faction) => visibleFactionIds.has(String(faction.id)));
  const ownName = currentFaction?.name ?? `Faction ${factionId}`;
  const opponentCount = visibleFactions.filter((faction) => String(faction.id) !== factionId).length;

  if (!publicGameState && visibleFactions.length === 0 && intelligenceRecords.length === 0) {
    return (
      <div className="command-shell__brief" aria-label="Diplomacy posture unavailable">
        <p>
          Diplomacy channel data is not yet available for Session {sessionId}. Documented MVP
          summaries will use faction posture and intelligence feeds when they arrive.
        </p>
      </div>
    );
  }

  return (
    <div className="command-shell__data-panel" aria-label="Diplomacy posture">
      <div className="command-shell__metric-grid">
        <div>
          <span>Current faction</span>
          <strong>{ownName}</strong>
        </div>
        <div>
          <span>Visible counterparts</span>
          <strong>{opponentCount}</strong>
        </div>
        <div>
          <span>Turn phase</span>
          <strong>{publicGameState?.phase ?? 'Unknown'}</strong>
        </div>
      </div>

      <section className="command-shell__posture-list" aria-label="Visible faction posture">
        {visibleFactions.map((faction) => {
          const control =
            publicGameState?.controlScores[String(faction.id)] ?? faction.controlScore ?? null;
          const isOwnFaction = String(faction.id) === factionId;

          return (
            <article key={String(faction.id)} className="command-shell__posture-card">
              <header>
                <h4>{faction.name}</h4>
                <span>{isOwnFaction ? 'Own faction' : faction.readyForTurn ? 'Ready' : 'Deciding'}</span>
              </header>
              <p>{control != null ? `Control ${control}` : 'Control unknown'}</p>
              <p>
                {isOwnFaction
                  ? 'Command posture anchors negotiation leverage.'
                  : 'MVP diplomacy summary derived from visible control, readiness, and intel.'}
              </p>
            </article>
          );
        })}
      </section>

      <section className="command-shell__ledger" aria-label="Recent diplomatic intelligence">
        <h4>Recent diplomatic signals</h4>
        {intelligenceRecords.length > 0 ? (
          <ul className="command-shell__plain-list">
            {intelligenceRecords.slice(0, 3).map((record) => (
              <li key={String(record.id)}>
                Turn {record.acquiredTurn} {record.intelType}: {formatIntelValue(record.value)}
              </li>
            ))}
          </ul>
        ) : (
          <p>No diplomatic intelligence has arrived this turn.</p>
        )}
      </section>
    </div>
  );
}

function DoctrinePanel({
  factionState,
  currentFaction,
}: {
  factionState: PrivateFactionStateRow | null;
  currentFaction: FactionRow | null;
}) {
  const doctrineName = factionState?.doctrine ?? 'documented MVP';
  const vector = parseDoctrineVector(currentFaction?.doctrineVector);
  const axes = DOCTRINE_AXES.map((axis) => ({
    ...axis,
    value: doctrineAxisValue(axis.key, vector[axis.key], doctrineName),
  }));
  const unlocks = doctrineUnlocks(doctrineName, axes);

  return (
    <div className="command-shell__data-panel" aria-label="Faction doctrine posture">
      <div className="command-shell__metric-grid">
        <div>
          <span>Faction</span>
          <strong>{currentFaction?.name ?? 'Current faction'}</strong>
        </div>
        <div>
          <span>Current doctrine</span>
          <strong>{titleCase(doctrineName)}</strong>
        </div>
        <div>
          <span>Political capital</span>
          <strong>{currentFaction?.politicalCapital ?? 'Unknown'}</strong>
        </div>
      </div>

      <section className="command-shell__axis-list" aria-label="Doctrine axes">
        {axes.map((axis) => (
          <article key={axis.key} className="command-shell__axis-row">
            <header>
              <span>{axis.left}</span>
              <span>{axis.right}</span>
            </header>
            <div
              className="command-shell__axis-track"
              aria-label={`${axis.left} to ${axis.right}: ${Math.round(axis.value)}`}
            >
              <span style={{ width: `${axis.value}%` }} />
            </div>
            <p>{axisSummary(axis)}</p>
          </article>
        ))}
      </section>

      <section className="command-shell__ledger" aria-label="Unlocked doctrine effects">
        <h4>Unlocked by current doctrine</h4>
        <ul className="command-shell__plain-list">
          {unlocks.map((unlock) => (
            <li key={unlock}>{unlock}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ResolutionPanel({
  currentFaction,
  publicGameState,
  turnSummary,
  events,
  factions,
}: {
  currentFaction: FactionRow | null;
  publicGameState: PublicGameStateRow | null;
  turnSummary: TurnSummaryRow | null;
  events: EventRow[];
  factions: FactionRow[];
}) {
  const payload = parseResolutionSummary(turnSummary?.summaryJson);
  const turn = turnSummary?.turn ?? publicGameState?.turn ?? null;
  const headline = payload.headline ?? (turn != null ? `Turn ${turn} outcome summary` : 'Turn outcome summary');
  const summaryEvents =
    payload.events.length > 0
      ? payload.events
      : events.slice(0, 5).map((event) => `${event.eventType}: ${formatEventPayload(event)}`);
  const controlScores = Object.keys(payload.controlScores).length
    ? payload.controlScores
    : publicGameState?.controlScores ?? {};
  const resourceDeltas = payload.resourceDeltas;

  return (
    <div className="command-shell__data-panel" aria-label="Turn resolution summary">
      <div className="command-shell__metric-grid">
        <div>
          <span>Summary</span>
          <strong>{headline}</strong>
        </div>
        <div>
          <span>Turn</span>
          <strong>{turn != null ? `Turn ${turn}` : 'Unknown'}</strong>
        </div>
        <div>
          <span>Acknowledgement</span>
          <strong>{turnSummary?.acknowledged ? 'Acknowledged' : 'Acknowledgement pending'}</strong>
        </div>
      </div>

      <section className="command-shell__ledger" aria-label="Resolution event log">
        <h4>Outcome log</h4>
        {summaryEvents.length > 0 ? (
          <ol className="command-shell__plain-list">
            {summaryEvents.slice(0, 5).map((event) => (
              <li key={event}>{event}</li>
            ))}
          </ol>
        ) : (
          <p>No event rows have arrived for this resolution yet.</p>
        )}
      </section>

      <div className="command-shell__split-grid">
        <section className="command-shell__ledger" aria-label="Control score changes">
          <h4>Control</h4>
          {Object.keys(controlScores).length > 0 ? (
            <ul className="command-shell__plain-list">
              {Object.entries(controlScores).map(([id, score]) => (
                <li key={id}>
                  {factionName(factions, currentFaction, id)} Control {score}
                </li>
              ))}
            </ul>
          ) : (
            <p>Control score data has not arrived.</p>
          )}
        </section>

        <section className="command-shell__ledger" aria-label="Resource deltas">
          <h4>Resource deltas</h4>
          {Object.keys(resourceDeltas).length > 0 ? (
            <ul className="command-shell__plain-list">
              {Object.entries(resourceDeltas).map(([name, amount]) => (
                <li key={name}>
                  {name} {formatSigned(amount)}
                </li>
              ))}
            </ul>
          ) : (
            <p>No resource deltas were reported.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function formatIntelValue(value: string): string {
  try {
    return summarizeIntelValue(JSON.parse(value));
  } catch {
    return value;
  }
}

function summarizeIntelValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(summarizeIntelValue).join(', ');
  }

  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, entry]) => `${key}: ${summarizeIntelValue(entry)}`)
      .join('; ');
  }

  return String(value);
}

type DoctrineAxisKey = 'strategy' | 'approach' | 'command' | 'focus' | 'style';

interface DoctrineAxisDef {
  key: DoctrineAxisKey;
  left: string;
  right: string;
  leftEffect: string;
  rightEffect: string;
}

interface DoctrineAxisView extends DoctrineAxisDef {
  value: number;
}

const DOCTRINE_AXES: DoctrineAxisDef[] = [
  {
    key: 'strategy',
    left: 'Expansionist',
    right: 'Consolidationist',
    leftEffect: 'Rapid expansion proposals',
    rightEffect: 'Stable colony development',
  },
  {
    key: 'approach',
    left: 'Militarist',
    right: 'Diplomatic',
    leftEffect: 'Stronger combat proposals',
    rightEffect: 'Negotiation and trade pressure',
  },
  {
    key: 'command',
    left: 'Centralist',
    right: 'Autonomist',
    leftEffect: 'Tighter Earth oversight',
    rightEffect: 'Faster local initiative',
  },
  {
    key: 'focus',
    left: 'Scientific',
    right: 'Industrial',
    leftEffect: 'Technology proposals unlock earlier',
    rightEffect: 'Construction tempo improves',
  },
  {
    key: 'style',
    left: 'Rigid',
    right: 'Adaptive',
    leftEffect: 'Predictable execution',
    rightEffect: 'Fast pivots under pressure',
  },
];

function parseDoctrineVector(value: string | null | undefined): Partial<Record<DoctrineAxisKey, number>> {
  const parsed = parseJsonObject(value);
  const vector: Partial<Record<DoctrineAxisKey, number>> = {};

  for (const axis of DOCTRINE_AXES) {
    const axisValue = normalizePercent(parsed?.[axis.key]);
    if (axisValue != null) {
      vector[axis.key] = axisValue;
    }
  }

  return vector;
}

function doctrineAxisValue(
  axis: DoctrineAxisKey,
  vectorValue: number | undefined,
  doctrineName: string,
): number {
  if (vectorValue != null) {
    return vectorValue;
  }

  const normalized = doctrineName.toLowerCase();
  if (axis === 'strategy' && normalized.includes('expansion')) return 25;
  if (axis === 'strategy' && normalized.includes('consolid')) return 75;
  if (axis === 'approach' && normalized.includes('militar')) return 25;
  if (axis === 'approach' && normalized.includes('diplom')) return 75;
  if (axis === 'focus' && normalized.includes('scient')) return 25;
  if (axis === 'focus' && normalized.includes('industrial')) return 75;
  if (axis === 'style' && normalized.includes('adaptive')) return 75;
  if (axis === 'style' && normalized.includes('rigid')) return 25;
  return 50;
}

function doctrineUnlocks(doctrineName: string, axes: DoctrineAxisView[]): string[] {
  const normalized = doctrineName.toLowerCase();
  const strategy = axes.find((axis) => axis.key === 'strategy');
  const focus = axes.find((axis) => axis.key === 'focus');
  const approach = axes.find((axis) => axis.key === 'approach');
  const unlocks = new Set<string>();

  if (normalized.includes('expansion') || (strategy && strategy.value <= 40)) {
    unlocks.add('Rapid expansion proposals');
    unlocks.add('Frontier colonist recruits');
  }
  if (normalized.includes('industrial') || (focus && focus.value >= 60)) {
    unlocks.add('Industrial build queues');
  }
  if (normalized.includes('diplom') || (approach && approach.value >= 60)) {
    unlocks.add('Negotiation-oriented officer proposals');
  }
  if (unlocks.size === 0) {
    unlocks.add('Balanced department proposals');
  }

  unlocks.add('Doctrine drift visible in future proposal mix');
  return [...unlocks];
}

function axisSummary(axis: DoctrineAxisView): string {
  if (axis.value === 50) {
    return `Balanced posture: ${axis.leftEffect}; ${axis.rightEffect}.`;
  }

  return axis.value < 50
    ? `Leaning ${axis.left}: ${axis.leftEffect}.`
    : `Leaning ${axis.right}: ${axis.rightEffect}.`;
}

interface ParsedResolutionSummary {
  headline: string | null;
  events: string[];
  controlScores: Record<string, number>;
  resourceDeltas: Record<string, number>;
}

function parseResolutionSummary(value: string | null | undefined): ParsedResolutionSummary {
  const parsed = parseJsonObject(value);
  return {
    headline: typeof parsed?.headline === 'string' ? parsed.headline : null,
    events: stringList(parsed?.events),
    controlScores: numberRecord(parsed?.controlScores),
    resourceDeltas: numberRecord(parsed?.resourceDeltas),
  };
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizePercent(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const percent = numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.min(100, Math.max(0, percent));
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry : summarizeIntelValue(entry)))
    .filter((entry) => entry.length > 0);
}

function numberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, raw]) => [key, typeof raw === 'number' ? raw : Number(raw)] as const)
      .filter(([, raw]) => Number.isFinite(raw)),
  );
}

function formatEventPayload(event: EventRow): string {
  if (!event.payload) {
    return `Turn ${event.turn}`;
  }

  return formatIntelValue(event.payload);
}

function factionName(
  factions: FactionRow[],
  currentFaction: FactionRow | null,
  factionId: string,
): string {
  if (currentFaction && String(currentFaction.id) === factionId) {
    return currentFaction.name;
  }

  return factions.find((faction) => String(faction.id) === factionId)?.name ?? `Faction ${factionId}`;
}

function factionControlScores(factions: FactionRow[]): Record<string, number> {
  return Object.fromEntries(factions.map((faction) => [String(faction.id), faction.controlScore]));
}

function sortedControlStandings(controlScores: Record<string, number>): Array<{ id: string; score: number }> {
  return Object.entries(controlScores)
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function victoryWinnerFactionId(events: EventRow[]): string | number | null {
  for (const event of events) {
    if (event.eventType !== 'victory_checked') {
      continue;
    }
    const payload = parseJsonObject(event.payload);
    if (payload?.winner_faction_id != null) {
      return typeof payload.winner_faction_id === 'string' || typeof payload.winner_faction_id === 'number'
        ? payload.winner_faction_id
        : null;
    }
  }

  return null;
}

function normalizeId(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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

function seedLocalDemoSession(playerName: string): SessionBackendResult {
  const result: SessionBackendResult = {
    sessionId: 9001,
    factionId: 202,
    playerSlot: 'player_a',
    playerName,
    isResume: false,
  };

  sessionStore.getState().actions.hydrateSubscription({
    sessions: [{ id: '9001', code: 'DEMO', status: 'active', currentTurn: 5, phase: 'summary' }],
    publicGameStates: [
      {
        sessionId: '9001',
        turn: 5,
        year: 2351,
        phase: 'summary',
        controlScores: { '202': 52, '303': 38 },
        visibleFactionIds: ['202', '303'],
      },
    ],
    privateFactionStates: [
      {
        sessionId: '9001',
        factionId: '202',
        resources: { credits: 150, minerals: 30, science: 12 },
        morale: 80,
        doctrine: 'expansion',
        visibility: 'ownFaction',
      },
    ],
    factions: [
      {
        id: '202',
        sessionId: '9001',
        name: 'Solar Republic',
        credits: 150,
        politicalCapital: 18,
        doctrineVector: '{"strategy":72,"approach":36,"command":64,"focus":58,"style":44}',
        controlScore: 52,
        readyForTurn: true,
      },
      {
        id: '303',
        sessionId: '9001',
        name: 'Martian League',
        credits: 90,
        politicalCapital: 11,
        doctrineVector: '{"strategy":44,"approach":68,"command":47,"focus":42,"style":61}',
        controlScore: 38,
        readyForTurn: false,
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
    turnSummaries: [
      {
        id: 'demo-summary-5',
        sessionId: '9001',
        factionId: '202',
        turn: 5,
        summaryJson:
          '{"headline":"Turn 5 outcome summary","events":["Olympus City infrastructure complete","Opponent colony ship detected inbound to Ganymede"],"controlScores":{"202":52,"303":38},"resourceDeltas":{"credits":-40,"science":6}}',
        acknowledged: false,
      },
    ],
  });

  return result;
}
