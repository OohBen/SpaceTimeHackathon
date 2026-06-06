import type { Timestamp } from 'spacetimedb';
import {
  buildTurn1Seed,
  type CelestialBodyRow,
  type CityRow,
  type ColonyShipRow,
  type FleetRow,
  type IntelligenceRecordRow,
  type PersonnelRelationshipRow,
  type PersonnelRow,
  type ProjectRow,
  type Turn1SeedInput,
  type Turn1SeedRows,
} from './turn1_seed.js';

// Closes the gap behind P4E1 task #118 demo runbook: `create_session` only
// seeds a session row + two faction rows, so the fallback proposal generator
// returns `fallback_unavailable` on a fresh session. This reducer overlays the
// Turn-1 world snapshot (cities, personnel, fleets, etc.) onto an existing
// live session so the deterministic deliberation path can actually generate
// proposals end-to-end during local demos.
//
// Idempotent: skips work if cities already exist for the session.

interface RowWithId {
  id: number;
}

type Table<Row extends RowWithId> = {
  iter: () => IterableIterator<Row>;
  insert: (row: Row) => Row;
  id: {
    find: (id: number) => Row | null;
    update: (row: Row) => Row;
  };
};

interface GameSessionRow {
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
}

interface FactionRow extends RowWithId {
  session_id: number;
}

export interface SeedDemoWorldDb {
  game_sessions: Table<GameSessionRow>;
  factions: Table<FactionRow>;
  celestial_bodies: Table<CelestialBodyRow>;
  cities: Table<CityRow>;
  personnel: Table<PersonnelRow>;
  personnel_relationships: Table<PersonnelRelationshipRow>;
  fleets: Table<FleetRow>;
  colony_ships: Table<ColonyShipRow>;
  projects: Table<ProjectRow>;
  intelligence_records: Table<IntelligenceRecordRow>;
}

export interface SeedDemoWorldContext {
  db: SeedDemoWorldDb;
  timestamp: Timestamp;
}

export interface SeedDemoWorldInput {
  session_id: number;
}

const SEED_FACTION_A_ID = 1;
const SEED_FACTION_B_ID = 2;

export function seedDemoWorldReducer(
  ctx: SeedDemoWorldContext,
  input: SeedDemoWorldInput
): void {
  const session = ctx.db.game_sessions.id.find(input.session_id);
  if (!session) {
    throw new Error(`session ${input.session_id} not found`);
  }

  const factions = collectFactions(ctx.db.factions.iter(), session.id);
  if (factions.length !== 2) {
    throw new Error(
      `session ${input.session_id} must have exactly two factions to seed demo world, found ${factions.length}`
    );
  }

  if (hasCitiesForSession(ctx.db.cities.iter(), session.id)) {
    // Already seeded; idempotent no-op.
    return;
  }

  const playerAFactionId =
    session.player_a_faction_id ?? factions[0]?.id ?? SEED_FACTION_A_ID;
  const playerBFactionId =
    session.player_b_faction_id ?? factions[1]?.id ?? SEED_FACTION_B_ID;

  const seed = buildTurn1Seed({ session_id: session.id } satisfies Turn1SeedInput);

  const factionRebind = new Map<number, number>([
    [SEED_FACTION_A_ID, playerAFactionId],
    [SEED_FACTION_B_ID, playerBFactionId],
  ]);

  insertCelestialBodies(ctx, seed.celestial_bodies);
  insertCities(ctx, seed.cities, factionRebind);
  insertPersonnel(ctx, seed.personnel, factionRebind);
  insertPersonnelRelationships(ctx, seed.personnel_relationships);
  insertFleets(ctx, seed.fleets, factionRebind);
  insertColonyShips(ctx, seed.colony_ships, factionRebind);
  insertProjects(ctx, seed.projects, factionRebind);
  insertIntelligenceRecords(ctx, seed.intelligence_records, factionRebind);
}

function collectFactions(
  iter: IterableIterator<FactionRow>,
  sessionId: number
): FactionRow[] {
  const out: FactionRow[] = [];
  for (const faction of iter) {
    if (faction.session_id === sessionId) out.push(faction);
  }
  return out;
}

function hasCitiesForSession(
  iter: IterableIterator<CityRow>,
  sessionId: number
): boolean {
  for (const city of iter) {
    if (city.session_id === sessionId) return true;
  }
  return false;
}

function insertCelestialBodies(
  ctx: SeedDemoWorldContext,
  rows: readonly CelestialBodyRow[]
): void {
  for (const row of rows) {
    ctx.db.celestial_bodies.insert({ ...row, id: 0 });
  }
}

function insertCities(
  ctx: SeedDemoWorldContext,
  rows: readonly CityRow[],
  rebind: ReadonlyMap<number, number>
): void {
  for (const row of rows) {
    const factionId = rebind.get(row.faction_id);
    if (factionId === undefined) continue;
    ctx.db.cities.insert({ ...row, id: 0, faction_id: factionId });
  }
}

function insertPersonnel(
  ctx: SeedDemoWorldContext,
  rows: readonly PersonnelRow[],
  rebind: ReadonlyMap<number, number>
): void {
  for (const row of rows) {
    const factionId = rebind.get(row.faction_id);
    if (factionId === undefined) continue;
    ctx.db.personnel.insert({ ...row, id: 0, faction_id: factionId });
  }
}

function insertPersonnelRelationships(
  ctx: SeedDemoWorldContext,
  rows: readonly PersonnelRelationshipRow[]
): void {
  for (const row of rows) {
    ctx.db.personnel_relationships.insert({ ...row, id: 0 });
  }
}

function insertFleets(
  ctx: SeedDemoWorldContext,
  rows: readonly FleetRow[],
  rebind: ReadonlyMap<number, number>
): void {
  for (const row of rows) {
    const factionId = rebind.get(row.faction_id);
    if (factionId === undefined) continue;
    ctx.db.fleets.insert({ ...row, id: 0, faction_id: factionId });
  }
}

function insertColonyShips(
  ctx: SeedDemoWorldContext,
  rows: readonly ColonyShipRow[],
  rebind: ReadonlyMap<number, number>
): void {
  for (const row of rows) {
    const factionId = rebind.get(row.faction_id);
    if (factionId === undefined) continue;
    ctx.db.colony_ships.insert({ ...row, id: 0, faction_id: factionId });
  }
}

function insertProjects(
  ctx: SeedDemoWorldContext,
  rows: readonly ProjectRow[],
  rebind: ReadonlyMap<number, number>
): void {
  for (const row of rows) {
    const factionId = rebind.get(row.faction_id);
    if (factionId === undefined) continue;
    ctx.db.projects.insert({ ...row, id: 0, faction_id: factionId });
  }
}

function insertIntelligenceRecords(
  ctx: SeedDemoWorldContext,
  rows: readonly IntelligenceRecordRow[],
  rebind: ReadonlyMap<number, number>
): void {
  for (const row of rows) {
    const observerFactionId = rebind.get(row.observer_faction_id);
    const targetFactionId = rebind.get(row.target_faction_id);
    if (observerFactionId === undefined || targetFactionId === undefined) continue;
    ctx.db.intelligence_records.insert({
      ...row,
      id: 0,
      observer_faction_id: observerFactionId,
      target_faction_id: targetFactionId,
    });
  }
}

export type { Turn1SeedRows };
