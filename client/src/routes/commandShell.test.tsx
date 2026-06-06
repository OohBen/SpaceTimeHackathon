import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from './AppRouter';
import type { SessionBackend } from '../session/spacetime';
import { useSessionStore } from '../session/store';

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

describe('Command Center shell', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
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
});
