import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from './AppRouter';
import type { SessionBackend } from '../session/spacetime';
import { useSessionStore } from '../session/store';
import { usePanelStore, CORE_PANELS } from './panels';

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
    usePanelStore.getState().reset();
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
  });
});
