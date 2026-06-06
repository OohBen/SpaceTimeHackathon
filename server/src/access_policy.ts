import type { Identity } from 'spacetimedb';

import type { FactionRow } from './session_lifecycle.js';
import type { Turn1SeedTableName } from './turn1_seed.js';

export const ACCESS_POLICY_VERSION = 1;

export type TableVisibility =
  | 'shared'
  | 'faction_private'
  | 'mixed'
  | 'participant_shared'
  | 'internal';

export type SubscriptionExposure = 'full' | 'projection' | 'none';

export interface SubscriptionPolicy {
  public: SubscriptionExposure;
  owner?: SubscriptionExposure;
  participant?: SubscriptionExposure;
  internal?: SubscriptionExposure;
}

export interface TableAccessPolicy {
  visibility: TableVisibility;
  subscription: SubscriptionPolicy;
  ownerKey?: string;
  participantKeys?: readonly string[];
  publicProjection?: readonly string[];
  privateFields?: readonly string[];
  notes: string;
}

export type ReducerAccess =
  | 'anonymous_allowed'
  | 'slot_claim_or_same_identity'
  | 'faction_owner'
  | 'session_participant'
  | 'session_participant_after_deadline'
  | 'system_only';

export interface ReducerAccessPolicy {
  access: ReducerAccess;
  reads: readonly Turn1SeedTableName[];
  writes: readonly Turn1SeedTableName[];
  notes: string;
}

export interface IdentityScopeInput {
  sender: Identity;
  sessionId: number;
  factions: Iterable<FactionRow>;
}

export interface IdentityScope {
  identity: string;
  sessionId: number;
  role: 'player' | 'observer';
  ownedFactionIds: number[];
}

export const TABLE_ACCESS_POLICIES = {
  game_sessions: {
    visibility: 'shared',
    subscription: { public: 'full', owner: 'full' },
    notes: 'Session lifecycle, phase, timer, winner, and faction links are shared within the command interface.',
  },
  factions: {
    visibility: 'mixed',
    subscription: { public: 'projection', owner: 'full' },
    ownerKey: 'id',
    publicProjection: ['id', 'session_id', 'name', 'control_score', 'ready_for_turn'],
    privateFields: ['player_id', 'credits', 'political_capital', 'doctrine_vector'],
    notes: 'Faction identity and resources are owner-private; names, scores, and readiness can be projected publicly.',
  },
  celestial_bodies: {
    visibility: 'shared',
    subscription: { public: 'full', owner: 'full' },
    notes: 'The solar map body catalog is shared world state.',
  },
  cities: {
    visibility: 'mixed',
    subscription: { public: 'projection', owner: 'full' },
    ownerKey: 'faction_id',
    publicProjection: ['id', 'session_id', 'body_id', 'faction_id', 'name', 'development_stage'],
    privateFields: [
      'population',
      'industrial_output',
      'research_output',
      'garrison_strength',
      'supply_status',
      'morale',
    ],
    notes: 'Map control is public; exact operating stats are full-fidelity only for the owning faction.',
  },
  personnel: {
    visibility: 'faction_private',
    subscription: { public: 'none', owner: 'full' },
    ownerKey: 'faction_id',
    notes: 'Officer roster, traits, pay, morale, and burnout are private faction command data.',
  },
  personnel_relationships: {
    visibility: 'faction_private',
    subscription: { public: 'none', owner: 'full' },
    ownerKey: 'derived_personnel_faction_id',
    notes: 'Relationship rows inherit visibility from the personnel rows they connect.',
  },
  proposals: {
    visibility: 'faction_private',
    subscription: { public: 'none', owner: 'full' },
    ownerKey: 'faction_id',
    notes: 'Proposal body, confidence, cost, and decision state are private to the faction being advised.',
  },
  commander_inbox: {
    visibility: 'faction_private',
    subscription: { public: 'none', owner: 'full' },
    ownerKey: 'faction_id',
    notes: 'Inbox messages are addressed to one faction commander.',
  },
  fleets: {
    visibility: 'mixed',
    subscription: { public: 'projection', owner: 'full' },
    ownerKey: 'faction_id',
    publicProjection: ['id', 'faction_id', 'posting_city_id', 'strength'],
    privateFields: ['orders'],
    notes: 'Presence and rough strength can drive the public map; orders remain owner-private.',
  },
  colony_ships: {
    visibility: 'mixed',
    subscription: { public: 'projection', owner: 'full' },
    ownerKey: 'faction_id',
    publicProjection: ['id', 'faction_id', 'destination_body_id', 'arrives_turn', 'status'],
    privateFields: ['origin_city_id', 'manifest', 'departed_turn'],
    notes: 'Visible transit state can be projected; manifest and launch context stay owner-private.',
  },
  projects: {
    visibility: 'faction_private',
    subscription: { public: 'none', owner: 'full' },
    ownerKey: 'faction_id',
    notes: 'Build queues and allocations expose strategy and resource posture.',
  },
  intelligence_records: {
    visibility: 'faction_private',
    subscription: { public: 'none', owner: 'full' },
    ownerKey: 'observer_faction_id',
    notes: 'Intel belongs to the observing faction, including accuracy and target details.',
  },
  events: {
    visibility: 'mixed',
    subscription: { public: 'projection', owner: 'full' },
    ownerKey: 'faction_id',
    publicProjection: ['id', 'session_id', 'turn', 'event_type', 'payload'],
    notes: 'Rows with no faction_id are shared events; faction-addressed rows are private unless projected safely.',
  },
  turn_summaries: {
    visibility: 'faction_private',
    subscription: { public: 'none', owner: 'full' },
    ownerKey: 'faction_id',
    notes: 'Resolution summaries are written per faction and may include private interpretation.',
  },
  trade_agreements: {
    visibility: 'participant_shared',
    subscription: { public: 'none', participant: 'full' },
    participantKeys: ['faction_a_id', 'faction_b_id'],
    notes: 'Diplomatic terms are visible to participating factions only unless later published as events.',
  },
  llm_requests: {
    visibility: 'faction_private',
    subscription: { public: 'none', owner: 'full', internal: 'full' },
    ownerKey: 'faction_id',
    notes: 'Prompt context and provider responses are faction-private plus orchestrator/internal processing data.',
  },
} as const satisfies Record<Turn1SeedTableName, TableAccessPolicy>;

export type ReducerName =
  | 'create_session'
  | 'join_or_resume_session'
  | 'advance_turn_phase'
  | 'advance_world'
  | 'run_deliberation'
  | 'commander_decision'
  | 'submit_turn'
  | 'expire_turn'
  | 'simulate_turn'
  | 'ack_resolution'
  | 'check_victory';

export const REDUCER_ACCESS_POLICIES = {
  create_session: {
    access: 'anonymous_allowed',
    reads: ['game_sessions', 'factions'],
    writes: ['game_sessions', 'factions'],
    notes: 'Any sender may create a setup session; slot rows begin as claimable placeholders.',
  },
  join_or_resume_session: {
    access: 'slot_claim_or_same_identity',
    reads: ['game_sessions', 'factions'],
    writes: ['factions', 'game_sessions'],
    notes: 'Unclaimed slot can be claimed once; claimed slot resumes only for the same identity.',
  },
  advance_turn_phase: {
    access: 'system_only',
    reads: ['game_sessions'],
    writes: ['game_sessions'],
    notes: 'Administrative phase repair helper; gameplay should advance through bounded reducers.',
  },
  advance_world: {
    access: 'session_participant',
    reads: ['game_sessions', 'factions'],
    writes: ['game_sessions'],
    notes: 'Starts the world-update to deliberation step for an initialized active session.',
  },
  run_deliberation: {
    access: 'faction_owner',
    reads: ['factions', 'game_sessions', 'llm_requests'],
    writes: ['llm_requests'],
    notes: 'Only the faction owner may enqueue proposal generation for that faction.',
  },
  commander_decision: {
    access: 'faction_owner',
    reads: ['factions', 'game_sessions', 'proposals'],
    writes: ['factions', 'proposals'],
    notes: 'Only the faction owner may decide and allocate resources for a faction proposal.',
  },
  submit_turn: {
    access: 'faction_owner',
    reads: ['factions', 'game_sessions', 'proposals', 'events'],
    writes: ['factions', 'proposals', 'events', 'game_sessions'],
    notes: 'Only the faction owner may mark that faction ready.',
  },
  expire_turn: {
    access: 'session_participant_after_deadline',
    reads: ['game_sessions', 'factions', 'proposals', 'events'],
    writes: ['factions', 'proposals', 'events', 'game_sessions'],
    notes: 'Either session participant may trigger timeout after the authoritative deadline.',
  },
  simulate_turn: {
    access: 'session_participant',
    reads: ['game_sessions', 'factions', 'proposals', 'events', 'turn_summaries'],
    writes: ['game_sessions', 'turn_summaries', 'events'],
    notes: 'Resolution is deterministic and bounded to initialized session participants or automation.',
  },
  ack_resolution: {
    access: 'faction_owner',
    reads: ['factions', 'game_sessions', 'turn_summaries'],
    writes: ['turn_summaries', 'events', 'factions', 'game_sessions'],
    notes: 'Only the owning faction can acknowledge its private summary.',
  },
  check_victory: {
    access: 'session_participant',
    reads: ['game_sessions', 'factions', 'events'],
    writes: ['game_sessions', 'events'],
    notes: 'Victory checks use shared state and do not reveal private faction data.',
  },
} as const satisfies Record<ReducerName, ReducerAccessPolicy>;

export function getTableAccessPolicy(
  tableName: Turn1SeedTableName
): TableAccessPolicy {
  return TABLE_ACCESS_POLICIES[tableName];
}

export function getReducerAccessPolicy(
  reducerName: ReducerName
): ReducerAccessPolicy {
  return REDUCER_ACCESS_POLICIES[reducerName];
}

export function resolveIdentityScope(input: IdentityScopeInput): IdentityScope {
  const identity = input.sender.toHexString();
  const ownedFactionIds = Array.from(input.factions)
    .filter((faction) => faction.session_id === input.sessionId)
    .filter((faction) => isClaimedFactionOwnedByIdentity(faction, identity))
    .map((faction) => faction.id)
    .sort((a, b) => a - b);

  return {
    identity,
    sessionId: input.sessionId,
    role: ownedFactionIds.length > 0 ? 'player' : 'observer',
    ownedFactionIds,
  };
}

export function canReadFactionPrivateData(
  scope: IdentityScope,
  factionId: number
): boolean {
  return scope.ownedFactionIds.includes(factionId);
}

function isClaimedFactionOwnedByIdentity(
  faction: FactionRow,
  identity: string
): boolean {
  if (faction.player_id.toHexString() !== identity) {
    return false;
  }

  return getFactionClaimStatus(faction) !== 'claimable';
}

function getFactionClaimStatus(
  faction: FactionRow
): 'claimable' | 'claimed' | 'unknown' {
  try {
    const doctrine = JSON.parse(faction.doctrine_vector) as {
      slot?: { claim_status?: unknown };
    };
    const claimStatus = doctrine.slot?.claim_status;
    if (claimStatus === 'claimable' || claimStatus === 'claimed') {
      return claimStatus;
    }
  } catch {
    return 'unknown';
  }

  return 'unknown';
}
