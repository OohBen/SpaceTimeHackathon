import { describe, expect, it } from 'vitest';

import {
  generateFallbackProposals,
  type FallbackProposalInput,
} from './fallback_proposals.js';
import { turn1Seed } from './turn1_seed.js';

const proposalKeys = [
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
];

function makeInput(): FallbackProposalInput {
  const faction = turn1Seed.factions[0];
  const session = turn1Seed.game_sessions[0];
  return {
    cities: turn1Seed.cities.filter((city) => city.faction_id === faction.id),
    existingProposals: [],
    faction,
    personnel: turn1Seed.personnel.filter((person) => person.faction_id === faction.id),
    session,
  };
}

describe('deterministic fallback proposal generator', () => {
  it('returns repeatable proposals for identical authoritative inputs', () => {
    const input = makeInput();

    expect(generateFallbackProposals(input)).toEqual(generateFallbackProposals(input));
  });

  it('does not depend on hidden runtime randomness or wall-clock time', () => {
    const originalRandom = Math.random;
    const originalNow = Date.now;
    Math.random = () => {
      throw new Error('Math.random must not be used');
    };
    Date.now = () => {
      throw new Error('Date.now must not be used');
    };

    try {
      expect(generateFallbackProposals(makeInput())).toHaveLength(2);
    } finally {
      Math.random = originalRandom;
      Date.now = originalNow;
    }
  });

  it('omits auto-increment IDs so insertion can allocate unique proposal keys', () => {
    const proposals = generateFallbackProposals(makeInput());

    expect(proposals).toHaveLength(2);
    for (const proposal of proposals) {
      expect(Object.keys(proposal)).toEqual(proposalKeys);
      expect(proposal).not.toHaveProperty('id');
      expect(proposal).toMatchObject({
        decision: undefined,
        faction_id: makeInput().faction.id,
        status: 'unread',
        turn: makeInput().session.current_turn,
      });
      expect(proposal.resource_cost).toBeGreaterThan(0);
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(proposal.confidence);
    }
  });

  it('produces commander-usable text grounded in faction, city, and officer state', () => {
    const [proposal] = generateFallbackProposals(makeInput());

    expect(proposal.title.length).toBeGreaterThan(12);
    expect(proposal.body).toContain(makeInput().faction.name);
    expect(proposal.body).toContain('Recommendation:');
    expect(proposal.body).toContain('Expected effect:');
    expect(proposal.body).toContain('Cost:');
    expect(
      makeInput().cities.some((city) => proposal.body.includes(city.name))
    ).toBe(true);
    expect(
      makeInput().personnel.some((person) => proposal.body.includes(person.name))
    ).toBe(true);
  });
});
