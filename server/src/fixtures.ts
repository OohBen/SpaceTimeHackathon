// Deterministic fixture shapes for Turn 1 (new game) and Turn 8 (mid-game scenario).
// Used to validate that the authoritative schema can represent both states without hacks.

export const turn1Session = {
  id: 1,
  state: 'setup',
  current_year: 2150,
  current_turn: 1,
  player_a_faction_id: undefined,
  player_b_faction_id: undefined,
  turn_phase: 'world_update',
  turn_deadline: undefined,
  winner_faction_id: undefined,
  created_at: BigInt(0),
  updated_at: BigInt(0),
} as const;

export const turn8Session = {
  id: 1,
  state: 'active',
  current_year: 2157,
  current_turn: 8,
  player_a_faction_id: 1,
  player_b_faction_id: 2,
  turn_phase: 'deliberation',
  turn_deadline: undefined,
  winner_faction_id: undefined,
  created_at: BigInt(0),
  updated_at: BigInt(0),
} as const;

export const turn1Faction = {
  id: 1,
  session_id: 1,
  name: 'United Earth Authority',
  credits: 1000,
  political_capital: 50,
  doctrine_vector: '{"expansion":0.5,"security":0.5}',
  control_score: 100,
  ready_for_turn: false,
} as const;

export const turn8Faction = {
  id: 1,
  session_id: 1,
  name: 'United Earth Authority',
  credits: 2400,
  political_capital: 72,
  doctrine_vector: '{"expansion":0.7,"security":0.3}',
  control_score: 140,
  ready_for_turn: false,
} as const;

export const turn1CelestialBody = {
  id: 1,
  session_id: 1,
  name: 'Earth',
  system_tier: 'earth',
  comms_lag_turns: 0,
  travel_time_turns: 0,
  resource_deposits: '{}',
  position: '{"x":0,"y":0}',
} as const;

export const turn1City = {
  id: 1,
  session_id: 1,
  body_id: 1,
  faction_id: 1,
  name: 'New Geneva',
  population: BigInt(50_000_000),
  infrastructure_level: 4,
  morale: 75,
  industrial_output: 200,
  research_output: 80,
  garrison_strength: 500,
  supply_status: 'adequate',
  development_stage: 'full',
} as const;

export const turn1Personnel = {
  id: 1,
  faction_id: 1,
  name: 'Director Chen',
  role: 'Director',
  department: 'Operations',
  posting_city_id: 1,
  competence: 80,
  creativity: 60,
  reliability: 90,
  ambition: 70,
  political_skill: 75,
  communication: 85,
  loyalty: 95,
  autonomy_tolerance: 40,
  morale: 80,
  burnout: 10,
  salary: 150,
} as const;

// Turn 8: colony ship in transit — departed turn 5, arrives turn 12
export const turn8ColonyShip = {
  id: 1,
  faction_id: 1,
  origin_city_id: 1,
  destination_body_id: 3,
  manifest: '{"population":5000,"supplies":200}',
  departed_turn: 5,
  arrives_turn: 12,
  status: 'in_transit',
} as const;

export const turn8Project = {
  id: 1,
  faction_id: 1,
  city_id: 1,
  type: 'military',
  name: 'Orbital Defence Platform',
  progress: 45,
  resources_assigned: 120,
  est_completion: 11,
  status: 'active',
} as const;

export const turn1Proposal = {
  id: 1,
  faction_id: 1,
  turn: 1,
  proposing_personnel_id: 1,
  department: 'Operations',
  title: 'Expand Mining Operations',
  body: 'Recommends increasing asteroid belt mining budget by 20%.',
  resource_cost: 50,
  confidence: 'HIGH',
  status: 'unread',
  decision: undefined,
} as const;

export const turn1InboxMessage = {
  id: 1,
  faction_id: 1,
  turn: 1,
  from_personnel_id: 2,
  subject: 'Supply chain update',
  body: 'Current reserves are sufficient for 4 turns without resupply.',
  requires_decision: false,
  status: 'unread',
} as const;
