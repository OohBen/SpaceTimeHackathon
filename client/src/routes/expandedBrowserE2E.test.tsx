import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from './AppRouter';
import { usePanelStore } from './panels';
import type { SessionBackend } from '../session/spacetime';
import { useSessionStore } from '../session/store';
import type { SpacetimeClient } from '../spacetime/client';
import type { ReducerCallDescriptor } from '../spacetime/reducers';
import { resetSessionStoreData, sessionStore } from '../state/session-store';

function fakeClient(calls: ReducerCallDescriptor[]): SpacetimeClient {
  const handle = { disconnect: vi.fn() };

  return {
    connect: vi.fn(() => handle),
    reconnect: vi.fn(() => handle),
    disconnect: vi.fn(),
    subscribe: vi.fn(),
    callReducer: vi.fn((call) => {
      calls.push(call);
    }),
    diagnostics: () => ({
      host: 'ws://localhost:3000',
      dbName: 'solar-dominion',
      issues: [],
    }),
  };
}

function backend(client: SpacetimeClient): SessionBackend {
  return {
    isConnected: true,
    identity: 'demo-browser-b',
    sessions: [],
    factions: [],
    client,
    getSessionChoices: () => [],
    getSlotChoices: () => [],
    joinOrResume: vi.fn(),
    createAndJoin: vi.fn(),
  };
}

async function launchBrowserB(client: SpacetimeClient) {
  render(<AppRouter backend={backend(client)} />);

  fireEvent.click(screen.getByRole('button', { name: /local demo/i }));
  fireEvent.change(screen.getByRole('textbox', { name: /player name/i }), {
    target: { value: 'Browser B Commander' },
  });
  fireEvent.click(screen.getByRole('button', { name: /browser b p2 martian league/i }));
  fireEvent.click(screen.getByRole('button', { name: /start/i }));

  await waitFor(() => expect(window.location.pathname).toBe('/game/9001/player_b'));
  fireEvent.click(screen.getByRole('button', { name: 'Inbox' }));
  fireEvent.click(screen.getByTestId('inbox-item-9801'));
}

function markMarsProposalApproved() {
  const proposal = sessionStore.getState().proposalsById['9801'];
  expect(proposal).toBeDefined();

  act(() => {
    sessionStore.getState().actions.hydrateSubscription({
      proposals: [
        {
          ...proposal!,
          status: 'approved',
          decision: '{"decision":"approved","allocation":35}',
        },
      ],
    });
    sessionStore.getState().actions.completeReducerCall('commanderDecision:9801');
  });
}

function markMarsProposalAutoDeferred() {
  const proposal = sessionStore.getState().proposalsById['9801'];
  expect(proposal).toBeDefined();

  act(() => {
    sessionStore.getState().actions.hydrateSubscription({
      proposals: [
        {
          ...proposal!,
          status: 'auto_deferred',
          decision: '{"decision":"deferred","allocation":0,"reason":"timeout"}',
        },
      ],
    });
    sessionStore.getState().actions.completeReducerCall('expireTurn:9001');
  });
}

describe('expanded browser E2E coverage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    localStorage.clear();
    useSessionStore.getState().reset();
    usePanelStore.getState().reset();
    resetSessionStoreData();
  });

  it('mock mode drives Browser B through a non-judge proposal decision and turn submit', async () => {
    const calls: ReducerCallDescriptor[] = [];
    await launchBrowserB(fakeClient(calls));

    expect(screen.getByTestId('commander-inbox')).toHaveTextContent(/mars dust lane interdiction/i);
    expect(screen.getByTestId('commander-inbox')).not.toHaveTextContent(
      /solar orbital yard expansion/i,
    );
    expect(screen.getByTestId('turn-submit-readiness')).toHaveTextContent(
      /not ready: 1 decision pending/i,
    );

    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    expect(calls[0]).toMatchObject({
      reducer: 'commander_decision',
      args: {
        factionId: 303,
        proposalId: 9801,
        decision: 'approved',
        allocation: 35,
      },
    });

    markMarsProposalApproved();

    expect(screen.getByTestId('turn-submit-readiness')).toHaveTextContent(
      /ready to submit: all required decisions recorded/i,
    );

    fireEvent.click(screen.getByRole('button', { name: /submit turn/i }));

    expect(calls[1]).toMatchObject({
      reducer: 'submit_turn',
      args: { factionId: 303 },
    });
  });

  it('mock mode processes timeout and syncs the auto-deferred safe outcome', async () => {
    const calls: ReducerCallDescriptor[] = [];
    await launchBrowserB(fakeClient(calls));

    fireEvent.click(screen.getByRole('button', { name: /process timeout/i }));

    expect(calls[0]).toMatchObject({
      reducer: 'expire_turn',
      args: { sessionId: 9001 },
    });

    markMarsProposalAutoDeferred();

    expect(screen.getByTestId('turn-timeout-status')).toHaveTextContent(
      /timeout processed; unresolved proposals auto-deferred/i,
    );
    expect(screen.getByText(/auto-deferred by timeout/i)).toBeDefined();
  });

  it('fixture mode recovers a direct Browser B route after stale Browser A context', async () => {
    const calls: ReducerCallDescriptor[] = [];
    useSessionStore.getState().setReady({
      sessionId: 9001,
      factionId: 202,
      playerSlot: 'player_a',
      playerName: 'Stale Browser A',
    });
    window.history.replaceState(null, '', '/game/9001/player_b');

    render(<AppRouter backend={backend(fakeClient(calls))} />);

    await waitFor(() =>
      expect(useSessionStore.getState().playerSlot).toBe('player_b'),
    );

    expect(screen.getByRole('heading', { name: /command center/i })).toBeDefined();
    expect(screen.getByLabelText(/faction identity/i)).toHaveTextContent('Martian League');
    expect(Object.values(sessionStore.getState().privateFactionStateByKey).map((row) => row.factionId))
      .toEqual(['303']);

    fireEvent.click(screen.getByRole('button', { name: 'Inbox' }));

    expect(screen.getByTestId('commander-inbox')).toHaveTextContent(/mars dust lane interdiction/i);
    expect(screen.getByTestId('commander-inbox')).not.toHaveTextContent(
      /solar orbital yard expansion/i,
    );
  });
});
