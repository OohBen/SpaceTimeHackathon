import { describe, expect, it } from 'vitest';

import {
  createSessionStore,
  type PublicColonyShipProjectionRow,
  type PublicEventProjectionRow,
  type PublicFactionProjectionRow,
  type PublicFleetProjectionRow,
  type PublicWorldBodyRow,
  type PublicWorldCityProjectionRow,
} from './session-store';
import {
  selectWorldMapBodyDetail,
  selectWorldMapViewModel,
} from './world-map-view-model';

const bodies: PublicWorldBodyRow[] = [
  {
    id: 20,
    sessionId: 1,
    name: 'Mars',
    systemTier: 'inner',
    commsLagTurns: 1,
    travelTimeTurns: 2,
    resourceDeposits: '{"metals":"rich"}',
    position: '{"x":4,"y":1}',
    visibility: 'public',
  },
  {
    id: 10,
    sessionId: 1,
    name: 'Earth',
    systemTier: 'inner',
    commsLagTurns: 0,
    travelTimeTurns: 1,
    resourceDeposits: '{"energy":"moderate"}',
    position: '{"x":0,"y":0}',
    visibility: 'public',
  },
  {
    id: 99,
    sessionId: 2,
    name: 'Hidden Session Body',
    systemTier: 'outer',
    commsLagTurns: 4,
    travelTimeTurns: 7,
    resourceDeposits: '{}',
    position: '{"x":99,"y":99}',
    visibility: 'public',
  },
];

const factions: PublicFactionProjectionRow[] = [
  {
    id: 1,
    sessionId: 1,
    name: 'Earth Directorate',
    controlScore: 46,
    readyForTurn: true,
    visibility: 'public',
  },
  {
    id: 2,
    sessionId: 1,
    name: 'Mars Compact',
    controlScore: 44,
    readyForTurn: false,
    visibility: 'public',
  },
  {
    id: 8,
    sessionId: 2,
    name: 'Other Session',
    controlScore: 9,
    readyForTurn: false,
    visibility: 'public',
  },
];

const cities: PublicWorldCityProjectionRow[] = [
  {
    id: 301,
    sessionId: 1,
    bodyId: 20,
    factionId: 1,
    name: 'Ares Shipyards',
    developmentStage: 'industrial',
    visibility: 'public',
  },
  {
    id: 302,
    sessionId: 1,
    bodyId: 20,
    factionId: 2,
    name: 'Valles Holdfast',
    developmentStage: 'fortified',
    visibility: 'public',
  },
  {
    id: 101,
    sessionId: 1,
    bodyId: 10,
    factionId: 1,
    name: 'Geneva Command',
    developmentStage: 'capital',
    visibility: 'public',
  },
  {
    id: 901,
    sessionId: 2,
    bodyId: 99,
    factionId: 8,
    name: 'Wrong Session City',
    developmentStage: 'hidden',
    visibility: 'public',
  },
];

const fleets: PublicFleetProjectionRow[] = [
  {
    id: 702,
    factionId: 2,
    postingCityId: 302,
    strength: 19,
    visibility: 'public',
  },
  {
    id: 701,
    factionId: 1,
    postingCityId: 301,
    strength: 24,
    visibility: 'public',
  },
  {
    id: 999,
    factionId: 8,
    postingCityId: 901,
    strength: 99,
    visibility: 'public',
  },
];

const colonyShips: PublicColonyShipProjectionRow[] = [
  {
    id: 801,
    factionId: 1,
    destinationBodyId: 20,
    arrivesTurn: 9,
    status: 'in_transit',
    visibility: 'public',
  },
  {
    id: 899,
    factionId: 8,
    destinationBodyId: 99,
    arrivesTurn: 3,
    status: 'in_transit',
    visibility: 'public',
  },
];

const events: PublicEventProjectionRow[] = [
  {
    id: 401,
    sessionId: 1,
    turn: 8,
    eventType: 'mars_contested',
    visibility: 'public',
  },
  {
    id: 499,
    sessionId: 2,
    turn: 1,
    eventType: 'wrong_session',
    visibility: 'public',
  },
];

function makeHydratedStore() {
  const store = createSessionStore();

  store.getState().actions.hydrateSubscription({
    sessions: [
      {
        id: '1',
        code: 'SOL-001',
        status: 'active',
        currentTurn: 8,
        phase: 'planning',
      },
      {
        id: '2',
        code: 'SOL-002',
        status: 'active',
        currentTurn: 1,
        phase: 'planning',
      },
    ],
    publicGameStates: [
      {
        sessionId: '1',
        turn: 8,
        year: 2149,
        phase: 'planning',
        controlScores: { '1': 46, '2': 44 },
        visibleFactionIds: ['1', '2'],
      },
    ],
    worldBodies: bodies,
    publicFactions: factions,
    publicCities: cities,
    publicFleets: fleets,
    publicColonyShips: colonyShips,
    publicEvents: events,
  });

  return store;
}

describe('world map view model selectors', () => {
  it('filters map entities to the active session and sorts stable rows for rendering', () => {
    const store = makeHydratedStore();

    const viewModel = selectWorldMapViewModel(store.getState());

    expect(viewModel.sessionId).toBe('1');
    expect(viewModel.bodies.map((body) => body.name)).toEqual(['Earth', 'Mars']);
    expect(viewModel.cities.map((city) => city.name)).toEqual([
      'Geneva Command',
      'Ares Shipyards',
      'Valles Holdfast',
    ]);
    expect(viewModel.fleets.map((fleet) => fleet.id)).toEqual([701, 702]);
    expect(viewModel.travel.map((travel) => travel.id)).toEqual([801]);
  });

  it('exposes only public projection fields while adding map-focused derived state', () => {
    const store = makeHydratedStore();

    const viewModel = selectWorldMapViewModel(store.getState());
    const mars = viewModel.bodies.find((body) => body.name === 'Mars');

    expect(mars).toMatchObject({
      id: 20,
      control: {
        status: 'contested',
        factionIds: [1, 2],
        factionNames: ['Earth Directorate', 'Mars Compact'],
      },
      position: { x: 4, y: 1 },
      cityIds: [301, 302],
      fleetIds: [701, 702],
    });
    expect(viewModel.travel[0]).toMatchObject({
      destinationBodyId: 20,
      destinationBodyName: 'Mars',
      factionName: 'Earth Directorate',
      turnsRemaining: 1,
    });
    expect(JSON.stringify(viewModel)).not.toContain('originCityId');
    expect(JSON.stringify(viewModel)).not.toContain('orders');
    expect(JSON.stringify(viewModel)).not.toContain('resources');
  });

  it('derives alert rows for contested bodies, inbound travel, and public events', () => {
    const store = makeHydratedStore();

    const viewModel = selectWorldMapViewModel(store.getState());

    expect(viewModel.alerts.map((alert) => alert.id)).toEqual([
      'body:20:contested',
      'event:401',
      'travel:801:arriving',
    ]);
    expect(viewModel.alertsByBodyId[20].map((alert) => alert.id)).toEqual([
      'body:20:contested',
      'travel:801:arriving',
    ]);
  });

  it('returns body detail slices for overlay consumers without route or component state', () => {
    const store = makeHydratedStore();

    const detail = selectWorldMapBodyDetail(store.getState(), 20);

    expect(detail?.body.name).toBe('Mars');
    expect(detail?.cities.map((city) => city.name)).toEqual([
      'Ares Shipyards',
      'Valles Holdfast',
    ]);
    expect(detail?.fleets.map((fleet) => fleet.strength)).toEqual([24, 19]);
    expect(detail?.travel.map((travel) => travel.status)).toEqual(['in_transit']);
    expect(selectWorldMapBodyDetail(store.getState(), 999)).toBeNull();
  });
});
