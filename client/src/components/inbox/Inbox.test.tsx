import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Inbox } from './Inbox';
import {
  createSessionStore,
  type ProposalRow,
  type SessionStore,
} from '../../state/session-store';

function seedStore(): SessionStore {
  const store = createSessionStore();
  store.getState().actions.setConnection({
    status: 'connected',
    identity: 'identity-player-1',
  });
  store.getState().actions.hydrateSubscription({
    sessions: [
      {
        id: 'session-1',
        code: 'SOL-001',
        status: 'active',
        currentTurn: 4,
        phase: 'planning',
      },
    ],
    playerSlots: [
      {
        sessionId: 'session-1',
        slot: 1,
        identity: 'identity-player-1',
        factionId: 'earth',
        factionName: 'Earth Directorate',
        playerName: 'Atlas',
        occupied: true,
        visibility: 'own',
      },
    ],
  });
  return store;
}

function makeProposal(overrides: Partial<ProposalRow> = {}): ProposalRow {
  return {
    id: 'prop-1',
    sessionId: 'session-1',
    factionId: 'earth',
    turn: 4,
    proposingPersonnelId: 'officer-7',
    department: 'Industry',
    title: 'Expand Ceres refinery',
    body: 'Build a second mass driver line to increase metals throughput by 30%.',
    resourceCost: 25,
    confidence: 'high',
    status: 'pending',
    decision: null,
    ...overrides,
  };
}

describe('Inbox component', () => {
  it('renders loading state while subscription is pending', () => {
    const store = createSessionStore();
    store.getState().actions.setConnection({
      status: 'connected',
      identity: 'identity-player-1',
    });
    store.getState().actions.setProposalsSubscription({ status: 'loading' });

    render(<Inbox store={store} />);

    expect(screen.getByTestId('inbox-loading')).toBeDefined();
    expect(screen.getByText(/loading proposals/i)).toBeDefined();
  });

  it('renders error state when subscription fails', () => {
    const store = seedStore();
    store.getState().actions.setProposalsSubscription({
      status: 'error',
      error: 'subscription dropped',
    });

    render(<Inbox store={store} />);

    expect(screen.getByTestId('inbox-error')).toBeDefined();
    expect(screen.getByText(/subscription dropped/i)).toBeDefined();
  });

  it('renders empty state when no proposals exist', () => {
    const store = seedStore();
    store.getState().actions.hydrateSubscription({ proposals: [] });

    render(<Inbox store={store} />);

    expect(screen.getByTestId('inbox-empty')).toBeDefined();
    expect(screen.getByText(/no proposals waiting/i)).toBeDefined();
  });

  it('lists proposals for the current player faction', () => {
    const store = seedStore();
    store.getState().actions.hydrateSubscription({
      proposals: [
        makeProposal({ id: 'prop-a', title: 'Earth alpha', factionId: 'earth' }),
        makeProposal({ id: 'prop-b', title: 'Earth beta', factionId: 'earth', turn: 5 }),
        makeProposal({ id: 'prop-c', title: 'Mars sneak', factionId: 'mars' }),
      ],
    });

    render(<Inbox store={store} />);

    const list = screen.getByTestId('inbox-list');
    expect(within(list).getByText('Earth alpha')).toBeDefined();
    expect(within(list).getByText('Earth beta')).toBeDefined();
    expect(within(list).queryByText('Mars sneak')).toBeNull();
  });

  it('opens proposal detail when a proposal is selected', () => {
    const store = seedStore();
    store.getState().actions.hydrateSubscription({
      proposals: [
        makeProposal({ id: 'prop-a', title: 'Earth alpha' }),
        makeProposal({ id: 'prop-b', title: 'Earth beta' }),
      ],
    });

    render(<Inbox store={store} />);

    expect(screen.getByTestId('proposal-reader-empty')).toBeDefined();

    fireEvent.click(screen.getByTestId('inbox-item-prop-a'));

    const reader = screen.getByTestId('proposal-reader-prop-a');
    expect(reader).toBeDefined();
    expect(within(reader).getByText('Earth alpha')).toBeDefined();
    expect(screen.queryByTestId('proposal-reader-empty')).toBeNull();
  });

  it('shows backend-sourced metadata in the reader', () => {
    const store = seedStore();
    store.getState().actions.hydrateSubscription({
      proposals: [
        makeProposal({
          id: 'prop-meta',
          title: 'Build Lunar shipyards',
          department: 'Fleet',
          proposingPersonnelId: 'officer-12',
          resourceCost: 42,
          confidence: 'medium',
          status: 'pending',
          decision: null,
          body: 'Establish dedicated dock capacity to accelerate colony ship throughput.',
        }),
      ],
    });

    render(<Inbox store={store} selectedProposalId="prop-meta" />);

    const meta = screen.getByTestId('proposal-reader-meta');
    expect(within(meta).getByText('Fleet')).toBeDefined();
    expect(within(meta).getByText('#officer-12')).toBeDefined();
    expect(within(meta).getByText('42')).toBeDefined();
    expect(within(meta).getByText('medium')).toBeDefined();
    const pendingDds = within(meta).getAllByText('pending', { selector: 'dd' });
    expect(pendingDds.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/accelerate colony ship throughput/i)).toBeDefined();
  });
});
