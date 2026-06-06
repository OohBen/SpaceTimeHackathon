import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Inbox } from '../components/inbox/Inbox';
import { sessionStore } from '../state/session-store';
import { buildLiveSnapshot } from './liveBridge';
import type {
  Factions,
  GameSessions,
  LlmRequests,
  Proposals,
  TurnSummaries,
} from '../module_bindings/types';

// End-to-end seam test: snapshot built by `buildLiveSnapshot` from generated
// row shapes flows into `sessionStore`, and `<Inbox />` renders the resulting
// proposals + orchestrator status + resolution summary. Proves the live-route
// integration path closes the gap left by P4E1 T3 (Inbox wired in AppRouter
// but never reached real session data) without requiring a real SpacetimeDB
// connection.

const identityHex = 'aaaaaaaa';

function resetStore() {
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
    publicFactionsByKey: {},
    privateFactionStateByKey: {},
    proposalsById: {},
    turnSummariesById: {},
    llmRequestsById: {},
    proposalsSubscription: { status: 'idle' },
    reducerCalls: {},
  });
}

function fakeIdentity(hex: string): Factions['playerId'] {
  return { toHexString: () => hex } as Factions['playerId'];
}

function fakeSession(): GameSessions {
  return {
    id: 42,
    state: 'active',
    currentYear: 2150,
    currentTurn: 8,
    playerAFactionId: 202,
    playerBFactionId: 203,
    turnPhase: 'summary',
    turnDeadline: undefined,
    winnerFactionId: undefined,
    createdAt: {} as GameSessions['createdAt'],
    updatedAt: {} as GameSessions['updatedAt'],
  };
}

function fakeFactions(): Factions[] {
  return [
    {
      id: 202,
      sessionId: 42,
      playerId: fakeIdentity(identityHex),
      name: 'Solar Republic',
      credits: 480,
      politicalCapital: 30,
      doctrineVector: JSON.stringify({
        slot: {
          slot_key: 'player_a',
          slot_index: 1,
          slot_name: 'Solar Republic',
          claim_status: 'claimed',
          placeholder_player_id: 'placeholder-player_a',
        },
      }),
      controlScore: 70,
      readyForTurn: false,
    } as Factions,
    {
      id: 203,
      sessionId: 42,
      playerId: fakeIdentity('cccccccc'),
      name: 'Belt Compact',
      credits: 320,
      politicalCapital: 25,
      doctrineVector: JSON.stringify({
        slot: {
          slot_key: 'player_b',
          slot_index: 2,
          slot_name: 'Belt Compact',
          claim_status: 'claimed',
          placeholder_player_id: 'placeholder-player_b',
        },
      }),
      controlScore: 50,
      readyForTurn: true,
    } as Factions,
  ];
}

function fakeProposals(): Proposals[] {
  return [
    {
      id: 501,
      factionId: 202,
      turn: 8,
      proposingPersonnelId: 81,
      department: 'Fleet',
      title: 'Callisto convoy screen',
      body: 'Defend Callisto convoy from raider sweeps next turn.',
      resourceCost: 30,
      confidence: 'HIGH',
      status: 'pending',
      decision: undefined,
    } as Proposals,
  ];
}

function fakeTurnSummaries(): TurnSummaries[] {
  return [
    {
      id: 9001,
      sessionId: 42,
      factionId: 202,
      turn: 8,
      summaryJson: '{"simulation_outputs":{"narrative":"Callisto route secured."},"proposal_outcomes":{"approved":1}}',
      acknowledged: false,
      acknowledgedAt: undefined,
      createdAt: {} as TurnSummaries['createdAt'],
      updatedAt: {} as TurnSummaries['updatedAt'],
    } as TurnSummaries,
  ];
}

function fakeLlmRequests(): LlmRequests[] {
  return [
    {
      id: 7,
      sessionId: 42,
      factionId: 202,
      requestType: 'proposals',
      contextJson: '{}',
      status: 'completed',
      responseJson: '{"source":"deterministic_fallback"}',
      error: undefined,
      errorCode: undefined,
      attemptCount: 1,
      createdTurn: 8,
      updatedTurn: 8,
    } as LlmRequests,
  ];
}

describe('liveBridge → Inbox integration seam', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it('renders proposal, orchestrator status, and resolution summary from a fully translated live snapshot', () => {
    const snapshot = buildLiveSnapshot({
      sessions: [fakeSession()],
      factions: fakeFactions(),
      proposals: fakeProposals(),
      turnSummaries: fakeTurnSummaries(),
      llmRequests: fakeLlmRequests(),
      identity: identityHex,
    });

    act(() => {
      sessionStore.getState().actions.setConnection({
        status: 'connected',
        identity: identityHex,
        error: null,
      });
      sessionStore.getState().actions.hydrateSubscription(snapshot);
      sessionStore.getState().actions.setProposalsSubscription({ status: 'ready' });
    });

    render(<Inbox />);

    expect(screen.getByTestId('commander-inbox')).toHaveTextContent(/Callisto convoy screen/i);
    expect(screen.getByTestId('orchestrator-status')).toHaveTextContent(/deterministic fallback/i);
    expect(screen.getByTestId('resolution-summary')).toHaveTextContent(/Callisto route secured/i);
  });

  it('keeps the inbox playable when the orchestrator request is still queued — deterministic fallback messaging stands in', () => {
    const queued: LlmRequests = {
      ...fakeLlmRequests()[0],
      status: 'queued',
      responseJson: undefined,
    } as LlmRequests;

    const snapshot = buildLiveSnapshot({
      sessions: [fakeSession()],
      factions: fakeFactions(),
      proposals: fakeProposals(),
      turnSummaries: [],
      llmRequests: [queued],
      identity: identityHex,
    });

    act(() => {
      sessionStore.getState().actions.setConnection({
        status: 'connected',
        identity: identityHex,
        error: null,
      });
      sessionStore.getState().actions.hydrateSubscription(snapshot);
      sessionStore.getState().actions.setProposalsSubscription({ status: 'ready' });
    });

    render(<Inbox />);

    expect(screen.getByTestId('orchestrator-status')).toHaveTextContent(/queued/i);
    expect(screen.getByTestId('orchestrator-status')).toHaveTextContent(/deterministic fallback/i);
    expect(screen.getByTestId('commander-inbox')).toHaveTextContent(/Callisto convoy screen/i);
  });

  it('keeps proposal-list hydrated even when the live snapshot delivers zero summaries and zero llm requests', () => {
    const decisionPhaseSession: GameSessions = {
      ...fakeSession(),
      turnPhase: 'decision',
    };

    const snapshot = buildLiveSnapshot({
      sessions: [decisionPhaseSession],
      factions: fakeFactions(),
      proposals: fakeProposals(),
      turnSummaries: [],
      llmRequests: [],
      identity: identityHex,
    });

    act(() => {
      sessionStore.getState().actions.setConnection({
        status: 'connected',
        identity: identityHex,
        error: null,
      });
      sessionStore.getState().actions.hydrateSubscription(snapshot);
      sessionStore.getState().actions.setProposalsSubscription({ status: 'ready' });
    });

    render(<Inbox />);

    expect(screen.getByTestId('inbox-list')).toHaveTextContent(/Callisto convoy screen/i);
    expect(screen.queryByTestId('orchestrator-status')).toBeNull();
    expect(screen.queryByTestId('resolution-summary')).toBeNull();
  });
});
