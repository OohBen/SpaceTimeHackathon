import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App, { ConnectionStatusPanel } from './App.tsx';
import type { SessionBackend } from './session/spacetime';

function backend(): SessionBackend {
  return {
    isConnected: true,
    identity: null,
    sessions: [],
    factions: [],
    getSessionChoices: () => [],
    getSlotChoices: () => [],
    joinOrResume: vi.fn(),
    createAndJoin: vi.fn(),
  };
}

describe('App scaffold', () => {
  it('renders Solar Dominion heading', () => {
    render(<App backend={backend()} />);
    expect(screen.getByRole('heading', { name: /solar dominion/i })).toBeDefined();
  });

  it('renders connection lifecycle states and local backend diagnostics', () => {
    render(
      <ConnectionStatusPanel
        connection={{
          status: 'failed',
          identity: null,
          error: 'connection refused',
          diagnostics: {
            host: 'ws://localhost:3000',
            dbName: 'solar-dominion',
            issues: ['SpacetimeDB is unreachable at ws://localhost:3000.'],
          },
        }}
        onReconnect={() => undefined}
      />,
    );

    expect(screen.getByText(/connection failed/i)).toBeDefined();
    expect(screen.getAllByText(/ws:\/\/localhost:3000/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/solar-dominion/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /reconnect/i })).toBeDefined();
  });

  it('renders loading, connected, and reconnecting lifecycle labels', () => {
    const states = ['loading', 'connected', 'reconnecting'] as const;

    for (const status of states) {
      const { unmount } = render(
        <ConnectionStatusPanel
          connection={{
            status,
            identity: null,
            error: null,
            diagnostics: {
              host: 'ws://localhost:3000',
              dbName: 'solar-dominion',
              issues: [],
            },
          }}
          onReconnect={() => undefined}
        />,
      );

      expect(screen.getByText(new RegExp(`connection ${status}`, 'i'))).toBeDefined();
      unmount();
    }
  });
});
