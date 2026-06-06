import { describe, expect, it } from 'vitest';

import {
  filterPrivateCommandState,
  filterRowsByFaction,
  PRIVATE_COMMAND_TABLES,
} from './private_state_filters.js';
import { resolveIdentityScope } from './access_policy.js';
import { turn1Seed } from './turn1_seed.js';

const [factionA, factionB] = turn1Seed.factions;
const scopeForA = () =>
  resolveIdentityScope({
    factions: turn1Seed.factions,
    sender: factionA.player_id,
    sessionId: factionA.session_id,
  });
const scopeForB = () =>
  resolveIdentityScope({
    factions: turn1Seed.factions,
    sender: factionB.player_id,
    sessionId: factionB.session_id,
  });

describe('private state subscription filters', () => {
  it('covers every private command table with an owner scoped filter', () => {
    expect(PRIVATE_COMMAND_TABLES).toEqual([
      'personnel',
      'personnel_relationships',
      'proposals',
      'commander_inbox',
      'projects',
      'intelligence_records',
      'turn_summaries',
      'trade_agreements',
      'llm_requests',
    ]);
  });

  it('returns only owner rows for faction-private command state', () => {
    const visible = filterPrivateCommandState(turn1Seed, scopeForA());

    expect(visible.personnel.every((row) => row.faction_id === factionA.id)).toBe(true);
    expect(visible.proposals.every((row) => row.faction_id === factionA.id)).toBe(true);
    expect(visible.commander_inbox.every((row) => row.faction_id === factionA.id)).toBe(true);
    expect(visible.projects.every((row) => row.faction_id === factionA.id)).toBe(true);
    expect(visible.turn_summaries.every((row) => row.faction_id === factionA.id)).toBe(true);
    expect(visible.llm_requests.every((row) => row.faction_id === factionA.id)).toBe(true);
    expect(
      visible.intelligence_records.every((row) => row.observer_faction_id === factionA.id)
    ).toBe(true);
  });

  it('does not leak opposing faction private rows between browser contexts', () => {
    const visibleToA = filterPrivateCommandState(turn1Seed, scopeForA());
    const visibleToB = filterPrivateCommandState(turn1Seed, scopeForB());

    expect(visibleToA.personnel.some((row) => row.faction_id === factionB.id)).toBe(false);
    expect(visibleToA.proposals.some((row) => row.faction_id === factionB.id)).toBe(false);
    expect(visibleToA.llm_requests.some((row) => row.faction_id === factionB.id)).toBe(false);
    expect(visibleToB.personnel.some((row) => row.faction_id === factionA.id)).toBe(false);
    expect(visibleToB.proposals.some((row) => row.faction_id === factionA.id)).toBe(false);
    expect(visibleToB.llm_requests.some((row) => row.faction_id === factionA.id)).toBe(false);
  });

  it('filters derived personnel relationships through visible personnel ownership', () => {
    const visible = filterPrivateCommandState(turn1Seed, scopeForA());
    const visiblePersonnelIds = new Set(visible.personnel.map((row) => row.id));

    expect(visible.personnel_relationships.length).toBeGreaterThan(0);
    expect(
      visible.personnel_relationships.every(
        (row) =>
          visiblePersonnelIds.has(row.personnel_a_id) &&
          visiblePersonnelIds.has(row.personnel_b_id)
      )
    ).toBe(true);
  });

  it('returns no private rows for observer or unclaimed contexts', () => {
    const observer = {
      identity: 'observer',
      ownedFactionIds: [],
      role: 'observer' as const,
      sessionId: factionA.session_id,
    };
    const visible = filterPrivateCommandState(turn1Seed, observer);

    for (const tableName of PRIVATE_COMMAND_TABLES) {
      expect(visible[tableName]).toEqual([]);
    }
  });

  it('provides a reusable owner filter for reducer-side query helpers', () => {
    expect(filterRowsByFaction(turn1Seed.proposals, scopeForA())).toEqual(
      turn1Seed.proposals.filter((row) => row.faction_id === factionA.id)
    );
  });
});
