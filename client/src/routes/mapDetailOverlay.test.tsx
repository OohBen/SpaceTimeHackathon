import { fireEvent, render, screen, act, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from './AppRouter';
import type { SessionBackend } from '../session/spacetime';
import { useSessionStore } from '../session/store';
import { usePanelStore, PANEL_STORE_KEY } from './panels';
import { sessionStore } from '../state/session-store';

function backend(): SessionBackend {
  return {
    isConnected: true,
    identity: 'identity-a',
    sessions: [],
    factions: [],
    client: null,
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
        {
          id: 3001,
          sessionId: 42,
          bodyId: 30,
          factionId: 202,
          name: 'Callisto Outpost',
          developmentStage: 'establishment',
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
        {
          id: 9002,
          sessionId: 42,
          turn: 8,
          eventType: 'scenario_cue_mars_pressure',
          visibility: 'public',
        },
        {
          id: 9003,
          sessionId: 42,
          turn: 8,
          eventType: 'scenario_cue_callisto_opportunity',
          visibility: 'public',
        },
      ],
    });
  });
}

describe('Map detail overlay (P2E4T3/T4)', () => {
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

  it('opens a contextual detail overlay when a body marker is selected', () => {
    enterStoredGameContext();
    usePanelStore.getState().setPanel('map');
    hydrateSeededWorldMap();

    render(<AppRouter backend={backend()} />);

    expect(screen.queryByRole('dialog', { name: /selected body detail/i })).toBeNull();

    const mars = screen.getByRole('button', { name: /open detail for mars/i });
    fireEvent.click(mars);

    const detail = screen.getByRole('dialog', { name: /selected body detail/i });
    expect(within(detail).getByRole('heading', { name: /^Mars$/i })).toBeDefined();
    expect(within(detail).getAllByText(/Contested/i).length).toBeGreaterThan(0);
  });

  it('surfaces control, resource, and status stats for the selected body', () => {
    enterStoredGameContext();
    usePanelStore.getState().setPanel('map');
    hydrateSeededWorldMap();

    render(<AppRouter backend={backend()} />);

    fireEvent.click(screen.getByRole('button', { name: /open detail for mars/i }));
    const detail = screen.getByRole('dialog', { name: /selected body detail/i });

    expect(within(detail).getAllByText(/Earth Directorate/i).length).toBeGreaterThan(0);
    expect(within(detail).getAllByText(/Mars Compact/i).length).toBeGreaterThan(0);
    expect(within(detail).getByText(/Ares Shipyards/i)).toBeDefined();
    expect(within(detail).getByText(/Valles Holdfast/i)).toBeDefined();
    expect(within(detail).getByText(/strength 24/)).toBeDefined();
    expect(within(detail).getByText(/strength 19/)).toBeDefined();
    expect(within(detail).getByText(/metals/i)).toBeDefined();
    expect(within(detail).getByText(/Arrives T9/i)).toBeDefined();
  });

  it('opens a contextual detail overlay when a city marker is selected', () => {
    enterStoredGameContext();
    usePanelStore.getState().setPanel('map');
    hydrateSeededWorldMap();

    render(<AppRouter backend={backend()} />);

    const ares = screen.getByRole('button', { name: /open detail for ares shipyards/i });
    fireEvent.click(ares);

    const detail = screen.getByRole('dialog', { name: /selected city detail/i });
    expect(within(detail).getByRole('heading', { name: /^Ares Shipyards$/i })).toBeDefined();
    expect(within(detail).getAllByText(/Earth Directorate/i).length).toBeGreaterThan(0);
    expect(within(detail).getAllByText(/industrial/i).length).toBeGreaterThan(0);
    expect(within(detail).getByRole('button', { name: /^Mars$/i })).toBeDefined();
  });

  it('dismisses the overlay without losing the routed game shell', () => {
    enterStoredGameContext();
    usePanelStore.getState().setPanel('map');
    hydrateSeededWorldMap();

    render(<AppRouter backend={backend()} />);
    const path = window.location.pathname;

    fireEvent.click(screen.getByRole('button', { name: /open detail for mars/i }));
    expect(screen.getByRole('dialog', { name: /selected body detail/i })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /close detail/i }));

    expect(screen.queryByRole('dialog', { name: /selected body detail/i })).toBeNull();
    expect(window.location.pathname).toBe(path);
    expect(screen.getByRole('banner', { name: /command center header/i })).toBeDefined();
    expect(screen.getByRole('region', { name: /command content panel/i })).toBeDefined();
  });

  it('updates overlay content when underlying session state changes', () => {
    enterStoredGameContext();
    usePanelStore.getState().setPanel('map');
    hydrateSeededWorldMap();

    render(<AppRouter backend={backend()} />);

    fireEvent.click(screen.getByRole('button', { name: /open detail for mars/i }));
    expect(
      within(screen.getByRole('dialog', { name: /selected body detail/i })).getByText(/strength 24/),
    ).toBeDefined();

    act(() => {
      sessionStore.getState().actions.hydrateSubscription({
        publicFleets: [
          {
            id: 7001,
            factionId: 202,
            postingCityId: 2001,
            strength: 99,
            visibility: 'public',
          },
        ],
      });
    });

    expect(
      within(screen.getByRole('dialog', { name: /selected body detail/i })).getByText(/strength 99/),
    ).toBeDefined();
  });

  it('highlights alerts and contested cues with explicit status messaging', () => {
    enterStoredGameContext();
    usePanelStore.getState().setPanel('map');
    hydrateSeededWorldMap();

    render(<AppRouter backend={backend()} />);

    const alertBoard = screen.getByRole('complementary', { name: /map alerts/i });
    expect(within(alertBoard).getAllByText(/Mars contested/i).length).toBeGreaterThan(0);
    expect(within(alertBoard).getByText(/Mars arrival imminent/i)).toBeDefined();
  });

  it('surfaces Turn 8 Mars pressure and Callisto opportunity cues in map and city detail', () => {
    enterStoredGameContext();
    usePanelStore.getState().setPanel('map');
    hydrateSeededWorldMap();

    render(<AppRouter backend={backend()} />);

    const alertBoard = screen.getByRole('complementary', { name: /map alerts/i });
    expect(
      within(alertBoard).getByText(/Mars pressure: Pavonis Hub strained supply/i),
    ).toBeDefined();
    expect(
      within(alertBoard).getByText(/Callisto opportunity: ice and volatiles window/i),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /open detail for callisto outpost/i }));

    const detail = screen.getByRole('dialog', { name: /selected city detail/i });
    expect(within(detail).getByRole('heading', { name: /^Callisto Outpost$/i })).toBeDefined();
    expect(
      within(detail).getByText(/Callisto opportunity: ice and volatiles window/i),
    ).toBeDefined();
  });

  it('keeps map markers legible by exposing accessible labels with control summaries', () => {
    enterStoredGameContext();
    usePanelStore.getState().setPanel('map');
    hydrateSeededWorldMap();

    render(<AppRouter backend={backend()} />);

    expect(screen.getByRole('button', { name: /open detail for earth.*controlled by earth directorate/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /open detail for mars.*contested/i })).toBeDefined();
  });
});
