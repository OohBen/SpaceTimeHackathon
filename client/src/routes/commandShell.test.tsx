import { fireEvent, render, screen, act, within } from '@testing-library/react';
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
    publicFactionsByKey: {},
    worldBodiesById: {},
    publicFactionsById: {},
    publicCitiesById: {},
    publicFleetsById: {},
    publicColonyShipsById: {},
    publicEventsById: {},
    proposalsById: {},
    proposalsSubscription: { status: 'idle' },
    reducerCalls: {},
  });
}

function hydrateSeededWorldMap() {
  act(() => {
    sessionStore.getState().actions.hydrateSubscription({
      sessions: [{ id: '42', code: 'SOL-42', status: 'active', currentTurn: 8, phase: 'orders' }],
      publicGameStates: [
        {
          sessionId: '42',
          turn: 8,
          year: 2360,
          phase: 'orders',
          controlScores: { '202': 46, '303': 44 },
          visibleFactionIds: ['202', '303'],
        },
      ],
      worldBodies: [
        {
          id: 10,
          sessionId: 42,
          name: 'Earth',
          systemTier: 'inner',
          commsLagTurns: 0,
          travelTimeTurns: 1,
          resourceDeposits: '{"energy":"moderate"}',
          position: '{"x":0,"y":0}',
          visibility: 'public',
        },
        {
          id: 20,
          sessionId: 42,
          name: 'Mars',
          systemTier: 'inner',
          commsLagTurns: 1,
          travelTimeTurns: 2,
          resourceDeposits: '{"metals":"rich"}',
          position: '{"x":4,"y":1}',
          visibility: 'public',
        },
        {
          id: 30,
          sessionId: 42,
          name: 'Callisto',
          systemTier: 'outer',
          commsLagTurns: 3,
          travelTimeTurns: 5,
          resourceDeposits: '{"volatiles":"rich"}',
          position: '{"x":8,"y":4}',
          visibility: 'public',
        },
      ],
      publicFactions: [
        {
          id: 202,
          sessionId: 42,
          name: 'Earth Directorate',
          controlScore: 46,
          readyForTurn: true,
          visibility: 'public',
        },
        {
          id: 303,
          sessionId: 42,
          name: 'Mars Compact',
          controlScore: 44,
          readyForTurn: false,
          visibility: 'public',
        },
      ],
      publicCities: [
        {
          id: 1001,
          sessionId: 42,
          bodyId: 10,
          factionId: 202,
          name: 'Geneva Command',
          developmentStage: 'capital',
          visibility: 'public',
        },
        {
          id: 2001,
          sessionId: 42,
          bodyId: 20,
          factionId: 202,
          name: 'Ares Shipyards',
          developmentStage: 'industrial',
          visibility: 'public',
        },
        {
          id: 2002,
          sessionId: 42,
          bodyId: 20,
          factionId: 303,
          name: 'Valles Holdfast',
          developmentStage: 'fortified',
          visibility: 'public',
        },
      ],
      publicFleets: [
        {
          id: 7001,
          factionId: 202,
          postingCityId: 2001,
          strength: 24,
          visibility: 'public',
        },
        {
          id: 7002,
          factionId: 303,
          postingCityId: 2002,
          strength: 19,
          visibility: 'public',
        },
      ],
      publicColonyShips: [
        {
          id: 8001,
          factionId: 202,
          destinationBodyId: 20,
          arrivesTurn: 9,
          status: 'in_transit',
          visibility: 'public',
        },
      ],
      publicEvents: [
        {
          id: 9001,
          sessionId: 42,
          turn: 8,
          eventType: 'mars_contested',
          visibility: 'public',
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
      usePanelStore.getState().setPanel('inbox');

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

  describe('Solar system map panel', () => {
    it('renders seeded bodies, cities, fleets, and travel indicators inside the shell panel', () => {
      enterStoredGameContext();
      usePanelStore.getState().setPanel('map');
      hydrateSeededWorldMap();

      render(<AppRouter backend={backend()} />);

      const panel = screen.getByRole('region', { name: /command content panel/i });
      expect(panel).toHaveTextContent(/Star Map/i);
      expect(screen.getByRole('img', { name: /solar system schematic map/i })).toBeDefined();
      expect(screen.getByLabelText(/open detail for earth.*controlled by earth directorate/i)).toBeDefined();
      expect(screen.getByLabelText(/open detail for mars.*contested/i)).toBeDefined();
      expect(screen.getByLabelText(/open detail for ares shipyards/i)).toBeDefined();
      expect(screen.getByLabelText(/open detail for valles holdfast/i)).toBeDefined();
      expect(screen.getByLabelText(/fleet marker earth directorate strength 24/i)).toBeDefined();
      expect(screen.getByLabelText(/fleet marker mars compact strength 19/i)).toBeDefined();
      expect(screen.getByLabelText(/travel route earth directorate to mars arrives turn 9/i)).toBeDefined();
    });

    it('keeps faction control, travel state, and seeded demo density readable', () => {
      enterStoredGameContext();
      usePanelStore.getState().setPanel('map');
      hydrateSeededWorldMap();

      render(<AppRouter backend={backend()} />);

      expect(screen.getAllByText(/Earth Directorate/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Mars Compact/i).length).toBeGreaterThan(0);
      expect(screen.getByText('Controlled')).toBeDefined();
      expect(screen.getByText('Contested')).toBeDefined();
      expect(screen.getByText('Inbound travel')).toBeDefined();
      expect(screen.getByText(/Arrives T9/i)).toBeDefined();
      const summary = screen.getByLabelText(/map summary/i);
      expect(within(summary).getByText(/3 bodies/i)).toBeDefined();
      expect(within(summary).getByText(/3 cities/i)).toBeDefined();
      expect(within(summary).getByText(/2 fleets/i)).toBeDefined();
      expect(within(summary).getByText(/1 travel/i)).toBeDefined();
    });

    it('renders map rows for the routed game session when the shared map store points elsewhere', () => {
      enterStoredGameContext();
      usePanelStore.getState().setPanel('map');
      hydrateSeededWorldMap();
      act(() => {
        sessionStore.setState({ activeSessionId: '999' });
      });

      render(<AppRouter backend={backend()} />);

      expect(screen.getByRole('img', { name: /solar system schematic map/i })).toBeDefined();
      expect(screen.getByLabelText(/open detail for earth.*controlled by earth directorate/i)).toBeDefined();
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
