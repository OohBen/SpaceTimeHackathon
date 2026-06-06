import { fireEvent, render, screen, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from './AppRouter';
import type { SessionBackend } from '../session/spacetime';
import { useSessionStore } from '../session/store';
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
    reducerCalls: {},
  });
}

describe('Command Center shell', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    resetSessionStore();
    window.history.replaceState(null, '', '/');
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
});
