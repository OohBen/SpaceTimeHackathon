import type { Timestamp } from 'spacetimedb';

import type { FactionRow, GameSessionRow } from './session_lifecycle.js';
import type { CityRow, ColonyShipRow, EventRow, ProjectRow } from './turn1_seed.js';

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
    };
    colony_ships: {
      iter(): Iterable<ColonyShipRow>;
      id: {
        update(row: ColonyShipRow): ColonyShipRow;
      };
    };
    projects: {
      iter(): Iterable<ProjectRow>;
      id: {
        update(row: ProjectRow): ProjectRow;
      };
    };
    events: {
      insert(row: EventRow): EventRow;
    };
  };
}

export interface WorldUpdateSnapshot {
  credit_income: Record<number, number>;
  arrived_ship_ids: number[];
  completed_project_ids: number[];
}

// EXECUTION ORDER: city_income -> colony_arrivals -> project_advancement -> world_advanced_event
// All steps iterate rows sorted by id ascending for stable, deterministic ordering.
export function runWorldUpdate(
  ctx: WorldUpdateContext,
  session: GameSessionRow
): WorldUpdateSnapshot {
  const factionIds = getSessionFactionIds(session);

  const creditIncome = applyCityIncome(ctx, factionIds);
  const arrivedShipIds = advanceColonyShips(ctx, factionIds, session.current_turn);
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
      credit_income: creditIncome,
      session_id: session.id,
      turn: session.current_turn,
    }),
  });

  return { credit_income: creditIncome, arrived_ship_ids: arrivedShipIds, completed_project_ids: completedProjectIds };
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
