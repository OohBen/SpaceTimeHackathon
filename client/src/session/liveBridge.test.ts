import { describe, expect, it } from 'vitest';
import type {
  Factions,
  GameSessions,
  LlmRequests,
  Personnel,
  Proposals,
  TurnSummaries,
} from '../module_bindings/types';
import { buildLiveSnapshot } from './liveBridge';

const identityHex = 'aaaaaaaa';
const otherIdentityHex = 'bbbbbbbb';
const placeholderHex = 'placeholder-player-a';

function identity(hex: string): Factions['playerId'] {
  return { toHexString: () => hex } as Factions['playerId'];
}

function session(overrides: Partial<GameSessions> = {}): GameSessions {
  return {
    id: 7,
    state: 'active',
    currentYear: 2150,
    currentTurn: 3,
    playerAFactionId: 101,
    playerBFactionId: 102,
    turnPhase: 'decision',
    turnDeadline: undefined,
    winnerFactionId: undefined,
    createdAt: {} as GameSessions['createdAt'],
    updatedAt: {} as GameSessions['updatedAt'],
    ...overrides,
  };
}

function faction(overrides: Partial<Factions> & { slotKey: 'player_a' | 'player_b'; ownerHex: string }): Factions {
  const slotKey = overrides.slotKey;
  return {
    id: slotKey === 'player_a' ? 101 : 102,
    sessionId: 7,
    playerId: identity(overrides.ownerHex),
    name: slotKey === 'player_a' ? 'United Earth' : 'Mars Compact',
    credits: 1000,
    politicalCapital: 50,
    doctrineVector: JSON.stringify({
      slot: {
        slot_key: slotKey,
        slot_index: slotKey === 'player_a' ? 1 : 2,
        slot_name: slotKey === 'player_a' ? 'United Earth' : 'Mars Compact',
        claim_status: overrides.ownerHex === placeholderHex ? 'claimable' : 'claimed',
        placeholder_player_id: `placeholder-${slotKey}`,
      },
    }),
    controlScore: 100,
    readyForTurn: false,
    ...overrides,
  } as Factions;
}

function proposal({
  id,
  factionId,
  ...overrides
}: Partial<Proposals> & { id: number; factionId: number }): Proposals {
  return {
    id,
    factionId,
    turn: 3,
    proposingPersonnelId: 81,
    department: 'Fleet',
    title: `Proposal ${id}`,
    body: `Private proposal ${id}`,
    resourceCost: 30,
    confidence: 'HIGH',
    status: 'pending',
    decision: undefined,
    ...overrides,
  } as Proposals;
}

function personnel({
  id,
  factionId,
  ...overrides
}: Partial<Personnel> & { id: number; factionId: number }): Personnel {
  return {
    id,
    factionId,
    name: `Officer ${id}`,
    role: 'Commander',
    department: 'Fleet',
    postingCityId: undefined,
    competence: 80,
    creativity: 70,
    reliability: 75,
    ambition: 45,
    politicalSkill: 50,
    communication: 60,
    loyalty: 70,
    autonomyTolerance: 65,
    morale: 72,
    burnout: 8,
    salary: 12,
    ...overrides,
  } as Personnel;
}

describe('buildLiveSnapshot', () => {
  it('translates a session state into the lobby/active/complete store status taxonomy', () => {
    const snap = buildLiveSnapshot({
      sessions: [
        session({ id: 1, state: 'setup', turnPhase: 'setup' }),
        session({ id: 2, state: 'active', turnPhase: 'decision' }),
        session({ id: 3, state: 'completed', turnPhase: 'complete' }),
      ],
      factions: [],
      proposals: [],
      turnSummaries: [],
      llmRequests: [],
      identity: identityHex,
    });

    expect(snap.sessions?.map(s => ({ id: s.id, status: s.status, phase: s.phase }))).toEqual([
      { id: '1', status: 'lobby', phase: 'setup' },
      { id: '2', status: 'active', phase: 'decision' },
      { id: '3', status: 'complete', phase: 'complete' },
    ]);
  });

  it('binds the player slot identity only for claimed slots whose owner matches the connection identity', () => {
    const snap = buildLiveSnapshot({
      sessions: [session()],
      factions: [
        faction({ slotKey: 'player_a', ownerHex: identityHex }),
        faction({ slotKey: 'player_b', ownerHex: placeholderHex }),
      ],
      proposals: [],
      turnSummaries: [],
      llmRequests: [],
      identity: identityHex,
    });

    const owned = snap.playerSlots?.find(p => p.factionId === '101');
    const placeholder = snap.playerSlots?.find(p => p.factionId === '102');

    expect(owned).toMatchObject({
      sessionId: '7',
      slot: 1,
      identity: identityHex,
      occupied: true,
    });
    expect(placeholder).toMatchObject({
      sessionId: '7',
      slot: 2,
      identity: null,
      occupied: false,
    });
  });

  it('emits private faction state only for factions owned by the live connection identity', () => {
    const snap = buildLiveSnapshot({
      sessions: [session()],
      factions: [
        faction({ slotKey: 'player_a', ownerHex: identityHex, credits: 700 }),
        faction({ slotKey: 'player_b', ownerHex: otherIdentityHex, credits: 200 }),
      ],
      proposals: [],
      turnSummaries: [],
      llmRequests: [],
      identity: identityHex,
    });

    expect(snap.privateFactionStates).toHaveLength(1);
    expect(snap.privateFactionStates?.[0]).toMatchObject({
      factionId: '101',
      sessionId: '7',
      resources: { credits: 700, political_capital: 50 },
      visibility: 'ownFaction',
    });
  });

  it('keeps cross-browser private live rows scoped while shared world rows match', () => {
    const factions = [
      faction({ slotKey: 'player_a', ownerHex: identityHex, credits: 700 }),
      faction({ slotKey: 'player_b', ownerHex: otherIdentityHex, credits: 200 }),
    ];
    const proposals = [
      proposal({ id: 501, factionId: 101, title: 'Earth private order' }),
      proposal({ id: 502, factionId: 102, title: 'Mars private order' }),
    ];
    const personnelRows = [
      personnel({ id: 701, factionId: 101, name: 'Earth Officer' }),
      personnel({ id: 702, factionId: 102, name: 'Mars Officer' }),
    ];

    const browserA = buildLiveSnapshot({
      sessions: [session({ currentTurn: 4, turnPhase: 'orders' })],
      factions,
      proposals,
      personnel: personnelRows,
      turnSummaries: [],
      llmRequests: [],
      identity: identityHex,
    });
    const browserB = buildLiveSnapshot({
      sessions: [session({ currentTurn: 4, turnPhase: 'orders' })],
      factions,
      proposals,
      personnel: personnelRows,
      turnSummaries: [],
      llmRequests: [],
      identity: otherIdentityHex,
    });

    expect(browserA.sessions).toEqual(browserB.sessions);
    expect(browserA.publicFactions).toEqual(browserB.publicFactions);
    expect(browserA.privateFactionStates?.map(row => row.factionId)).toEqual(['101']);
    expect(browserB.privateFactionStates?.map(row => row.factionId)).toEqual(['102']);
    expect(browserA.proposals?.map(row => row.title)).toEqual(['Earth private order']);
    expect(browserB.proposals?.map(row => row.title)).toEqual(['Mars private order']);
    expect(browserA.personnel?.map(row => row.name)).toEqual(['Earth Officer']);
    expect(browserB.personnel?.map(row => row.name)).toEqual(['Mars Officer']);
  });

  it('joins proposals to their session via the parent faction so the store can route by sessionId', () => {
    const proposal: Proposals = {
      id: 501,
      factionId: 101,
      turn: 3,
      proposingPersonnelId: 81,
      department: 'Fleet',
      title: 'Callisto convoy screen',
      body: 'Defend Callisto convoy.',
      resourceCost: 30,
      confidence: 'HIGH',
      status: 'pending',
      decision: undefined,
    };

    const snap = buildLiveSnapshot({
      sessions: [session()],
      factions: [faction({ slotKey: 'player_a', ownerHex: identityHex })],
      proposals: [proposal],
      turnSummaries: [],
      llmRequests: [],
      identity: identityHex,
    });

    expect(snap.proposals).toHaveLength(1);
    expect(snap.proposals?.[0]).toMatchObject({
      id: '501',
      sessionId: '7',
      factionId: '101',
      turn: 3,
      title: 'Callisto convoy screen',
      decision: null,
    });
  });

  it('drops orphan proposals whose faction is not yet hydrated rather than surfacing a missing-sessionId row', () => {
    const orphan: Proposals = {
      id: 999,
      factionId: 9999,
      turn: 1,
      proposingPersonnelId: 0,
      department: 'Unknown',
      title: 'Orphan',
      body: '',
      resourceCost: 0,
      confidence: 'LOW',
      status: 'pending',
      decision: undefined,
    };

    const snap = buildLiveSnapshot({
      sessions: [session()],
      factions: [],
      proposals: [orphan],
      turnSummaries: [],
      llmRequests: [],
      identity: identityHex,
    });

    expect(snap.proposals).toEqual([]);
  });

  it('passes turn summaries and llm requests through with stringified IDs and nullable fields', () => {
    const summary: TurnSummaries = {
      id: 42,
      sessionId: 7,
      factionId: 101,
      turn: 3,
      summaryJson: '{"event":"turn_summary"}',
      acknowledged: false,
      acknowledgedAt: undefined,
      createdAt: {} as TurnSummaries['createdAt'],
      updatedAt: {} as TurnSummaries['updatedAt'],
    };
    const request: LlmRequests = {
      id: 9,
      sessionId: 7,
      factionId: 101,
      requestType: 'proposals',
      contextJson: '{}',
      status: 'completed',
      responseJson: '{"source":"deterministic_fallback"}',
      error: undefined,
      errorCode: undefined,
      attemptCount: 1,
      createdTurn: 3,
      updatedTurn: 3,
    };

    const snap = buildLiveSnapshot({
      sessions: [session()],
      factions: [faction({ slotKey: 'player_a', ownerHex: identityHex })],
      proposals: [],
      turnSummaries: [summary],
      llmRequests: [request],
      identity: identityHex,
    });

    expect(snap.turnSummaries?.[0]).toMatchObject({
      id: '42',
      sessionId: '7',
      factionId: '101',
      acknowledged: false,
      acknowledgedAt: null,
    });
    expect(snap.llmRequests?.[0]).toMatchObject({
      id: '9',
      sessionId: '7',
      factionId: '101',
      status: 'completed',
      responseJson: '{"source":"deterministic_fallback"}',
      error: null,
      errorCode: null,
      attemptCount: 1,
    });
  });

  it('treats malformed doctrineVector as a slot-metadata absence rather than throwing', () => {
    const broken = faction({ slotKey: 'player_a', ownerHex: identityHex });
    broken.doctrineVector = 'not-json';

    const snap = buildLiveSnapshot({
      sessions: [session()],
      factions: [broken],
      proposals: [],
      turnSummaries: [],
      llmRequests: [],
      identity: identityHex,
    });

    // Without metadata the bridge cannot infer claim status; falls back to
    // unoccupied so the lobby surface treats the slot as joinable.
    expect(snap.playerSlots?.[0].factionName).toBe(broken.name);
    expect(snap.playerSlots?.[0].occupied).toBe(false);
    expect(snap.playerSlots?.[0].identity).toBeNull();
  });

  it('returns no private faction state when the connection identity is null', () => {
    const snap = buildLiveSnapshot({
      sessions: [session()],
      factions: [faction({ slotKey: 'player_a', ownerHex: identityHex })],
      proposals: [],
      turnSummaries: [],
      llmRequests: [],
      identity: null,
    });

    expect(snap.privateFactionStates).toEqual([]);
  });
});
