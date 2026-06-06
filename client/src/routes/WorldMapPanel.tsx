import { useMemo } from 'react';
import { useStore } from 'zustand';
import { sessionStore } from '../state/session-store';
import {
  selectWorldMapViewModel,
  type WorldMapBodyView,
  type WorldMapCityView,
  type WorldMapFleetView,
  type WorldMapTravelView,
  type WorldMapViewModel,
} from '../state/world-map-view-model';

interface PlotPoint {
  x: number;
  y: number;
}

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 600;
const PADDING_X = 96;
const PADDING_Y = 72;
const FACTION_COLORS = ['#0f766e', '#b45309', '#2563eb', '#7c3aed', '#be123c'];

export function WorldMapPanel({ sessionId }: { sessionId?: number | string }) {
  const state = useStore(sessionStore);
  const viewModel = useMemo(() => {
    const scopedState =
      sessionId === undefined ? state : { ...state, activeSessionId: String(sessionId) };
    return selectWorldMapViewModel(scopedState);
  }, [sessionId, state]);

  if (!viewModel.sessionId || viewModel.bodies.length === 0) {
    return (
      <div className="world-map world-map--empty">
        <p>No public map data is available for this session yet.</p>
      </div>
    );
  }

  return (
    <div className="world-map">
      <div className="world-map__summary" aria-label="Map summary">
        <MapMetric value={viewModel.bodies.length} label="bodies" />
        <MapMetric value={viewModel.cities.length} label="cities" />
        <MapMetric value={viewModel.fleets.length} label="fleets" />
        <MapMetric value={viewModel.travel.length} label="travel" />
      </div>

      <div className="world-map__layout">
        <div className="world-map__canvas-wrap">
          <WorldMapSvg viewModel={viewModel} />
        </div>
        <MapLegend viewModel={viewModel} />
      </div>
    </div>
  );
}

function WorldMapSvg({ viewModel }: { viewModel: WorldMapViewModel }) {
  const plot = createPlotter(viewModel.bodies);

  return (
    <svg
      className="world-map__svg"
      role="img"
      aria-label="Solar system schematic map"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id="world-map-grid" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#d6ded9" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="#f8faf9" />
      <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="url(#world-map-grid)" />
      <line
        className="world-map__axis"
        x1={PADDING_X}
        y1={VIEWBOX_HEIGHT / 2}
        x2={VIEWBOX_WIDTH - PADDING_X}
        y2={VIEWBOX_HEIGHT / 2}
      />

      {viewModel.travel.map((travel, index) => (
        <TravelRoute
          key={travel.id}
          travel={travel}
          destination={viewModel.bodiesById[travel.destinationBodyId]}
          plot={plot}
          index={index}
        />
      ))}

      {viewModel.bodies.map((body) => (
        <BodyMarker
          key={body.id}
          body={body}
          cities={viewModel.citiesByBodyId[body.id] ?? []}
          fleets={viewModel.fleetsByBodyId[body.id] ?? []}
          plot={plot}
        />
      ))}
    </svg>
  );
}

function BodyMarker({
  body,
  cities,
  fleets,
  plot,
}: {
  body: WorldMapBodyView;
  cities: WorldMapCityView[];
  fleets: WorldMapFleetView[];
  plot: (body: WorldMapBodyView) => PlotPoint;
}) {
  const point = plot(body);
  const radius = body.control.status === 'contested' ? 34 : 28;
  const controlLabel = body.control.controllingFactionName
    ? `controlled by ${body.control.controllingFactionName}`
    : body.control.status;

  return (
    <g
      aria-label={`body ${body.name} ${controlLabel}`}
      className={`world-map__body world-map__body--${body.control.status}`}
    >
      <circle
        cx={point.x}
        cy={point.y}
        r={radius + 7}
        className="world-map__body-halo"
      />
      <circle
        cx={point.x}
        cy={point.y}
        r={radius}
        className="world-map__body-core"
      />
      <text x={point.x} y={point.y - radius - 14} className="world-map__body-label">
        {body.name}
      </text>
      <text x={point.x} y={point.y + radius + 24} className="world-map__body-meta">
        {body.systemTier}
      </text>

      {cities.map((city, index) => (
        <CityMarker
          key={city.id}
          city={city}
          origin={point}
          index={index}
          total={cities.length}
        />
      ))}

      {fleets.map((fleet, index) => (
        <FleetMarker
          key={fleet.id}
          fleet={fleet}
          origin={point}
          index={index}
          total={fleets.length}
        />
      ))}
    </g>
  );
}

function CityMarker({
  city,
  origin,
  index,
  total,
}: {
  city: WorldMapCityView;
  origin: PlotPoint;
  index: number;
  total: number;
}) {
  const angle = orbitAngle(index, total, -120);
  const marker = radialPoint(origin, 48, angle);
  const color = colorForFaction(city.factionId);

  return (
    <rect
      aria-label={`city marker ${city.name}`}
      className="world-map__city-marker"
      x={marker.x - 7}
      y={marker.y - 7}
      width="14"
      height="14"
      rx="2"
      fill={color}
    />
  );
}

function FleetMarker({
  fleet,
  origin,
  index,
  total,
}: {
  fleet: WorldMapFleetView;
  origin: PlotPoint;
  index: number;
  total: number;
}) {
  const angle = orbitAngle(index, total, 60);
  const marker = radialPoint(origin, 62, angle);
  const color = colorForFaction(fleet.factionId);
  const points = [
    `${marker.x},${marker.y - 11}`,
    `${marker.x - 10},${marker.y + 8}`,
    `${marker.x + 10},${marker.y + 8}`,
  ].join(' ');

  return (
    <polygon
      aria-label={`fleet marker ${fleet.factionName} strength ${fleet.strength}`}
      className="world-map__fleet-marker"
      points={points}
      fill={color}
    />
  );
}

function TravelRoute({
  travel,
  destination,
  plot,
  index,
}: {
  travel: WorldMapTravelView;
  destination: WorldMapBodyView | undefined;
  plot: (body: WorldMapBodyView) => PlotPoint;
  index: number;
}) {
  if (!destination) return null;

  const end = plot(destination);
  const laneOffset = (index % 3) * 18;
  const start = {
    x: Math.max(40, end.x - 180),
    y: Math.max(44, end.y - 124 + laneOffset),
  };

  return (
    <g aria-label={`travel route ${travel.factionName} to ${destination.name} arrives turn ${travel.arrivesTurn}`}>
      <path
        className="world-map__travel-route"
        d={`M ${start.x} ${start.y} C ${start.x + 90} ${start.y} ${end.x - 96} ${end.y - 88} ${end.x - 20} ${end.y - 32}`}
      />
      <circle
        className="world-map__travel-dot"
        cx={end.x - 20}
        cy={end.y - 32}
        r="7"
      />
      <text x={end.x - 112} y={end.y - 84} className="world-map__travel-label">
        Arrives T{travel.arrivesTurn}
      </text>
    </g>
  );
}

function MapLegend({ viewModel }: { viewModel: WorldMapViewModel }) {
  const factions = uniqueFactions(viewModel);

  return (
    <aside className="world-map__legend" aria-label="Map legend">
      <div>
        <h4>Faction control</h4>
        <ul className="world-map__legend-list">
          {factions.map((faction) => (
            <li key={faction.id}>
              <span
                className="world-map__swatch"
                style={{ background: colorForFaction(faction.id) }}
                aria-hidden="true"
              />
              <span>{faction.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4>Map states</h4>
        <ul className="world-map__legend-list">
          <li>
            <span className="world-map__swatch world-map__swatch--controlled" aria-hidden="true" />
            <span>Controlled</span>
          </li>
          <li>
            <span className="world-map__swatch world-map__swatch--contested" aria-hidden="true" />
            <span>Contested</span>
          </li>
          <li>
            <span className="world-map__swatch world-map__swatch--travel" aria-hidden="true" />
            <span>Inbound travel</span>
          </li>
        </ul>
      </div>

      <div>
        <h4>Body ledger</h4>
        <ol className="world-map__body-ledger">
          {viewModel.bodies.map((body) => (
            <li key={body.id}>
              <strong>{body.name}</strong>
              <span>{controlSummary(body)}</span>
              <span>
                {(viewModel.citiesByBodyId[body.id] ?? []).length} cities,
                {' '}
                {(viewModel.fleetsByBodyId[body.id] ?? []).length} fleets,
                {' '}
                {(viewModel.travelByDestinationBodyId[body.id] ?? []).length} inbound
              </span>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}

function MapMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="world-map__metric">
      <strong>{value} {label}</strong>
    </div>
  );
}

function createPlotter(bodies: readonly WorldMapBodyView[]) {
  const xs = bodies.map((body) => body.position.x);
  const ys = bodies.map((body) => body.position.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const width = VIEWBOX_WIDTH - PADDING_X * 2;
  const height = VIEWBOX_HEIGHT - PADDING_Y * 2;

  return (body: WorldMapBodyView): PlotPoint => ({
    x: PADDING_X + ((body.position.x - minX) / spanX) * width,
    y: VIEWBOX_HEIGHT - PADDING_Y - ((body.position.y - minY) / spanY) * height,
  });
}

function uniqueFactions(viewModel: WorldMapViewModel): Array<{ id: number; name: string }> {
  const factions = new Map<number, string>();

  for (const city of viewModel.cities) {
    factions.set(city.factionId, city.factionName);
  }
  for (const fleet of viewModel.fleets) {
    factions.set(fleet.factionId, fleet.factionName);
  }
  for (const travel of viewModel.travel) {
    factions.set(travel.factionId, travel.factionName);
  }

  return [...factions.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.id - right.id);
}

function controlSummary(body: WorldMapBodyView): string {
  if (body.control.status === 'controlled' && body.control.controllingFactionName) {
    return `Controlled by ${body.control.controllingFactionName}`;
  }

  if (body.control.status === 'contested') {
    return `Contested by ${body.control.factionNames.join(' / ')}`;
  }

  return 'Uncontrolled';
}

function colorForFaction(factionId: number): string {
  return FACTION_COLORS[Math.abs(factionId) % FACTION_COLORS.length];
}

function orbitAngle(index: number, total: number, offset: number): number {
  const step = 360 / Math.max(1, total);
  return offset + index * step;
}

function radialPoint(origin: PlotPoint, radius: number, angleDegrees: number): PlotPoint {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: origin.x + Math.cos(radians) * radius,
    y: origin.y + Math.sin(radians) * radius,
  };
}
