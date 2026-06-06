import { Identity, Timestamp } from 'spacetimedb';

export type GameSessionRow = {
  id: number;
  state: string;
  current_year: number;
  current_turn: number;
  player_a_faction_id: number | undefined;
  player_b_faction_id: number | undefined;
  turn_phase: string;
  turn_deadline: Timestamp | undefined;
  winner_faction_id: number | undefined;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type FactionRow = {
  id: number;
  session_id: number;
  player_id: Identity;
  name: string;
  credits: number;
  political_capital: number;
  doctrine_vector: string;
  control_score: number;
  ready_for_turn: boolean;
};

export type CelestialBodyRow = {
  id: number;
  session_id: number;
  name: string;
  system_tier: string;
  comms_lag_turns: number;
  travel_time_turns: number;
  resource_deposits: string;
  position: string;
};

export type CityRow = {
  id: number;
  session_id: number;
  body_id: number;
  faction_id: number;
  name: string;
  population: bigint;
  infrastructure_level: number;
  morale: number;
  industrial_output: number;
  research_output: number;
  garrison_strength: number;
  supply_status: string;
  development_stage: string;
};

export type PersonnelRow = {
  id: number;
  faction_id: number;
  name: string;
  role: string;
  department: string;
  posting_city_id: number | undefined;
  competence: number;
  creativity: number;
  reliability: number;
  ambition: number;
  political_skill: number;
  communication: number;
  loyalty: number;
  autonomy_tolerance: number;
  morale: number;
  burnout: number;
  salary: number;
};

export type PersonnelRelationshipRow = {
  id: number;
  personnel_a_id: number;
  personnel_b_id: number;
  type: string;
  strength: number;
};

export type ProposalRow = {
  id: number;
  faction_id: number;
  turn: number;
  proposing_personnel_id: number;
  department: string;
  title: string;
  body: string;
  resource_cost: number;
  confidence: string;
  status: string;
  decision: string | undefined;
};

export type CommanderInboxRow = {
  id: number;
  faction_id: number;
  turn: number;
  from_personnel_id: number;
  subject: string;
  body: string;
  requires_decision: boolean;
  status: string;
};

export type FleetRow = {
  id: number;
  faction_id: number;
  posting_city_id: number;
  strength: number;
  orders: string | undefined;
};

export type ColonyShipRow = {
  id: number;
  faction_id: number;
  origin_city_id: number;
  destination_body_id: number;
  manifest: string;
  departed_turn: number;
  arrives_turn: number;
  status: string;
};

export type ProjectRow = {
  id: number;
  faction_id: number;
  city_id: number;
  type: string;
  name: string;
  progress: number;
  resources_assigned: number;
  est_completion: number;
  status: string;
};

export type IntelligenceRecordRow = {
  id: number;
  observer_faction_id: number;
  target_faction_id: number;
  intel_type: string;
  value: string;
  accuracy: number;
  acquired_turn: number;
};

export type EventRow = {
  id: number;
  session_id: number;
  faction_id: number | undefined;
  turn: number;
  event_type: string;
  payload: string;
};

export type TradeAgreementRow = {
  id: number;
  session_id: number;
  faction_a_id: number;
  faction_b_id: number;
  terms: string;
  signed_turn: number;
  expires_turn: number | undefined;
};

export type LlmRequestRow = {
  id: number;
  session_id: number;
  faction_id: number;
  request_type: string;
  context_json: string;
  status: string;
  response_json: string | undefined;
  error: string | undefined;
  created_turn: number;
};

export type Turn1SeedRows = {
  game_sessions: GameSessionRow[];
  factions: FactionRow[];
  celestial_bodies: CelestialBodyRow[];
  cities: CityRow[];
  personnel: PersonnelRow[];
  personnel_relationships: PersonnelRelationshipRow[];
  proposals: ProposalRow[];
  commander_inbox: CommanderInboxRow[];
  fleets: FleetRow[];
  colony_ships: ColonyShipRow[];
  projects: ProjectRow[];
  intelligence_records: IntelligenceRecordRow[];
  events: EventRow[];
  trade_agreements: TradeAgreementRow[];
  llm_requests: LlmRequestRow[];
};

export type Turn1SeedInput = {
  session_id?: number;
  player_a_identity?: string;
  player_b_identity?: string;
  player_a_faction_name?: string;
  player_b_faction_name?: string;
  created_at_micros?: bigint;
};

export type Turn1SeedTableName = keyof Turn1SeedRows;

export type Turn1SeedBatch = {
  table: Turn1SeedTableName;
  rows: Turn1SeedRows[Turn1SeedTableName];
};

export const TURN1_SEED_INSERT_ORDER = [
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
  'trade_agreements',
  'llm_requests',
] as const satisfies readonly Turn1SeedTableName[];

const TURN1_YEAR = 2150;
const TURN1_TURN = 1;
const FACTION_A_ID = 1;
const FACTION_B_ID = 2;

const identityFromHex = (hex: string): Identity => {
  const normalized = hex.replace(/^0x/u, '').padStart(64, '0');
  return Identity.fromString(normalized);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
};

const stableJson = (value: unknown): string => JSON.stringify(stableValue(value));

export function buildTurn1Seed(input: Turn1SeedInput = {}): Turn1SeedRows {
  const sessionId = input.session_id ?? 1;
  const createdAt = new Timestamp(input.created_at_micros ?? 0n);
  const playerAIdentity = identityFromHex(input.player_a_identity ?? 'a1');
  const playerBIdentity = identityFromHex(input.player_b_identity ?? 'b2');
  const playerAName = input.player_a_faction_name ?? 'United Earth Authority';
  const playerBName = input.player_b_faction_name ?? 'Mars Congressional Compact';

  const game_sessions: GameSessionRow[] = [
    {
      id: sessionId,
      state: 'active',
      current_year: TURN1_YEAR,
      current_turn: TURN1_TURN,
      player_a_faction_id: FACTION_A_ID,
      player_b_faction_id: FACTION_B_ID,
      turn_phase: 'deliberation',
      turn_deadline: undefined,
      winner_faction_id: undefined,
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const factions: FactionRow[] = [
    {
      id: FACTION_A_ID,
      session_id: sessionId,
      player_id: playerAIdentity,
      name: playerAName,
      credits: 1_200,
      political_capital: 55,
      doctrine_vector: stableJson({ diplomacy: 0.45, expansion: 0.6, science: 0.55, security: 0.5 }),
      control_score: 100,
      ready_for_turn: false,
    },
    {
      id: FACTION_B_ID,
      session_id: sessionId,
      player_id: playerBIdentity,
      name: playerBName,
      credits: 1_200,
      political_capital: 55,
      doctrine_vector: stableJson({ diplomacy: 0.4, expansion: 0.55, science: 0.45, security: 0.65 }),
      control_score: 100,
      ready_for_turn: false,
    },
  ];

  const celestial_bodies: CelestialBodyRow[] = [
    {
      id: 1,
      session_id: sessionId,
      name: 'Earth',
      system_tier: 'earth',
      comms_lag_turns: 0,
      travel_time_turns: 0,
      resource_deposits: stableJson({ biosphere: 90, industry: 80, metals: 45, water: 95 }),
      position: stableJson({ x: 0, y: 0 }),
    },
    {
      id: 2,
      session_id: sessionId,
      name: 'Luna',
      system_tier: 'earth',
      comms_lag_turns: 0,
      travel_time_turns: 1,
      resource_deposits: stableJson({ helium3: 70, metals: 62, water: 25 }),
      position: stableJson({ x: 1, y: 0 }),
    },
    {
      id: 3,
      session_id: sessionId,
      name: 'Mars',
      system_tier: 'inner',
      comms_lag_turns: 1,
      travel_time_turns: 3,
      resource_deposits: stableJson({ deuterium: 30, metals: 72, regolith: 88, water: 58 }),
      position: stableJson({ x: 4, y: 1 }),
    },
    {
      id: 4,
      session_id: sessionId,
      name: 'Asteroid Belt',
      system_tier: 'belt',
      comms_lag_turns: 2,
      travel_time_turns: 5,
      resource_deposits: stableJson({ volatiles: 35, rare_metals: 90, structural_metals: 95 }),
      position: stableJson({ x: 7, y: 2 }),
    },
    {
      id: 5,
      session_id: sessionId,
      name: 'Jupiter',
      system_tier: 'jupiter',
      comms_lag_turns: 3,
      travel_time_turns: 8,
      resource_deposits: stableJson({ fusion_fuels: 95, storm_energy: 80 }),
      position: stableJson({ x: 12, y: -2 }),
    },
    {
      id: 6,
      session_id: sessionId,
      name: 'Callisto',
      system_tier: 'jupiter',
      comms_lag_turns: 3,
      travel_time_turns: 9,
      resource_deposits: stableJson({ ice: 88, subsurface_metals: 55, volatiles: 74 }),
      position: stableJson({ x: 13, y: -1 }),
    },
  ];

  const cities: CityRow[] = [
    {
      id: 1,
      session_id: sessionId,
      body_id: 1,
      faction_id: FACTION_A_ID,
      name: 'New Geneva',
      population: 50_000_000n,
      infrastructure_level: 5,
      morale: 74,
      industrial_output: 220,
      research_output: 105,
      garrison_strength: 520,
      supply_status: 'stable',
      development_stage: 'full',
    },
    {
      id: 2,
      session_id: sessionId,
      body_id: 2,
      faction_id: FACTION_A_ID,
      name: 'Tycho Shipyards',
      population: 7_500_000n,
      infrastructure_level: 3,
      morale: 68,
      industrial_output: 145,
      research_output: 80,
      garrison_strength: 210,
      supply_status: 'stable',
      development_stage: 'maturation',
    },
    {
      id: 3,
      session_id: sessionId,
      body_id: 3,
      faction_id: FACTION_B_ID,
      name: 'Pavonis Hub',
      population: 18_000_000n,
      infrastructure_level: 4,
      morale: 72,
      industrial_output: 180,
      research_output: 85,
      garrison_strength: 460,
      supply_status: 'stable',
      development_stage: 'full',
    },
  ];

  const personnel: PersonnelRow[] = [
    {
      id: 1,
      faction_id: FACTION_A_ID,
      name: 'Amina Rao',
      role: 'Chief of Staff',
      department: 'Executive',
      posting_city_id: 1,
      competence: 82,
      creativity: 64,
      reliability: 91,
      ambition: 58,
      political_skill: 78,
      communication: 88,
      loyalty: 86,
      autonomy_tolerance: 45,
      morale: 80,
      burnout: 12,
      salary: 180,
    },
    {
      id: 2,
      faction_id: FACTION_A_ID,
      name: 'Marta Keane',
      role: 'Chief Scientist',
      department: 'Research',
      posting_city_id: 2,
      competence: 87,
      creativity: 91,
      reliability: 74,
      ambition: 66,
      political_skill: 52,
      communication: 70,
      loyalty: 79,
      autonomy_tolerance: 72,
      morale: 76,
      burnout: 18,
      salary: 170,
    },
    {
      id: 3,
      faction_id: FACTION_A_ID,
      name: 'Elias Okafor',
      role: 'Fleet Marshal',
      department: 'Defense',
      posting_city_id: 1,
      competence: 84,
      creativity: 58,
      reliability: 83,
      ambition: 71,
      political_skill: 61,
      communication: 74,
      loyalty: 81,
      autonomy_tolerance: 50,
      morale: 78,
      burnout: 16,
      salary: 175,
    },
    {
      id: 4,
      faction_id: FACTION_B_ID,
      name: 'Pavel Orlov',
      role: 'Chief of Staff',
      department: 'Executive',
      posting_city_id: 3,
      competence: 80,
      creativity: 61,
      reliability: 88,
      ambition: 73,
      political_skill: 82,
      communication: 81,
      loyalty: 84,
      autonomy_tolerance: 42,
      morale: 79,
      burnout: 14,
      salary: 180,
    },
    {
      id: 5,
      faction_id: FACTION_B_ID,
      name: 'Lin Qiao',
      role: 'Chief Scientist',
      department: 'Research',
      posting_city_id: 3,
      competence: 86,
      creativity: 88,
      reliability: 72,
      ambition: 69,
      political_skill: 55,
      communication: 73,
      loyalty: 77,
      autonomy_tolerance: 75,
      morale: 75,
      burnout: 20,
      salary: 170,
    },
    {
      id: 6,
      faction_id: FACTION_B_ID,
      name: 'Selene Varga',
      role: 'Mars Theater Commander',
      department: 'Defense',
      posting_city_id: 3,
      competence: 85,
      creativity: 63,
      reliability: 80,
      ambition: 78,
      political_skill: 64,
      communication: 77,
      loyalty: 79,
      autonomy_tolerance: 57,
      morale: 77,
      burnout: 17,
      salary: 175,
    },
  ];

  const personnel_relationships: PersonnelRelationshipRow[] = [
    { id: 1, personnel_a_id: 1, personnel_b_id: 2, type: 'trusted', strength: 32 },
    { id: 2, personnel_a_id: 1, personnel_b_id: 3, type: 'professional', strength: 24 },
    { id: 3, personnel_a_id: 4, personnel_b_id: 5, type: 'trusted', strength: 29 },
    { id: 4, personnel_a_id: 4, personnel_b_id: 6, type: 'professional', strength: 27 },
  ];

  const proposals: ProposalRow[] = [
    {
      id: 1,
      faction_id: FACTION_A_ID,
      turn: TURN1_TURN,
      proposing_personnel_id: 2,
      department: 'Research',
      title: 'Expand Tycho shipyard automation',
      body: 'Fund lunar fabrication automation so Turn 2 colony ship construction has a stronger industrial base.',
      resource_cost: 120,
      confidence: 'HIGH',
      status: 'unread',
      decision: undefined,
    },
    {
      id: 2,
      faction_id: FACTION_A_ID,
      turn: TURN1_TURN,
      proposing_personnel_id: 1,
      department: 'Executive',
      title: 'Charter asteroid prospecting office',
      body: 'Stand up a planning office for Asteroid Belt surveys before rivals lock up high-grade mineral claims.',
      resource_cost: 80,
      confidence: 'MEDIUM',
      status: 'unread',
      decision: undefined,
    },
    {
      id: 3,
      faction_id: FACTION_B_ID,
      turn: TURN1_TURN,
      proposing_personnel_id: 6,
      department: 'Defense',
      title: 'Harden Pavonis orbital lanes',
      body: 'Assign defense crews to Mars orbital traffic control to protect early outbound convoys.',
      resource_cost: 110,
      confidence: 'HIGH',
      status: 'unread',
      decision: undefined,
    },
    {
      id: 4,
      faction_id: FACTION_B_ID,
      turn: TURN1_TURN,
      proposing_personnel_id: 5,
      department: 'Research',
      title: 'Prepare Callisto reconnaissance package',
      body: 'Reserve science staff for a Callisto survey package that can launch once outer-system logistics mature.',
      resource_cost: 90,
      confidence: 'MEDIUM',
      status: 'unread',
      decision: undefined,
    },
  ];

  const commander_inbox: CommanderInboxRow[] = [
    {
      id: 1,
      faction_id: FACTION_A_ID,
      turn: TURN1_TURN,
      from_personnel_id: 1,
      subject: 'Turn 1 command brief',
      body: 'New Geneva and Tycho are stable. Two proposals are ready for allocation.',
      requires_decision: false,
      status: 'unread',
    },
    {
      id: 2,
      faction_id: FACTION_A_ID,
      turn: TURN1_TURN,
      from_personnel_id: 2,
      subject: 'Tycho automation proposal',
      body: 'Research recommends a focused shipyard automation package before the first colony-ship cycle.',
      requires_decision: true,
      status: 'unread',
    },
    {
      id: 3,
      faction_id: FACTION_B_ID,
      turn: TURN1_TURN,
      from_personnel_id: 4,
      subject: 'Turn 1 command brief',
      body: 'Pavonis is stable. Defense and research proposals are ready for allocation.',
      requires_decision: false,
      status: 'unread',
    },
    {
      id: 4,
      faction_id: FACTION_B_ID,
      turn: TURN1_TURN,
      from_personnel_id: 6,
      subject: 'Pavonis lane hardening proposal',
      body: 'Theater command recommends early orbital-lane hardening to secure outbound logistics.',
      requires_decision: true,
      status: 'unread',
    },
  ];

  const fleets: FleetRow[] = [
    { id: 1, faction_id: FACTION_A_ID, posting_city_id: 1, strength: 420, orders: 'home_guard' },
    { id: 2, faction_id: FACTION_B_ID, posting_city_id: 3, strength: 420, orders: 'home_guard' },
  ];

  const colony_ships: ColonyShipRow[] = [];

  const projects: ProjectRow[] = [
    {
      id: 1,
      faction_id: FACTION_A_ID,
      city_id: 2,
      type: 'industry',
      name: 'Tycho fabrication baseline',
      progress: 0,
      resources_assigned: 0,
      est_completion: 4,
      status: 'proposed',
    },
    {
      id: 2,
      faction_id: FACTION_B_ID,
      city_id: 3,
      type: 'infrastructure',
      name: 'Pavonis orbital-lane baseline',
      progress: 0,
      resources_assigned: 0,
      est_completion: 4,
      status: 'proposed',
    },
  ];

  const intelligence_records: IntelligenceRecordRow[] = [
    {
      id: 1,
      observer_faction_id: FACTION_A_ID,
      target_faction_id: FACTION_B_ID,
      intel_type: 'public_map',
      value: stableJson({ known_cities: ['Pavonis Hub'], visible_bodies: ['Earth', 'Luna', 'Mars'] }),
      accuracy: 70,
      acquired_turn: TURN1_TURN,
    },
    {
      id: 2,
      observer_faction_id: FACTION_B_ID,
      target_faction_id: FACTION_A_ID,
      intel_type: 'public_map',
      value: stableJson({ known_cities: ['New Geneva', 'Tycho Shipyards'], visible_bodies: ['Earth', 'Luna', 'Mars'] }),
      accuracy: 70,
      acquired_turn: TURN1_TURN,
    },
  ];

  const events: EventRow[] = [
    {
      id: 1,
      session_id: sessionId,
      faction_id: undefined,
      turn: TURN1_TURN,
      event_type: 'session_seeded',
      payload: stableJson({ seed: 'turn1', year: TURN1_YEAR, factions: [FACTION_A_ID, FACTION_B_ID] }),
    },
    {
      id: 2,
      session_id: sessionId,
      faction_id: undefined,
      turn: TURN1_TURN,
      event_type: 'turn_opened',
      payload: stableJson({ phase: 'deliberation', proposal_count: proposals.length }),
    },
  ];

  const trade_agreements: TradeAgreementRow[] = [];

  const llm_requests: LlmRequestRow[] = [
    {
      id: 1,
      session_id: sessionId,
      faction_id: FACTION_A_ID,
      request_type: 'proposals',
      context_json: stableJson({
        body_ids: [1, 2, 3, 4, 5, 6],
        city_ids: [1, 2],
        faction_id: FACTION_A_ID,
        personnel_ids: [1, 2, 3],
        proposal_ids: [1, 2],
        turn: TURN1_TURN,
      }),
      status: 'complete',
      response_json: stableJson({ proposal_ids: [1, 2], source: 'deterministic_fixture' }),
      error: undefined,
      created_turn: TURN1_TURN,
    },
    {
      id: 2,
      session_id: sessionId,
      faction_id: FACTION_B_ID,
      request_type: 'proposals',
      context_json: stableJson({
        body_ids: [1, 2, 3, 4, 5, 6],
        city_ids: [3],
        faction_id: FACTION_B_ID,
        personnel_ids: [4, 5, 6],
        proposal_ids: [3, 4],
        turn: TURN1_TURN,
      }),
      status: 'complete',
      response_json: stableJson({ proposal_ids: [3, 4], source: 'deterministic_fixture' }),
      error: undefined,
      created_turn: TURN1_TURN,
    },
  ];

  return {
    game_sessions,
    factions,
    celestial_bodies,
    cities,
    personnel,
    personnel_relationships,
    proposals,
    commander_inbox,
    fleets,
    colony_ships,
    projects,
    intelligence_records,
    events,
    trade_agreements,
    llm_requests,
  };
}

export function getTurn1SeedInsertPlan(seed: Turn1SeedRows = turn1Seed): Turn1SeedBatch[] {
  return TURN1_SEED_INSERT_ORDER.map((table) => ({ table, rows: seed[table] }));
}

export const turn1Seed = buildTurn1Seed();
