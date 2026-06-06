import { fireEvent, render, screen, act, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRouter } from './AppRouter';
import { usePanelStore, PANEL_STORE_KEY } from './panels';
import type { SessionBackend } from '../session/spacetime';
import { useSessionStore } from '../session/store';
import { sessionStore } from '../state/session-store';

function backend(): SessionBackend {
  return {
    isConnected: true,
    identity: 'identity-b',
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
    factionId: 303,
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
    factionsById: {},
    personnelById: {},
    intelligenceRecordsById: {},
    eventsById: {},
    turnSummariesById: {},
    llmRequestsById: {},
    reducerCalls: {},
  });
}

function hydrateTurn8JudgeScenario() {
  act(() => {
    sessionStore.getState().actions.setConnection({
      status: 'connected',
      identity: 'identity-b',
    });
    sessionStore.getState().actions.hydrateSubscription({
      sessions: [{ id: '42', code: 'JUDGE-8', status: 'active', currentTurn: 8, phase: 'deliberation' }],
      playerSlots: [
        {
          sessionId: '42',
          slot: 2,
          identity: 'identity-b',
          factionId: '303',
          factionName: 'Mars Compact',
          playerName: 'Rex',
          occupied: true,
          visibility: 'own',
        },
      ],
      publicGameStates: [
        {
          sessionId: '42',
          turn: 8,
          year: 2157,
          phase: 'deliberation',
          controlScores: { '202': 140, '303': 118 },
          visibleFactionIds: ['202', '303'],
        },
      ],
      privateFactionStates: [
        {
          sessionId: '42',
          factionId: '303',
          resources: { credits: 1950, politicalCapital: 61 },
          morale: 55,
          doctrine: 'security',
          visibility: 'ownFaction',
        },
      ],
      publicFactions: [
        {
          id: 202,
          sessionId: 42,
          name: 'United Earth Authority',
          controlScore: 140,
          readyForTurn: false,
          visibility: 'public',
        },
        {
          id: 303,
          sessionId: 42,
          name: 'Mars Congressional Compact',
          controlScore: 118,
          readyForTurn: false,
          visibility: 'public',
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
          resourceDeposits: '{"water":44}',
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
          resourceDeposits: '{"metals":72,"regolith":88,"water":58}',
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
          resourceDeposits: '{"ice":88,"subsurface_metals":55,"volatiles":74}',
          position: '{"x":8,"y":4}',
          visibility: 'public',
        },
      ],
      publicCities: [
        {
          id: 1001,
          sessionId: 42,
          bodyId: 10,
          factionId: 202,
          name: 'New Geneva',
          developmentStage: 'capital',
          visibility: 'public',
        },
        {
          id: 2001,
          sessionId: 42,
          bodyId: 20,
          factionId: 303,
          name: 'Pavonis Hub',
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
          factionId: 303,
          postingCityId: 2001,
          strength: 580,
          visibility: 'public',
        },
        {
          id: 7002,
          factionId: 202,
          postingCityId: 3001,
          strength: 35,
          visibility: 'public',
        },
      ],
      publicEvents: [
        {
          id: 9001,
          sessionId: 42,
          turn: 8,
          eventType: 'scenario_cue_mars_pressure',
          visibility: 'public',
        },
        {
          id: 9002,
          sessionId: 42,
          turn: 8,
          eventType: 'scenario_cue_callisto_opportunity',
          visibility: 'public',
        },
      ],
      proposals: [
        {
          id: 'p3',
          sessionId: '42',
          factionId: '303',
          turn: 8,
          proposingPersonnelId: '6',
          department: 'Defense',
          title: 'Pavonis pressure and Callisto push',
          body: 'Pavonis Hub is under supply pressure, but a guarded Callisto push could contest the outer-system resource window before Earth consolidates it.',
          resourceCost: 160,
          confidence: 'HIGH',
          status: 'pending',
          decision: null,
        },
        {
          id: 'p4',
          sessionId: '42',
          factionId: '303',
          turn: 8,
          proposingPersonnelId: '5',
          department: 'Research',
          title: 'Counter-colonization analysis',
          body: 'Fund analysis on rival Callisto expansion; prepare diplomatic countermeasures or matched colonization plan.',
          resourceCost: 110,
          confidence: 'MEDIUM',
          status: 'pending',
          decision: null,
        },
      ],
      llmRequests: [
        {
          id: 'llm-139',
          sessionId: '42',
          factionId: '303',
          requestType: 'proposals',
          status: 'completed',
          responseJson: '{"source":"deterministic_fixture"}',
          error: null,
          errorCode: null,
          attemptCount: 0,
          createdTurn: 8,
          updatedTurn: 8,
        },
      ],
    });
  });
}

describe('issue 139 Turn 8 judge scenario UI smoke', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    usePanelStore.getState().reset();
    resetSessionStore();
    enterStoredGameContext();
    hydrateTurn8JudgeScenario();
    window.localStorage.removeItem(PANEL_STORE_KEY);
  });

  afterEach(() => {
    window.localStorage.removeItem(PANEL_STORE_KEY);
  });

  it('shows Mars pressure and Callisto opportunity on the map immediately', () => {
    usePanelStore.getState().setPanel('map');

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

  it('shows Turn 8 judge-story proposals in the command inbox', () => {
    usePanelStore.getState().setPanel('inbox');

    render(<AppRouter backend={backend()} />);

    expect(screen.getByTestId('turn-readiness')).toHaveTextContent(/Turn 8/i);
    expect(screen.getByTestId('commander-inbox')).toHaveTextContent(
      /Pavonis pressure and Callisto push/i,
    );
    expect(screen.getByTestId('commander-inbox')).toHaveTextContent(
      /Counter-colonization analysis/i,
    );

    fireEvent.click(screen.getByTestId('inbox-item-p3'));

    const reader = screen.getByTestId('proposal-reader-p3');
    expect(reader).toHaveTextContent(/Pavonis Hub is under supply pressure/i);
    expect(reader).toHaveTextContent(/guarded Callisto push/i);
    expect(reader).toHaveTextContent(/outer-system resource window/i);
  });
});
