// Deterministic fixture shapes for Turn 1 (new game) and Turn 8 (mid-game scenario).
// Used to validate that the authoritative schema can represent both states without hacks.
import { turn1Seed } from './turn1_seed.js';
import { turn8Seed } from './turn8_seed.js';

export {
  TURN1_SEED_INSERT_ORDER,
  buildTurn1Seed,
  getTurn1SeedInsertPlan,
  turn1Seed,
  type Turn1SeedRows,
} from './turn1_seed.js';

export {
  TURN8_SEED_INSERT_ORDER,
  buildTurn8Seed,
  getTurn8SeedInsertPlan,
  turn8Seed,
  type Turn8SeedRows,
} from './turn8_seed.js';

export const turn1Session = turn1Seed.game_sessions[0];
export const turn8Session = turn8Seed.game_sessions[0];

export const turn1Faction = turn1Seed.factions[0];
export const turn8Faction = turn8Seed.factions[0];

export const turn1CelestialBody = turn1Seed.celestial_bodies[0];
export const turn1City = turn1Seed.cities[0];
export const turn1Personnel = turn1Seed.personnel[0];

export const turn8ColonyShip = turn8Seed.colony_ships[0];
export const turn8Project = turn8Seed.projects[1];

export const turn1Proposal = turn1Seed.proposals[0];
export const turn1InboxMessage = turn1Seed.commander_inbox[0];
