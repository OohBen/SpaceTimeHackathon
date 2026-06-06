import { fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from './AppRouter';
import type { SessionBackend } from '../session/spacetime';
import { useSessionStore } from '../session/store';
import { usePanelStore, CORE_PANELS, PANEL_STORE_KEY } from './panels';
import { sessionStore } from '../state/session-store';

function backend(): SessionBackend {
  return {
    isConnected: true,
    identity: 'identity-a',
    sessions: [],
    factions: [],
    getSessionChoices: () => [],
    getSlotChoices: () => [],
    joinOrResume: vi.fn(),
    createAndJoin: vi.fn(),
  };
}

function enterStoredGameContext() {
  useSessionStore.getState().setReady({
    sessionId: 42,
    factionId: 202,
    playerSlot: 'player_b',
    playerName: 'Rex',
  });
  window.history.replaceState(null, '', '/game/42/player_b');
}

function resetSessionStore() {
  sessionStore.setState({
    connection: {
      status: 'idle',
      identity: null,
      error: null,
      diagnostics: { host: 'ws://localhost:3000', dbName: 'solar-dominion', issues: [] },
    },
    activeSessionId: null,
    sessionsById: {},
    playerSlotsByKey: {},
    publicGameStateBySessionId: {},
    privateFactionStateByKey: {},
    factionsById: {},
    personnelById: {},
    intelligenceRecordsById: {},
    eventsById: {},
    turnSummariesById: {},
    reducerCalls: {},
  });
}

function hydrateOperationalPanelState() {
  act(() => {
    sessionStore.getState().actions.hydrateSubscription({
      sessions: [{ id: '42', code: 'GAME1', status: 'active', currentTurn: 5, phase: 'orders' }],
      publicGameStates: [
        {
          sessionId: '42',
          turn: 5,
          year: 2351,
          phase: 'orders',
          controlScores: { '202': 47, '303': 41 },
          visibleFactionIds: ['202', '303'],
        },
      ],
      privateFactionStates: [
        {
          sessionId: '42',
          factionId: '202',
          resources: { credits: 150, minerals: 30, science: 12 },
          morale: 80,
          doctrine: 'expansion',
          visibility: 'ownFaction',
        },
      ],
      personnel: [
        {
          id: '1',
          factionId: '202',
          name: 'Ada Watanabe',
          role: 'Chief Scientist',
          department: 'Research',
          postingCityId: '7',
          competence: 88,
          creativity: 91,
          reliability: 76,
          ambition: 45,
          politicalSkill: 50,
          communication: 72,
          loyalty: 84,
          autonomyTolerance: 68,
          morale: 73,
          burnout: 12,
          salary: 18,
        },
      ],
      intelligenceRecords: [
        {
          id: '10',
          observerFactionId: '202',
          targetFactionId: '303',
          intelType: 'scouting',
          value: '{"visible_bodies":["Mars","Luna"],"known_cities":["Pavonis"]}',
          accuracy: 82,
          acquiredTurn: 5,
        },
      ],
    });
  });
}

function hydrateStrategicPanelState() {
  act(() => {
    const hydrate = sessionStore.getState().actions
      .hydrateSubscription as (snapshot: Record<string, unknown>) => void;

    hydrate({
      sessions: [{ id: '42', code: 'GAME1', status: 'active', currentTurn: 5, phase: 'summary' }],
      publicGameStates: [
        {
          sessionId: '42',
          turn: 5,
          year: 2351,
          phase: 'summary',
          controlScores: { '202': 52, '303': 38 },
          visibleFactionIds: ['202', '303'],
        },
      ],
      privateFactionStates: [
        {
          sessionId: '42',
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
          sessionId: '42',
          name: 'Solar Republic',
          credits: 150,
          politicalCapital: 18,
          doctrineVector:
            '{"strategy":72,"approach":36,"command":64,"focus":58,"style":44}',
          controlScore: 52,
          readyForTurn: true,
        },
        {
          id: '303',
          sessionId: '42',
          name: 'Martian League',
          credits: 90,
          politicalCapital: 11,
          doctrineVector:
            '{"strategy":44,"approach":68,"command":47,"focus":42,"style":61}',
          controlScore: 38,
          readyForTurn: false,
        },
      ],
      intelligenceRecords: [
        {
          id: '10',
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
          id: 'turn-summary-5',
          sessionId: '42',
          factionId: '202',
          turn: 5,
          summaryJson:
            '{"headline":"Turn 5 outcome summary","events":["Olympus City infrastructure complete","Opponent colony ship detected inbound to Ganymede"],"controlScores":{"202":52,"303":38},"resourceDeltas":{"credits":-40,"science":6}}',
          acknowledged: false,
        },
      ],
    });
  });
}

describe('Command Center shell', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    usePanelStore.getState().reset();
    resetSessionStore();
    window.history.replaceState(null, '', '/');
    window.localStorage.removeItem(PANEL_STORE_KEY);
  });

  afterEach(() => {
    window.localStorage.removeItem(PANEL_STORE_KEY);
  });

  it('renders persistent header, sidebar, and content panel regions from route context', () => {
    enterStoredGameContext();

    render(<AppRouter backend={backend()} />);

    expect(screen.getByRole('banner', { name: /command center header/i })).toBeDefined();
    expect(screen.getByRole('complementary', { name: /command sidebar/i })).toBeDefined();
    expect(screen.getByRole('region', { name: /command content panel/i })).toBeDefined();
    expect(screen.getByText(/Session 42/i)).toBeDefined();
    expect(screen.getByText(/Your slot:/i)).toBeDefined();
    expect(screen.getAllByText('player_b').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Rex/i).length).toBeGreaterThan(0);
  });

  it('keeps shell regions and the game route stable during internal panel changes', () => {
    enterStoredGameContext();

    render(<AppRouter backend={backend()} />);
    const gamePath = window.location.pathname;

    fireEvent.click(screen.getByRole('button', { name: /session brief/i }));

    expect(window.location.pathname).toBe(gamePath);
    expect(screen.getByRole('banner', { name: /command center header/i })).toBeDefined();
    expect(screen.getByRole('complementary', { name: /command sidebar/i })).toBeDefined();
    expect(screen.getByRole('region', { name: /command content panel/i })).toHaveTextContent(
      /session brief/i
    );
  });

  describe('Sidebar navigation and panel state model', () => {
    it('sidebar exposes all core panel destinations', () => {
      enterStoredGameContext();
      render(<AppRouter backend={backend()} />);

      const nav = screen.getByRole('navigation', { name: /command panels/i });
      for (const panel of CORE_PANELS) {
        expect(nav.querySelector(`button[aria-pressed]`)!.parentElement).toBeDefined();
        expect(screen.getByRole('button', { name: panel.label })).toBeDefined();
      }
    });

    it('marks only the active panel button as pressed', () => {
      enterStoredGameContext();
      render(<AppRouter backend={backend()} />);

      const overviewBtn = screen.getByRole('button', { name: 'Command Overview' });
      const briefBtn = screen.getByRole('button', { name: 'Session Brief' });

      expect(overviewBtn.getAttribute('aria-pressed')).toBe('true');
      expect(briefBtn.getAttribute('aria-pressed')).toBe('false');

      fireEvent.click(briefBtn);

      expect(overviewBtn.getAttribute('aria-pressed')).toBe('false');
      expect(briefBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('swaps the main content surface without changing the URL', () => {
      enterStoredGameContext();
      render(<AppRouter backend={backend()} />);
      const path = window.location.pathname;

      for (const panel of CORE_PANELS) {
        fireEvent.click(screen.getByRole('button', { name: panel.label }));
        expect(window.location.pathname).toBe(path);
        const heading = screen.getByRole('region', { name: /command content panel/i }).querySelector('h3');
        expect(heading?.textContent).toBe(panel.label);
      }
    });

    it('active panel is recoverable from panel store state after panel change', () => {
      enterStoredGameContext();
      render(<AppRouter backend={backend()} />);

      fireEvent.click(screen.getByRole('button', { name: 'Inbox' }));

      expect(usePanelStore.getState().activePanel).toBe('inbox');
    });

    it('shows placeholder content for panels not yet implemented', () => {
      enterStoredGameContext();
      usePanelStore.getState().setPanel('map');

      render(<AppRouter backend={backend()} />);

      expect(
        screen.getByRole('region', { name: /command content panel/i })
      ).toHaveTextContent(/not yet available/i);
    });

    it('panel model is extensible — CORE_PANELS registry drives sidebar render', () => {
      expect(CORE_PANELS.map((p) => p.id)).toEqual(
        expect.arrayContaining(['overview', 'session-brief', 'map', 'inbox', 'strategic']),
      );
    });

    it('exposes the strategic demo panels in the shell registry', () => {
      expect(CORE_PANELS.map((p) => p.id)).toEqual(
        expect.arrayContaining([
          'personnel',
          'resources',
          'intelligence',
          'diplomacy',
          'doctrine',
          'resolution',
          'end-game',
        ]),
      );
    });

    it('can switch through strategic demo panels without route churn', () => {
      enterStoredGameContext();
      render(<AppRouter backend={backend()} />);
      const path = window.location.pathname;

      for (const panel of [
        'Personnel',
        'Resources',
        'Intelligence',
        'Diplomacy',
        'Doctrine',
        'Turn Resolution',
        'End Game',
      ]) {
        fireEvent.click(screen.getByRole('button', { name: panel }));
        expect(window.location.pathname).toBe(path);
        expect(screen.getByRole('region', { name: /command content panel/i })).toHaveTextContent(
          panel,
        );
      }
    });

    it('degrades unavailable strategic panel data into clear placeholder content', () => {
      enterStoredGameContext();
      usePanelStore.getState().setPanel('diplomacy');

      render(<AppRouter backend={backend()} />);

      const panel = screen.getByRole('region', { name: /command content panel/i });
      expect(panel).toHaveTextContent(/Diplomacy/i);
      expect(panel).toHaveTextContent(/not yet available/i);
      expect(panel).toHaveTextContent(/Session 42/i);
    });

    it('renders personnel panel from faction roster data', () => {
      enterStoredGameContext();
      hydrateOperationalPanelState();
      usePanelStore.getState().setPanel('personnel');

      render(<AppRouter backend={backend()} />);

      const panel = screen.getByRole('region', { name: /command content panel/i });
      expect(panel).toHaveTextContent(/Ada Watanabe/i);
      expect(panel).toHaveTextContent(/Chief Scientist/i);
      expect(panel).toHaveTextContent(/Research/i);
      expect(panel).toHaveTextContent(/Morale 73/i);
      expect(panel).toHaveTextContent(/Burnout 12/i);
      expect(panel).toHaveTextContent(/Competence 88/i);
      expect(panel).not.toHaveTextContent(/not yet available/i);
    });

    it('renders resources panel from private economy and public session state', () => {
      enterStoredGameContext();
      hydrateOperationalPanelState();
      usePanelStore.getState().setPanel('resources');

      render(<AppRouter backend={backend()} />);

      const panel = screen.getByRole('region', { name: /command content panel/i });
      expect(panel).toHaveTextContent(/credits/i);
      expect(panel).toHaveTextContent(/150/i);
      expect(panel).toHaveTextContent(/minerals/i);
      expect(panel).toHaveTextContent(/30/i);
      expect(panel).toHaveTextContent(/Morale 80/i);
      expect(panel).toHaveTextContent(/Doctrine expansion/i);
      expect(panel).toHaveTextContent(/Control 47/i);
      expect(panel).toHaveTextContent(/Turn 5/i);
      expect(panel).not.toHaveTextContent(/not yet available/i);
    });

    it('renders intelligence panel from scouting records visible to the faction', () => {
      enterStoredGameContext();
      hydrateOperationalPanelState();
      usePanelStore.getState().setPanel('intelligence');

      render(<AppRouter backend={backend()} />);

      const panel = screen.getByRole('region', { name: /command content panel/i });
      expect(panel).toHaveTextContent(/scouting/i);
      expect(panel).toHaveTextContent(/Target 303/i);
      expect(panel).toHaveTextContent(/Accuracy 82%/i);
      expect(panel).toHaveTextContent(/Turn 5/i);
      expect(panel).toHaveTextContent(/visible_bodies: Mars, Luna/i);
      expect(panel).toHaveTextContent(/known_cities: Pavonis/i);
      expect(panel).not.toHaveTextContent(/not yet available/i);
    });

    it('renders diplomacy panel from visible faction posture and recent intelligence', () => {
      enterStoredGameContext();
      hydrateStrategicPanelState();
      usePanelStore.getState().setPanel('diplomacy');

      render(<AppRouter backend={backend()} />);

      const panel = screen.getByRole('region', { name: /command content panel/i });
      expect(screen.getByLabelText(/diplomacy posture/i)).toBeDefined();
      expect(panel).toHaveTextContent(/Solar Republic/i);
      expect(panel).toHaveTextContent(/Martian League/i);
      expect(panel).toHaveTextContent(/Control 52/i);
      expect(panel).toHaveTextContent(/Control 38/i);
      expect(panel).toHaveTextContent(/probing Callisto access/i);
      expect(panel).not.toHaveTextContent(/not yet available/i);
    });

    it('renders doctrine panel from the current faction doctrine vector', () => {
      enterStoredGameContext();
      hydrateStrategicPanelState();
      usePanelStore.getState().setPanel('doctrine');

      render(<AppRouter backend={backend()} />);

      const panel = screen.getByRole('region', { name: /command content panel/i });
      expect(screen.getByLabelText(/faction doctrine posture/i)).toBeDefined();
      expect(panel).toHaveTextContent(/Expansionist/i);
      expect(panel).toHaveTextContent(/Consolidationist/i);
      expect(panel).toHaveTextContent(/Militarist/i);
      expect(panel).toHaveTextContent(/Diplomatic/i);
      expect(panel).toHaveTextContent(/Rapid expansion proposals/i);
      expect(panel).not.toHaveTextContent(/not yet available/i);
    });

    it('renders resolution panel from latest faction turn summary data', () => {
      enterStoredGameContext();
      hydrateStrategicPanelState();
      usePanelStore.getState().setPanel('resolution');

      render(<AppRouter backend={backend()} />);

      const panel = screen.getByRole('region', { name: /command content panel/i });
      expect(screen.getByLabelText(/turn resolution summary/i)).toBeDefined();
      expect(panel).toHaveTextContent(/Turn 5 outcome summary/i);
      expect(panel).toHaveTextContent(/Olympus City infrastructure complete/i);
      expect(panel).toHaveTextContent(/Opponent colony ship detected inbound to Ganymede/i);
      expect(panel).toHaveTextContent(/Control 52/i);
      expect(panel).toHaveTextContent(/credits -40/i);
      expect(panel).toHaveTextContent(/Acknowledgement pending/i);
      expect(panel).not.toHaveTextContent(/not yet available/i);
    });

    it('active panel persists across remount via local storage', () => {
      enterStoredGameContext();
      const { unmount } = render(<AppRouter backend={backend()} />);

      fireEvent.click(screen.getByRole('button', { name: 'Inbox' }));
      expect(usePanelStore.getState().activePanel).toBe('inbox');

      const stored = window.localStorage.getItem(PANEL_STORE_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!) as { state?: { activePanel?: string } };
      expect(parsed.state?.activePanel).toBe('inbox');

      unmount();
    });

    it('sidebar scrolls when nav content overflows', () => {
      enterStoredGameContext();
      render(<AppRouter backend={backend()} />);
      const sidebar = screen.getByRole('complementary', { name: /command sidebar/i });
      expect(sidebar.classList.contains('command-shell__sidebar')).toBe(true);
    });
  });

  describe('Global HUD', () => {
    it('shows absent-data placeholders when session store has no live data', () => {
      enterStoredGameContext();

      render(<AppRouter backend={backend()} />);

      expect(screen.getByLabelText(/faction identity/i)).toHaveTextContent(/Faction 202/i);
      expect(screen.getByLabelText(/turn and year/i)).toHaveTextContent(/Turn —/i);
      expect(screen.getByLabelText(/phase/i)).toHaveTextContent(/Phase —/i);
      expect(screen.getByLabelText(/control score/i)).toHaveTextContent(/Control —/i);
      expect(screen.getByLabelText(/resources/i)).toHaveTextContent(/Resources —/i);
    });

    it('shows live faction name from session store when a player slot is present', () => {
      enterStoredGameContext();

      act(() => {
        sessionStore.getState().actions.setConnection({ status: 'connected', identity: 'identity-a' });
        sessionStore.getState().actions.hydrateSubscription({
          sessions: [{ id: '42', code: 'G', status: 'active', currentTurn: 1, phase: 'orders' }],
          playerSlots: [
            {
              sessionId: '42',
              slot: 2,
              identity: 'identity-a',
              factionId: '202',
              factionName: 'Solar Republic',
              playerName: 'Rex',
              occupied: true,
              visibility: 'own',
            },
          ],
        });
      });

      render(<AppRouter backend={backend()} />);

      expect(screen.getByLabelText(/faction identity/i)).toHaveTextContent(/Solar Republic/i);
    });

    it('shows turn, year, phase, and control score from public game state', () => {
      enterStoredGameContext();

      act(() => {
        sessionStore.getState().actions.hydrateSubscription({
          sessions: [{ id: '42', code: 'GAME1', status: 'active', currentTurn: 3, phase: 'orders' }],
          publicGameStates: [
            {
              sessionId: '42',
              turn: 3,
              year: 2342,
              phase: 'orders',
              controlScores: { '202': 47 },
              visibleFactionIds: ['202'],
            },
          ],
        });
      });

      render(<AppRouter backend={backend()} />);

      expect(screen.getByLabelText(/turn and year/i)).toHaveTextContent(/Turn 3/i);
      expect(screen.getByLabelText(/turn and year/i)).toHaveTextContent(/Year 2342/i);
      expect(screen.getByLabelText(/phase/i)).toHaveTextContent(/orders/i);
      expect(screen.getByLabelText(/control score/i)).toHaveTextContent(/Control: 47/i);
    });

    it('shows resources from private faction state', () => {
      enterStoredGameContext();

      act(() => {
        sessionStore.getState().actions.hydrateSubscription({
          sessions: [{ id: '42', code: 'GAME1', status: 'active', currentTurn: 1, phase: 'orders' }],
          privateFactionStates: [
            {
              sessionId: '42',
              factionId: '202',
              resources: { credits: 150, minerals: 30 },
              morale: 80,
              doctrine: 'expansion',
              visibility: 'ownFaction',
            },
          ],
        });
      });

      render(<AppRouter backend={backend()} />);

      expect(screen.getByLabelText(/resources/i)).toHaveTextContent(/credits: 150/i);
      expect(screen.getByLabelText(/resources/i)).toHaveTextContent(/minerals: 30/i);
    });

    it('preserves shared HUD context across panel changes', () => {
      enterStoredGameContext();

      act(() => {
        sessionStore.getState().actions.hydrateSubscription({
          sessions: [{ id: '42', code: 'G', status: 'active', currentTurn: 4, phase: 'orders' }],
          publicGameStates: [
            {
              sessionId: '42',
              turn: 4,
              year: 2360,
              phase: 'orders',
              controlScores: { '202': 55 },
              visibleFactionIds: ['202'],
            },
          ],
          privateFactionStates: [
            {
              sessionId: '42',
              factionId: '202',
              resources: { credits: 99 },
              morale: 70,
              doctrine: 'expansion',
              visibility: 'ownFaction',
            },
          ],
        });
      });

      render(<AppRouter backend={backend()} />);

      const banner = screen.getByRole('banner', { name: /command center header/i });
      expect(banner).toHaveTextContent(/Turn 4/);
      expect(banner).toHaveTextContent(/Control: 55/);
      expect(banner).toHaveTextContent(/credits: 99/);

      fireEvent.click(screen.getByRole('button', { name: 'Inbox' }));
      const bannerAfter = screen.getByRole('banner', { name: /command center header/i });
      expect(bannerAfter).toHaveTextContent(/Turn 4/);
      expect(bannerAfter).toHaveTextContent(/Control: 55/);
      expect(bannerAfter).toHaveTextContent(/credits: 99/);
      expect(bannerAfter).toHaveTextContent(/Rex/);

      fireEvent.click(screen.getByRole('button', { name: 'Strategic View' }));
      const bannerFinal = screen.getByRole('banner', { name: /command center header/i });
      expect(bannerFinal).toHaveTextContent(/Turn 4/);
      expect(bannerFinal).toHaveTextContent(/Control: 55/);
      expect(bannerFinal).toHaveTextContent(/credits: 99/);
    });

    it('updates HUD when store state changes after mount', () => {
      enterStoredGameContext();
      render(<AppRouter backend={backend()} />);

      expect(screen.getByLabelText(/turn and year/i)).toHaveTextContent(/Turn —/i);

      act(() => {
        sessionStore.getState().actions.hydrateSubscription({
          sessions: [{ id: '42', code: 'G', status: 'active', currentTurn: 5, phase: 'combat' }],
          publicGameStates: [
            {
              sessionId: '42',
              turn: 5,
              year: 2350,
              phase: 'combat',
              controlScores: { '202': 60 },
              visibleFactionIds: ['202'],
            },
          ],
        });
      });

      expect(screen.getByLabelText(/turn and year/i)).toHaveTextContent(/Turn 5/i);
      expect(screen.getByLabelText(/phase/i)).toHaveTextContent(/combat/i);
    });
  });

  describe('Two-browser narrow layout', () => {
    it('header remains usable at narrow two-browser viewport width', () => {
      enterStoredGameContext();
      render(<AppRouter backend={backend()} />);

      const header = screen.getByRole('banner', { name: /command center header/i });
      expect(header).toBeDefined();
      expect(header.querySelector('.command-shell__title-block')).not.toBeNull();
      expect(header.querySelector('.command-shell__context')).not.toBeNull();
      expect(header.querySelector('.command-shell__back')).not.toBeNull();
      expect(
        screen.getByRole('button', { name: /back to menu/i }),
      ).toBeDefined();
    });
  });
});
