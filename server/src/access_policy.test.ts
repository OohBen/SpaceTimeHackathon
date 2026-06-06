import { Identity } from 'spacetimedb';
import { describe, expect, it } from 'vitest';

import {
  ACCESS_POLICY_VERSION,
  REDUCER_ACCESS_POLICIES,
  TABLE_ACCESS_POLICIES,
  canReadFactionPrivateData,
  getReducerAccessPolicy,
  getTableAccessPolicy,
  resolveIdentityScope,
} from './access_policy.js';
import { buildSlotIdentity, type FactionRow } from './session_lifecycle.js';
import { TURN1_SEED_INSERT_ORDER, turn1Seed } from './turn1_seed.js';

const identityFromHex = (hex: string): Identity =>
  Identity.fromString(hex.replace(/^0x/u, '').padStart(64, '0'));

describe('access policy contract', () => {
  it('versions the authoritative access policy for downstream gates', () => {
    expect(ACCESS_POLICY_VERSION).toBe(1);
  });

  it('classifies every authoritative table used by the command interface', () => {
    expect(Object.keys(TABLE_ACCESS_POLICIES).sort()).toEqual(
      [...TURN1_SEED_INSERT_ORDER].sort()
    );
  });

  it('marks shared world tables as public and faction records as projection-backed', () => {
    expect(getTableAccessPolicy('game_sessions')).toMatchObject({
      subscription: { public: 'full', owner: 'full' },
      visibility: 'shared',
    });
    expect(getTableAccessPolicy('celestial_bodies')).toMatchObject({
      subscription: { public: 'full', owner: 'full' },
      visibility: 'shared',
    });
    expect(getTableAccessPolicy('factions')).toMatchObject({
      ownerKey: 'id',
      subscription: { public: 'projection', owner: 'full' },
      visibility: 'mixed',
    });
  });

  it('keeps command-private rows owner-only by faction identity', () => {
    for (const tableName of [
      'personnel',
      'proposals',
      'commander_inbox',
      'projects',
      'turn_summaries',
      'llm_requests',
    ] as const) {
      expect(getTableAccessPolicy(tableName)).toMatchObject({
        ownerKey: 'faction_id',
        subscription: { public: 'none', owner: 'full' },
        visibility: 'faction_private',
      });
    }
  });

  it('models partial visibility for map, event, intel, and diplomacy records', () => {
    expect(getTableAccessPolicy('cities')).toMatchObject({
      ownerKey: 'faction_id',
      subscription: { public: 'projection', owner: 'full' },
      visibility: 'mixed',
    });
    expect(getTableAccessPolicy('intelligence_records')).toMatchObject({
      ownerKey: 'observer_faction_id',
      subscription: { public: 'none', owner: 'full' },
      visibility: 'faction_private',
    });
    expect(getTableAccessPolicy('events')).toMatchObject({
      ownerKey: 'faction_id',
      privateFields: ['payload'],
      publicProjection: ['id', 'session_id', 'turn', 'event_type'],
      subscription: { public: 'projection', owner: 'full' },
      visibility: 'mixed',
    });
    expect(getTableAccessPolicy('events').publicProjection).not.toContain('payload');
    expect(getTableAccessPolicy('trade_agreements')).toMatchObject({
      participantKeys: ['faction_a_id', 'faction_b_id'],
      subscription: { public: 'none', participant: 'full' },
      visibility: 'participant_shared',
    });
  });

  it('maps reducers to the tables and identity checks they must use', () => {
    expect(getReducerAccessPolicy('create_session')).toMatchObject({
      access: 'anonymous_allowed',
      writes: ['game_sessions', 'factions'],
    });
    expect(getReducerAccessPolicy('join_or_resume_session')).toMatchObject({
      access: 'slot_claim_or_same_identity',
      reads: ['game_sessions', 'factions'],
      writes: ['factions', 'game_sessions'],
    });
    expect(getReducerAccessPolicy('seed_demo_turn_8')).toMatchObject({
      access: 'system_only',
      reads: ['game_sessions'],
      writes: [
        'game_sessions',
        'factions',
        'celestial_bodies',
        'cities',
        'personnel',
        'personnel_relationships',
        'proposals',
        'commander_inbox',
        'fleets',
        'colony_ships',
        'projects',
        'intelligence_records',
        'events',
        'turn_summaries',
        'trade_agreements',
        'llm_requests',
      ],
    });
    expect(getReducerAccessPolicy('commander_decision')).toMatchObject({
      access: 'faction_owner',
      reads: ['factions', 'game_sessions', 'proposals'],
      writes: ['factions', 'proposals'],
    });
    expect(getReducerAccessPolicy('expire_turn')).toMatchObject({
      access: 'session_participant_after_deadline',
    });
    expect(Object.keys(REDUCER_ACCESS_POLICIES).sort()).toEqual([
      'ack_resolution',
      'advance_turn_phase',
      'advance_world',
      'check_victory',
      'commander_decision',
      'create_session',
      'expire_turn',
      'join_or_resume_session',
      'run_deliberation',
      'seed_demo_turn_8',
      'simulate_turn',
      'submit_turn',
    ]);
  });

  it('resolves local P1/P2 identity scope from claimed faction rows', () => {
    const [factionA, factionB] = turn1Seed.factions;
    const scope = resolveIdentityScope({
      factions: [factionA, factionB],
      sender: factionA.player_id,
      sessionId: factionA.session_id,
    });

    expect(scope).toEqual({
      identity: factionA.player_id.toHexString(),
      ownedFactionIds: [factionA.id],
      role: 'player',
      sessionId: factionA.session_id,
    });
    expect(canReadFactionPrivateData(scope, factionA.id)).toBe(true);
    expect(canReadFactionPrivateData(scope, factionB.id)).toBe(false);
  });

  it('does not treat unclaimed placeholder identities as private owners', () => {
    const placeholder = buildSlotIdentity(42, 'player_a');
    const claimableFaction: FactionRow = {
      id: 101,
      session_id: 42,
      player_id: placeholder,
      name: 'United Earth Authority',
      credits: 1_000,
      political_capital: 50,
      doctrine_vector: JSON.stringify({
        expansion: 0.5,
        security: 0.5,
        slot: {
          claim_status: 'claimable',
          join_reducer: 'join_or_resume_session',
          lifecycle: 'session_slot',
          placeholder_player_id: placeholder.toHexString(),
          resume_key: 'session_id+player_slot',
          schema_version: 1,
          slot_index: 1,
          slot_key: 'player_a',
          slot_name: 'United Earth Authority',
        },
      }),
      control_score: 100,
      ready_for_turn: false,
    };

    const scope = resolveIdentityScope({
      factions: [claimableFaction],
      sender: placeholder,
      sessionId: claimableFaction.session_id,
    });

    expect(scope.role).toBe('observer');
    expect(scope.ownedFactionIds).toEqual([]);
    expect(canReadFactionPrivateData(scope, claimableFaction.id)).toBe(false);
  });

  it('keeps future hosted mode on the same per-session ownership rule', () => {
    const hostedIdentity = identityFromHex('c0ffee');
    const hostedFaction: FactionRow = {
      ...turn1Seed.factions[0],
      player_id: hostedIdentity,
      session_id: 500,
    };

    const scope = resolveIdentityScope({
      factions: [hostedFaction],
      sender: hostedIdentity,
      sessionId: 500,
    });

    expect(scope.role).toBe('player');
    expect(scope.ownedFactionIds).toEqual([hostedFaction.id]);
  });
});
