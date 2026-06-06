import type { Timestamp } from 'spacetimedb';
import type { FactionRow, GameSessionRow } from './session_lifecycle.js';
import {
  buildTurn1Seed,
  type CelestialBodyRow,
  type CityRow,
  type ColonyShipRow,
  type CommanderInboxRow,
  type EventRow,
  type FleetRow,
  type IntelligenceRecordRow,
  type LlmRequestRow,
  type ModuleSettingsRow,
  type PersonnelRelationshipRow,
  type PersonnelRow,
  type ProposalRow,
  type ProjectRow,
  type TradeAgreementRow,
  type TurnSummaryRow,
  type Turn1SeedInput,
  type Turn1SeedRows,
} from './turn1_seed.js';
import { buildTurn8Seed } from './turn8_seed.js';

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

type InsertRow<Row> = {
  [Key in keyof Row]-?: Row[Key] | ({} extends Pick<Row, Key> ? undefined : never);
};

type Table<Row extends RowWithId> = {
  iter: () => IterableIterator<Row>;
  insert: (row: InsertRow<Row>) => Row;
  id: {
    find: (id: number) => Row | null;
    update: (row: InsertRow<Row>) => Row;
    delete?: (id: number) => void;
  };
};

export interface SeedDemoWorldDb {
  game_sessions: Table<GameSessionRow>;
  factions: Table<FactionRow>;
  celestial_bodies: Table<CelestialBodyRow>;
  cities: Table<CityRow>;
  personnel: Table<PersonnelRow>;
  personnel_relationships: Table<PersonnelRelationshipRow>;
  proposals: Table<ProposalRow>;
  commander_inbox: Table<CommanderInboxTableRow>;
  fleets: Table<FleetRow>;
  colony_ships: Table<ColonyShipRow>;
  projects: Table<ProjectRow>;
  intelligence_records: Table<IntelligenceRecordRow>;
  events: Table<EventTableRow>;
  turn_summaries: Table<TurnSummaryTableRow>;
  trade_agreements: Table<TradeAgreementRow>;
  llm_requests: Table<LlmRequestRow>;
  module_settings: Table<ModuleSettingsRow>;
}

type CommanderInboxTableRow = CommanderInboxRow & {
  narrative_json: string | undefined;
};

type EventTableRow = EventRow & {
  narrative_json: string | undefined;
};

type TurnSummaryTableRow = TurnSummaryRow & {
  narrative_json: string | undefined;
};

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

export function seedDemoTurn8Reducer(
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
      `session ${input.session_id} must have exactly two factions to seed Turn 8 scenario, found ${factions.length}`
    );
  }

  const [playerAFaction, playerBFaction] = resolveSessionFactions(session, factions);
  const factionRebind = new Map<number, number>([
    [SEED_FACTION_A_ID, playerAFaction.id],
    [SEED_FACTION_B_ID, playerBFaction.id],
  ]);

  clearSessionScenarioRows(ctx, session.id, new Set(factions.map((faction) => faction.id)));

  const seed = buildTurn8Seed({
    session_id: session.id,
    player_a_identity: playerAFaction.player_id.toHexString(),
    player_b_identity: playerBFaction.player_id.toHexString(),
    player_a_faction_name: playerAFaction.name,
    player_b_faction_name: playerBFaction.name,
    created_at_micros: ctx.timestamp.microsSinceUnixEpoch,
  });
  const seededSession = seed.game_sessions[0];
  const seededFactionA = seed.factions.find((row) => row.id === SEED_FACTION_A_ID);
  const seededFactionB = seed.factions.find((row) => row.id === SEED_FACTION_B_ID);
  if (!seededFactionA || !seededFactionB) {
    throw new Error('Turn 8 seed must include both fixture factions');
  }

  ctx.db.game_sessions.id.update({
    ...session,
    state: seededSession.state,
    current_year: seededSession.current_year,
    current_turn: seededSession.current_turn,
    player_a_faction_id: playerAFaction.id,
    player_b_faction_id: playerBFaction.id,
    turn_phase: seededSession.turn_phase,
    turn_deadline: seededSession.turn_deadline,
    winner_faction_id: seededSession.winner_faction_id,
    updated_at: ctx.timestamp,
  });
  updateScenarioFaction(ctx, playerAFaction, seededFactionA);
  updateScenarioFaction(ctx, playerBFaction, seededFactionB);

  const bodyIds = insertScenarioCelestialBodies(ctx, seed.celestial_bodies);
  const cityIds = insertScenarioCities(ctx, seed.cities, bodyIds, factionRebind);
  const personnelIds = insertScenarioPersonnel(ctx, seed.personnel, cityIds, factionRebind);
  insertScenarioPersonnelRelationships(ctx, seed.personnel_relationships, personnelIds);
  const proposalIds = insertScenarioProposals(ctx, seed.proposals, personnelIds, factionRebind);
  const inboxIds = insertScenarioCommanderInbox(ctx, seed.commander_inbox, personnelIds, factionRebind, session.id);
  insertScenarioFleets(ctx, seed.fleets, cityIds, factionRebind);
  insertScenarioColonyShips(ctx, seed.colony_ships, cityIds, bodyIds, factionRebind);
  insertScenarioProjects(ctx, seed.projects, cityIds, factionRebind);
  insertScenarioIntelligenceRecords(ctx, seed.intelligence_records, factionRebind);
  insertScenarioEvents(ctx, seed.events, factionRebind);
  insertScenarioTurnSummaries(ctx, seed.turn_summaries, factionRebind);
  insertScenarioTradeAgreements(ctx, seed.trade_agreements, factionRebind);
  insertScenarioLlmRequests(ctx, seed.llm_requests, factionRebind, proposalIds, inboxIds);
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

function resolveSessionFactions(
  session: GameSessionRow,
  factions: readonly FactionRow[]
): readonly [FactionRow, FactionRow] {
  const byId = new Map(factions.map((faction) => [faction.id, faction]));
  const playerA = session.player_a_faction_id
    ? byId.get(session.player_a_faction_id)
    : factions[0];
  const playerB = session.player_b_faction_id
    ? byId.get(session.player_b_faction_id)
    : factions.find((faction) => faction.id !== playerA?.id);

  if (!playerA || !playerB || playerA.id === playerB.id) {
    throw new Error(`session ${session.id} must have distinct player_a/player_b factions`);
  }
  return [playerA, playerB];
}

function clearSessionScenarioRows(
  ctx: SeedDemoWorldContext,
  sessionId: number,
  factionIds: ReadonlySet<number>
): void {
  const bodyIds = new Set(
    [...ctx.db.celestial_bodies.iter()]
      .filter((row) => row.session_id === sessionId)
      .map((row) => row.id)
  );
  const cityIds = new Set(
    [...ctx.db.cities.iter()]
      .filter((row) => row.session_id === sessionId)
      .map((row) => row.id)
  );
  const personnelIds = new Set(
    [...ctx.db.personnel.iter()]
      .filter((row) => factionIds.has(row.faction_id))
      .map((row) => row.id)
  );

  deleteMatching(ctx.db.proposals, (row) => factionIds.has(row.faction_id));
  deleteMatching(ctx.db.commander_inbox, (row) => factionIds.has(row.faction_id));
  deleteMatching(
    ctx.db.llm_requests,
    (row) => row.session_id === sessionId || factionIds.has(row.faction_id)
  );
  deleteMatching(
    ctx.db.turn_summaries,
    (row) => row.session_id === sessionId || factionIds.has(row.faction_id)
  );
  deleteMatching(ctx.db.events, (row) => row.session_id === sessionId);
  deleteMatching(ctx.db.trade_agreements, (row) => row.session_id === sessionId);
  deleteMatching(
    ctx.db.intelligence_records,
    (row) => factionIds.has(row.observer_faction_id) || factionIds.has(row.target_faction_id)
  );
  deleteMatching(
    ctx.db.projects,
    (row) => factionIds.has(row.faction_id) || cityIds.has(row.city_id)
  );
  deleteMatching(
    ctx.db.colony_ships,
    (row) =>
      factionIds.has(row.faction_id) ||
      cityIds.has(row.origin_city_id) ||
      bodyIds.has(row.destination_body_id)
  );
  deleteMatching(
    ctx.db.fleets,
    (row) => factionIds.has(row.faction_id) || cityIds.has(row.posting_city_id)
  );
  deleteMatching(
    ctx.db.personnel_relationships,
    (row) => personnelIds.has(row.personnel_a_id) || personnelIds.has(row.personnel_b_id)
  );
  deleteMatching(ctx.db.personnel, (row) => factionIds.has(row.faction_id));
  deleteMatching(ctx.db.cities, (row) => row.session_id === sessionId);
  deleteMatching(ctx.db.celestial_bodies, (row) => row.session_id === sessionId);
}

function deleteMatching<Row extends RowWithId>(
  table: Table<Row>,
  predicate: (row: Row) => boolean
): void {
  const deleteById = table.id.delete;
  if (!deleteById) {
    throw new Error('scenario reload requires table primary-key delete support');
  }
  for (const row of [...table.iter()].filter(predicate)) {
    deleteById(row.id);
  }
}

function updateScenarioFaction(
  ctx: SeedDemoWorldContext,
  existing: FactionRow,
  seeded: FactionRow
): void {
  ctx.db.factions.id.update({
    ...existing,
    credits: seeded.credits,
    political_capital: seeded.political_capital,
    doctrine_vector: mergeDoctrineVector(existing.doctrine_vector, seeded.doctrine_vector),
    control_score: seeded.control_score,
    ready_for_turn: false,
  });
}

function mergeDoctrineVector(existing: string, seeded: string): string {
  try {
    const existingValue = JSON.parse(existing) as { slot?: unknown };
    const seededValue = JSON.parse(seeded) as Record<string, unknown>;
    return JSON.stringify({
      ...seededValue,
      slot: existingValue.slot ?? seededValue.slot,
    });
  } catch {
    return seeded;
  }
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

function insertScenarioCelestialBodies(
  ctx: SeedDemoWorldContext,
  rows: readonly CelestialBodyRow[]
): Map<number, number> {
  const ids = new Map<number, number>();
  for (const row of rows) {
    const inserted = ctx.db.celestial_bodies.insert({ ...row, id: 0 });
    ids.set(row.id, inserted.id);
  }
  return ids;
}

function insertScenarioCities(
  ctx: SeedDemoWorldContext,
  rows: readonly CityRow[],
  bodyIds: ReadonlyMap<number, number>,
  factionIds: ReadonlyMap<number, number>
): Map<number, number> {
  const ids = new Map<number, number>();
  for (const row of rows) {
    const bodyId = requireMappedId(bodyIds, row.body_id, 'body');
    const factionId = requireMappedId(factionIds, row.faction_id, 'faction');
    const inserted = ctx.db.cities.insert({
      ...row,
      id: 0,
      body_id: bodyId,
      faction_id: factionId,
    });
    ids.set(row.id, inserted.id);
  }
  return ids;
}

function insertScenarioPersonnel(
  ctx: SeedDemoWorldContext,
  rows: readonly PersonnelRow[],
  cityIds: ReadonlyMap<number, number>,
  factionIds: ReadonlyMap<number, number>
): Map<number, number> {
  const ids = new Map<number, number>();
  for (const row of rows) {
    const factionId = requireMappedId(factionIds, row.faction_id, 'faction');
    const postingCityId =
      row.posting_city_id === undefined
        ? undefined
        : requireMappedId(cityIds, row.posting_city_id, 'city');
    const inserted = ctx.db.personnel.insert({
      ...row,
      id: 0,
      faction_id: factionId,
      posting_city_id: postingCityId,
    });
    ids.set(row.id, inserted.id);
  }
  return ids;
}

function insertScenarioPersonnelRelationships(
  ctx: SeedDemoWorldContext,
  rows: readonly PersonnelRelationshipRow[],
  personnelIds: ReadonlyMap<number, number>
): void {
  for (const row of rows) {
    ctx.db.personnel_relationships.insert({
      ...row,
      id: 0,
      personnel_a_id: requireMappedId(personnelIds, row.personnel_a_id, 'personnel'),
      personnel_b_id: requireMappedId(personnelIds, row.personnel_b_id, 'personnel'),
    });
  }
}

function insertScenarioProposals(
  ctx: SeedDemoWorldContext,
  rows: readonly ProposalRow[],
  personnelIds: ReadonlyMap<number, number>,
  factionIds: ReadonlyMap<number, number>
): Map<number, number> {
  const ids = new Map<number, number>();
  for (const row of rows) {
    const inserted = ctx.db.proposals.insert({
      ...row,
      id: 0,
      faction_id: requireMappedId(factionIds, row.faction_id, 'faction'),
      proposing_personnel_id: requireMappedId(
        personnelIds,
        row.proposing_personnel_id,
        'personnel'
      ),
    });
    ids.set(row.id, inserted.id);
  }
  return ids;
}

function insertScenarioCommanderInbox(
  ctx: SeedDemoWorldContext,
  rows: readonly CommanderInboxRow[],
  personnelIds: ReadonlyMap<number, number>,
  factionIds: ReadonlyMap<number, number>,
  sessionId: number
): Map<number, number> {
  const ids = new Map<number, number>();
  for (const row of rows) {
    const factionId = requireMappedId(factionIds, row.faction_id, 'faction');
    const inserted = ctx.db.commander_inbox.insert({
      ...row,
      id: 0,
      faction_id: factionId,
      from_personnel_id: requireMappedId(personnelIds, row.from_personnel_id, 'personnel'),
      narrative_json: rebindNarrativeJson(row.narrative_json, factionIds, sessionId),
    });
    ids.set(row.id, inserted.id);
  }
  return ids;
}

function insertScenarioFleets(
  ctx: SeedDemoWorldContext,
  rows: readonly FleetRow[],
  cityIds: ReadonlyMap<number, number>,
  factionIds: ReadonlyMap<number, number>
): void {
  for (const row of rows) {
    ctx.db.fleets.insert({
      ...row,
      id: 0,
      faction_id: requireMappedId(factionIds, row.faction_id, 'faction'),
      posting_city_id: requireMappedId(cityIds, row.posting_city_id, 'city'),
    });
  }
}

function insertScenarioColonyShips(
  ctx: SeedDemoWorldContext,
  rows: readonly ColonyShipRow[],
  cityIds: ReadonlyMap<number, number>,
  bodyIds: ReadonlyMap<number, number>,
  factionIds: ReadonlyMap<number, number>
): void {
  for (const row of rows) {
    ctx.db.colony_ships.insert({
      ...row,
      id: 0,
      faction_id: requireMappedId(factionIds, row.faction_id, 'faction'),
      origin_city_id: requireMappedId(cityIds, row.origin_city_id, 'city'),
      destination_body_id: requireMappedId(bodyIds, row.destination_body_id, 'body'),
    });
  }
}

function insertScenarioProjects(
  ctx: SeedDemoWorldContext,
  rows: readonly ProjectRow[],
  cityIds: ReadonlyMap<number, number>,
  factionIds: ReadonlyMap<number, number>
): void {
  for (const row of rows) {
    ctx.db.projects.insert({
      ...row,
      id: 0,
      faction_id: requireMappedId(factionIds, row.faction_id, 'faction'),
      city_id: requireMappedId(cityIds, row.city_id, 'city'),
    });
  }
}

function insertScenarioIntelligenceRecords(
  ctx: SeedDemoWorldContext,
  rows: readonly IntelligenceRecordRow[],
  factionIds: ReadonlyMap<number, number>
): void {
  for (const row of rows) {
    ctx.db.intelligence_records.insert({
      ...row,
      id: 0,
      observer_faction_id: requireMappedId(
        factionIds,
        row.observer_faction_id,
        'faction'
      ),
      target_faction_id: requireMappedId(factionIds, row.target_faction_id, 'faction'),
    });
  }
}

function insertScenarioEvents(
  ctx: SeedDemoWorldContext,
  rows: readonly EventRow[],
  factionIds: ReadonlyMap<number, number>
): void {
  for (const row of rows) {
    ctx.db.events.insert({
      ...row,
      id: 0,
      faction_id:
        row.faction_id === undefined
          ? undefined
          : requireMappedId(factionIds, row.faction_id, 'faction'),
      narrative_json: row.narrative_json,
    });
  }
}

function insertScenarioTurnSummaries(
  ctx: SeedDemoWorldContext,
  rows: readonly TurnSummaryRow[],
  factionIds: ReadonlyMap<number, number>
): void {
  for (const row of rows) {
    const factionId = requireMappedId(factionIds, row.faction_id, 'faction');
    ctx.db.turn_summaries.insert({
      ...row,
      id: 0,
      faction_id: factionId,
      narrative_json: rebindNarrativeJson(row.narrative_json, factionIds, row.session_id),
    });
  }
}

function insertScenarioTradeAgreements(
  ctx: SeedDemoWorldContext,
  rows: readonly TradeAgreementRow[],
  factionIds: ReadonlyMap<number, number>
): void {
  for (const row of rows) {
    ctx.db.trade_agreements.insert({
      ...row,
      id: 0,
      faction_a_id: requireMappedId(factionIds, row.faction_a_id, 'faction'),
      faction_b_id: requireMappedId(factionIds, row.faction_b_id, 'faction'),
    });
  }
}

function insertScenarioLlmRequests(
  ctx: SeedDemoWorldContext,
  rows: readonly LlmRequestRow[],
  factionIds: ReadonlyMap<number, number>,
  proposalIds: ReadonlyMap<number, number>,
  inboxIds: ReadonlyMap<number, number>
): void {
  for (const row of rows) {
    ctx.db.llm_requests.insert({
      ...row,
      id: 0,
      faction_id: requireMappedId(factionIds, row.faction_id, 'faction'),
      context_json: rebindRequestJson(row.context_json, factionIds, proposalIds, inboxIds),
      response_json:
        row.response_json === undefined
          ? undefined
          : rebindRequestJson(row.response_json, factionIds, proposalIds, inboxIds),
    });
  }
}

function requireMappedId(
  ids: ReadonlyMap<number, number>,
  seedId: number,
  label: string
): number {
  const mapped = ids.get(seedId);
  if (mapped === undefined) {
    throw new Error(`missing ${label} id mapping for seed row ${seedId}`);
  }
  return mapped;
}

function rebindNarrativeJson(
  raw: string | undefined,
  factionIds: ReadonlyMap<number, number>,
  sessionId: number
): string | undefined {
  if (raw === undefined) return undefined;
  try {
    const parsed = JSON.parse(raw) as { metadata?: { faction_id?: number; session_id?: number } };
    const factionId = parsed.metadata?.faction_id;
    if (factionId === undefined || !factionIds.has(factionId)) return raw;
    return JSON.stringify({
      ...parsed,
      metadata: {
        ...parsed.metadata,
        faction_id: requireMappedId(factionIds, factionId, 'faction'),
        session_id: sessionId,
      },
    });
  } catch {
    return raw;
  }
}

function rebindRequestJson(
  raw: string,
  factionIds: ReadonlyMap<number, number>,
  proposalIds: ReadonlyMap<number, number>,
  inboxIds: ReadonlyMap<number, number>
): string {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return JSON.stringify(rebindRequestValue(parsed, factionIds, proposalIds, inboxIds));
  } catch {
    return raw;
  }
}

function rebindRequestValue(
  value: unknown,
  factionIds: ReadonlyMap<number, number>,
  proposalIds: ReadonlyMap<number, number>,
  inboxIds: ReadonlyMap<number, number>,
  key?: string
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => rebindRequestValue(entry, factionIds, proposalIds, inboxIds, key));
  }
  if (typeof value === 'number') {
    if (key === 'faction_id') return factionIds.get(value) ?? value;
    if (key === 'proposal_ids') return proposalIds.get(value) ?? value;
    if (key === 'commander_inbox_ids') return inboxIds.get(value) ?? value;
    return value;
  }
  if (typeof value !== 'object' || value === null) return value;

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      rebindRequestValue(entryValue, factionIds, proposalIds, inboxIds, entryKey),
    ])
  );
}

export type { Turn1SeedRows };
