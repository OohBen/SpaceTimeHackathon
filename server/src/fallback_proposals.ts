import type {
  CityRow,
  FactionRow,
  GameSessionRow,
  PersonnelRow,
  ProposalRow,
} from './turn1_seed.js';

export type FallbackProposalInput = {
  session: GameSessionRow;
  faction: FactionRow;
  personnel: readonly PersonnelRow[];
  cities: readonly CityRow[];
  existingProposals?: readonly ProposalRow[];
  count?: number;
};

type ProposalCandidate = {
  city: CityRow;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  department: string;
  effect: string;
  officer: PersonnelRow;
  priority: number;
  recommendation: string;
  resourceCost: number;
  title: string;
};

export function generateFallbackProposals(input: FallbackProposalInput): ProposalRow[] {
  const count = Math.max(0, input.count ?? 2);
  const cities = stableSort(
    input.cities.filter((city) => city.faction_id === input.faction.id),
    cityKey
  );
  const personnel = stableSort(
    input.personnel.filter((person) => person.faction_id === input.faction.id),
    personnelKey
  );

  if (count === 0 || cities.length === 0 || personnel.length === 0) {
    return [];
  }

  const existingTitles = new Set(
    (input.existingProposals ?? [])
      .filter((proposal) => proposal.faction_id === input.faction.id)
      .map((proposal) => proposal.title)
  );

  return buildCandidates(input, cities, personnel)
    .filter((candidate) => !existingTitles.has(candidate.title))
    .slice(0, count)
    .map((candidate) => candidateToProposal(input, candidate));
}

function buildCandidates(
  input: FallbackProposalInput,
  cities: readonly CityRow[],
  personnel: readonly PersonnelRow[]
): ProposalCandidate[] {
  const candidates = cities.flatMap((city) => [
    buildLogisticsCandidate(input, city, selectOfficer(personnel, 'Executive')),
    buildIndustryCandidate(input, city, selectOfficer(personnel, 'Executive')),
    buildResearchCandidate(input, city, selectOfficer(personnel, 'Research')),
    buildSecurityCandidate(input, city, selectOfficer(personnel, 'Defense')),
  ]);

  return stableSort(candidates, (candidate) => [
    -candidate.priority,
    candidate.city.id,
    candidate.department,
    candidate.officer.id,
    candidate.title,
  ]);
}

function buildLogisticsCandidate(
  input: FallbackProposalInput,
  city: CityRow,
  officer: PersonnelRow
): ProposalCandidate {
  const unstableSupply = city.supply_status === 'strained' || city.supply_status === 'critical';
  const moraleGap = Math.max(0, 75 - city.morale);
  const priority = 70 + moraleGap + (unstableSupply ? 35 : 0) + stableTieBreak(input, city, officer);
  return {
    city,
    confidence: confidenceFrom(city.morale + officer.reliability - officer.burnout),
    department: officer.department,
    effect: `Improve ${city.name} supply resilience and raise morale before turn pressure compounds.`,
    officer,
    priority,
    recommendation: `Stabilize ${city.supply_status} logistics through emergency maintenance and ration smoothing.`,
    resourceCost: boundedCost(input.faction.credits, 70 + moraleGap),
    title: `${city.name} Logistics Stabilization`,
  };
}

function buildIndustryCandidate(
  input: FallbackProposalInput,
  city: CityRow,
  officer: PersonnelRow
): ProposalCandidate {
  const priority =
    55 +
    city.industrial_output +
    city.infrastructure_level * 8 +
    Math.max(0, officer.competence - 60) +
    stableTieBreak(input, city, officer);
  return {
    city,
    confidence: confidenceFrom(city.infrastructure_level * 20 + officer.competence),
    department: officer.department,
    effect: `Increase ${city.name} industrial throughput for future fleets, ships, and infrastructure.`,
    officer,
    priority,
    recommendation: 'Convert idle capacity into a focused fabrication and logistics package.',
    resourceCost: boundedCost(input.faction.credits, 85 + city.infrastructure_level * 15),
    title: `${city.name} Industrial Surge`,
  };
}

function buildResearchCandidate(
  input: FallbackProposalInput,
  city: CityRow,
  officer: PersonnelRow
): ProposalCandidate {
  const priority =
    45 +
    city.research_output +
    Math.max(0, officer.creativity - 50) +
    Math.max(0, input.faction.political_capital - 40) +
    stableTieBreak(input, city, officer);
  return {
    city,
    confidence: confidenceFrom(city.research_output + officer.creativity + officer.communication),
    department: officer.department,
    effect: `Turn ${city.name} research capacity into near-term proposal options without model dependency.`,
    officer,
    priority,
    recommendation: 'Fund a bounded research sprint with milestone reports and commander review gates.',
    resourceCost: boundedCost(input.faction.credits, 75 + Math.floor(city.research_output / 2)),
    title: `${city.name} Applied Research Sprint`,
  };
}

function buildSecurityCandidate(
  input: FallbackProposalInput,
  city: CityRow,
  officer: PersonnelRow
): ProposalCandidate {
  const garrisonGap = Math.max(0, 80 - city.garrison_strength);
  const priority =
    50 +
    garrisonGap +
    Math.max(0, officer.reliability - officer.burnout) +
    stableTieBreak(input, city, officer);
  return {
    city,
    confidence: confidenceFrom(city.garrison_strength + officer.reliability),
    department: officer.department,
    effect: `Reduce operational risk around ${city.name} while preserving the faction turn plan.`,
    officer,
    priority,
    recommendation: 'Rebalance patrol coverage, reserve drills, and depot hardening.',
    resourceCost: boundedCost(input.faction.credits, 65 + garrisonGap),
    title: `${city.name} Security Readiness Drill`,
  };
}

function candidateToProposal(
  input: FallbackProposalInput,
  candidate: ProposalCandidate
): ProposalRow {
  return {
    id: 0,
    faction_id: input.faction.id,
    turn: input.session.current_turn,
    proposing_personnel_id: candidate.officer.id,
    department: candidate.department,
    title: candidate.title,
    body: [
      `${candidate.officer.name} submits a fallback proposal for ${input.faction.name}.`,
      `Recommendation: ${candidate.recommendation}`,
      `Expected effect: ${candidate.effect}`,
      `Cost: ${candidate.resourceCost} credits. Confidence: ${candidate.confidence}.`,
    ].join(' '),
    resource_cost: candidate.resourceCost,
    confidence: candidate.confidence,
    status: 'unread',
    decision: undefined,
  };
}

function selectOfficer(
  personnel: readonly PersonnelRow[],
  preferredDepartment: string
): PersonnelRow {
  const preferred = personnel.filter((person) => person.department === preferredDepartment);
  const pool = preferred.length > 0 ? preferred : personnel;
  return stableSort(pool, (person) => [
    -(person.competence + person.reliability + person.communication - person.burnout),
    person.id,
    person.name,
  ])[0];
}

function boundedCost(credits: number, desired: number): number {
  const ceiling = Math.max(40, Math.floor(credits * 0.35));
  return Math.max(40, Math.min(ceiling, desired));
}

function confidenceFrom(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 160) return 'HIGH';
  if (score >= 110) return 'MEDIUM';
  return 'LOW';
}

function stableTieBreak(
  input: FallbackProposalInput,
  city: CityRow,
  officer: PersonnelRow
): number {
  return stableHash([
    input.session.id,
    input.session.current_turn,
    input.faction.id,
    city.id,
    officer.id,
  ]) % 10;
}

function stableHash(parts: readonly (number | string)[]): number {
  let hash = 2166136261;
  for (const part of parts.join('|')) {
    hash ^= part.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableSort<T>(
  values: readonly T[],
  keyFn: (value: T) => readonly (number | string)[]
): T[] {
  return [...values].sort((left, right) => compareKeys(keyFn(left), keyFn(right)));
}

function compareKeys(
  left: readonly (number | string)[],
  right: readonly (number | string)[]
): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    if (leftValue === rightValue) continue;
    if (leftValue === undefined) return -1;
    if (rightValue === undefined) return 1;
    return leftValue < rightValue ? -1 : 1;
  }
  return 0;
}

const cityKey = (city: CityRow): readonly (number | string)[] => [
  city.faction_id,
  city.id,
  city.name,
];

const personnelKey = (person: PersonnelRow): readonly (number | string)[] => [
  person.faction_id,
  person.id,
  person.name,
];
