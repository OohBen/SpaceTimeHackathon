import { TABLE_ACCESS_POLICIES } from './access_policy.js';
import type {
  CelestialBodyRow,
  CityRow,
  ColonyShipRow,
  EventRow,
  FactionRow,
  FleetRow,
  GameSessionRow,
  Turn1SeedRows,
} from './turn1_seed.js';

export const PUBLIC_WORLD_PRIVATE_FIELD_DENYLIST = [
  'player_id',
  'credits',
  'political_capital',
  'doctrine_vector',
  'population',
  'infrastructure_level',
  'morale',
  'industrial_output',
  'research_output',
  'garrison_strength',
  'supply_status',
  'orders',
  'origin_city_id',
  'manifest',
  'departed_turn',
  'payload',
] as const;

export const PUBLIC_WORLD_SUBSCRIPTION_GROUPS = {
  shared_full: ['game_sessions', 'celestial_bodies'],
  public_projections: [
    {
      sourceTable: 'factions',
      viewName: 'public_factions',
      fields: TABLE_ACCESS_POLICIES.factions.publicProjection,
    },
    {
      sourceTable: 'cities',
      viewName: 'public_cities',
      fields: TABLE_ACCESS_POLICIES.cities.publicProjection,
    },
    {
      sourceTable: 'fleets',
      viewName: 'public_fleets',
      fields: TABLE_ACCESS_POLICIES.fleets.publicProjection,
    },
    {
      sourceTable: 'colony_ships',
      viewName: 'public_colony_ships',
      fields: TABLE_ACCESS_POLICIES.colony_ships.publicProjection,
    },
    {
      sourceTable: 'events',
      viewName: 'public_events',
      fields: TABLE_ACCESS_POLICIES.events.publicProjection,
    },
  ],
} as const;

export type PublicFactionProjection = Pick<
  FactionRow,
  'id' | 'session_id' | 'name' | 'control_score' | 'ready_for_turn'
>;

export type PublicCityProjection = Pick<
  CityRow,
  'id' | 'session_id' | 'body_id' | 'faction_id' | 'name' | 'development_stage'
>;

export type PublicFleetProjection = Pick<
  FleetRow,
  'id' | 'faction_id' | 'posting_city_id' | 'strength'
>;

export type PublicColonyShipProjection = Pick<
  ColonyShipRow,
  'id' | 'faction_id' | 'destination_body_id' | 'arrives_turn' | 'status'
>;

export type PublicEventProjection = Pick<
  EventRow,
  'id' | 'session_id' | 'turn' | 'event_type'
>;

export interface PublicWorldProjection {
  game_sessions: GameSessionRow[];
  celestial_bodies: CelestialBodyRow[];
  factions: PublicFactionProjection[];
  cities: PublicCityProjection[];
  fleets: PublicFleetProjection[];
  colony_ships: PublicColonyShipProjection[];
  events: PublicEventProjection[];
}

export interface PublicWorldProjectionInput {
  sessionId?: number;
  viewerFactionId?: number;
}

export function buildPublicWorldProjection(
  rows: Turn1SeedRows,
  input: PublicWorldProjectionInput = {}
): PublicWorldProjection {
  const sessionId = input.sessionId;
  const citiesForSession = filterBySession(rows.cities, sessionId);
  const cityIds = new Set(citiesForSession.map((city) => city.id));
  const bodyIds = new Set(
    filterBySession(rows.celestial_bodies, sessionId).map((body) => body.id)
  );

  return {
    game_sessions: filterSessions(rows.game_sessions, sessionId),
    celestial_bodies: filterBySession(rows.celestial_bodies, sessionId),
    factions: filterBySession(rows.factions, sessionId).map(projectFaction),
    cities: citiesForSession.map(projectCity),
    fleets: rows.fleets
      .filter((fleet) => !sessionId || cityIds.has(fleet.posting_city_id))
      .map(projectFleet),
    colony_ships: rows.colony_ships
      .filter(
        (ship) =>
          !sessionId ||
          cityIds.has(ship.origin_city_id) ||
          bodyIds.has(ship.destination_body_id)
      )
      .map(projectColonyShip),
    events: filterBySession(rows.events, sessionId).map(projectEvent),
  };
}

export function projectFaction(
  faction: FactionRow
): PublicFactionProjection {
  return {
    id: faction.id,
    session_id: faction.session_id,
    name: faction.name,
    control_score: faction.control_score,
    ready_for_turn: faction.ready_for_turn,
  };
}

export function projectCity(city: CityRow): PublicCityProjection {
  return {
    id: city.id,
    session_id: city.session_id,
    body_id: city.body_id,
    faction_id: city.faction_id,
    name: city.name,
    development_stage: city.development_stage,
  };
}

export function projectFleet(fleet: FleetRow): PublicFleetProjection {
  return {
    id: fleet.id,
    faction_id: fleet.faction_id,
    posting_city_id: fleet.posting_city_id,
    strength: fleet.strength,
  };
}

export function projectColonyShip(
  ship: ColonyShipRow
): PublicColonyShipProjection {
  return {
    id: ship.id,
    faction_id: ship.faction_id,
    destination_body_id: ship.destination_body_id,
    arrives_turn: ship.arrives_turn,
    status: ship.status,
  };
}

export function projectEvent(event: EventRow): PublicEventProjection {
  return {
    id: event.id,
    session_id: event.session_id,
    turn: event.turn,
    event_type: event.event_type,
  };
}

function filterSessions(
  rows: readonly GameSessionRow[],
  sessionId: number | undefined
): GameSessionRow[] {
  if (sessionId === undefined) {
    return [...rows];
  }

  return rows.filter((row) => row.id === sessionId);
}

function filterBySession<T extends { session_id: number }>(
  rows: readonly T[],
  sessionId: number | undefined
): T[] {
  if (sessionId === undefined) {
    return [...rows];
  }

  return rows.filter((row) => row.session_id === sessionId);
}
