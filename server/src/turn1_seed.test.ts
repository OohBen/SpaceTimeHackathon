import { Identity, Timestamp } from 'spacetimedb';
import { describe, expect, it } from 'vitest';

import {
  TURN1_SEED_INSERT_ORDER,
  buildTurn1Seed,
  getTurn1SeedInsertPlan,
  turn1Seed,
  type Turn1SeedRows,
} from './turn1_seed.js';

const canonicalValue = (value: unknown): unknown => {
  if (value instanceof Identity) {
    return value.toHexString();
  }

  if (value instanceof Timestamp) {
    return value.microsSinceUnixEpoch.toString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)])
    );
  }

  return value;
};

const canonicalSeed = (seed: Turn1SeedRows): unknown => canonicalValue(seed);

describe('Turn 1 deterministic seed', () => {
  it('builds the expected initial session and faction state', () => {
    const seed = buildTurn1Seed();

    expect(seed.game_sessions).toEqual([
      expect.objectContaining({
        id: 1,
        state: 'active',
        current_year: 2150,
        current_turn: 1,
        player_a_faction_id: 1,
        player_b_faction_id: 2,
        turn_phase: 'deliberation',
        winner_faction_id: undefined,
      }),
    ]);

    expect(seed.factions).toHaveLength(2);
    expect(seed.factions.map((faction) => faction.name)).toEqual([
      'United Earth Authority',
      'Mars Congressional Compact',
    ]);
    expect(seed.factions.every((faction) => faction.ready_for_turn === false)).toBe(true);
    expect(seed.factions.every((faction) => faction.player_id instanceof Identity)).toBe(true);
  });

  it('populates minimum solar-system, city, personnel, and proposal context rows', () => {
    const seed = buildTurn1Seed();

    expect(seed.celestial_bodies.map((body) => body.name)).toEqual([
      'Earth',
      'Luna',
      'Mars',
      'Asteroid Belt',
      'Jupiter',
      'Callisto',
    ]);
    expect(seed.cities.map((city) => city.name)).toEqual([
      'New Geneva',
      'Tycho Shipyards',
      'Pavonis Hub',
    ]);
    expect(seed.personnel).toHaveLength(6);
    expect(seed.personnel.map((person) => person.department)).toEqual([
      'Executive',
      'Research',
      'Defense',
      'Executive',
      'Research',
      'Defense',
    ]);
    expect(seed.proposals).toHaveLength(4);
    expect(seed.commander_inbox.filter((message) => message.requires_decision)).toHaveLength(2);
    expect(seed.llm_requests).toHaveLength(2);
    expect(seed.llm_requests.every((request) => request.request_type === 'proposals')).toBe(true);
  });

  it('keeps seeded enum-like values inside the spec vocabulary', () => {
    const seed = buildTurn1Seed();
    const systemTiers = new Set(['earth', 'inner', 'belt', 'jupiter', 'saturn', 'deep']);
    const developmentStages = new Set(['establishment', 'early', 'maturation', 'full']);
    const confidenceLevels = new Set(['HIGH', 'MEDIUM', 'LOW']);
    const proposalStatuses = new Set([
      'unread',
      'read',
      'approved',
      'rejected',
      'deferred',
      'auto_deferred',
    ]);
    const llmStatuses = new Set(['queued', 'processing', 'completed', 'failed', 'cancelled']);

    expect(seed.celestial_bodies.every((body) => systemTiers.has(body.system_tier))).toBe(true);
    expect(seed.cities.every((city) => developmentStages.has(city.development_stage))).toBe(true);
    expect(seed.proposals.every((proposal) => confidenceLevels.has(proposal.confidence))).toBe(true);
    expect(seed.proposals.every((proposal) => proposalStatuses.has(proposal.status))).toBe(true);
    expect(seed.llm_requests.every((request) => llmStatuses.has(request.status))).toBe(true);
  });

  it('uses authoritative snake_case schema field names', () => {
    const seed = buildTurn1Seed();

    expect(Object.keys(seed.game_sessions[0])).toEqual([
      'id',
      'state',
      'current_year',
      'current_turn',
      'player_a_faction_id',
      'player_b_faction_id',
      'turn_phase',
      'turn_deadline',
      'winner_faction_id',
      'created_at',
      'updated_at',
    ]);
    expect(Object.keys(seed.factions[0])).toEqual([
      'id',
      'session_id',
      'player_id',
      'name',
      'credits',
      'political_capital',
      'doctrine_vector',
      'control_score',
      'ready_for_turn',
    ]);
    expect(Object.keys(seed.cities[0])).toEqual([
      'id',
      'session_id',
      'body_id',
      'faction_id',
      'name',
      'population',
      'infrastructure_level',
      'morale',
      'industrial_output',
      'research_output',
      'garrison_strength',
      'supply_status',
      'development_stage',
    ]);
    expect(Object.keys(seed.proposals[0])).toEqual([
      'id',
      'faction_id',
      'turn',
      'proposing_personnel_id',
      'department',
      'title',
      'body',
      'resource_cost',
      'confidence',
      'status',
      'decision',
    ]);
  });

  it('is deterministic for identical inputs', () => {
    const input = {
      session_id: 77,
      player_a_identity: '1111',
      player_b_identity: '2222',
      player_a_faction_name: 'North Star Directorate',
      player_b_faction_name: 'Valles Compact',
      created_at_micros: 123_456n,
    };

    const first = buildTurn1Seed(input);
    const second = buildTurn1Seed(input);

    expect(first).not.toBe(second);
    expect(canonicalSeed(first)).toEqual(canonicalSeed(second));
  });

  it('keeps references valid without requiring a live SpacetimeDB instance', () => {
    const seed = buildTurn1Seed();
    const sessionIds = new Set(seed.game_sessions.map((session) => session.id));
    const factionIds = new Set(seed.factions.map((faction) => faction.id));
    const bodyIds = new Set(seed.celestial_bodies.map((body) => body.id));
    const cityIds = new Set(seed.cities.map((city) => city.id));
    const personnelIds = new Set(seed.personnel.map((person) => person.id));

    expect(seed.factions.every((faction) => sessionIds.has(faction.session_id))).toBe(true);
    expect(seed.celestial_bodies.every((body) => sessionIds.has(body.session_id))).toBe(true);
    expect(seed.cities.every((city) => sessionIds.has(city.session_id))).toBe(true);
    expect(seed.cities.every((city) => bodyIds.has(city.body_id))).toBe(true);
    expect(seed.cities.every((city) => factionIds.has(city.faction_id))).toBe(true);
    expect(seed.personnel.every((person) => factionIds.has(person.faction_id))).toBe(true);
    expect(seed.personnel.every((person) => person.posting_city_id === undefined || cityIds.has(person.posting_city_id))).toBe(true);
    expect(seed.proposals.every((proposal) => factionIds.has(proposal.faction_id))).toBe(true);
    expect(seed.proposals.every((proposal) => personnelIds.has(proposal.proposing_personnel_id))).toBe(true);
    expect(seed.commander_inbox.every((message) => personnelIds.has(message.from_personnel_id))).toBe(true);
  });

  it('exposes deterministic insert batches in dependency order', () => {
    const plan = getTurn1SeedInsertPlan(turn1Seed);

    expect(plan.map((batch) => batch.table)).toEqual(TURN1_SEED_INSERT_ORDER);
    expect(plan[0]).toEqual({ table: 'game_sessions', rows: turn1Seed.game_sessions });
    expect(plan[1]).toEqual({ table: 'factions', rows: turn1Seed.factions });
    expect(plan[3]).toEqual({ table: 'cities', rows: turn1Seed.cities });
    expect(plan.at(-1)).toEqual({ table: 'llm_requests', rows: turn1Seed.llm_requests });
  });
});
