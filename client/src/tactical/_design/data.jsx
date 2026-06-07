/* ============================================================
   SOLAR DOMINION — Seed state: Turn 8 judge scenario
   Mars contested · Jupiter/Callisto opportunity visible
   POV: SOL IMPERIUM (Player A)
   ============================================================ */

const FACTIONS = {
  imperium: {
    id: 'imperium', name: 'SOL IMPERIUM', tag: 'PLAYER A · AZURE COMMAND',
    color: 'var(--imperium)', color2: 'var(--imperium-2)',
    credits: 2460, creditsDelta: +180,
    politicalCapital: 17, pcDelta: -2,
    controlScore: 54,
    doctrine: { Expansion: 72, Industry: 58, Military: 64, Research: 41, Diplomacy: 33 },
  },
  accord: {
    id: 'accord', name: 'FREE ORBITS COALITION', tag: 'PLAYER B · AMBER COMMAND',
    color: 'var(--accord)', color2: 'var(--accord-2)',
    credits: 1980, creditsDelta: +120,
    politicalCapital: 23, pcDelta: +4,
    controlScore: 46,
    doctrine: { Expansion: 55, Industry: 44, Military: 49, Research: 67, Diplomacy: 71 },
  },
};

const SESSION = {
  id: 'SD-7F3A', state: 'active', year: 2147, turn: 8, maxTurn: 30,
  phase: 'decision', // authoritative turn_phase
  deadline: 165, // seconds remaining (turn_deadline)
  oppReady: false, winnerFactionId: null,
  playerSlot: 'A',
};

/* ---- Authoritative turn_phase pipeline (spec: game_sessions.turn_phase) ---- */
const TURN_PHASES = [
  { id: 'world_update',  label: 'World Update',  desc: 'Simulation reports what changed since last turn.' },
  { id: 'deliberation',  label: 'Deliberation',  desc: 'Officers draft proposals from the new situation.' },
  { id: 'decision',      label: 'Decision',      desc: 'You approve, reject, defer & allocate. Timer applies.' },
  { id: 'resolution',    label: 'Resolution',    desc: 'Both turns resolve at once; outcomes revealed.' },
  { id: 'summary',       label: 'Summary',       desc: 'Turn summary recorded; acknowledge to continue.' },
  { id: 'complete',      label: 'Complete',      desc: 'Turn closed; advance to the next world update.' },
];

/* ---- Celestial bodies (orbital layout; cx/cy in 1000x680 viewBox) ---- */
// control: 'imperium' | 'accord' | 'contested' | 'neutral'
const BODIES = [
  { id: 'sol',      name: 'SOL',       tier: 'star',    cx: 500, cy: 340, r: 30, orbit: 0,   control: 'star',
    sub: 'G-TYPE STAR', lag: 0, travel: 0 },
  { id: 'mercury',  name: 'MERCURY',   tier: 'inner',   cx: 0,   cy: 0,  r: 6,  orbit: 78,  control: 'neutral',
    sub: 'BARREN', lag: 1, travel: 2, deposits: { Metals: 'HIGH', Volatiles: 'LOW' } },
  { id: 'venus',    name: 'VENUS',     tier: 'inner',   cx: 0,   cy: 0,  r: 9,  orbit: 120, control: 'neutral',
    sub: 'HOSTILE', lag: 1, travel: 2, deposits: { Volatiles: 'MED', Metals: 'LOW' } },
  { id: 'earth',    name: 'EARTH',     tier: 'earth',   cx: 0,   cy: 0,  r: 13, orbit: 168, control: 'imperium',
    sub: 'CAPITAL · 4 CITIES', lag: 0, travel: 0, capital: 'imperium',
    deposits: { Metals: 'MED', Volatiles: 'HIGH', Rare: 'MED' } },
  { id: 'luna',     name: 'LUNA',      tier: 'earth',   cx: 0,   cy: 0,  r: 6,  orbit: 168, moonOf: 'earth', moonAngle: 58, moonDist: 42, control: 'accord',
    sub: 'COALITION HOLD', lag: 0, travel: 1, deposits: { Metals: 'HIGH', Rare: 'LOW' } },
  { id: 'mars',     name: 'MARS',      tier: 'inner',   cx: 0,   cy: 0,  r: 11, orbit: 232, control: 'contested',
    sub: '⚠ CONTESTED · 3 CITIES', lag: 1, travel: 3, hot: true,
    deposits: { Metals: 'HIGH', Volatiles: 'MED', Rare: 'HIGH' } },
  { id: 'ceres',    name: 'CERES',     tier: 'belt',    cx: 0,   cy: 0,  r: 8,  orbit: 290, control: 'accord',
    sub: 'BELT STRONGHOLD', lag: 2, travel: 4, deposits: { Metals: 'HIGH', Rare: 'MED', Volatiles: 'HIGH' } },
  { id: 'jupiter',  name: 'JUPITER',   tier: 'jupiter', cx: 0,   cy: 0,  r: 20, orbit: 360, control: 'neutral',
    sub: 'GAS GIANT', lag: 3, travel: 6, deposits: { Volatiles: 'EXTREME' } },
  { id: 'europa',   name: 'EUROPA',    tier: 'jupiter', cx: 0, cy: 0, r: 6, orbit: 360, moonOf: 'jupiter', moonAngle: 150, moonDist: 52, control: 'imperium',
    sub: 'IMPERIUM OUTPOST', lag: 3, travel: 6, deposits: { Volatiles: 'HIGH', Rare: 'MED' } },
  { id: 'callisto', name: 'CALLISTO',  tier: 'jupiter', cx: 0, cy: 0, r: 7, orbit: 360, moonOf: 'jupiter', moonAngle: 352, moonDist: 70, control: 'neutral',
    sub: '◎ OPPORTUNITY', lag: 3, travel: 6, opportunity: true,
    deposits: { Metals: 'HIGH', Rare: 'EXTREME', Volatiles: 'MED' } },
  { id: 'saturn',   name: 'SATURN',    tier: 'saturn',  cx: 0,   cy: 0,  r: 18, orbit: 432, control: 'neutral',
    sub: 'FRONTIER · RINGED', lag: 4, travel: 8, deposits: { Volatiles: 'EXTREME', Rare: 'LOW' } },
  { id: 'titan',    name: 'TITAN',     tier: 'saturn',  cx: 0, cy: 0, r: 7, orbit: 432, moonOf: 'saturn', moonAngle: 60, moonDist: 40, control: 'neutral',
    sub: 'FRONTIER', lag: 4, travel: 8, deposits: { Volatiles: 'EXTREME' } },
];

/* ---- Cities ---- */
const CITIES = [
  { id: 'c1', bodyId: 'earth', faction: 'imperium', name: 'Geneva Directorate', pop: '48.2M', infra: 5, morale: 78, ind: 92, res: 64, garrison: 70, stage: 'full', supply: 'secure' },
  { id: 'c2', bodyId: 'earth', faction: 'imperium', name: 'Kóryo Arcology', pop: '31.0M', infra: 4, morale: 71, ind: 74, res: 58, garrison: 55, stage: 'maturation', supply: 'secure' },
  { id: 'c3', bodyId: 'mars', faction: 'imperium', name: 'Olympus Command', pop: '6.4M', infra: 3, morale: 61, ind: 48, res: 30, garrison: 62, stage: 'early', supply: 'strained' },
  { id: 'c4', bodyId: 'mars', faction: 'accord', name: 'Valles Free Port', pop: '5.1M', infra: 3, morale: 69, ind: 41, res: 38, garrison: 44, stage: 'early', supply: 'strained' },
  { id: 'c5', bodyId: 'mars', faction: 'contested', name: 'Hellas Crossing', pop: '2.2M', infra: 2, morale: 47, ind: 22, res: 12, garrison: 18, stage: 'establishment', supply: 'cut off' },
  { id: 'c6', bodyId: 'europa', faction: 'imperium', name: 'Conamara Station', pop: '0.9M', infra: 2, morale: 58, ind: 18, res: 26, garrison: 24, stage: 'establishment', supply: 'tenuous' },
];

/* ---- Personnel (officers) ---- */
const PERSONNEL = {
  p1: { id: 'p1', name: 'Adm. Vera Kessler', role: 'Chief of Staff', dept: 'COMMAND', city: 'Geneva Directorate',
    init: 'VK', competence: 88, creativity: 54, reliability: 91, ambition: 62, political: 79, comms: 84, loyalty: 86, autonomy: 46, morale: 74, burnout: 22, salary: 320 },
  p2: { id: 'p2', name: 'Gen. Idris Thorne', role: 'Mars Theater Commander', dept: 'MILITARY', city: 'Olympus Command',
    init: 'IT', competence: 81, creativity: 73, reliability: 68, ambition: 88, political: 57, comms: 62, loyalty: 64, autonomy: 80, morale: 66, burnout: 44, salary: 295 },
  p3: { id: 'p3', name: 'Dr. Lena Okonkwo', role: 'Chief Scientist', dept: 'RESEARCH', city: 'Geneva Directorate',
    init: 'LO', competence: 92, creativity: 90, reliability: 77, ambition: 49, political: 41, comms: 70, loyalty: 81, autonomy: 64, morale: 80, burnout: 19, salary: 310 },
  p4: { id: 'p4', name: 'Min. Cato Reyes', role: 'Director of Industry', dept: 'INDUSTRY', city: 'Kóryo Arcology',
    init: 'CR', competence: 76, creativity: 48, reliability: 84, ambition: 71, political: 66, comms: 59, loyalty: 72, autonomy: 38, morale: 69, burnout: 31, salary: 255 },
  p5: { id: 'p5', name: 'Env. Sora Veil', role: 'Head of Intelligence', dept: 'INTEL', city: 'Geneva Directorate',
    init: 'SV', competence: 84, creativity: 67, reliability: 72, ambition: 80, political: 88, comms: 75, loyalty: 58, autonomy: 73, morale: 63, burnout: 49, salary: 280 },
};

/* ---- Personnel relationships (spec: personnel_relationships) ---- */
const RELATIONSHIPS = [
  { id: 'r1', a: 'p1', b: 'p2', type: 'rivalry',  strength: 64, note: 'Thorne resents the Chief of Staff’s caution on Mars.' },
  { id: 'r2', a: 'p1', b: 'p3', type: 'trust',    strength: 81, note: 'Kessler shields Okonkwo’s long-horizon research from budget cuts.' },
  { id: 'r3', a: 'p2', b: 'p5', type: 'alliance', strength: 58, note: 'Thorne and Veil trade intel for operational cover.' },
  { id: 'r4', a: 'p4', b: 'p3', type: 'mentor',   strength: 47, note: 'Reyes leans on Okonkwo for fabrication breakthroughs.' },
];

/* ---- Proposals (commander inbox, Turn 8) ---- */
const PROPOSALS = [
  {
    id: 'pr1', from: 'p2', dept: 'MILITARY', confidence: 'HIGH', status: 'unread',
    title: 'Callisto Colonization Push',
    cost: { credits: 720, teams: 2 },
    summary: 'Divert the Europa-staged colony ship to Callisto before the Coalition surveys it.',
    body: [
      "Commander — the window on **Callisto** is closing. Our Europa outpost has a colony ship fueled and crewed; redirecting it now lands us on the richest **rare-element** body in the Jovian system before the Coalition's belt fleet can respond.",
      "Surveys put Callisto's rare deposits at **EXTREME** — enough to fund three turns of Mars reinforcement on its own. Comms lag to Jupiter is **3 turns**, so this is a commit-and-trust order: I will not be able to recall it.",
      "I am confident. If we hesitate, Valles Free Port's surveyors reach it first and we are locked out of the outer system for the rest of the campaign. <span class='pull'>Recommend immediate approval and full construction support.</span>",
    ],
    rationale: 'High ambition + high creativity drove an aggressive opportunity read; moderate reliability means execution risk if underfunded.',
  },
  {
    id: 'pr2', from: 'p1', dept: 'COMMAND', confidence: 'MEDIUM', status: 'unread',
    title: 'Reinforce Mars Garrison',
    cost: { credits: 480, teams: 1 },
    summary: 'Hellas Crossing morale is collapsing under Coalition pressure. Reinforce or risk losing the contested third city.',
    body: [
      "Commander, **Hellas Crossing** is the swing settlement on Mars. Morale has fallen to **47** and the garrison is thin at 18. If the Coalition presses next turn, we lose our claim and Mars tips amber.",
      "I propose moving a construction team and a garrison uplift from Olympus Command to stabilize Hellas. It is defensive, not glamorous — but losing Mars erases our control-score lead.",
      "Confidence is moderate: reinforcement holds the line but spends credits we may want for Callisto. <span class='pull'>This is a hedge, Commander. You cannot fully fund both.</span>",
    ],
    rationale: 'High reliability + high competence produced a cautious, defensible hold recommendation that explicitly flags the budget conflict.',
  },
  {
    id: 'pr3', from: 'p3', dept: 'RESEARCH', confidence: 'MEDIUM', status: 'unread',
    title: 'Fusion Drive Research Initiative',
    cost: { credits: 540, teams: 0 },
    summary: 'Commit research output to fusion propulsion — halves outer-system travel time from Turn 12.',
    body: [
      "Commander, our travel times to the outer system are crippling. A focused **fusion-drive** program at Geneva would cut Jupiter and Saturn transit from 6–8 turns to 3–4 by Turn 12.",
      "This is a long bet. It does nothing this turn and competes with immediate military needs — but it is what turns a contested inner system into a true solar dominion.",
      "I will not oversell it. The payoff is real but delayed. <span class='pull'>If we are winning the map, fund it. If we are bleeding on Mars, defer it.</span>",
    ],
    rationale: 'Very high competence + creativity, low political skill: a technically sound but bluntly-framed long-horizon proposal.',
  },
  {
    id: 'pr4', from: 'p4', dept: 'INDUSTRY', confidence: 'LOW', status: 'unread',
    title: 'Kóryo Output Expansion',
    cost: { credits: 300, teams: 1 },
    summary: 'Upgrade Kóryo Arcology infrastructure to level 5 — modest, reliable industrial gain.',
    body: [
      "Commander, a straightforward one: raise **Kóryo Arcology** to infrastructure level 5. Adds roughly 18% industrial output from Turn 10, compounding through the campaign.",
      "I rate my own confidence **low** only because the timing is poor — every credit is contested this turn. The upgrade itself is safe and well-understood.",
      "<span class='pull'>No urgency. Approve if you have slack; defer without cost if you do not.</span>",
    ],
    rationale: 'High reliability, low creativity: a safe incremental industry proposal, honestly self-rated low given the turn\'s pressures.',
  },
];

/* ---- Turn resolution event logs (objective · shared by both POVs) ---- */
const RES_LOG_PREV = [
  { name:'Orders Locked', events:[
    { f:'a', t:'<b>Sol Imperium</b> funded the <b>Europa Outpost</b> expansion — 480 cr.' },
    { f:'b', t:'<b>Free Orbits Coalition</b> opened a <b>Luna trade</b> overture through neutral brokers.' },
  ]},
  { name:'Combat', events:[
    { f:'n', t:'<b>Mars</b> stayed contested — no decisive engagement at Hellas Crossing.' },
  ]},
  { name:'Economy & Diplomacy', events:[
    { f:'a', t:'Imperium rebuffed the Luna overture; treasury rose on Earth & Europa output.', tag:'win', tagt:'+160 CR' },
    { f:'b', t:'Coalition Ceres refinery output held steady; belt treasury trending up.' },
  ]},
];
const RES_LOG_NEXT = [
  { name:'Orders Locked', events:[
    { f:'a', t:'<b>Sol Imperium</b> approved <b>Callisto Colonization Push</b> — 720 cr, 2 teams committed.' },
    { f:'b', t:'<b>Free Orbits Coalition</b> approved <b>Press the Mars Salient</b> — 600 cr, 1 team.' },
    { f:'a', t:'Imperium reinforced Hellas Crossing garrison (partial fund).' },
  ]},
  { name:'Fleet Movement', events:[
    { f:'a', t:'Colony convoy cleared Jupiter’s gravity well, on final approach to <b>Callisto</b>.' },
    { f:'b', t:'3rd Belt Flotilla arrived at <b>Mars</b> orbit from Ceres.', tag:'win', tagt:'ARRIVED' },
  ]},
  { name:'Combat', events:[
    { f:'b', t:'Coalition pressed <b>Hellas Crossing</b>. Imperium reinforcement held the line — city stays contested.', tag:'loss', tagt:'REPELLED' },
    { f:'n', t:'No fleet engagements in the outer system.' },
  ]},
  { name:'Colonization', events:[
    { f:'a', t:'Imperium colony ship landed on <b>Callisto</b> unopposed. First dome established.', tag:'win', tagt:'CLAIMED' },
    { f:'a', t:'<b>Callisto</b> rare-element field secured — Jovian supply line opens Turn 13.' },
  ]},
  { name:'Economy & Diplomacy', events:[
    { f:'a', t:'Imperium treasury +180 cr from Earth & Europa production.' },
    { f:'b', t:'Coalition Ceres refinery output rose; +120 cr and trending up.' },
    { f:'n', t:'No diplomatic channels opened this turn.' },
  ]},
];

/* ---- Turn summaries (spec: turn_summaries) · Imperium POV ---- */
const TURN_SUMMARY_PREV = {
  turnLabel:'Turn 7 → 8',
  control:{ self:54, enemy:46, delta:+1, selfName:'Imperium', enemyName:'Coalition', note:'Holding the Mars line preserved our control-score lead.' },
  phases: RES_LOG_PREV,
  deltas:[
    { group:'Imperium · Changes', rows:[ {k:'Territory', v:'No change'}, {k:'Credits', v:'1,740', d:'+160', dir:'up'}, {k:'Europa', v:'Establishment'} ] },
    { group:'Coalition · Changes', rows:[ {k:'Luna trade', v:'Rebuffed', dir:'down'}, {k:'Credits', v:'1,860', d:'+110', dir:'up'} ] },
  ],
  officer:{ from:'p1', text:'Mars holds. The board is set — the Callisto play is ours to make next turn.' },
};
const TURN_SUMMARY_NEXT = {
  turnLabel:'Turn 8 → 9',
  control:{ self:57, enemy:43, delta:+3, selfName:'Imperium', enemyName:'Coalition', note:'The Callisto claim shifted the balance in our favor.' },
  phases: RES_LOG_NEXT,
  deltas:[
    { group:'Imperium · Changes', rows:[ {k:'Territory', v:'+ Callisto', dir:'up'}, {k:'Credits', v:'1,920', d:'+180', dir:'up'}, {k:'Mars · Hellas', v:'Held'}, {k:'Colony ships', v:'1 → 0'} ] },
    { group:'Coalition · Changes', rows:[ {k:'Territory', v:'No change'}, {k:'Credits', v:'2,100', d:'+120', dir:'up'}, {k:'Mars push', v:'Repelled', dir:'down'} ] },
  ],
  officer:{ from:'p2', text:'Callisto is ours. The outer system is open — confidence vindicated.' },
};

/* ---- Commander inbox (non-proposal briefings) ---- */
const BRIEFINGS = [
  { id: 'b2', from: 'p1', dept: 'COMMAND', kind: 'turn_summary', requiresDecision: false,
    subject: 'Turn 7 → 8 · Resolution Summary', summary: TURN_SUMMARY_PREV },
  { id: 'b1', from: 'p5', dept: 'INTEL', subject: 'Coalition belt fleet repositioning', requiresDecision: false,
    body: 'Intel flags a Coalition fleet leaving Ceres on a heading consistent with a Jupiter survey run. Accuracy: 72%. Acquired Turn 8.' },
];

/* ---- Fleets (spec: fleets) ---- */
const FLEETS = [
  { id: 'f1', name: '1st Olympus Guard', postingBodyId: 'mars',   strength: 62, orders: 'Hold Hellas Crossing line' },
  { id: 'f2', name: 'Home Defense Wing', postingBodyId: 'earth',  strength: 74, orders: 'Garrison Earth orbit' },
  { id: 'f3', name: 'Jovian Picket',     postingBodyId: 'europa', strength: 38, orders: 'Escort colony convoy' },
];

/* ---- Colony ships (spec: colony_ships) ---- */
const COLONY_SHIPS = [
  { id: 'cs1', name: 'Pioneer Ardent', originBodyId: 'europa', destBodyId: 'callisto', manifest: '2,400 colonists · survey rig · dome kit',
    departedTurn: 7, arrivesTurn: 10, status: 'in_transit' },
];

/* ---- Projects (spec: projects) ---- */
const PROJECTS = [
  { id: 'pj1', cityId: 'c3', city: 'Olympus Command', type: 'fortification', name: 'Hellas Garrison Uplift', progress: 35, assigned: '1 team · 240 cr', estCompletion: 'Turn 10', status: 'active' },
  { id: 'pj2', cityId: 'c1', city: 'Geneva Directorate', type: 'research', name: 'Fusion Drive Prototype', progress: 12, assigned: '540 cr', estCompletion: 'Turn 12', status: 'queued' },
];

/* ---- LLM request queue (spec: llm_requests) ---- */
const LLM_REQUESTS = [
  { id: 'lr1', type: 'proposals',     status: 'complete',   model: 'inception/mercury-2', createdTurn: 8, note: '4 officer proposals generated' },
  { id: 'lr2', type: 'inbox',         status: 'complete',   model: 'inception/mercury-2', createdTurn: 8, note: '2 briefings drafted' },
  { id: 'lr3', type: 'event_narrative', status: 'processing', model: 'inception/mercury-2', createdTurn: 8, note: 'Resolution flavor pending' },
];

/* ---- Status bar telemetry ---- */
const TELEMETRY = {
  fleets: 3, colonyShips: 1, projects: 2, alerts: 2,
  sync: 'LIVE', latency: 38,
};

/* ---- Map alerts (spec: map shows alerts) ---- */
const ALERTS = [
  { id: 'al1', bodyId: 'mars',     level: 'critical', label: 'Hellas morale collapse' },
  { id: 'al2', bodyId: 'callisto', level: 'opportunity', label: 'Colonization window closing' },
];

Object.assign(window, { FACTIONS, SESSION, TURN_PHASES, BODIES, CITIES, PERSONNEL, RELATIONSHIPS, PROPOSALS, BRIEFINGS, FLEETS, COLONY_SHIPS, PROJECTS, LLM_REQUESTS, TELEMETRY, ALERTS, RES_LOG_PREV, RES_LOG_NEXT, TURN_SUMMARY_PREV, TURN_SUMMARY_NEXT });
