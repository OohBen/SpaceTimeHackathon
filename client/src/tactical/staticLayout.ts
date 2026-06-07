/* ============================================================
   SOLAR DOMINION — Static presentational layout
   These constants are NOT in the DB: orbital positions, radii,
   tiers, moon geometry, and the turn-phase pipeline labels.
   Kept EXACTLY as in _design/data.jsx. useTacticalData() merges
   live celestial_bodies into BODY_LAYOUT by lowercased name.
   ============================================================ */
import type { TacBody, TacTurnPhase } from './types';

/* Layout entry: positional fields only (control/sub come from live merge,
   but defaults below preserve the design's static scenario fallback). */
export interface TacBodyLayout extends TacBody {
  /* lowercased name used as the merge key against live celestial_bodies */
  layoutKey: string;
}

/* ---- Celestial bodies (orbital layout; cx/cy in 1000x680 viewBox) ----
   control: 'imperium' | 'accord' | 'contested' | 'neutral' | 'star' */
export const BODY_LAYOUT: TacBodyLayout[] = [
  { id: 'sol', layoutKey: 'sol', name: 'SOL', tier: 'star', cx: 500, cy: 340, r: 30, orbit: 0, control: 'star',
    sub: 'G-TYPE STAR', lag: 0, travel: 0 },
  { id: 'mercury', layoutKey: 'mercury', name: 'MERCURY', tier: 'inner', cx: 0, cy: 0, r: 6, orbit: 78, control: 'neutral',
    sub: 'BARREN', lag: 1, travel: 2, deposits: { Metals: 'HIGH', Volatiles: 'LOW' } },
  { id: 'venus', layoutKey: 'venus', name: 'VENUS', tier: 'inner', cx: 0, cy: 0, r: 9, orbit: 120, control: 'neutral',
    sub: 'HOSTILE', lag: 1, travel: 2, deposits: { Volatiles: 'MED', Metals: 'LOW' } },
  { id: 'earth', layoutKey: 'earth', name: 'EARTH', tier: 'earth', cx: 0, cy: 0, r: 13, orbit: 168, control: 'imperium',
    sub: 'CAPITAL · 4 CITIES', lag: 0, travel: 0, capital: 'imperium',
    deposits: { Metals: 'MED', Volatiles: 'HIGH', Rare: 'MED' } },
  { id: 'luna', layoutKey: 'luna', name: 'LUNA', tier: 'earth', cx: 0, cy: 0, r: 6, orbit: 168, moonOf: 'earth', moonAngle: 58, moonDist: 42, control: 'accord',
    sub: 'COALITION HOLD', lag: 0, travel: 1, deposits: { Metals: 'HIGH', Rare: 'LOW' } },
  { id: 'mars', layoutKey: 'mars', name: 'MARS', tier: 'inner', cx: 0, cy: 0, r: 11, orbit: 232, control: 'contested',
    sub: '⚠ CONTESTED · 3 CITIES', lag: 1, travel: 3, hot: true,
    deposits: { Metals: 'HIGH', Volatiles: 'MED', Rare: 'HIGH' } },
  { id: 'ceres', layoutKey: 'ceres', name: 'CERES', tier: 'belt', cx: 0, cy: 0, r: 8, orbit: 290, control: 'accord',
    sub: 'BELT STRONGHOLD', lag: 2, travel: 4, deposits: { Metals: 'HIGH', Rare: 'MED', Volatiles: 'HIGH' } },
  { id: 'jupiter', layoutKey: 'jupiter', name: 'JUPITER', tier: 'jupiter', cx: 0, cy: 0, r: 20, orbit: 360, control: 'neutral',
    sub: 'GAS GIANT', lag: 3, travel: 6, deposits: { Volatiles: 'EXTREME' } },
  { id: 'europa', layoutKey: 'europa', name: 'EUROPA', tier: 'jupiter', cx: 0, cy: 0, r: 6, orbit: 360, moonOf: 'jupiter', moonAngle: 150, moonDist: 52, control: 'imperium',
    sub: 'IMPERIUM OUTPOST', lag: 3, travel: 6, deposits: { Volatiles: 'HIGH', Rare: 'MED' } },
  { id: 'callisto', layoutKey: 'callisto', name: 'CALLISTO', tier: 'jupiter', cx: 0, cy: 0, r: 7, orbit: 360, moonOf: 'jupiter', moonAngle: 352, moonDist: 70, control: 'neutral',
    sub: '◎ OPPORTUNITY', lag: 3, travel: 6, opportunity: true,
    deposits: { Metals: 'HIGH', Rare: 'EXTREME', Volatiles: 'MED' } },
  { id: 'saturn', layoutKey: 'saturn', name: 'SATURN', tier: 'saturn', cx: 0, cy: 0, r: 18, orbit: 432, control: 'neutral',
    sub: 'FRONTIER · RINGED', lag: 4, travel: 8, deposits: { Volatiles: 'EXTREME', Rare: 'LOW' } },
  { id: 'titan', layoutKey: 'titan', name: 'TITAN', tier: 'saturn', cx: 0, cy: 0, r: 7, orbit: 432, moonOf: 'saturn', moonAngle: 60, moonDist: 40, control: 'neutral',
    sub: 'FRONTIER', lag: 4, travel: 8, deposits: { Volatiles: 'EXTREME' } },
];

/* fast lookup by lowercased body name (matches live celestial_bodies.name) */
export const BODY_LAYOUT_BY_KEY: Record<string, TacBodyLayout> = Object.fromEntries(
  BODY_LAYOUT.map((b) => [b.layoutKey, b]),
);

/* ---- Authoritative turn_phase pipeline (spec: game_sessions.turn_phase) ---- */
export const TURN_PHASES: TacTurnPhase[] = [
  { id: 'world_update', label: 'World Update', desc: 'Simulation reports what changed since last turn.' },
  { id: 'deliberation', label: 'Deliberation', desc: 'Officers draft proposals from the new situation.' },
  { id: 'decision', label: 'Decision', desc: 'You approve, reject, defer & allocate. Timer applies.' },
  { id: 'resolution', label: 'Resolution', desc: 'Both turns resolve at once; outcomes revealed.' },
  { id: 'summary', label: 'Summary', desc: 'Turn summary recorded; acknowledge to continue.' },
  { id: 'complete', label: 'Complete', desc: 'Turn closed; advance to the next world update.' },
];
