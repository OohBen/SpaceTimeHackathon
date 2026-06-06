import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Inbox } from './Inbox';
import type { SpacetimeClient } from '../../spacetime/client';
import type { ReducerCallDescriptor } from '../../spacetime/reducers';
import {
  createSessionStore,
  type ProposalRow,
  type SessionStore,
} from '../../state/session-store';

function seedStore(options: {
  factionId?: string;
  resources?: Record<string, number>;
} = {}): SessionStore {
  const factionId = options.factionId ?? 'earth';
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
        factionId,
        factionName: 'Earth Directorate',
        playerName: 'Atlas',
        occupied: true,
        visibility: 'own',
      },
    ],
    privateFactionStates: options.resources
      ? [
          {
            sessionId: 'session-1',
            factionId,
            resources: options.resources,
            morale: 74,
            doctrine: 'industrial',
            visibility: 'ownFaction',
          },
        ]
      : undefined,
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

function seedDecisionStore(
  overrides: Partial<ProposalRow> = {},
  resources: Record<string, number> = { credits: 40, metals: 15 },
): SessionStore {
  const store = seedStore({ factionId: '7', resources });
  store.getState().actions.hydrateSubscription({
    proposals: [
      makeProposal({
        id: '101',
        factionId: '7',
        status: 'unread',
        resourceCost: 25,
        ...overrides,
      }),
    ],
  });
  return store;
}

function fakeClient(onCall: (call: ReducerCallDescriptor) => void): SpacetimeClient {
  return {
    connect: () => ({ disconnect: () => undefined }),
    reconnect: () => ({ disconnect: () => undefined }),
    disconnect: () => undefined,
    subscribe: () => undefined,
    callReducer: onCall,
    diagnostics: () => ({
      host: 'ws://localhost:3000',
      dbName: 'solar-dominion',
      issues: [],
    }),
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

  it('submits approved proposals through the typed commander decision reducer', () => {
    const calls: ReducerCallDescriptor[] = [];
    const store = seedDecisionStore();

    render(
      <Inbox
        store={store}
        client={fakeClient((call) => calls.push(call))}
        selectedProposalId="101"
      />,
    );

    expect(screen.getByText(/available credits: 40/i)).toBeDefined();
    expect(screen.getByLabelText(/credits allocation/i)).toHaveValue(25);

    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    expect(calls).toEqual([
      {
        reducer: 'commander_decision',
        args: {
          factionId: 7,
          proposalId: 101,
          decision: 'approved',
          allocation: 25,
        },
      },
    ]);
    expect(screen.getByRole('status')).toHaveTextContent(/submitting decision/i);
  });

  it('submits reject and defer decisions with zero allocation', () => {
    const rejectCalls: ReducerCallDescriptor[] = [];
    const { unmount } = render(
      <Inbox
        store={seedDecisionStore()}
        client={fakeClient((call) => rejectCalls.push(call))}
        selectedProposalId="101"
      />,
    );

    fireEvent.change(screen.getByLabelText(/credits allocation/i), {
      target: { value: '35' },
    });
    fireEvent.click(screen.getByRole('button', { name: /reject/i }));

    expect(rejectCalls[0]).toMatchObject({
      reducer: 'commander_decision',
      args: { factionId: 7, proposalId: 101, decision: 'rejected', allocation: 0 },
    });

    unmount();

    const deferCalls: ReducerCallDescriptor[] = [];
    render(
      <Inbox
        store={seedDecisionStore({ id: '102' })}
        client={fakeClient((call) => deferCalls.push(call))}
        selectedProposalId="102"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /defer/i }));

    expect(deferCalls[0]).toMatchObject({
      reducer: 'commander_decision',
      args: { factionId: 7, proposalId: 102, decision: 'deferred', allocation: 0 },
    });
  });

  it('blocks impossible approved allocations with clear validation messaging', () => {
    const calls: ReducerCallDescriptor[] = [];
    const store = seedDecisionStore({}, { credits: 20, metals: 15 });

    render(
      <Inbox
        store={store}
        client={fakeClient((call) => calls.push(call))}
        selectedProposalId="101"
      />,
    );

    expect(screen.getByText(/only 20 credits available/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/credits allocation/i), {
      target: { value: '10' },
    });

    expect(screen.getByText(/requires at least 25 credits/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    expect(calls).toHaveLength(0);
  });

  it('shows backend validation errors and success state for decision calls', () => {
    const store = seedDecisionStore();

    render(
      <Inbox
        store={store}
        client={fakeClient(() => {
          throw new Error('approved proposal 101 requires at least 25 credits');
        })}
        selectedProposalId="101"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      /backend rejected decision: approved proposal 101 requires at least 25 credits/i,
    );

    act(() => {
      store.getState().actions.beginReducerCall('commanderDecision:101', {
        reducer: 'commander_decision',
        args: { factionId: 7, proposalId: 101, decision: 'approved', allocation: 25 },
      });
      store.getState().actions.completeReducerCall('commanderDecision:101');
    });

    expect(screen.getByRole('status')).toHaveTextContent(/decision submitted/i);
  });

  it('disables decision controls for proposals that already have a terminal decision', () => {
    const store = seedDecisionStore({
      status: 'approved',
      decision: '{"decision":"approved"}',
    });

    render(<Inbox store={store} client={fakeClient(() => undefined)} selectedProposalId="101" />);

    const controls = within(screen.getByRole('region', { name: /proposal decision controls/i }));

    expect(screen.getByText(/decision already recorded/i)).toBeDefined();
    expect(controls.getByRole('button', { name: /approve/i })).toBeDisabled();
    expect(controls.getByRole('button', { name: /reject/i })).toBeDisabled();
    expect(controls.getByRole('button', { name: /defer/i })).toBeDisabled();
  });
});
