/* ============================================================
   SOLAR DOMINION — Tactical Command data shapes (TS contract)
   Derived from _design/data.jsx + the fields the components
   (map.jsx / inbox.jsx / panels.jsx / tactical-app.jsx) read.
   These are the PRESENTATIONAL shapes the components consume —
   useTacticalData() maps live SpacetimeDB rows into them.
   ============================================================ */

export type TacControl = 'imperium' | 'accord' | 'contested' | 'neutral' | 'star';
export type TacConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type TacProposalStatus =
  | 'unread'
  | 'read'
  | 'approved'
  | 'rejected'
  | 'deferred'
  | 'auto_deferred';
export type TacDepartment = 'COMMAND' | 'MILITARY' | 'RESEARCH' | 'INDUSTRY' | 'INTEL' | string;
export type TacAlertLevel = 'critical' | 'opportunity';
export type TacShipStatus = 'preparing' | 'in_transit' | 'arrived' | 'lost' | string;
export type TacLlmStatus = 'complete' | 'processing' | 'queued' | 'failed' | string;
export type TacRelationshipType = 'trust' | 'alliance' | 'mentor' | 'rivalry' | 'tension' | string;

/* ---- doctrine vector: 5 strategic axes the DoctrinePanel renders ---- */
export interface TacDoctrine {
  Expansion: number;
  Industry: number;
  Military: number;
  Research: number;
  Diplomacy: number;
}

/* ---- factions ---- */
export interface TacFaction {
  id: string;
  name: string;
  tag: string;
  color: string;
  color2: string;
  credits: number;
  creditsDelta: number;
  politicalCapital: number;
  pcDelta: number;
  controlScore: number;
  doctrine: TacDoctrine;
}

/* the opposing faction, public projection only */
export interface TacEnemy {
  id: string;
  name: string;
  controlScore: number;
  doctrine: TacDoctrine;
}

/* ---- session / turn ---- */
export interface TacSession {
  id: string;
  state: string;
  year: number;
  turn: number;
  maxTurn: number;
  phase: string;
  deadline: number;
  winnerFactionId: string | null;
}

export interface TacTurnPhase {
  id: string;
  label: string;
  desc: string;
}

/* ---- celestial bodies (live data merged with static layout) ---- */
export interface TacDeposits {
  [resource: string]: string;
}

export interface TacBody {
  id: string;
  name: string;
  tier: string;
  cx: number;
  cy: number;
  r: number;
  orbit: number;
  control: TacControl;
  sub: string;
  lag: number;
  travel: number;
  moonOf?: string;
  moonAngle?: number;
  moonDist?: number;
  capital?: TacControl;
  hot?: boolean;
  opportunity?: boolean;
  deposits?: TacDeposits;
}

/* ---- cities ---- */
export interface TacCity {
  id: string;
  bodyId: string;
  faction: TacControl;
  name: string;
  pop: string;
  infra: number;
  morale: number;
  ind: number;
  res: number;
  garrison: number;
  stage: string;
  supply: string;
}

/* ---- personnel ---- */
export interface TacPersonnel {
  id: string;
  name: string;
  role: string;
  dept: TacDepartment;
  city: string;
  init: string;
  competence: number;
  creativity: number;
  reliability: number;
  ambition: number;
  political: number;
  comms: number;
  loyalty: number;
  autonomy: number;
  morale: number;
  burnout: number;
  salary: number;
}

/* keyed roster: components index by personnel id, e.g. R[p.from] */
export type TacRoster = Record<string, TacPersonnel>;

/* ---- relationships ---- */
export interface TacRelationship {
  id: string;
  a: string;
  b: string;
  type: TacRelationshipType;
  strength: number;
  note: string;
}

/* ---- proposals ---- */
export interface TacProposalCost {
  credits: number;
  teams: number;
}

export interface TacProposal {
  id: string;
  from: string;
  dept: TacDepartment;
  confidence: TacConfidence;
  status: TacProposalStatus;
  title: string;
  cost: TacProposalCost;
  summary: string;
  body: string[];
  rationale: string;
}

/* ---- turn summaries (resolution feed) ---- */
export interface TacResEvent {
  f: 'a' | 'b' | 'n';
  t: string;
  tag?: 'win' | 'loss';
  tagt?: string;
}

export interface TacResPhase {
  name: string;
  events: TacResEvent[];
}

export interface TacTurnControl {
  self: number;
  enemy: number;
  delta: number;
  selfName: string;
  enemyName: string;
  note: string;
}

export interface TacDeltaRow {
  k: string;
  v: string;
  d?: string;
  dir?: 'up' | 'down';
}

export interface TacDeltaGroup {
  group: string;
  rows: TacDeltaRow[];
}

export interface TacTurnSummary {
  turnLabel: string;
  control: TacTurnControl;
  phases: TacResPhase[];
  deltas: TacDeltaGroup[];
  officer: { from: string; text: string };
}

/* ---- briefings (commander inbox, non-proposal) ---- */
export interface TacBriefing {
  id: string;
  from: string;
  dept: TacDepartment;
  kind?: 'turn_summary' | string;
  requiresDecision?: boolean;
  subject: string;
  body?: string;
  summary?: TacTurnSummary;
}

/* ---- fleets ---- */
export interface TacFleet {
  id: string;
  name: string;
  postingBodyId: string;
  strength: number;
  orders: string;
}

/* ---- colony ships ---- */
export interface TacColonyShip {
  id: string;
  name: string;
  originBodyId: string;
  destBodyId: string;
  manifest: string;
  departedTurn: number;
  arrivesTurn: number;
  status: TacShipStatus;
}

/* ---- projects ---- */
export interface TacProject {
  id: string;
  cityId: string;
  city: string;
  type: string;
  name: string;
  progress: number;
  assigned: string;
  estCompletion: string;
  status: string;
}

/* ---- LLM request queue ---- */
export interface TacLlmReq {
  id: string;
  type: string;
  status: TacLlmStatus;
  model: string;
  createdTurn: number;
  note: string;
}

/* ---- map alerts ---- */
export interface TacAlert {
  id: string;
  bodyId: string;
  level: TacAlertLevel;
  label: string;
}

/* ---- intel (IntelPanel reads subject / acc / body) ---- */
export interface TacIntel {
  id: string;
  subject: string;
  acc?: number;
  body: string;
}

/* ---- diplomacy (DiplomacyPanel reads these) ---- */
export interface TacDiplo {
  enemyName: string;
  posture: string;
  trades: string | number;
  lastNeg: string;
  ceasefire: string;
  note: string;
}
