/* ============================================================
   SOLAR DOMINION — Coalition (Player B) data + per-faction
   intel/diplomacy text. Enables the POV switch.
   ============================================================ */

/* ---- Coalition officers ---- */
const ACCORD_PERSONNEL = {
  a1: { id:'a1', name:'Coord. Sela Marsh', role:'Coalition Coordinator', dept:'COMMAND', city:'Valles Free Port',
    init:'SM', competence:80, creativity:71, reliability:77, ambition:69, political:85, comms:88, loyalty:74, autonomy:55, morale:79, burnout:26, salary:300 },
  a2: { id:'a2', name:'Col. Bram Okafor', role:'Belt Fleet Commander', dept:'MILITARY', city:'Ceres Foundry',
    init:'BO', competence:84, creativity:78, reliability:64, ambition:83, political:52, comms:60, loyalty:70, autonomy:82, morale:72, burnout:43, salary:285 },
  a3: { id:'a3', name:'Dr. Yuki Tan', role:'Coalition Science Lead', dept:'RESEARCH', city:'Ceres Foundry',
    init:'YT', competence:90, creativity:86, reliability:73, ambition:55, political:48, comms:66, loyalty:83, autonomy:61, morale:81, burnout:17, salary:305 },
  a4: { id:'a4', name:'Steward Nadia Cruz', role:'Trade & Industry', dept:'INDUSTRY', city:'Luna Commons',
    init:'NC', competence:78, creativity:59, reliability:86, ambition:61, political:72, comms:80, loyalty:77, autonomy:44, morale:75, burnout:28, salary:265 },
  a5: { id:'a5', name:'Agent "Quill"', role:'Coalition Intelligence', dept:'INTEL', city:'Valles Free Port',
    init:'QL', competence:83, creativity:74, reliability:69, ambition:76, political:81, comms:71, loyalty:62, autonomy:70, morale:66, burnout:46, salary:275 },
};

/* ---- Coalition personnel relationships ---- */
const ACCORD_RELATIONSHIPS = [
  { id:'ar1', a:'a1', b:'a2', type:'tension',  strength:52, note:'Marsh reins in Okafor’s appetite for risk.' },
  { id:'ar2', a:'a1', b:'a4', type:'trust',    strength:78, note:'Coordinator relies on Cruz’s trade network.' },
  { id:'ar3', a:'a2', b:'a5', type:'alliance', strength:60, note:'Okafor and Quill coordinate the Mars push.' },
  { id:'ar4', a:'a3', b:'a4', type:'mentor',   strength:49, note:'Tan advises Cruz on refinery tech.' },
];

/* ---- Coalition proposals (Turn 8, mirror scenario) ---- */
const ACCORD_PROPOSALS = [
  {
    id:'apr1', from:'a2', dept:'MILITARY', confidence:'HIGH', status:'unread',
    title:'Press the Mars Salient',
    cost:{ credits:600, teams:1 },
    summary:'Push Hellas Crossing now while the Imperium is distracted by the outer system.',
    body:[
      "Coordinator — Imperium attention is on **Callisto**. Their Mars garrison at Hellas Crossing is thin and morale is cracking. This is the moment to press the salient and flip the contested third city to our side.",
      "Our belt infantry are staged at Valles Free Port. One coordinated push tips Mars from **52/48 against us** to a Coalition majority — and Mars is the spine of the control score.",
      "High confidence. If we wait a turn, they reinforce. <span class='pull'>Strike while their eyes are on Jupiter.</span>",
    ],
    rationale:'High ambition + creativity from the belt commander produced an aggressive, opportunistic strike read on the enemy\'s distraction.',
  },
  {
    id:'apr2', from:'a1', dept:'COMMAND', confidence:'MEDIUM', status:'unread',
    title:'Survey Callisto Before They Land',
    cost:{ credits:700, teams:2 },
    summary:'Race the belt survey fleet to Callisto to deny the Imperium colony ship.',
    body:[
      "We read an Imperium colony ship leaving Europa, bound for **Callisto**. If they plant first, the entire Jovian rare-element supply is theirs for the campaign.",
      "I propose diverting the belt survey fleet to contest the landing. We may not beat them outright, but a contested Callisto is far better than an Imperium monopoly.",
      "Moderate confidence — it spends fleet we'd otherwise use on Mars. <span class='pull'>We cannot fully fund both Mars and Callisto this turn.</span>",
    ],
    rationale:'High political skill + comms produced a balanced denial play that explicitly surfaces the budget conflict with the Mars push.',
  },
  {
    id:'apr3', from:'a3', dept:'RESEARCH', confidence:'MEDIUM', status:'unread',
    title:'Ceres Refinery Expansion',
    cost:{ credits:500, teams:0 },
    summary:'Expand volatiles refining at Ceres — compounding credit income from Turn 10.',
    body:[
      "Coordinator, our belt advantage is economic. Expanding the **Ceres refinery** lifts volatiles output ~22%, compounding into credits that outlast any single battle.",
      "It does nothing this turn and competes with the Mars push. But a richer Coalition can simply outspend the Imperium over thirty turns.",
      "<span class='pull'>If we hold our ground, fund it. If Mars is slipping, defer.</span>",
    ],
    rationale:'Very high competence + creativity, lower political skill: a sound long-horizon economic proposal, plainly framed.',
  },
  {
    id:'apr4', from:'a4', dept:'INDUSTRY', confidence:'LOW', status:'unread',
    title:'Luna Trade Pact',
    cost:{ credits:280, teams:1 },
    summary:'Leverage our Luna hold for a modest, reliable credit stream from Earth orbit.',
    body:[
      "A quiet one, Coordinator. Our hold on **Luna** sits right at the Imperium's doorstep. A trade pact through neutral brokers turns that foothold into steady income.",
      "I rate it **low confidence** only on timing — the credits are small and slow. The arrangement itself is safe.",
      "<span class='pull'>No urgency. Approve if you have slack.</span>",
    ],
    rationale:'High reliability, low creativity: a safe incremental income proposal, honestly self-rated low for the turn.',
  },
];

/* ---- Coalition turn summaries (spec: turn_summaries) ---- */
const ACCORD_TURN_SUMMARY_PREV = {
  turnLabel:'Turn 7 → 8',
  control:{ self:46, enemy:54, delta:+1, selfName:'Coalition', enemyName:'Imperium', note:'We held the belt economy and kept Mars in play.' },
  phases: RES_LOG_PREV,
  deltas:[
    { group:'Coalition · Changes', rows:[ {k:'Luna trade', v:'Rebuffed', dir:'down'}, {k:'Credits', v:'1,860', d:'+110', dir:'up'}, {k:'Ceres', v:'Output steady'} ] },
    { group:'Imperium · Changes', rows:[ {k:'Territory', v:'No change'}, {k:'Credits', v:'1,740', d:'+160', dir:'up'} ] },
  ],
  officer:{ from:'a1', text:'Mars is still ours to take. Watch Europa — they are fueling something.' },
};
const ACCORD_TURN_SUMMARY_NEXT = {
  turnLabel:'Turn 8 → 9',
  control:{ self:43, enemy:57, delta:-3, selfName:'Coalition', enemyName:'Imperium', note:'Losing the Callisto race cost us the outer system.' },
  phases: RES_LOG_NEXT,
  deltas:[
    { group:'Coalition · Changes', rows:[ {k:'Mars push', v:'Repelled', dir:'down'}, {k:'Callisto', v:'Lost to Imperium', dir:'down'}, {k:'Credits', v:'2,100', d:'+120', dir:'up'} ] },
    { group:'Imperium · Changes', rows:[ {k:'Territory', v:'+ Callisto', dir:'up'}, {k:'Credits', v:'1,920', d:'+180', dir:'up'} ] },
  ],
  officer:{ from:'a2', text:'They reinforced Hellas in time. We bled for nothing — regroup at Ceres.' },
};

const ACCORD_BRIEFINGS = [
  { id:'ab2', from:'a1', dept:'COMMAND', kind:'turn_summary', requiresDecision:false,
    subject:'Turn 7 → 8 · Resolution Summary', summary: ACCORD_TURN_SUMMARY_PREV },
  { id:'ab1', from:'a5', dept:'INTEL', subject:'Imperium colony ship leaving Europa', requiresDecision:false,
    body:'Coalition sensors flag an Imperium colony ship departing Europa on a Callisto heading. Accuracy: 76%. Acquired Turn 8.' },
];

/* ---- Per-faction Intelligence feed ---- */
const IMP_INTEL = [
  { id:'ii1', subject:'Coalition belt fleet repositioning', acc:72, body:'A Coalition fleet left Ceres on a heading consistent with a Jupiter survey run. Likely contesting Callisto.' },
  { id:'ii2', subject:'Coalition treasury estimate', acc:64, body:'Estimated 1,800–2,100 cr, trending up via Ceres volatiles trade.' },
  { id:'ii3', subject:'Mars garrison comparison', acc:81, body:'Coalition Valles garrison assessed at 44 vs our Olympus 62. Hellas Crossing remains the weak seam.' },
];
const ACC_INTEL = [
  { id:'ai1', subject:'Imperium colony ship in transit', acc:76, body:'Imperium colony ship departed Europa toward Callisto. If unopposed, they claim the Jovian rare-element field.' },
  { id:'ai2', subject:'Imperium treasury estimate', acc:61, body:'Estimated 2,300–2,600 cr. Higher reserves, but committed to outer-system expansion.' },
  { id:'ai3', subject:'Mars front read', acc:78, body:'Imperium Hellas garrison thin (≈18) with falling morale. A decisive belt push could flip the city.' },
];

/* ---- Per-faction Diplomacy standing ---- */
const IMP_DIPLO = {
  enemyName:'Free Orbits Coalition',
  posture:'HOSTILE · CONTESTED MARS',
  trades:0, lastNeg:'Turn 7 · Luna · FAILED', ceasefire:'LOW',
  note:'No diplomatic channels are open this turn. Intelligence advises that a ceasefire offer would read as weakness while Mars is contested.',
};
const ACC_DIPLO = {
  enemyName:'Sol Imperium',
  posture:'HOSTILE · CONTESTED MARS',
  trades:0, lastNeg:'Turn 7 · Luna · WE PROPOSED', ceasefire:'LOW',
  note:'The Imperium rebuffed our Luna trade overture last turn. A renewed offer could buy time on Mars — but spends political capital we may need elsewhere.',
};

/* ---- Coalition cities (for resources/production view) ---- */
const ACCORD_CITIES = [
  { id:'ac1', faction:'accord', name:'Valles Free Port', pop:'5.1M', infra:3, ind:41, res:38, morale:69, garrison:44, stage:'early', supply:'secure' },
  { id:'ac2', faction:'accord', name:'Ceres Foundry', pop:'8.7M', infra:4, ind:78, res:55, morale:74, garrison:50, stage:'maturation', supply:'secure' },
  { id:'ac3', faction:'accord', name:'Luna Commons', pop:'12.3M', infra:4, ind:62, res:47, morale:71, garrison:38, stage:'maturation', supply:'secure' },
  { id:'ac5', faction:'contested', name:'Hellas Crossing', pop:'2.2M', infra:2, ind:22, res:12, morale:47, garrison:18, stage:'establishment', supply:'cut off' },
];

/* ---- Coalition fleets / colony ships / projects / llm queue ---- */
const ACCORD_FLEETS = [
  { id:'af1', name:'3rd Belt Flotilla', postingBodyId:'mars',  strength:58, orders:'Press the Mars salient' },
  { id:'af2', name:'Ceres Home Fleet',  postingBodyId:'ceres', strength:66, orders:'Defend belt stronghold' },
  { id:'af3', name:'Survey Squadron',   postingBodyId:'ceres', strength:31, orders:'Stage for Callisto run' },
];
const ACCORD_COLONY_SHIPS = [
  { id:'acs1', name:'Drifter’s Hope', originBodyId:'ceres', destBodyId:'callisto', manifest:'1,800 colonists · refinery seed',
    departedTurn:8, arrivesTurn:12, status:'preparing' },
];
const ACCORD_PROJECTS = [
  { id:'apj1', cityId:'ac2', city:'Ceres Foundry', type:'industry', name:'Ceres Refinery Expansion', progress:28, assigned:'500 cr', estCompletion:'Turn 10', status:'active' },
  { id:'apj2', cityId:'ac3', city:'Luna Commons', type:'trade', name:'Luna Trade Pact Office', progress:8, assigned:'1 team · 280 cr', estCompletion:'Turn 11', status:'queued' },
];
const ACCORD_LLM = [
  { id:'alr1', type:'proposals', status:'complete', model:'inception/mercury-2', createdTurn:8, note:'4 officer proposals generated' },
  { id:'alr2', type:'inbox',     status:'complete', model:'inception/mercury-2', createdTurn:8, note:'2 briefings drafted' },
  { id:'alr3', type:'event_narrative', status:'queued', model:'inception/mercury-2', createdTurn:8, note:'Resolution flavor queued' },
];
const ACCORD_ALERTS = [
  { id:'aal1', bodyId:'mars',     level:'opportunity', label:'Hellas ripe to flip' },
  { id:'aal2', bodyId:'callisto', level:'critical',    label:'Imperium ship inbound' },
];

Object.assign(window, {
  ACCORD_PERSONNEL, ACCORD_RELATIONSHIPS, ACCORD_PROPOSALS, ACCORD_BRIEFINGS,
  IMP_INTEL, ACC_INTEL, IMP_DIPLO, ACC_DIPLO, ACCORD_CITIES,
  ACCORD_FLEETS, ACCORD_COLONY_SHIPS, ACCORD_PROJECTS, ACCORD_LLM, ACCORD_ALERTS,
  ACCORD_TURN_SUMMARY_PREV, ACCORD_TURN_SUMMARY_NEXT,
});
