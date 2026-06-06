// Deterministic fixture shapes for Turn 1 (new game) and Turn 8 (mid-game scenario).
// Used to validate that the authoritative schema can represent both states without hacks.
import { Identity, Timestamp } from 'spacetimedb';

import { turn1Seed } from './turn1_seed.js';

export {
  TURN1_SEED_INSERT_ORDER,
  buildTurn1Seed,
  getTurn1SeedInsertPlan,
  turn1Seed,
  type Turn1SeedRows,
} from './turn1_seed.js';

const fixtureIdentity = (hex: string): Identity => Identity.fromString(hex.padStart(64, '0'));
const epochTimestamp = new Timestamp(0n);

export const turn1Session = turn1Seed.game_sessions[0];

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
  created_at: epochTimestamp,
  updated_at: epochTimestamp,
} as const;

export const turn1Faction = turn1Seed.factions[0];

export const turn8Faction = {
  id: 1,
  session_id: 1,
  player_id: fixtureIdentity('a1'),
  name: 'United Earth Authority',
  credits: 2400,
  political_capital: 72,
  doctrine_vector: '{"expansion":0.7,"security":0.3}',
  control_score: 140,
  ready_for_turn: false,
} as const;

export const turn1CelestialBody = turn1Seed.celestial_bodies[0];

export const turn1City = turn1Seed.cities[0];

export const turn1Personnel = turn1Seed.personnel[0];

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

export const turn1Proposal = turn1Seed.proposals[0];

export const turn1InboxMessage = turn1Seed.commander_inbox[0];
