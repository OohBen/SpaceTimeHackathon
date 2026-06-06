import { Identity, Timestamp } from 'spacetimedb';

import { buildSlotIdentity } from './session_lifecycle.js';
import {
  attachNarrativeToCommanderInbox,
  type NarrativeAttachmentPayload,
} from './narrative_attachment.js';
import {
  TURN1_SEED_INSERT_ORDER,
  type Turn1SeedRows,
  type Turn1SeedBatch,
  type GameSessionRow,
  type FactionRow,
  type CelestialBodyRow,
  type CityRow,
  type PersonnelRow,
  type PersonnelRelationshipRow,
  type ProposalRow,
  type CommanderInboxRow,
  type FleetRow,
  type ColonyShipRow,
  type ProjectRow,
  type IntelligenceRecordRow,
  type EventRow,
  type TurnSummaryRow,
  type TradeAgreementRow,
  type LlmRequestRow,
} from './turn1_seed.js';

export type Turn8SeedRows = Turn1SeedRows;

export type Turn8SeedInput = {
  session_id?: number;
  player_a_identity?: string;
  player_b_identity?: string;
  player_a_faction_name?: string;
  player_b_faction_name?: string;
  created_at_micros?: bigint;
};

export const TURN8_SEED_INSERT_ORDER = TURN1_SEED_INSERT_ORDER;

const TURN8_YEAR = 2157;
const TURN8_TURN = 8;
const TURN1_YEAR = 2150;
const TURN1_TURN = 1;
const FACTION_A_ID = 1;
const FACTION_B_ID = 2;

export const TURN8_JUDGE_SCENARIO_DELTAS = {
  baseline_seed: 'turn1',
  scenario: 'mars_pressure_callisto_opportunity',
  turn_state: {
    current_year: { from: TURN1_YEAR, to: TURN8_YEAR, delta: TURN8_YEAR - TURN1_YEAR },
    current_turn: { from: TURN1_TURN, to: TURN8_TURN, delta: TURN8_TURN - TURN1_TURN },
    turn_phase: 'deliberation',
  },
  factions: {
    '1': {
      credits: { from: 1_200, to: 2_400, delta: 1_200 },
      political_capital: { from: 55, to: 72, delta: 17 },
      control_score: { from: 100, to: 140, delta: 40 },
    },
    '2': {
      credits: { from: 1_200, to: 1_950, delta: 750 },
      political_capital: { from: 55, to: 61, delta: 6 },
      control_score: { from: 100, to: 118, delta: 18 },
    },
  },
  cities: {
    'Pavonis Hub': {
      morale: { from: 72, to: 44, delta: -28 },
      industrial_output: { from: 180, to: 165, delta: -15 },
      garrison_strength: { from: 460, to: 680, delta: 220 },
      supply_status: { from: 'stable', to: 'strained' },
    },
    'Callisto Outpost': {
      baseline: 'absent',
      faction_id: FACTION_A_ID,
      population: 120_000,
      development_stage: 'establishment',
      supply_status: 'stable',
    },
  },
  fleets: {
    'New Geneva home guard': {
      faction_id: FACTION_A_ID,
      city: 'New Geneva',
      strength: { from: 420, to: 460, delta: 40 },
      orders: { from: 'home_guard', to: 'home_guard' },
    },
    'Pavonis perimeter defense': {
      faction_id: FACTION_B_ID,
      city: 'Pavonis Hub',
      strength: { from: 420, to: 580, delta: 160 },
      orders: { from: 'home_guard', to: 'perimeter_defense' },
    },
    'Callisto outpost guard': {
      baseline: 'absent',
      faction_id: FACTION_A_ID,
      city: 'Callisto Outpost',
      strength: 35,
      orders: 'outpost_guard',
    },
  },
  resources: {
    Mars: {
      deposits: { deuterium: 30, metals: 72, regolith: 88, water: 58 },
      pressure: { city: 'Pavonis Hub', supply_status: 'strained', garrison_strength: 680 },
    },
    Callisto: {
      deposits: { ice: 88, subsurface_metals: 55, volatiles: 74 },
      opportunity: { city: 'Callisto Outpost', development_stage: 'establishment' },
    },
  },
} as const;

const identityFromHex = (hex: string): Identity => {
  const normalized = hex.replace(/^0x/u, '').padStart(64, '0');
  return Identity.fromString(normalized);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
};

const stableJson = (value: unknown): string => JSON.stringify(stableValue(value));

function inboxNarrativePayload(
  sessionId: number,
  factionId: number,
  headline: string,
  prose: string
): NarrativeAttachmentPayload {
  return {
    authoritative: false,
    display_only: true,
    headline,
    metadata: {
      faction_id: factionId,
      privacy_scope: 'own_faction',
      session_id: sessionId,
      turn: TURN8_TURN,
    },
    prose,
    request_type: 'inbox',
    schema_version: 1,
    source: 'fixture',
    surface: 'inbox',
  };
}

function attachTurn8InboxNarratives(
  sessionId: number,
  rows: CommanderInboxRow[]
): CommanderInboxRow[] {
  const narrativeById: Record<number, { headline: string; prose: string }> = {
    1: {
      headline: 'Mars pressure, Callisto window',
      prose:
        'Command staff frames Turn 8 around the Mars pressure versus Callisto opportunity decision. Pavonis Hub is strained, while Callisto Outpost can turn ice and volatiles into durable leverage.',
    },
    2: {
      headline: 'Callisto survey window',
      prose:
        'The Callisto survey is the clean opportunity. Mars remains pressured around Pavonis Hub, so delaying the outer-system push gives the Compact room to contest the ice and volatiles window.',
    },
    3: {
      headline: 'Pavonis strain, Callisto opening',
      prose:
        'Pavonis Hub is strained under Mars pressure, but the larger decision is whether to spend this turn on relief or contest Callisto before Earth locks the opportunity.',
    },
    4: {
      headline: 'Escort choice at Callisto',
      prose:
        'Mars command sees the judge-facing tradeoff: stabilize Pavonis Hub now or escort a Callisto push while the ice and volatiles window is still open.',
    },
  };

  return rows.map((row) => {
    const narrative = narrativeById[row.id];
    if (!narrative) return row;
    return attachNarrativeToCommanderInbox(
      row,
      inboxNarrativePayload(sessionId, row.faction_id, narrative.headline, narrative.prose)
    );
  });
}

function buildSlotDoctrineVector(
  sessionId: number,
  slotKey: 'player_a' | 'player_b',
  slotName: string,
  placeholderPlayerId: Identity = buildSlotIdentity(sessionId, slotKey)
): string {
  return stableJson({
    expansion: slotKey === 'player_a' ? 0.7 : 0.5,
    security: slotKey === 'player_a' ? 0.4 : 0.6,
    slot: {
      schema_version: 1,
      lifecycle: 'session_slot',
      slot_key: slotKey,
      slot_index: slotKey === 'player_a' ? 1 : 2,
      slot_name: slotName,
      claim_status: 'claimable',
      join_reducer: 'join_or_resume_session',
      resume_key: 'session_id+player_slot',
      placeholder_player_id: placeholderPlayerId.toHexString(),
    },
  });
}

export function buildTurn8Seed(input: Turn8SeedInput = {}): Turn8SeedRows {
  const sessionId = input.session_id ?? 1;
  const createdAt = new Timestamp(input.created_at_micros ?? 0n);
  const playerAIdentity = identityFromHex(input.player_a_identity ?? buildSlotIdentity(sessionId, 'player_a').toHexString());
  const playerBIdentity = identityFromHex(input.player_b_identity ?? buildSlotIdentity(sessionId, 'player_b').toHexString());
  const playerAName = input.player_a_faction_name ?? 'United Earth Authority';
  const playerBName = input.player_b_faction_name ?? 'Mars Congressional Compact';

  const game_sessions: GameSessionRow[] = [
    {
      id: sessionId,
      state: 'active',
      current_year: TURN8_YEAR,
      current_turn: TURN8_TURN,
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
      credits: 2_400,
      political_capital: 72,
      doctrine_vector: buildSlotDoctrineVector(
        sessionId,
        'player_a',
        playerAName,
        playerAIdentity
      ),
      control_score: 140,
      ready_for_turn: false,
    },
    {
      id: FACTION_B_ID,
      session_id: sessionId,
      player_id: playerBIdentity,
      name: playerBName,
      credits: 1_950,
      political_capital: 61,
      doctrine_vector: buildSlotDoctrineVector(
        sessionId,
        'player_b',
        playerBName,
        playerBIdentity
      ),
      control_score: 118,
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
      population: 52_000_000n,
      infrastructure_level: 5,
      morale: 79,
      industrial_output: 245,
      research_output: 118,
      garrison_strength: 540,
      supply_status: 'stable',
      development_stage: 'full',
    },
    {
      id: 2,
      session_id: sessionId,
      body_id: 2,
      faction_id: FACTION_A_ID,
      name: 'Tycho Shipyards',
      population: 8_200_000n,
      infrastructure_level: 4,
      morale: 73,
      industrial_output: 185,
      research_output: 96,
      garrison_strength: 230,
      supply_status: 'stable',
      development_stage: 'maturation',
    },
    {
      id: 3,
      session_id: sessionId,
      body_id: 3,
      faction_id: FACTION_B_ID,
      name: 'Pavonis Hub',
      population: 19_500_000n,
      infrastructure_level: 4,
      morale: 44,
      industrial_output: 165,
      research_output: 78,
      garrison_strength: 680,
      supply_status: 'strained',
      development_stage: 'full',
    },
    {
      id: 4,
      session_id: sessionId,
      body_id: 6,
      faction_id: FACTION_A_ID,
      name: 'Callisto Outpost',
      population: 120_000n,
      infrastructure_level: 1,
      morale: 65,
      industrial_output: 22,
      research_output: 18,
      garrison_strength: 40,
      supply_status: 'stable',
      development_stage: 'establishment',
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
      competence: 84,
      creativity: 66,
      reliability: 90,
      ambition: 60,
      political_skill: 80,
      communication: 89,
      loyalty: 87,
      autonomy_tolerance: 46,
      morale: 72,
      burnout: 31,
      salary: 180,
    },
    {
      id: 2,
      faction_id: FACTION_A_ID,
      name: 'Marta Keane',
      role: 'Chief Scientist',
      department: 'Research',
      posting_city_id: 2,
      competence: 89,
      creativity: 92,
      reliability: 75,
      ambition: 68,
      political_skill: 54,
      communication: 71,
      loyalty: 78,
      autonomy_tolerance: 73,
      morale: 69,
      burnout: 38,
      salary: 170,
    },
    {
      id: 3,
      faction_id: FACTION_A_ID,
      name: 'Elias Okafor',
      role: 'Fleet Marshal',
      department: 'Defense',
      posting_city_id: 1,
      competence: 86,
      creativity: 60,
      reliability: 84,
      ambition: 73,
      political_skill: 63,
      communication: 75,
      loyalty: 82,
      autonomy_tolerance: 52,
      morale: 70,
      burnout: 34,
      salary: 175,
    },
    {
      id: 4,
      faction_id: FACTION_B_ID,
      name: 'Pavel Orlov',
      role: 'Chief of Staff',
      department: 'Executive',
      posting_city_id: 3,
      competence: 82,
      creativity: 63,
      reliability: 86,
      ambition: 75,
      political_skill: 83,
      communication: 82,
      loyalty: 83,
      autonomy_tolerance: 44,
      morale: 58,
      burnout: 42,
      salary: 180,
    },
    {
      id: 5,
      faction_id: FACTION_B_ID,
      name: 'Lin Qiao',
      role: 'Chief Scientist',
      department: 'Research',
      posting_city_id: 3,
      competence: 87,
      creativity: 89,
      reliability: 73,
      ambition: 71,
      political_skill: 56,
      communication: 74,
      loyalty: 76,
      autonomy_tolerance: 76,
      morale: 62,
      burnout: 44,
      salary: 170,
    },
    {
      id: 6,
      faction_id: FACTION_B_ID,
      name: 'Selene Varga',
      role: 'Mars Theater Commander',
      department: 'Defense',
      posting_city_id: 3,
      competence: 87,
      creativity: 65,
      reliability: 81,
      ambition: 80,
      political_skill: 66,
      communication: 78,
      loyalty: 78,
      autonomy_tolerance: 58,
      morale: 55,
      burnout: 48,
      salary: 175,
    },
  ];

  const personnel_relationships: PersonnelRelationshipRow[] = [
    { id: 1, personnel_a_id: 1, personnel_b_id: 2, type: 'trusted', strength: 38 },
    { id: 2, personnel_a_id: 1, personnel_b_id: 3, type: 'professional', strength: 30 },
    { id: 3, personnel_a_id: 4, personnel_b_id: 5, type: 'trusted', strength: 35 },
    { id: 4, personnel_a_id: 4, personnel_b_id: 6, type: 'strained', strength: 18 },
  ];

  const proposals: ProposalRow[] = [
    {
      id: 1,
      faction_id: FACTION_A_ID,
      turn: TURN8_TURN,
      proposing_personnel_id: 2,
      department: 'Research',
      title: 'Callisto subsurface survey',
      body: 'Deploy a dedicated science team to Callisto Outpost to begin subsurface ice-metal survey before rival claims.',
      resource_cost: 140,
      confidence: 'HIGH',
      status: 'unread',
      decision: undefined,
    },
    {
      id: 2,
      faction_id: FACTION_A_ID,
      turn: TURN8_TURN,
      proposing_personnel_id: 3,
      department: 'Defense',
      title: 'Reinforce Jupiter approach corridor',
      body: 'Assign patrol fleets to secure the transit corridor as colony ship nears Jupiter.',
      resource_cost: 180,
      confidence: 'MEDIUM',
      status: 'unread',
      decision: undefined,
    },
    {
      id: 3,
      faction_id: FACTION_B_ID,
      turn: TURN8_TURN,
      proposing_personnel_id: 6,
      department: 'Defense',
      title: 'Pavonis pressure and Callisto push',
      body: 'Pavonis Hub is under supply pressure, but a guarded Callisto push could contest the outer-system resource window before Earth consolidates it.',
      resource_cost: 160,
      confidence: 'HIGH',
      status: 'unread',
      decision: undefined,
    },
    {
      id: 4,
      faction_id: FACTION_B_ID,
      turn: TURN8_TURN,
      proposing_personnel_id: 5,
      department: 'Research',
      title: 'Counter-colonization analysis',
      body: 'Fund analysis on rival Callisto expansion; prepare diplomatic countermeasures or matched colonization plan.',
      resource_cost: 110,
      confidence: 'MEDIUM',
      status: 'unread',
      decision: undefined,
    },
  ];

  const commander_inbox: CommanderInboxRow[] = attachTurn8InboxNarratives(sessionId, [
    {
      id: 1,
      faction_id: FACTION_A_ID,
      turn: TURN8_TURN,
      from_personnel_id: 1,
      subject: 'Turn 8 command brief',
      body: 'Colony ship on schedule. Callisto Outpost operational. Two proposals require allocation.',
      requires_decision: false,
      status: 'unread',
    },
    {
      id: 2,
      faction_id: FACTION_A_ID,
      turn: TURN8_TURN,
      from_personnel_id: 2,
      subject: 'Callisto survey window',
      body: 'Science staff ready to deploy. Survey window opens this turn — delay risks rival pre-emption.',
      requires_decision: true,
      status: 'unread',
    },
    {
      id: 3,
      faction_id: FACTION_B_ID,
      turn: TURN8_TURN,
      from_personnel_id: 4,
      subject: 'Turn 8 command brief',
      body: 'Pavonis supply critical. Rival activity near Callisto confirmed. Two proposals awaiting decision.',
      requires_decision: false,
      status: 'unread',
    },
    {
      id: 4,
      faction_id: FACTION_B_ID,
      turn: TURN8_TURN,
      from_personnel_id: 6,
      subject: 'Pavonis pressure / Callisto window',
      body: 'Garrison morale is strained, but Callisto remains the attractive expansion target if command can spare escorts this turn.',
      requires_decision: true,
      status: 'unread',
    },
  ]);

  const fleets: FleetRow[] = [
    { id: 1, faction_id: FACTION_A_ID, posting_city_id: 1, strength: 460, orders: 'home_guard' },
    { id: 2, faction_id: FACTION_B_ID, posting_city_id: 3, strength: 580, orders: 'perimeter_defense' },
    { id: 3, faction_id: FACTION_A_ID, posting_city_id: 4, strength: 35, orders: 'outpost_guard' },
  ];

  const colony_ships: ColonyShipRow[] = [
    {
      id: 1,
      faction_id: FACTION_A_ID,
      origin_city_id: 1,
      destination_body_id: 5,
      manifest: stableJson({ population: 5_000, supplies: 200 }),
      departed_turn: 5,
      arrives_turn: 12,
      status: 'in_transit',
    },
  ];

  const projects: ProjectRow[] = [
    {
      id: 1,
      faction_id: FACTION_A_ID,
      city_id: 2,
      type: 'industry',
      name: 'Tycho fabrication expansion',
      progress: 80,
      resources_assigned: 150,
      est_completion: 9,
      status: 'active',
    },
    {
      id: 2,
      faction_id: FACTION_B_ID,
      city_id: 3,
      type: 'military',
      name: 'Orbital Defence Platform',
      progress: 45,
      resources_assigned: 120,
      est_completion: 11,
      status: 'active',
    },
  ];

  const intelligence_records: IntelligenceRecordRow[] = [
    {
      id: 1,
      observer_faction_id: FACTION_A_ID,
      target_faction_id: FACTION_B_ID,
      intel_type: 'contested_territory',
      value: stableJson({
        body: 'Mars',
        city: 'Pavonis Hub',
        fleet_strength: 580,
        garrison_strength: 680,
        morale: 44,
        pressure: 'supply_relief_required',
        supply_status: 'strained',
      }),
      accuracy: 82,
      acquired_turn: 7,
    },
    {
      id: 2,
      observer_faction_id: FACTION_B_ID,
      target_faction_id: FACTION_A_ID,
      intel_type: 'opportunity',
      value: stableJson({
        body: 'Callisto',
        city: 'Callisto Outpost',
        development_stage: 'establishment',
        note: 'Rival outpost established; subsurface survey likely imminent',
        resource_deposits: TURN8_JUDGE_SCENARIO_DELTAS.resources.Callisto.deposits,
      }),
      accuracy: 75,
      acquired_turn: 7,
    },
    {
      id: 3,
      observer_faction_id: FACTION_A_ID,
      target_faction_id: FACTION_B_ID,
      intel_type: 'opportunity',
      value: stableJson({
        body: 'Callisto',
        note: 'Rival has no Jupiter-system presence; window to consolidate',
        opportunity: 'outer_system_consolidation',
        resource_deposits: TURN8_JUDGE_SCENARIO_DELTAS.resources.Callisto.deposits,
      }),
      accuracy: 88,
      acquired_turn: 8,
    },
  ];

  const events: EventRow[] = [
    {
      id: 1,
      session_id: sessionId,
      faction_id: undefined,
      turn: 1,
      event_type: 'session_seeded',
      payload: stableJson({ seed: 'turn1', year: 2150, factions: [FACTION_A_ID, FACTION_B_ID] }),
    },
    {
      id: 2,
      session_id: sessionId,
      faction_id: FACTION_A_ID,
      turn: 5,
      event_type: 'colony_ship_departed',
      payload: stableJson({ ship_id: 1, origin_city_id: 1, destination_body_id: 5, arrives_turn: 12 }),
    },
    {
      id: 3,
      session_id: sessionId,
      faction_id: undefined,
      turn: TURN8_TURN,
      event_type: 'turn8_judge_scenario_seeded',
      payload: stableJson(TURN8_JUDGE_SCENARIO_DELTAS),
    },
    {
      id: 4,
      session_id: sessionId,
      faction_id: undefined,
      turn: TURN8_TURN,
      event_type: 'scenario_cue_mars_pressure',
      payload: stableJson({
        body: 'Mars',
        city: 'Pavonis Hub',
        cue: 'mars_pressure',
        label: 'Mars pressure: Pavonis Hub strained supply',
        severity: 'warning',
        source: 'turn8_judge_scenario',
        surface: 'map_detail',
      }),
    },
    {
      id: 5,
      session_id: sessionId,
      faction_id: undefined,
      turn: TURN8_TURN,
      event_type: 'scenario_cue_callisto_opportunity',
      payload: stableJson({
        body: 'Callisto',
        city: 'Callisto Outpost',
        cue: 'callisto_opportunity',
        label: 'Callisto opportunity: ice and volatiles window',
        severity: 'info',
        source: 'turn8_judge_scenario',
        surface: 'map_detail',
      }),
    },
    {
      id: 6,
      session_id: sessionId,
      faction_id: undefined,
      turn: TURN8_TURN,
      event_type: 'turn_opened',
      payload: stableJson({ phase: 'deliberation', proposal_count: proposals.length }),
    },
  ];

  const trade_agreements: TradeAgreementRow[] = [
    {
      id: 1,
      session_id: sessionId,
      faction_a_id: FACTION_A_ID,
      faction_b_id: FACTION_B_ID,
      terms: stableJson({ resource: 'water', rate: 15, direction: 'a_to_b' }),
      signed_turn: 3,
      expires_turn: 10,
    },
  ];

  const turn_summaries: TurnSummaryRow[] = [];

  const llm_requests: LlmRequestRow[] = [
    {
      id: 1,
      session_id: sessionId,
      faction_id: FACTION_A_ID,
      request_type: 'proposals',
      context_json: stableJson({
        body_ids: [1, 2, 3, 4, 5, 6],
        city_ids: [1, 2, 4],
        faction_id: FACTION_A_ID,
        personnel_ids: [1, 2, 3],
        proposal_ids: [1, 2],
        turn: TURN8_TURN,
      }),
      status: 'completed',
      response_json: stableJson({ proposal_ids: [1, 2], source: 'deterministic_fixture' }),
      error: undefined,
      error_code: undefined,
      attempt_count: 0,
      created_turn: TURN8_TURN,
      updated_turn: TURN8_TURN,
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
        turn: TURN8_TURN,
      }),
      status: 'completed',
      response_json: stableJson({ proposal_ids: [3, 4], source: 'deterministic_fixture' }),
      error: undefined,
      error_code: undefined,
      attempt_count: 0,
      created_turn: TURN8_TURN,
      updated_turn: TURN8_TURN,
    },
    {
      id: 3,
      session_id: sessionId,
      faction_id: FACTION_A_ID,
      request_type: 'inbox',
      context_json: stableJson({
        commander_inbox_ids: [1, 2],
        faction_id: FACTION_A_ID,
        scenario_cues: ['mars_pressure', 'callisto_opportunity'],
        scenario_id: 'turn-8-judge',
        surface: 'inbox',
        turn: TURN8_TURN,
      }),
      status: 'completed',
      response_json: stableJson({
        commander_inbox_ids: [1, 2],
        source: 'deterministic_fixture',
      }),
      error: undefined,
      error_code: undefined,
      attempt_count: 0,
      created_turn: TURN8_TURN,
      updated_turn: TURN8_TURN,
    },
    {
      id: 4,
      session_id: sessionId,
      faction_id: FACTION_B_ID,
      request_type: 'inbox',
      context_json: stableJson({
        commander_inbox_ids: [3, 4],
        faction_id: FACTION_B_ID,
        scenario_cues: ['mars_pressure', 'callisto_opportunity'],
        scenario_id: 'turn-8-judge',
        surface: 'inbox',
        turn: TURN8_TURN,
      }),
      status: 'completed',
      response_json: stableJson({
        commander_inbox_ids: [3, 4],
        source: 'deterministic_fixture',
      }),
      error: undefined,
      error_code: undefined,
      attempt_count: 0,
      created_turn: TURN8_TURN,
      updated_turn: TURN8_TURN,
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
    turn_summaries,
    trade_agreements,
    llm_requests,
    module_settings: [],
  };
}

export function getTurn8SeedInsertPlan(seed: Turn8SeedRows = turn8Seed): Turn1SeedBatch[] {
  return TURN8_SEED_INSERT_ORDER.map((table) => ({ table, rows: seed[table] }));
}

export const turn8Seed: Turn8SeedRows = buildTurn8Seed();
