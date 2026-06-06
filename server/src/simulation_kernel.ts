import type { Timestamp } from 'spacetimedb';

import type { FactionRow, GameSessionRow } from './session_lifecycle.js';
import type {
  CelestialBodyRow,
  CityRow,
  ColonyShipRow,
  EventRow,
  FleetRow,
  ProjectRow,
  ProposalRow,
} from './turn1_seed.js';
import { applyDoctrineDrift, applyMoraleDrift, applyPoliticalCapitalDecay } from './economy_rules.js';

const FLEET_MIN_STRENGTH = 0;
const FLEET_MAX_STRENGTH = 1_000;
const CONTROL_MIN_SCORE = 0;
const CONTROL_MAX_SCORE = 200;
const CONTROL_PRESSURE_STEP = 100;
const CONTROL_MAX_DELTA = 5;
const SUPPLY_STRENGTH_DELTA: Record<string, number> = {
  stable: 5,
  strained: -10,
  critical: -25,
};

export interface WorldUpdateContext {
  timestamp: Timestamp;
  db: {
    game_sessions: {
      id: {
        find(id: number): GameSessionRow | null;
        update(row: GameSessionRow): GameSessionRow;
      };
    };
    factions: {
      id: {
        find(id: number): FactionRow | null;
        update(row: FactionRow): FactionRow;
      };
    };
    cities: {
      iter(): Iterable<CityRow>;
      id: {
        update(row: CityRow): CityRow;
      };
    };
    celestial_bodies: {
      iter(): Iterable<CelestialBodyRow>;
    };
    colony_ships: {
      iter(): Iterable<ColonyShipRow>;
      id: {
        update(row: ColonyShipRow): ColonyShipRow;
      };
    };
    fleets: {
      iter(): Iterable<FleetRow>;
      id: {
        update(row: FleetRow): FleetRow;
      };
    };
    projects: {
      iter(): Iterable<ProjectRow>;
      id: {
        update(row: ProjectRow): ProjectRow;
      };
    };
    proposals: {
      iter(): Iterable<ProposalRow>;
    };
    events: {
      insert(row: EventRow): EventRow;
    };
  };
}

export interface TravelProgressSnapshot {
  destination_body_id: number;
  distance: number;
  elapsed_turns: number;
  origin_body_id: number;
  progress_pct: number;
  status: string;
  total_turns: number;
}

export interface RuleChangeSnapshot {
  after: number;
  before: number;
  delta: number;
}

export interface WorldUpdateSnapshot {
  credit_income: Record<number, number>;
  arrived_ship_ids: number[];
  completed_project_ids: number[];
  travel_progress: Record<number, TravelProgressSnapshot>;
  fleet_strength_changes: Record<number, RuleChangeSnapshot>;
  control_scores: Record<number, RuleChangeSnapshot>;
  contested_body_ids: number[];
}

// EXECUTION ORDER: city_income -> morale_drift -> political_capital_decay -> doctrine_drift
//                  -> travel_progress -> colony_arrivals -> fleet_strength -> control_pressure
//                  -> project_advancement -> world_advanced_event
// All steps iterate rows sorted by id ascending for stable, deterministic ordering.
export function runWorldUpdate(
  ctx: WorldUpdateContext,
  session: GameSessionRow
): WorldUpdateSnapshot {
  const factionIds = getSessionFactionIds(session);

  const creditIncome = applyCityIncome(ctx, factionIds);
  applyMoraleDrift(ctx, factionIds);
  applyPoliticalCapitalDecay(ctx, factionIds);
  applyDoctrineDrift(ctx, factionIds, session.current_turn - 1);
  const travelProgress = buildTravelProgress(ctx, factionIds, session.current_turn);
  const arrivedShipIds = advanceColonyShips(ctx, factionIds, session.current_turn);
  const fleetStrengthChanges = applyFleetStrengthRules(ctx, factionIds);
  const controlPressure = applyControlPressure(ctx, factionIds);
  const completedProjectIds = advanceProjects(ctx, factionIds);

  ctx.db.events.insert({
    id: 0,
    session_id: session.id,
    faction_id: undefined,
    turn: session.current_turn,
    event_type: 'world_advanced',
    payload: stableJson({
      arrived_ship_count: arrivedShipIds.length,
      completed_project_count: completedProjectIds.length,
      contested_body_ids: controlPressure.contested_body_ids,
      control_scores: controlPressure.control_scores,
      credit_income: creditIncome,
      fleet_strength_changes: fleetStrengthChanges,
      session_id: session.id,
      travel_progress: travelProgress,
      turn: session.current_turn,
    }),
  });

  return {
    credit_income: creditIncome,
    arrived_ship_ids: arrivedShipIds,
    completed_project_ids: completedProjectIds,
    travel_progress: travelProgress,
    fleet_strength_changes: fleetStrengthChanges,
    control_scores: controlPressure.control_scores,
    contested_body_ids: controlPressure.contested_body_ids,
  };
}

function getSessionFactionIds(session: GameSessionRow): [number, number] {
  if (session.player_a_faction_id === undefined || session.player_b_faction_id === undefined) {
    throw new Error(`session ${session.id} is not fully initialized`);
  }
  return [session.player_a_faction_id, session.player_b_faction_id];
}

// Accumulate income from all session cities (sorted by city.id), then apply once per faction.
function applyCityIncome(
  ctx: WorldUpdateContext,
  factionIds: readonly [number, number]
): Record<number, number> {
  const [idA, idB] = factionIds;
  const income: Record<number, number> = { [idA]: 0, [idB]: 0 };

  const cities = sortById(
    [...ctx.db.cities.iter()].filter(city => city.faction_id === idA || city.faction_id === idB)
  );

  for (const city of cities) {
    income[city.faction_id] += Math.max(0, city.industrial_output);
  }

  // Update factions sorted by id for deterministic write order
  for (const factionId of sortIds(factionIds)) {
    const earned = income[factionId] ?? 0;
    if (earned === 0) continue;
    const faction = ctx.db.factions.id.find(factionId);
    if (!faction) throw new Error(`faction ${factionId} not found`);
    ctx.db.factions.id.update({ ...faction, credits: faction.credits + earned });
  }

  return income;
}

function buildTravelProgress(
  ctx: WorldUpdateContext,
  factionIds: readonly [number, number],
  currentTurn: number
): Record<number, TravelProgressSnapshot> {
  const [idA, idB] = factionIds;
  const progress: Record<number, TravelProgressSnapshot> = {};
  const citiesById = new Map(
    [...ctx.db.cities.iter()]
      .filter(city => city.faction_id === idA || city.faction_id === idB)
      .map(city => [city.id, city])
  );
  const bodiesById = new Map(
    [...ctx.db.celestial_bodies.iter()].map(body => [body.id, body])
  );

  const ships = sortById(
    [...ctx.db.colony_ships.iter()].filter(
      ship =>
        (ship.faction_id === idA || ship.faction_id === idB) &&
        ship.status === 'in_transit'
    )
  );

  for (const ship of ships) {
    const originCity = citiesById.get(ship.origin_city_id);
    if (!originCity) continue;

    const originBody = bodiesById.get(originCity.body_id);
    const destinationBody = bodiesById.get(ship.destination_body_id);
    if (!originBody || !destinationBody) continue;

    const originPosition = parsePosition(originBody.position);
    const destinationPosition = parsePosition(destinationBody.position);
    if (!originPosition || !destinationPosition) continue;

    const totalTurns = Math.max(1, ship.arrives_turn - ship.departed_turn);
    const elapsedTurns = clamp(
      currentTurn - ship.departed_turn,
      0,
      totalTurns
    );
    const progressPct = Math.round((elapsedTurns / totalTurns) * 100);
    const distance = roundTo(
      Math.hypot(
        destinationPosition.x - originPosition.x,
        destinationPosition.y - originPosition.y
      ),
      3
    );

    progress[ship.id] = {
      destination_body_id: destinationBody.id,
      distance,
      elapsed_turns: elapsedTurns,
      origin_body_id: originBody.id,
      progress_pct: progressPct,
      status: progressPct >= 100 ? 'arrived' : ship.status,
      total_turns: totalTurns,
    };
  }

  return progress;
}

// Mark ships that arrive on or before current_turn as arrived, sorted by id.
function advanceColonyShips(
  ctx: WorldUpdateContext,
  factionIds: readonly [number, number],
  currentTurn: number
): number[] {
  const [idA, idB] = factionIds;
  const arrivedIds: number[] = [];

  const ships = sortById(
    [...ctx.db.colony_ships.iter()].filter(
      ship =>
        (ship.faction_id === idA || ship.faction_id === idB) &&
        ship.status === 'in_transit' &&
        ship.arrives_turn <= currentTurn
    )
  );

  for (const ship of ships) {
    ctx.db.colony_ships.id.update({ ...ship, status: 'arrived' });
    arrivedIds.push(ship.id);
  }

  return arrivedIds;
}

function applyFleetStrengthRules(
  ctx: WorldUpdateContext,
  factionIds: readonly [number, number]
): Record<number, RuleChangeSnapshot> {
  const [idA, idB] = factionIds;
  const changes: Record<number, RuleChangeSnapshot> = {};
  const cityById = new Map(
    [...ctx.db.cities.iter()]
      .filter(city => city.faction_id === idA || city.faction_id === idB)
      .map(city => [city.id, city])
  );

  const fleets = sortById(
    [...ctx.db.fleets.iter()].filter(fleet => {
      const city = cityById.get(fleet.posting_city_id);
      return (
        (fleet.faction_id === idA || fleet.faction_id === idB) &&
        city !== undefined &&
        city.faction_id === fleet.faction_id
      );
    })
  );

  for (const fleet of fleets) {
    const city = cityById.get(fleet.posting_city_id);
    if (!city) continue;

    const before = fleet.strength;
    const ruleDelta = SUPPLY_STRENGTH_DELTA[city.supply_status] ?? 0;
    const after = clamp(before + ruleDelta, FLEET_MIN_STRENGTH, FLEET_MAX_STRENGTH);
    const delta = after - before;
    if (delta === 0) continue;

    ctx.db.fleets.id.update({ ...fleet, strength: after });
    changes[fleet.id] = { after, before, delta };
  }

  return changes;
}

function applyControlPressure(
  ctx: WorldUpdateContext,
  factionIds: readonly [number, number]
): {
  contested_body_ids: number[];
  control_scores: Record<number, RuleChangeSnapshot>;
} {
  const [idA, idB] = factionIds;
  const cityById = new Map<number, CityRow>();
  const pressureByBody = new Map<number, Map<number, number>>();
  const deltas: Record<number, number> = { [idA]: 0, [idB]: 0 };
  const contestedBodyIds: number[] = [];

  for (const city of sortById(
    [...ctx.db.cities.iter()].filter(city => city.faction_id === idA || city.faction_id === idB)
  )) {
    cityById.set(city.id, city);
    addBodyPressure(
      pressureByBody,
      city.body_id,
      city.faction_id,
      Math.max(0, city.garrison_strength)
    );
  }

  for (const fleet of sortById([...ctx.db.fleets.iter()])) {
    const city = cityById.get(fleet.posting_city_id);
    if (!city || city.faction_id !== fleet.faction_id) continue;

    addBodyPressure(
      pressureByBody,
      city.body_id,
      fleet.faction_id,
      Math.max(0, fleet.strength)
    );
  }

  for (const bodyId of sortIds([...pressureByBody.keys()])) {
    const pressure = pressureByBody.get(bodyId)!;
    const pressureA = pressure.get(idA) ?? 0;
    const pressureB = pressure.get(idB) ?? 0;

    if (pressureA > 0 && pressureB > 0) {
      contestedBodyIds.push(bodyId);
      const difference = pressureA - pressureB;
      if (difference === 0) continue;

      const magnitude = clamp(
        Math.floor(Math.abs(difference) / CONTROL_PRESSURE_STEP),
        1,
        CONTROL_MAX_DELTA
      );
      if (difference > 0) {
        deltas[idA] += magnitude;
        deltas[idB] -= magnitude;
      } else {
        deltas[idA] -= magnitude;
        deltas[idB] += magnitude;
      }
      continue;
    }

    if (pressureA > 0) {
      deltas[idA] += 1;
    } else if (pressureB > 0) {
      deltas[idB] += 1;
    }
  }

  const controlScores: Record<number, RuleChangeSnapshot> = {};
  for (const factionId of sortIds(factionIds)) {
    const delta = deltas[factionId] ?? 0;
    if (delta === 0) continue;

    const faction = ctx.db.factions.id.find(factionId);
    if (!faction) throw new Error(`faction ${factionId} not found`);

    const before = faction.control_score;
    const after = clamp(before + delta, CONTROL_MIN_SCORE, CONTROL_MAX_SCORE);
    const appliedDelta = after - before;
    if (appliedDelta === 0) continue;

    ctx.db.factions.id.update({ ...faction, control_score: after });
    controlScores[factionId] = {
      after,
      before,
      delta: appliedDelta,
    };
  }

  return {
    contested_body_ids: contestedBodyIds,
    control_scores: controlScores,
  };
}

// Advance in-progress projects by resources_assigned per turn, cap at 100, sorted by id.
function advanceProjects(
  ctx: WorldUpdateContext,
  factionIds: readonly [number, number]
): number[] {
  const [idA, idB] = factionIds;
  const completedIds: number[] = [];

  const projects = sortById(
    [...ctx.db.projects.iter()].filter(
      project =>
        (project.faction_id === idA || project.faction_id === idB) &&
        project.status === 'in_progress'
    )
  );

  for (const project of projects) {
    const progress = Math.min(100, project.progress + project.resources_assigned);
    const status = progress >= 100 ? 'complete' : 'in_progress';
    ctx.db.projects.id.update({ ...project, progress, status });
    if (status === 'complete') {
      completedIds.push(project.id);
    }
  }

  return completedIds;
}

function sortById<T extends { id: number }>(rows: T[]): T[] {
  return rows.slice().sort((a, b) => a.id - b.id);
}

function sortIds(ids: readonly number[]): number[] {
  return ids.slice().sort((a, b) => a - b);
}

function addBodyPressure(
  pressureByBody: Map<number, Map<number, number>>,
  bodyId: number,
  factionId: number,
  pressure: number
): void {
  if (pressure <= 0) return;

  const pressureByFaction = pressureByBody.get(bodyId) ?? new Map<number, number>();
  pressureByFaction.set(factionId, (pressureByFaction.get(factionId) ?? 0) + pressure);
  pressureByBody.set(bodyId, pressureByFaction);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function parsePosition(positionJson: string): { x: number; y: number } | undefined {
  const value = JSON.parse(positionJson);
  if (!isRecord(value)) return undefined;
  const { x, y } = value;
  if (typeof x !== 'number' || typeof y !== 'number') return undefined;
  return { x, y };
}

const stableJson = (value: unknown): string => JSON.stringify(stableValue(value));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value === undefined) return null;
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, stableValue(value[key])])
  );
};
