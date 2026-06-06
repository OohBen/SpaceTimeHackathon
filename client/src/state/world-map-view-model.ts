import type {
  PublicColonyShipProjectionRow,
  PublicEventProjectionRow,
  PublicFactionProjectionRow,
  PublicFleetProjectionRow,
  PublicWorldBodyRow,
  PublicWorldCityProjectionRow,
  SessionState,
} from './session-store';

export interface WorldMapPoint {
  x: number;
  y: number;
}

export type WorldMapControlStatus = 'uncontrolled' | 'controlled' | 'contested';
export type WorldMapAlertSeverity = 'info' | 'warning' | 'critical';

export interface WorldMapControlState {
  status: WorldMapControlStatus;
  factionIds: number[];
  factionNames: string[];
  controllingFactionId: number | null;
  controllingFactionName: string | null;
}

export interface WorldMapBodyView {
  id: number;
  name: string;
  systemTier: string;
  commsLagTurns: number;
  travelTimeTurns: number;
  resourceDeposits: string;
  position: WorldMapPoint;
  control: WorldMapControlState;
  cityIds: number[];
  fleetIds: number[];
  travelIds: number[];
  alertIds: string[];
  visibility: 'public';
}

export interface WorldMapCityView {
  id: number;
  bodyId: number;
  factionId: number;
  factionName: string;
  name: string;
  developmentStage: string;
  visibility: 'public';
}

export interface WorldMapFleetView {
  id: number;
  cityId: number;
  bodyId: number;
  factionId: number;
  factionName: string;
  strength: number;
  visibility: 'public';
}

export interface WorldMapTravelView {
  id: number;
  type: 'colonyShip';
  factionId: number;
  factionName: string;
  destinationBodyId: number;
  destinationBodyName: string;
  arrivesTurn: number;
  turnsRemaining: number | null;
  status: string;
  visibility: 'public';
}

export interface WorldMapAlert {
  id: string;
  severity: WorldMapAlertSeverity;
  label: string;
  bodyId: number | null;
  turn: number | null;
  eventType: string | null;
}

export interface WorldMapViewModel {
  sessionId: string | null;
  turn: number | null;
  bodies: WorldMapBodyView[];
  cities: WorldMapCityView[];
  fleets: WorldMapFleetView[];
  travel: WorldMapTravelView[];
  alerts: WorldMapAlert[];
  bodiesById: Record<number, WorldMapBodyView>;
  citiesById: Record<number, WorldMapCityView>;
  fleetsById: Record<number, WorldMapFleetView>;
  travelById: Record<number, WorldMapTravelView>;
  alertsById: Record<string, WorldMapAlert>;
  citiesByBodyId: Record<number, WorldMapCityView[]>;
  fleetsByBodyId: Record<number, WorldMapFleetView[]>;
  travelByDestinationBodyId: Record<number, WorldMapTravelView[]>;
  alertsByBodyId: Record<number, WorldMapAlert[]>;
}

export interface WorldMapBodyDetail {
  body: WorldMapBodyView;
  cities: WorldMapCityView[];
  fleets: WorldMapFleetView[];
  travel: WorldMapTravelView[];
  alerts: WorldMapAlert[];
}

export function selectWorldMapViewModel(state: SessionState): WorldMapViewModel {
  const sessionId = state.activeSessionId;
  if (!sessionId) return emptyWorldMapViewModel(null);

  const turn =
    state.publicGameStateBySessionId[sessionId]?.turn ??
    state.sessionsById[sessionId]?.currentTurn ??
    null;
  const bodies = Object.values(state.worldBodiesById)
    .filter((body) => isActiveSessionRow(body, sessionId))
    .sort(byId);
  const factions = Object.values(state.publicFactionsById)
    .filter((faction) => isActiveSessionRow(faction, sessionId))
    .sort(byId);
  const cities = Object.values(state.publicCitiesById)
    .filter((city) => isActiveSessionRow(city, sessionId))
    .sort(byId);

  const bodyRowsById = toMap(bodies);
  const factionRowsById = toMap(factions);
  const cityRowsById = toMap(cities);
  const fleets = Object.values(state.publicFleetsById)
    .filter((fleet) => cityRowsById.has(fleet.postingCityId))
    .sort(byId);
  const travel = Object.values(state.publicColonyShipsById)
    .filter((ship) => bodyRowsById.has(ship.destinationBodyId))
    .sort(byId);
  const events = Object.values(state.publicEventsById)
    .filter((event) => isActiveSessionRow(event, sessionId))
    .sort(byId);

  const cityViews = cities.map((city) => toCityView(city, factionRowsById));
  const fleetViews = fleets.map((fleet) => toFleetView(fleet, cityRowsById, factionRowsById));
  const travelViews = travel.map((ship) => toTravelView(ship, bodyRowsById, factionRowsById, turn));
  const cityViewsByBodyId = groupByNumber(cityViews, (city) => city.bodyId);
  const fleetViewsByBodyId = groupByNumber(fleetViews, (fleet) => fleet.bodyId);
  const travelViewsByDestinationBodyId = groupByNumber(
    travelViews,
    (ship) => ship.destinationBodyId,
  );

  const bodyViewsWithoutAlerts = bodies.map((body) =>
    toBodyView(
      body,
      cityViewsByBodyId[body.id] ?? [],
      fleetViewsByBodyId[body.id] ?? [],
      travelViewsByDestinationBodyId[body.id] ?? [],
      factionRowsById,
    ),
  );
  const alerts = buildAlerts(bodyViewsWithoutAlerts, travelViews, events).sort(byAlertId);
  const alertsByBodyId = groupAlertsByBody(alerts);
  const bodyViews = bodyViewsWithoutAlerts.map((body) => ({
    ...body,
    alertIds: (alertsByBodyId[body.id] ?? []).map((alert) => alert.id),
  }));

  return {
    sessionId,
    turn,
    bodies: bodyViews,
    cities: cityViews,
    fleets: fleetViews,
    travel: travelViews,
    alerts,
    bodiesById: indexViews(bodyViews),
    citiesById: indexViews(cityViews),
    fleetsById: indexViews(fleetViews),
    travelById: indexViews(travelViews),
    alertsById: indexAlerts(alerts),
    citiesByBodyId: cityViewsByBodyId,
    fleetsByBodyId: fleetViewsByBodyId,
    travelByDestinationBodyId: travelViewsByDestinationBodyId,
    alertsByBodyId,
  };
}

export function selectWorldMapBodyDetail(
  state: SessionState,
  bodyId: number,
): WorldMapBodyDetail | null {
  const viewModel = selectWorldMapViewModel(state);
  const body = viewModel.bodiesById[bodyId];
  if (!body) return null;

  return {
    body,
    cities: body.cityIds.map((id) => viewModel.citiesById[id]).filter(isDefined),
    fleets: body.fleetIds.map((id) => viewModel.fleetsById[id]).filter(isDefined),
    travel: body.travelIds.map((id) => viewModel.travelById[id]).filter(isDefined),
    alerts: body.alertIds.map((id) => viewModel.alertsById[id]).filter(isDefined),
  };
}

function toBodyView(
  body: PublicWorldBodyRow,
  cities: readonly WorldMapCityView[],
  fleets: readonly WorldMapFleetView[],
  travel: readonly WorldMapTravelView[],
  factionsById: ReadonlyMap<number, PublicFactionProjectionRow>,
): WorldMapBodyView {
  return {
    id: body.id,
    name: body.name,
    systemTier: body.systemTier,
    commsLagTurns: body.commsLagTurns,
    travelTimeTurns: body.travelTimeTurns,
    resourceDeposits: body.resourceDeposits,
    position: parsePoint(body.position),
    control: deriveControl(cities, factionsById),
    cityIds: cities.map((city) => city.id),
    fleetIds: fleets.map((fleet) => fleet.id),
    travelIds: travel.map((ship) => ship.id),
    alertIds: [],
    visibility: 'public',
  };
}

function toCityView(
  city: PublicWorldCityProjectionRow,
  factionsById: ReadonlyMap<number, PublicFactionProjectionRow>,
): WorldMapCityView {
  return {
    id: city.id,
    bodyId: city.bodyId,
    factionId: city.factionId,
    factionName: factionName(city.factionId, factionsById),
    name: city.name,
    developmentStage: city.developmentStage,
    visibility: 'public',
  };
}

function toFleetView(
  fleet: PublicFleetProjectionRow,
  citiesById: ReadonlyMap<number, PublicWorldCityProjectionRow>,
  factionsById: ReadonlyMap<number, PublicFactionProjectionRow>,
): WorldMapFleetView {
  const city = citiesById.get(fleet.postingCityId);
  return {
    id: fleet.id,
    cityId: fleet.postingCityId,
    bodyId: city?.bodyId ?? 0,
    factionId: fleet.factionId,
    factionName: factionName(fleet.factionId, factionsById),
    strength: fleet.strength,
    visibility: 'public',
  };
}

function toTravelView(
  ship: PublicColonyShipProjectionRow,
  bodiesById: ReadonlyMap<number, PublicWorldBodyRow>,
  factionsById: ReadonlyMap<number, PublicFactionProjectionRow>,
  turn: number | null,
): WorldMapTravelView {
  return {
    id: ship.id,
    type: 'colonyShip',
    factionId: ship.factionId,
    factionName: factionName(ship.factionId, factionsById),
    destinationBodyId: ship.destinationBodyId,
    destinationBodyName: bodiesById.get(ship.destinationBodyId)?.name ?? 'Unknown body',
    arrivesTurn: ship.arrivesTurn,
    turnsRemaining: turn === null ? null : Math.max(0, ship.arrivesTurn - turn),
    status: ship.status,
    visibility: 'public',
  };
}

function deriveControl(
  cities: readonly WorldMapCityView[],
  factionsById: ReadonlyMap<number, PublicFactionProjectionRow>,
): WorldMapControlState {
  const factionIds = [...new Set(cities.map((city) => city.factionId))].sort((a, b) => a - b);
  const factionNames = factionIds.map((id) => factionName(id, factionsById));
  const controlledBy = factionIds.length === 1 ? factionIds[0] : null;

  return {
    status:
      factionIds.length === 0 ? 'uncontrolled' : factionIds.length === 1 ? 'controlled' : 'contested',
    factionIds,
    factionNames,
    controllingFactionId: controlledBy,
    controllingFactionName: controlledBy === null ? null : factionName(controlledBy, factionsById),
  };
}

function buildAlerts(
  bodies: readonly WorldMapBodyView[],
  travel: readonly WorldMapTravelView[],
  events: readonly PublicEventProjectionRow[],
): WorldMapAlert[] {
  return [
    ...bodies
      .filter((body) => body.control.status === 'contested')
      .map((body) => ({
        id: `body:${body.id}:contested`,
        severity: 'warning' as const,
        label: `${body.name} contested`,
        bodyId: body.id,
        turn: null,
        eventType: null,
      })),
    ...events.map((event) => ({
      id: `event:${event.id}`,
      severity: eventSeverity(event.eventType),
      label: event.eventType.replace(/_/g, ' '),
      bodyId: null,
      turn: event.turn,
      eventType: event.eventType,
    })),
    ...travel
      .filter((ship) => ship.turnsRemaining !== null && ship.turnsRemaining <= 1)
      .map((ship) => ({
        id: `travel:${ship.id}:arriving`,
        severity: 'info' as const,
        label: `${ship.destinationBodyName} arrival imminent`,
        bodyId: ship.destinationBodyId,
        turn: null,
        eventType: null,
      })),
  ];
}

function eventSeverity(eventType: string): WorldMapAlertSeverity {
  if (eventType.includes('critical') || eventType.includes('attack')) return 'critical';
  if (eventType.includes('contested') || eventType.includes('shortage')) return 'warning';
  return 'info';
}

function parsePoint(raw: string): WorldMapPoint {
  try {
    const parsed = JSON.parse(raw) as Partial<WorldMapPoint>;
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    return { x: 0, y: 0 };
  }
  return { x: 0, y: 0 };
}

function factionName(
  factionId: number,
  factionsById: ReadonlyMap<number, PublicFactionProjectionRow>,
): string {
  return factionsById.get(factionId)?.name ?? `Faction ${factionId}`;
}

function isActiveSessionRow(
  row: { sessionId: number | string },
  activeSessionId: string,
): boolean {
  return String(row.sessionId) === activeSessionId;
}

function toMap<T extends { id: number }>(rows: readonly T[]): Map<number, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function groupByNumber<T>(rows: readonly T[], keyFor: (row: T) => number): Record<number, T[]> {
  return rows.reduce<Record<number, T[]>>((grouped, row) => {
    const key = keyFor(row);
    grouped[key] = [...(grouped[key] ?? []), row];
    return grouped;
  }, {});
}

function groupAlertsByBody(alerts: readonly WorldMapAlert[]): Record<number, WorldMapAlert[]> {
  return alerts.reduce<Record<number, WorldMapAlert[]>>((grouped, alert) => {
    if (alert.bodyId === null) return grouped;
    grouped[alert.bodyId] = [...(grouped[alert.bodyId] ?? []), alert];
    return grouped;
  }, {});
}

function indexViews<T extends { id: number }>(views: readonly T[]): Record<number, T> {
  return views.reduce<Record<number, T>>((indexed, view) => {
    indexed[view.id] = view;
    return indexed;
  }, {});
}

function indexAlerts(alerts: readonly WorldMapAlert[]): Record<string, WorldMapAlert> {
  return alerts.reduce<Record<string, WorldMapAlert>>((indexed, alert) => {
    indexed[alert.id] = alert;
    return indexed;
  }, {});
}

function byId<T extends { id: number }>(left: T, right: T): number {
  return left.id - right.id;
}

function byAlertId(left: WorldMapAlert, right: WorldMapAlert): number {
  return left.id.localeCompare(right.id);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function emptyWorldMapViewModel(sessionId: string | null): WorldMapViewModel {
  return {
    sessionId,
    turn: null,
    bodies: [],
    cities: [],
    fleets: [],
    travel: [],
    alerts: [],
    bodiesById: {},
    citiesById: {},
    fleetsById: {},
    travelById: {},
    alertsById: {},
    citiesByBodyId: {},
    fleetsByBodyId: {},
    travelByDestinationBodyId: {},
    alertsByBodyId: {},
  };
}
