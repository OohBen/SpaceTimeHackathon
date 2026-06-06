import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from './AppRouter';
import { Setup } from './Setup';
import type { SessionBackend } from '../session/spacetime';
import { useSessionStore } from '../session/store';

function backend(overrides: Partial<SessionBackend> = {}): SessionBackend {
  return {
    isConnected: true,
    identity: 'aaaaaaaa',
    sessions: [],
    factions: [],
    getSessionChoices: () => [{ id: 7, label: 'Session #7 - setup', state: 'setup' }],
    getSlotChoices: () => [
      {
        key: 'player_a',
        label: 'P1',
        factionName: 'United Earth',
        status: 'occupied',
        recovery: 'Use the browser that claimed P1 or choose P2.',
      },
      {
        key: 'player_b',
        label: 'P2',
        factionName: 'Mars Compact',
        status: 'available',
        recovery: 'Join this open slot.',
      },
    ],
    joinOrResume: vi.fn(async () => ({
      sessionId: 7,
      factionId: 102,
      playerSlot: 'player_b' as const,
      playerName: 'Rex',
      isResume: false,
    })),
    createAndJoin: vi.fn(),
    ...overrides,
  };
}

describe('player slot flow', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    localStorage.clear();
    useSessionStore.getState().reset();
  });

  it('renders available and occupied slot states for the selected session', () => {
    render(
      <Setup
        mode="resume"
        backend={backend()}
        onBack={() => {}}
        onSubmit={() => Promise.resolve()}
      />
    );

    expect(screen.getByRole('button', { name: /p1 united earth occupied/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /p2 mars compact available/i })).toBeEnabled();
    expect(screen.getByText(/use the browser that claimed p1/i)).toBeDefined();
  });

  it('routes a successful create into the game context', async () => {
    const fakeBackend = backend({
      createAndJoin: vi.fn(async () => ({
        sessionId: 11,
        factionId: 101,
        playerSlot: 'player_a' as const,
        playerName: 'Atlas',
        isResume: false,
      })),
    });
    render(<AppRouter backend={fakeBackend} />);

    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /player name/i }), {
      target: { value: 'Atlas' },
    });
    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    await waitFor(() => expect(window.location.pathname).toBe('/game/11/player_a'));
    expect(screen.getByRole('heading', { name: /command center/i })).toBeDefined();
    expect(screen.getByText(/session 11/i)).toBeDefined();
    expect(screen.getByText(/player_a/i)).toBeDefined();
  });

  it('submits the requested slot through the backend join flow', async () => {
    const fakeBackend = backend();
    render(<AppRouter backend={fakeBackend} />);

    fireEvent.click(screen.getByRole('button', { name: /resume/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /player name/i }), {
      target: { value: 'Rex' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: /session id/i }), {
      target: { value: '7' },
    });
    fireEvent.click(screen.getByRole('button', { name: /p2 mars compact available/i }));
    fireEvent.click(screen.getByRole('button', { name: /join slot/i }));

    await waitFor(() =>
      expect(fakeBackend.joinOrResume).toHaveBeenCalledWith({
        playerName: 'Rex',
        mode: 'resume',
        sessionId: 7,
        playerSlot: 'player_b',
      })
    );
    await waitFor(() => expect(window.location.pathname).toBe('/game/7/player_b'));
    expect(await screen.findByText(/your slot:/i)).toBeDefined();
    expect(screen.getByText('player_b')).toBeDefined();
  });

  it('renders a matching direct game route as a resumed context', () => {
    useSessionStore.getState().setReady({
      sessionId: 7,
      factionId: 102,
      playerSlot: 'player_b',
      playerName: 'Rex',
    });
    window.history.replaceState(null, '', '/game/7/player_b');

    render(<AppRouter backend={backend()} />);

    expect(screen.getByRole('heading', { name: /command center/i })).toBeDefined();
    expect(screen.getByText(/session 7/i)).toBeDefined();
    expect(screen.getByText(/player_b/i)).toBeDefined();
  });

  it('blocks a direct game route when stored session context mismatches the path', () => {
    useSessionStore.getState().setReady({
      sessionId: 7,
      factionId: 101,
      playerSlot: 'player_a',
      playerName: 'Atlas',
    });
    window.history.replaceState(null, '', '/game/7/player_b');

    render(<AppRouter backend={backend()} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/route.*does not match.*session/i);
    expect(screen.queryByRole('heading', { name: /command center/i })).toBeNull();
  });

  it('shows actionable invalid-session recovery text', async () => {
    const fakeBackend = backend({
      joinOrResume: vi.fn(async () => {
        throw new Error('session 404 not found');
      }),
    });
    render(<AppRouter backend={fakeBackend} />);

    fireEvent.click(screen.getByRole('button', { name: /resume/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /player name/i }), {
      target: { value: 'Rex' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: /session id/i }), {
      target: { value: '404' },
    });
    fireEvent.click(screen.getByRole('button', { name: /p2 mars compact available/i }));
    fireEvent.click(screen.getByRole('button', { name: /join slot/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /session 404 not found.*check the session id/i
    );
  });
});
