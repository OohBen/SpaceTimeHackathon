import { describe, expect, it } from 'vitest';

import {
  applyDoctrineDrift,
  applyMoraleDrift,
  applyPoliticalCapitalDecay,
  type EconomyRulesContext,
} from './economy_rules.js';
import type { FactionRow } from './session_lifecycle.js';
import type { CityRow, ProposalRow } from './turn1_seed.js';

function makeFaction(
  id: number,
  overrides: Partial<FactionRow> = {}
): FactionRow {
  return {
    id,
    session_id: 1,
    player_id: { toHexString: () => id.toString().padStart(64, '0') } as FactionRow['player_id'],
    name: `Faction ${id}`,
    credits: 1000,
    political_capital: 100,
    doctrine_vector: '{"expansion":0.5,"security":0.5,"science":0.5,"diplomacy":0.5}',
    control_score: 100,
    ready_for_turn: false,
    ...overrides,
  };
}

function makeCity(
  id: number,
  factionId: number,
  morale: number,
  supplyStatus: string
): CityRow {
  return {
    id,
    session_id: 1,
    body_id: id,
    faction_id: factionId,
    name: `City ${id}`,
    population: 1_000_000n,
    infrastructure_level: 3,
    morale,
    industrial_output: 100,
    research_output: 50,
    garrison_strength: 200,
    supply_status: supplyStatus,
    development_stage: 'full',
  };
}

function makeProposal(
  id: number,
  factionId: number,
  turn: number,
  department: string,
  status: string
): ProposalRow {
  return {
    id,
    faction_id: factionId,
    turn,
    proposing_personnel_id: 1,
    department,
    title: `Proposal ${id}`,
    body: 'test body',
    resource_cost: 10,
    confidence: 'medium',
    status,
    decision: status === 'approved' ? 'approve' : undefined,
  };
}

function makeCtx(
  factions: FactionRow[],
  cities: CityRow[],
  proposals: ProposalRow[]
): EconomyRulesContext & { factions: FactionRow[]; cities: CityRow[] } {
  const factionMap = new Map(factions.map(f => [f.id, { ...f }]));
  const cityList = cities.map(c => ({ ...c }));
  return {
    factions,
    cities: cityList,
    db: {
      factions: {
        id: {
          find: (id: number) => factionMap.get(id) ?? null,
          update: (row: FactionRow) => {
            factionMap.set(row.id, { ...row });
            const idx = factions.findIndex(f => f.id === row.id);
            if (idx >= 0) factions[idx] = { ...row };
            return row;
          },
        },
      },
      cities: {
        iter: () => cityList.values(),
        id: {
          update: (row: CityRow) => {
            const idx = cityList.findIndex(c => c.id === row.id);
            if (idx >= 0) cityList[idx] = { ...row };
            return row;
          },
        },
      },
      proposals: {
        iter: () => proposals.values(),
      },
    },
  };
}

describe('applyMoraleDrift', () => {
  it('decreases morale by 2 for strained supply', () => {
    const cities = [makeCity(1, 1, 70, 'strained')];
    const ctx = makeCtx([makeFaction(1), makeFaction(2)], cities, []);

    const deltas = applyMoraleDrift(ctx, [1, 2]);

    expect(deltas[1]).toBe(-2);
    expect(ctx.cities[0].morale).toBe(68);
  });

  it('decreases morale by 5 for critical supply', () => {
    const cities = [makeCity(1, 1, 70, 'critical')];
    const ctx = makeCtx([makeFaction(1), makeFaction(2)], cities, []);

    applyMoraleDrift(ctx, [1, 2]);

    expect(ctx.cities[0].morale).toBe(65);
  });

  it('increases morale by 1 for stable supply', () => {
    const cities = [makeCity(1, 1, 70, 'stable')];
    const ctx = makeCtx([makeFaction(1), makeFaction(2)], cities, []);

    applyMoraleDrift(ctx, [1, 2]);

    expect(ctx.cities[0].morale).toBe(71);
  });

  it('clamps morale to [0, 100]', () => {
    const cities = [
      makeCity(1, 1, 1, 'critical'),
      makeCity(2, 2, 100, 'stable'),
    ];
    const ctx = makeCtx([makeFaction(1), makeFaction(2)], cities, []);

    applyMoraleDrift(ctx, [1, 2]);

    expect(ctx.cities[0].morale).toBe(0);
    expect(ctx.cities[1].morale).toBe(100);
  });

  it('ignores cities outside the session factions', () => {
    const cities = [
      makeCity(1, 1, 70, 'strained'),
      makeCity(2, 99, 70, 'critical'),
    ];
    const ctx = makeCtx([makeFaction(1), makeFaction(2)], cities, []);

    applyMoraleDrift(ctx, [1, 2]);

    expect(ctx.cities[0].morale).toBe(68);
    expect(ctx.cities[1].morale).toBe(70);
  });

  it('produces identical results regardless of city input order', () => {
    const citiesForward = [
      makeCity(1, 1, 70, 'strained'),
      makeCity(2, 1, 50, 'stable'),
      makeCity(3, 2, 60, 'critical'),
    ];
    const citiesReverse = [...citiesForward].reverse();

    const ctxA = makeCtx([makeFaction(1), makeFaction(2)], citiesForward, []);
    const ctxB = makeCtx([makeFaction(1), makeFaction(2)], citiesReverse, []);

    const deltasA = applyMoraleDrift(ctxA, [1, 2]);
    const deltasB = applyMoraleDrift(ctxB, [1, 2]);

    expect(deltasA).toEqual(deltasB);
  });
});

describe('applyPoliticalCapitalDecay', () => {
  it('decays political capital by 5 percent (floored)', () => {
    const factions = [
      makeFaction(1, { political_capital: 100 }),
      makeFaction(2, { political_capital: 50 }),
    ];
    const ctx = makeCtx(factions, [], []);

    const result = applyPoliticalCapitalDecay(ctx, [1, 2]);

    expect(result[1]).toBe(95);
    expect(result[2]).toBe(47);
    expect(factions[0].political_capital).toBe(95);
    expect(factions[1].political_capital).toBe(47);
  });

  it('floors zero or near-zero values to zero', () => {
    const factions = [
      makeFaction(1, { political_capital: 0 }),
      makeFaction(2, { political_capital: 1 }),
    ];
    const ctx = makeCtx(factions, [], []);

    applyPoliticalCapitalDecay(ctx, [1, 2]);

    expect(factions[0].political_capital).toBe(0);
    expect(factions[1].political_capital).toBe(0);
  });

  it('throws when a session faction is missing', () => {
    const ctx = makeCtx([makeFaction(1)], [], []);

    expect(() => applyPoliticalCapitalDecay(ctx, [1, 2])).toThrow(
      /faction 2 not found/
    );
  });

  it('produces identical results regardless of faction id input order', () => {
    const factionsA = [
      makeFaction(1, { political_capital: 200 }),
      makeFaction(2, { political_capital: 150 }),
    ];
    const factionsB = [
      makeFaction(1, { political_capital: 200 }),
      makeFaction(2, { political_capital: 150 }),
    ];

    const ctxA = makeCtx(factionsA, [], []);
    const ctxB = makeCtx(factionsB, [], []);

    const a = applyPoliticalCapitalDecay(ctxA, [1, 2]);
    const b = applyPoliticalCapitalDecay(ctxB, [2, 1]);

    expect(a).toEqual(b);
  });
});

describe('applyDoctrineDrift', () => {
  it('drifts mapped axis by +0.02 per approved proposal from previous turn', () => {
    const factions = [makeFaction(1), makeFaction(2)];
    const proposals = [
      makeProposal(1, 1, 3, 'Military', 'approved'),
      makeProposal(2, 1, 3, 'Science', 'approved'),
    ];
    const ctx = makeCtx(factions, [], proposals);

    applyDoctrineDrift(ctx, [1, 2], 3);

    const doctrine = JSON.parse(factions[0].doctrine_vector);
    expect(doctrine.security).toBe(0.52);
    expect(doctrine.science).toBe(0.52);
  });

  it('aggregates multiple approved proposals on the same axis', () => {
    const factions = [makeFaction(1), makeFaction(2)];
    const proposals = [
      makeProposal(1, 1, 3, 'Military', 'approved'),
      makeProposal(2, 1, 3, 'Intelligence', 'approved'),
    ];
    const ctx = makeCtx(factions, [], proposals);

    applyDoctrineDrift(ctx, [1, 2], 3);

    const doctrine = JSON.parse(factions[0].doctrine_vector);
    expect(doctrine.security).toBe(0.54);
  });

  it('clamps doctrine axes to [0, 1]', () => {
    const factions = [
      makeFaction(1, { doctrine_vector: '{"security":0.99}' }),
      makeFaction(2),
    ];
    const proposals = [
      makeProposal(1, 1, 3, 'Military', 'approved'),
      makeProposal(2, 1, 3, 'Intelligence', 'approved'),
    ];
    const ctx = makeCtx(factions, [], proposals);

    applyDoctrineDrift(ctx, [1, 2], 3);

    const doctrine = JSON.parse(factions[0].doctrine_vector);
    expect(doctrine.security).toBe(1);
  });

  it('ignores proposals that are not approved', () => {
    const factions = [makeFaction(1), makeFaction(2)];
    const proposals = [
      makeProposal(1, 1, 3, 'Military', 'pending'),
      makeProposal(2, 1, 3, 'Science', 'rejected'),
    ];
    const ctx = makeCtx(factions, [], proposals);

    applyDoctrineDrift(ctx, [1, 2], 3);

    const doctrine = JSON.parse(factions[0].doctrine_vector);
    expect(doctrine.security).toBe(0.5);
    expect(doctrine.science).toBe(0.5);
  });

  it('ignores proposals from a different turn', () => {
    const factions = [makeFaction(1), makeFaction(2)];
    const proposals = [
      makeProposal(1, 1, 2, 'Military', 'approved'),
    ];
    const ctx = makeCtx(factions, [], proposals);

    applyDoctrineDrift(ctx, [1, 2], 3);

    const doctrine = JSON.parse(factions[0].doctrine_vector);
    expect(doctrine.security).toBe(0.5);
  });

  it('ignores proposals from departments without an axis mapping', () => {
    const factions = [makeFaction(1), makeFaction(2)];
    const proposals = [makeProposal(1, 1, 3, 'Logistics', 'approved')];
    const ctx = makeCtx(factions, [], proposals);

    applyDoctrineDrift(ctx, [1, 2], 3);

    const doctrine = JSON.parse(factions[0].doctrine_vector);
    expect(doctrine.expansion).toBe(0.5);
    expect(doctrine.security).toBe(0.5);
  });

  it('skips when previousTurn is non-positive', () => {
    const factions = [makeFaction(1), makeFaction(2)];
    const proposals = [makeProposal(1, 1, 0, 'Military', 'approved')];
    const ctx = makeCtx(factions, [], proposals);

    applyDoctrineDrift(ctx, [1, 2], 0);

    const doctrine = JSON.parse(factions[0].doctrine_vector);
    expect(doctrine.security).toBe(0.5);
  });

  it('produces identical doctrine vectors regardless of proposal iteration order', () => {
    const proposalsForward = [
      makeProposal(1, 1, 3, 'Military', 'approved'),
      makeProposal(2, 1, 3, 'Science', 'approved'),
      makeProposal(3, 1, 3, 'Intelligence', 'approved'),
    ];
    const proposalsReverse = [...proposalsForward].reverse();

    const factionsA = [makeFaction(1), makeFaction(2)];
    const factionsB = [makeFaction(1), makeFaction(2)];

    const ctxA = makeCtx(factionsA, [], proposalsForward);
    const ctxB = makeCtx(factionsB, [], proposalsReverse);

    applyDoctrineDrift(ctxA, [1, 2], 3);
    applyDoctrineDrift(ctxB, [1, 2], 3);

    expect(factionsA[0].doctrine_vector).toBe(factionsB[0].doctrine_vector);
  });

  it('does not write to factions with no qualifying proposals', () => {
    const factions = [
      makeFaction(1, { doctrine_vector: '{"science":0.7}' }),
      makeFaction(2, { doctrine_vector: '{"science":0.3}' }),
    ];
    const proposals = [makeProposal(1, 1, 3, 'Science', 'approved')];
    const ctx = makeCtx(factions, [], proposals);

    applyDoctrineDrift(ctx, [1, 2], 3);

    expect(JSON.parse(factions[0].doctrine_vector).science).toBe(0.72);
    expect(JSON.parse(factions[1].doctrine_vector).science).toBe(0.3);
  });
});
