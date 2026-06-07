/* ============================================================
   SOLAR DOMINION — Tactical data adapter
   Subscribes to `sessionStore` and maps LIVE SpacetimeDB rows
   into the design `types.ts` shapes for the SINGLE current-player
   faction (no POV/enemy-as-self). The shell + ported components
   consume this bundle.

   Field-by-field mapping notes live inline. Where a live field is
   genuinely absent in the current subscription surface, the value
   is derived or returned empty and flagged with `// LIVE-GAP:`.
   ============================================================ */
import { useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import {
  sessionStore,
  selectActiveSession,
  selectCurrentPlayerSlot,
  selectFactionById,
  selectFactionsForSession,
  selectPersonnelRoster,
  selectInboxProposalsForCurrentPlayer,
  selectIntelligenceRecords,
  selectLatestTurnSummaryForFaction,
  selectTurnSummaryForCurrentPlayer,
  selectLlmRequestsForCurrentPlayer,
  selectPublicGameState,
  type SessionState,
  type SessionStore,
  type FactionRow,
  type PersonnelRow,
  type ProposalRow,
  type PublicWorldBodyRow,
  type PublicWorldCityProjectionRow,
  type PublicFleetProjectionRow,
  type PublicColonyShipProjectionRow,
  type PublicFactionProjectionRow,
  type IntelligenceRecordRow,
  type TurnSummaryRow,
  type LlmRequestRow,
  type PublicGameStateRow,
  type SessionRow,
  type PlayerSlotRow,
} from '../state/session-store';
import { BODY_LAYOUT, BODY_LAYOUT_BY_KEY } from './staticLayout';
import type {
  TacFaction,
  TacEnemy,
  TacSession,
  TacBody,
  TacCity,
  TacPersonnel,
  TacRoster,
  TacRelationship,
  TacProposal,
  TacBriefing,
  TacFleet,
  TacColonyShip,
  TacProject,
  TacLlmReq,
  TacAlert,
  TacIntel,
  TacDiplo,
  TacDoctrine,
  TacTurnSummary,
  TacControl,
  TacConfidence,
  TacProposalStatus,
} from './types';

const MAX_TURN_DEFAULT = 30;

/* ============================================================
   Public bundle shape
   ============================================================ */
export interface TacticalDataBundle {
  ready: boolean;
  session: TacSession | null;
  faction: TacFaction | null;
  enemy: TacEnemy | null;
  bodies: TacBody[];
  cities: TacCity[];
  personnel: TacPersonnel[];
  roster: TacRoster;
  relationships: TacRelationship[];
  proposals: TacProposal[];
  briefings: TacBriefing[];
  fleets: TacFleet[];
  colonyShips: TacColonyShip[];
  projects: TacProject[];
  llmRequests: TacLlmReq[];
  alerts: TacAlert[];
  intel: TacIntel[];
  diplo: TacDiplo | null;
  doctrine: TacDoctrine | null;
  /* raw live handles the shell needs to dispatch reducers */
  activeSession: SessionRow | null;
  currentSlot: PlayerSlotRow | null;
}

/* ============================================================
   Hook
   ============================================================ */
export function useTacticalData(store: SessionStore = sessionStore): TacticalDataBundle {
  /* subscribe to the slices that feed the bundle (Inbox.tsx pattern) */
  const activeSessionId = useStoreSlice(store, (s) => s.activeSessionId);
  const sessionsById = useStoreSlice(store, (s) => s.sessionsById);
  const playerSlotsByKey = useStoreSlice(store, (s) => s.playerSlotsByKey);
  const factionsById = useStoreSlice(store, (s) => s.factionsById);
  const personnelById = useStoreSlice(store, (s) => s.personnelById);
  const proposalsById = useStoreSlice(store, (s) => s.proposalsById);
  const turnSummariesById = useStoreSlice(store, (s) => s.turnSummariesById);
  const llmRequestsById = useStoreSlice(store, (s) => s.llmRequestsById);
  const intelRecordsById = useStoreSlice(store, (s) => s.intelligenceRecordsById);
  const eventsById = useStoreSlice(store, (s) => s.eventsById);
  const worldBodiesById = useStoreSlice(store, (s) => s.worldBodiesById);
  const publicCitiesById = useStoreSlice(store, (s) => s.publicCitiesById);
  const publicFleetsById = useStoreSlice(store, (s) => s.publicFleetsById);
  const publicColonyShipsById = useStoreSlice(store, (s) => s.publicColonyShipsById);
  const publicFactionsById = useStoreSlice(store, (s) => s.publicFactionsById);
  const publicGameStateBySessionId = useStoreSlice(store, (s) => s.publicGameStateBySessionId);
  const identity = useStoreSlice(store, (s) => s.connection.identity);

  return useMemo<TacticalDataBundle>(() => {
    const state = store.getState();
    return buildBundle(state);
    // depend on every slice so the memo recomputes on any live change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    store,
    activeSessionId,
    sessionsById,
    playerSlotsByKey,
    factionsById,
    personnelById,
    proposalsById,
    turnSummariesById,
    llmRequestsById,
    intelRecordsById,
    eventsById,
    worldBodiesById,
    publicCitiesById,
    publicFleetsById,
    publicColonyShipsById,
    publicFactionsById,
    publicGameStateBySessionId,
    identity,
  ]);
}

/* ============================================================
   Pure builder (unit-testable; reads the store snapshot)
   ============================================================ */
export function buildBundle(state: SessionState): TacticalDataBundle {
  const activeSession = selectActiveSession(state);
  const currentSlot = selectCurrentPlayerSlot(state);
  const publicGameState = selectPublicGameState(state);

  if (!activeSession) {
    return emptyBundle(null, null);
  }

  const sessionId = String(activeSession.id);

  /* ---- self faction ---- */
  // design.faction <- selectCurrentPlayerSlot.factionId -> selectFactionById
  const selfFactionRow = currentSlot ? selectFactionById(state, currentSlot.factionId) : null;

  /* ---- enemy faction (the OTHER faction in the session) ---- */
  // design.enemy <- selectFactionsForSession minus self; prefer operational row,
  // fall back to public projection for name/controlScore.
  const sessionFactions = selectFactionsForSession(state, sessionId);
  const enemyFactionRow =
    sessionFactions.find((f) => !selfFactionRow || String(f.id) !== String(selfFactionRow.id)) ??
    null;

  const session = buildSession(activeSession, publicGameState);
  const faction = selfFactionRow ? buildFaction(selfFactionRow, publicGameState) : null;
  const enemy = buildEnemy(enemyFactionRow, state.publicFactionsById, selfFactionRow, publicGameState);

  /* ---- roster + personnel ---- */
  const personnelRows = selfFactionRow
    ? selectPersonnelRoster(state, selfFactionRow.id)
    : []; // LIVE-GAP: no slot -> no faction -> empty roster
  const personnel = personnelRows.map(buildPersonnel);
  const roster: TacRoster = {};
  for (const p of personnel) roster[p.id] = p;
  const cityNameById = buildCityNameMap(state.publicCitiesById);
  // re-stamp city names now that we have the projection map (roster posting)
  for (const p of personnel) {
    const row = personnelRows.find((r) => String(r.id) === p.id);
    if (row && row.postingCityId != null) {
      const cn = cityNameById[String(row.postingCityId)];
      if (cn) p.city = cn;
    }
  }

  /* ---- relationships ---- */
  // LIVE-GAP: personnel_relationships is not subscribed/hydrated by liveBridge.
  // Return [] until a relationships slice exists.
  const relationships: TacRelationship[] = [];

  /* ---- bodies (merge live world bodies into static layout) ---- */
  const bodies = buildBodies(
    state.worldBodiesById,
    state.publicCitiesById,
    selfFactionRow,
    enemyFactionRow,
  );

  /* ---- cities ---- */
  const cities = buildCities(
    state.publicCitiesById,
    state.worldBodiesById,
    selfFactionRow,
    enemyFactionRow,
  );

  /* ---- proposals ---- */
  const proposalRows = selectInboxProposalsForCurrentPlayer(state);
  const proposals = proposalRows.map((p) => buildProposal(p, roster));

  /* ---- briefings (turn summaries + non-proposal inbox items) ---- */
  const briefings = buildBriefings(state, activeSession, currentSlot, selfFactionRow, roster);

  /* ---- fleets / colony ships / projects ---- */
  const fleets = buildFleets(state.publicFleetsById, selfFactionRow, cityNameById, bodies);
  const colonyShips = buildColonyShips(state.publicColonyShipsById, selfFactionRow, bodies);
  // LIVE-GAP: projects table is not subscribed/hydrated by liveBridge -> [].
  const projects: TacProject[] = [];

  /* ---- llm requests ---- */
  const llmRequests = selectLlmRequestsForCurrentPlayer(state).map(buildLlmReq);

  /* ---- alerts (derived from bodies) ---- */
  const alerts = buildAlerts(bodies);

  /* ---- intel ---- */
  const intel = selfFactionRow
    ? selectIntelligenceRecords(state, selfFactionRow.id).map(buildIntel)
    : [];

  /* ---- diplomacy + doctrine (derived) ---- */
  const diplo = buildDiplo(enemy, intel);
  const doctrine = faction?.doctrine ?? null;

  return {
    ready: Boolean(currentSlot && faction),
    session,
    faction,
    enemy,
    bodies,
    cities,
    personnel,
    roster,
    relationships,
    proposals,
    briefings,
    fleets,
    colonyShips,
    projects,
    llmRequests,
    alerts,
    intel,
    diplo,
    doctrine,
    activeSession,
    currentSlot,
  };
}

/* ============================================================
   Builders
   ============================================================ */

function buildSession(
  session: SessionRow,
  pgs: PublicGameStateRow | null,
): TacSession {
  // design.session.turn/phase/year <- session row, year from public_game_state
  // (session row has no year). maxTurn default 30 (LIVE-GAP: not on the row).
  return {
    id: String(session.id),
    state: session.status,
    year: pgs?.year ?? 0, // LIVE-GAP: year only on public_game_state; 0 if absent
    turn: session.currentTurn,
    maxTurn: MAX_TURN_DEFAULT, // LIVE-GAP: no max_turn field on session
    phase: session.phase,
    deadline: 0, // LIVE-GAP: turn_deadline not exposed in store; shell owns timer
    winnerFactionId: session.winnerFactionId == null ? null : String(session.winnerFactionId),
  };
}

function buildFaction(row: FactionRow, pgs: PublicGameStateRow | null): TacFaction {
  // controlScore prefers public_game_state.controlScores, else operational row.
  const controlScore = pgs?.controlScores?.[String(row.id)] ?? row.controlScore;
  return {
    id: String(row.id),
    name: row.name,
    tag: '', // LIVE-GAP: no faction tag field; shell may format from slot
    color: 'var(--imperium)',
    color2: 'var(--imperium-2)',
    credits: row.credits,
    creditsDelta: 0, // LIVE-GAP: per-turn credit delta not exposed; 0
    politicalCapital: row.politicalCapital,
    pcDelta: 0, // LIVE-GAP: per-turn PC delta not exposed; 0
    controlScore,
    doctrine: parseDoctrineVector(row.doctrineVector),
  };
}

function buildEnemy(
  enemyRow: FactionRow | null,
  publicFactionsById: Record<string, PublicFactionProjectionRow>,
  selfRow: FactionRow | null,
  pgs: PublicGameStateRow | null,
): TacEnemy | null {
  if (enemyRow) {
    const controlScore = pgs?.controlScores?.[String(enemyRow.id)] ?? enemyRow.controlScore;
    return {
      id: String(enemyRow.id),
      name: enemyRow.name,
      controlScore,
      doctrine: parseDoctrineVector(enemyRow.doctrineVector),
    };
  }
  // fall back to a public projection that isn't the self faction
  const projection = Object.values(publicFactionsById).find(
    (p) => !selfRow || String(p.id) !== String(selfRow.id),
  );
  if (!projection) return null;
  return {
    id: String(projection.id),
    name: projection.name,
    controlScore: pgs?.controlScores?.[String(projection.id)] ?? projection.controlScore,
    doctrine: zeroDoctrine(), // LIVE-GAP: public projection has no doctrine vector
  };
}

function buildPersonnel(row: PersonnelRow): TacPersonnel {
  return {
    id: String(row.id),
    name: row.name,
    role: row.role,
    dept: row.department,
    city: row.postingCityId != null ? String(row.postingCityId) : '', // re-stamped with name later
    init: initialsFromName(row.name),
    competence: row.competence,
    creativity: row.creativity,
    reliability: row.reliability,
    ambition: row.ambition,
    political: row.politicalSkill, // design.political <- politicalSkill
    comms: row.communication, // design.comms <- communication
    loyalty: row.loyalty,
    autonomy: row.autonomyTolerance, // design.autonomy <- autonomyTolerance
    morale: row.morale,
    burnout: row.burnout,
    salary: row.salary,
  };
}

function buildProposal(row: ProposalRow, roster: TacRoster): TacProposal {
  // design.from <- proposingPersonnelId (roster key)
  // design.cost.credits <- resourceCost; teams derived (0 unless body hints)
  const officer = roster[String(row.proposingPersonnelId)];
  const paras = splitParagraphs(row.body);
  return {
    id: String(row.id),
    from: String(row.proposingPersonnelId),
    dept: row.department,
    confidence: normalizeConfidence(row.confidence),
    status: normalizeProposalStatus(row.status, row.decision),
    title: row.title,
    cost: { credits: row.resourceCost, teams: deriveTeams(row.body, row.resourceCost) },
    summary: paras[0] ?? row.body, // first paragraph as the summary line
    body: paras,
    rationale: officer ? deriveRationale(officer) : '',
  };
}

function buildBriefings(
  state: SessionState,
  activeSession: SessionRow,
  currentSlot: PlayerSlotRow | null,
  selfRow: FactionRow | null,
  roster: TacRoster,
): TacBriefing[] {
  const out: TacBriefing[] = [];

  // turn summaries -> briefing of kind 'turn_summary'
  const summaries: TurnSummaryRow[] = [];
  const cur = selectTurnSummaryForCurrentPlayer(state);
  if (cur) summaries.push(cur);
  if (selfRow) {
    const latest = selectLatestTurnSummaryForFaction(state, activeSession.id, selfRow.id);
    if (latest && !summaries.some((s) => String(s.id) === String(latest.id))) {
      summaries.push(latest);
    }
  }

  const fromOfficer = pickSummaryOfficer(roster);
  for (const s of summaries) {
    const parsed = parseTurnSummary(s, selfRow, roster, fromOfficer);
    out.push({
      id: `ts-${String(s.id)}`,
      from: fromOfficer,
      dept: 'COMMAND',
      kind: 'turn_summary',
      requiresDecision: false,
      subject: `Turn ${s.turn} · Resolution Summary`,
      summary: parsed,
    });
  }

  // LIVE-GAP: there is no separate "briefings" table; non-proposal inbox items
  // (e.g. intel summaries) are not modeled. Events could surface here later.
  void currentSlot;
  return out;
}

function buildBodies(
  worldBodiesById: Record<string, PublicWorldBodyRow>,
  citiesById: Record<string, PublicWorldCityProjectionRow>,
  selfRow: FactionRow | null,
  enemyRow: FactionRow | null,
): TacBody[] {
  const liveBodies = Object.values(worldBodiesById);
  const liveByKey = new Map<string, PublicWorldBodyRow>();
  for (const b of liveBodies) liveByKey.set(b.name.toLowerCase(), b);

  // group cities per body to compute control + counts
  const citiesByBody = new Map<string, PublicWorldCityProjectionRow[]>();
  for (const c of Object.values(citiesById)) {
    const list = citiesByBody.get(String(c.bodyId)) ?? [];
    list.push(c);
    citiesByBody.set(String(c.bodyId), list);
  }

  return BODY_LAYOUT.map((layout) => {
    const live = liveByKey.get(layout.layoutKey);
    if (!live) {
      // no live row -> render from static layout (positions are static)
      return { ...stripLayoutKey(layout) };
    }
    const cityRows = citiesByBody.get(String(live.id)) ?? [];
    const control = deriveBodyControl(layout, cityRows, selfRow, enemyRow);
    const deposits = parseDeposits(live.resourceDeposits) ?? layout.deposits;
    return {
      ...stripLayoutKey(layout),
      // live overrides where available
      tier: live.systemTier || layout.tier,
      lag: live.commsLagTurns ?? layout.lag,
      travel: live.travelTimeTurns ?? layout.travel,
      control,
      hot: control === 'contested',
      sub: deriveBodySub(layout, control, cityRows.length),
      deposits,
    };
  });
}

function buildCities(
  citiesById: Record<string, PublicWorldCityProjectionRow>,
  worldBodiesById: Record<string, PublicWorldBodyRow>,
  selfRow: FactionRow | null,
  enemyRow: FactionRow | null,
): TacCity[] {
  const bodyKeyById = new Map<string, string>();
  for (const b of Object.values(worldBodiesById)) {
    bodyKeyById.set(String(b.id), b.name.toLowerCase());
  }
  return Object.values(citiesById).map((c) => {
    const layoutKey = bodyKeyById.get(String(c.bodyId)) ?? String(c.bodyId);
    return {
      id: String(c.id),
      bodyId: layoutKey, // map to static body id (lowercased name) for the design map
      faction: factionToControl(String(c.factionId), selfRow, enemyRow),
      name: c.name,
      pop: '', // LIVE-GAP: population not in public_cities projection
      infra: 0, // LIVE-GAP: infra level not in projection
      morale: 0, // LIVE-GAP: morale not in projection
      ind: 0, // LIVE-GAP: industry output not in projection
      res: 0, // LIVE-GAP: research output not in projection
      garrison: 0, // LIVE-GAP: garrison not in projection
      stage: c.developmentStage,
      supply: '', // LIVE-GAP: supply status not in projection
    };
  });
}

function buildFleets(
  fleetsById: Record<string, PublicFleetProjectionRow>,
  selfRow: FactionRow | null,
  cityNameById: Record<string, string>,
  bodies: TacBody[],
): TacFleet[] {
  void bodies;
  return Object.values(fleetsById)
    .filter((f) => !selfRow || String(f.factionId) === String(selfRow.id))
    .map((f) => ({
      id: String(f.id),
      name: cityNameById[String(f.postingCityId)] ?? `Fleet ${f.id}`,
      postingBodyId: String(f.postingCityId), // LIVE-GAP: projection posts to city, not body
      strength: f.strength,
      orders: '', // LIVE-GAP: fleet orders not in public projection
    }));
}

function buildColonyShips(
  shipsById: Record<string, PublicColonyShipProjectionRow>,
  selfRow: FactionRow | null,
  bodies: TacBody[],
): TacColonyShip[] {
  const bodyIdToKey = new Map<string, string>();
  void bodies;
  return Object.values(shipsById)
    .filter((s) => !selfRow || String(s.factionId) === String(selfRow.id))
    .map((s) => ({
      id: String(s.id),
      name: `Colony Ship ${s.id}`, // LIVE-GAP: ship name not in public projection
      originBodyId: '', // LIVE-GAP: origin not in public projection
      destBodyId: bodyIdToKey.get(String(s.destinationBodyId)) ?? String(s.destinationBodyId),
      manifest: '', // LIVE-GAP: manifest not in public projection
      departedTurn: 0, // LIVE-GAP: departure turn not in public projection
      arrivesTurn: s.arrivesTurn,
      status: s.status,
    }));
}

function buildLlmReq(row: LlmRequestRow): TacLlmReq {
  return {
    id: String(row.id),
    type: row.requestType, // design.type <- requestType
    status: normalizeLlmStatus(row.status),
    model: extractModel(row.responseJson), // parsed from responseJson, else generic
    createdTurn: row.createdTurn,
    note: row.error ?? '', // surface error text when present
  };
}

function buildAlerts(bodies: TacBody[]): TacAlert[] {
  // derive: contested -> critical, opportunity -> opportunity
  const out: TacAlert[] = [];
  for (const b of bodies) {
    if (b.control === 'contested') {
      out.push({ id: `al-${b.id}-c`, bodyId: b.id, level: 'critical', label: `${b.name} contested` });
    } else if (b.opportunity) {
      out.push({ id: `al-${b.id}-o`, bodyId: b.id, level: 'opportunity', label: `${b.name} opportunity` });
    }
  }
  return out;
}

function buildIntel(row: IntelligenceRecordRow): TacIntel {
  // design.subject <- intelType, design.acc <- accuracy, design.body <- value
  return {
    id: String(row.id),
    subject: row.intelType,
    acc: row.accuracy,
    body: row.value,
  };
}

function buildDiplo(enemy: TacEnemy | null, intel: TacIntel[]): TacDiplo | null {
  if (!enemy) return null;
  // LIVE-GAP: trade_agreements / negotiation history not subscribed.
  // Derive a minimal standing card from what we know.
  return {
    enemyName: enemy.name,
    posture: 'Unknown', // LIVE-GAP: no diplomacy posture field
    trades: 0, // LIVE-GAP: trade agreements not subscribed
    lastNeg: '—', // LIVE-GAP: negotiation log not subscribed
    ceasefire: '—', // LIVE-GAP: ceasefire viability not modeled
    note:
      intel.length > 0
        ? `${intel.length} intelligence report${intel.length === 1 ? '' : 's'} on file.`
        : 'No diplomatic channels open.',
  };
}

/* ============================================================
   Helpers
   ============================================================ */

function buildCityNameMap(
  citiesById: Record<string, PublicWorldCityProjectionRow>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of Object.values(citiesById)) out[String(c.id)] = c.name;
  return out;
}

function stripLayoutKey(layout: { layoutKey: string } & TacBody): TacBody {
  const { layoutKey: _layoutKey, ...rest } = layout;
  void _layoutKey;
  return { ...rest };
}

function deriveBodyControl(
  layout: TacBody,
  cityRows: PublicWorldCityProjectionRow[],
  selfRow: FactionRow | null,
  enemyRow: FactionRow | null,
): TacControl {
  if (layout.control === 'star') return 'star';
  if (cityRows.length === 0) return 'neutral';
  const owners = new Set(cityRows.map((c) => String(c.factionId)));
  const hasSelf = selfRow ? owners.has(String(selfRow.id)) : false;
  const hasEnemy = enemyRow ? owners.has(String(enemyRow.id)) : false;
  if (hasSelf && hasEnemy) return 'contested';
  if (hasSelf) return 'imperium';
  if (hasEnemy) return 'accord';
  return 'neutral';
}

function deriveBodySub(layout: TacBody, control: TacControl, cityCount: number): string {
  if (control === 'contested') return `⚠ CONTESTED · ${cityCount} ${cityCount === 1 ? 'CITY' : 'CITIES'}`;
  if (cityCount > 0) return `${cityCount} ${cityCount === 1 ? 'CITY' : 'CITIES'}`;
  return layout.sub;
}

function factionToControl(
  factionId: string,
  selfRow: FactionRow | null,
  enemyRow: FactionRow | null,
): TacControl {
  if (selfRow && factionId === String(selfRow.id)) return 'imperium';
  if (enemyRow && factionId === String(enemyRow.id)) return 'accord';
  return 'neutral';
}

function parseDeposits(json: string): Record<string, string> | undefined {
  const parsed = safeJson(json);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    out[titleCase(k)] = String(v).toUpperCase();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/* live doctrine vectors use lowercase axis keys; some use the 4-axis
   expansion/security/science/diplomacy form (see liveBridge displayDoctrine).
   Map both onto the 5 design axes; ignore the embedded `slot` metadata. */
const DOCTRINE_ALIASES: Record<string, keyof TacDoctrine> = {
  expansion: 'Expansion',
  industry: 'Industry',
  military: 'Military',
  security: 'Military', // 4-axis "security" maps to Military
  research: 'Research',
  science: 'Research', // 4-axis "science" maps to Research
  diplomacy: 'Diplomacy',
};

function parseDoctrineVector(json: string): TacDoctrine {
  const parsed = safeJson(json);
  const out = zeroDoctrine();
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return out;
  for (const [rawKey, rawVal] of Object.entries(parsed as Record<string, unknown>)) {
    if (rawKey === 'slot') continue; // slot metadata, not a doctrine axis
    const axis = DOCTRINE_ALIASES[rawKey.toLowerCase()];
    if (!axis) continue;
    out[axis] = normalizeAxisValue(rawVal);
  }
  return out;
}

function normalizeAxisValue(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  // values may be 0..1 fractions or 0..100 percentages
  const scaled = value > 1 ? value : value * 100;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function zeroDoctrine(): TacDoctrine {
  return { Expansion: 0, Industry: 0, Military: 0, Research: 0, Diplomacy: 0 };
}

function normalizeConfidence(value: string): TacConfidence {
  const v = value.toUpperCase();
  if (v === 'HIGH' || v === 'MEDIUM' || v === 'LOW') return v;
  if (v.startsWith('H')) return 'HIGH';
  if (v.startsWith('L')) return 'LOW';
  return 'MEDIUM';
}

const TERMINAL_STATUSES = new Set(['approved', 'rejected', 'deferred', 'auto_deferred']);

function normalizeProposalStatus(status: string, decision: string | null): TacProposalStatus {
  const s = status.toLowerCase();
  if (TERMINAL_STATUSES.has(s)) return s as TacProposalStatus;
  if (decision) {
    const d = decision.toLowerCase();
    if (TERMINAL_STATUSES.has(d)) return d as TacProposalStatus;
  }
  if (s === 'read') return 'read';
  // 'pending' / unknown -> treat as unread for the inbox card styling
  return 'unread';
}

function normalizeLlmStatus(status: string): TacLlmReq['status'] {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'complete') return 'complete';
  if (s === 'processing' || s === 'running' || s === 'in_progress') return 'processing';
  if (s === 'failed' || s === 'cancelled' || s === 'error') return 'failed';
  return 'queued';
}

function extractModel(responseJson: string | null): string {
  const parsed = safeJson(responseJson ?? '');
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const model = (parsed as Record<string, unknown>).model;
    if (typeof model === 'string' && model.length > 0) return model;
  }
  return 'mercury-2'; // generic default label shown in the inbox provenance row
}

function splitParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function deriveTeams(body: string, _resourceCost: number): number {
  void _resourceCost;
  // LIVE-GAP: proposals carry only `resourceCost` (credits). Construction-team
  // counts are not modeled, so parse a hint from the body text if present, else 0.
  const match = body.match(/(\d+)\s*team/i);
  return match ? Number(match[1]) : 0;
}

function deriveRationale(officer: TacPersonnel): string {
  // LIVE-GAP: proposals have no separate `rationale` field. Synthesize a
  // trait-grounded sentence so the "Why this officer · why now" section reads.
  const traits: string[] = [];
  if (officer.competence >= 80) traits.push('high competence');
  if (officer.creativity >= 80) traits.push('high creativity');
  if (officer.reliability >= 80) traits.push('high reliability');
  if (officer.ambition >= 80) traits.push('high ambition');
  if (officer.political >= 80) traits.push('strong political skill');
  const lead = traits.length > 0 ? traits.join(', ') : 'balanced traits';
  return `${officer.name}'s profile (${lead}) shapes how this proposal is framed and how reliably it executes.`;
}

function initialsFromName(name: string): string {
  const parts = name
    .replace(/^(Adm\.|Gen\.|Dr\.|Min\.|Env\.|Capt\.|Lt\.|Cmdr\.|Col\.)\s*/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function pickSummaryOfficer(roster: TacRoster): string {
  // prefer a COMMAND officer for the summary attribution; else first.
  const ids = Object.keys(roster);
  const command = ids.find((id) => roster[id].dept === 'COMMAND');
  return command ?? ids[0] ?? '';
}

function parseTurnSummary(
  row: TurnSummaryRow,
  selfRow: FactionRow | null,
  roster: TacRoster,
  fromOfficer: string,
): TacTurnSummary {
  // The authoritative turn summary lives in summaryJson. Shapes vary, so pull
  // narrative + control scores defensively and fall back to safe defaults.
  const payload = safeJson(row.summaryJson);
  const obj =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};

  const narrative =
    pickString(obj, ['narrative', 'resolution_narrative', 'summary']) ??
    'Turn resolved.';

  const selfScore = pickNumber(obj, ['self_control', 'control_self']) ?? selfRow?.controlScore ?? 0;
  const enemyScore = pickNumber(obj, ['enemy_control', 'control_enemy']) ?? 0;
  const delta = pickNumber(obj, ['control_delta', 'delta']) ?? 0;

  return {
    turnLabel: `Turn ${row.turn}`,
    control: {
      self: selfScore,
      enemy: enemyScore,
      delta,
      selfName: selfRow?.name ?? 'You',
      enemyName: 'Enemy',
      note: narrative,
    },
    // LIVE-GAP: structured resolution feed/deltas not consistently present in
    // summaryJson; surface the narrative as a single Resolution Feed entry.
    phases: [
      {
        name: 'Resolution',
        events: [{ f: 'n', t: escapeHtml(narrative) }],
      },
    ],
    deltas: [],
    officer: { from: fromOfficer || pickSummaryOfficer(roster), text: narrative },
  };
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function safeJson(value: string): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function emptyBundle(
  activeSession: SessionRow | null,
  currentSlot: PlayerSlotRow | null,
): TacticalDataBundle {
  return {
    ready: false,
    session: null,
    faction: null,
    enemy: null,
    bodies: BODY_LAYOUT.map((b) => {
      const { layoutKey: _k, ...rest } = b;
      void _k;
      return { ...rest };
    }),
    cities: [],
    personnel: [],
    roster: {},
    relationships: [],
    proposals: [],
    briefings: [],
    fleets: [],
    colonyShips: [],
    projects: [],
    llmRequests: [],
    alerts: [],
    intel: [],
    diplo: null,
    doctrine: null,
    activeSession,
    currentSlot,
  };
}

function useStoreSlice<T>(store: SessionStore, selector: (state: SessionState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

/* keep BODY_LAYOUT_BY_KEY referenced for downstream consumers that want a
   direct layout lookup (e.g. the map mapping live ids to static positions). */
export { BODY_LAYOUT_BY_KEY };

/* re-export reducer-call helpers + actions the shell needs so it can dispatch
   commander_decision / submit_turn / run_deliberation / ack_resolution
   without re-importing from spacetime/* directly.
   The shell still supplies the live `SpacetimeClient` + store. */
export {
  commanderDecisionAction,
  submitTurnAction,
  runDeliberationAction,
  ackResolutionAction,
  simulateTurnAction,
  expireTurnAction,
  advanceTurnPhaseAction,
  commanderDecisionKey,
  submitTurnKey,
  runDeliberationKey,
  ackResolutionKey,
} from '../spacetime/session-actions';
