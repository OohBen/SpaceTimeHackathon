/* ============================================================
   SOLAR DOMINION — TACTICAL COMMAND (L1)
   Ambient full-bleed map + floating holographic chrome.
   - POV switch (Imperium / Coalition)
   - Non-modal docked reader (map stays visible)
   - Guided tutorial + inline explanations
   ============================================================ */
const { useState, useEffect, useLayoutEffect, useRef } = React;

const T_NAV = [
  { id: 'map', icon: 'map', label: 'Solar Map', help: 'The system at a glance' },
  { id: 'personnel', icon: 'personnel', label: 'Personnel', help: 'Your officers & their traits' },
  { id: 'resources', icon: 'resources', label: 'Resources', help: 'Treasury, capital & production' },
  { id: 'intel', icon: 'intel', label: 'Intelligence', help: 'Estimated enemy activity' },
  { id: 'diplomacy', icon: 'diplomacy', label: 'Diplomacy', help: 'Standing with the enemy' },
  { id: 'doctrine', icon: 'doctrine', label: 'Doctrine', help: 'Your strategic leanings' },
];

const FTHEME = {
  imperium: { hud:'#5bb6ff', hud2:'#8fd4ff', glow:'rgba(91,182,255,0.5)', ink:'#04101f', dim:'#3f88d8' },
  accord:   { hud:'#ffab4d', hud2:'#ffc078', glow:'rgba(255,171,77,0.5)', ink:'#1a0e00', dim:'#d9831e' },
};

function fmtClock(s){ const m=Math.floor(s/60), ss=s%60; return `${m}:${ss.toString().padStart(2,'0')}`; }

const WS_META = {
  personnel: { icon:'personnel', title:'Personnel Roster', sub:'· officers & traits' },
  resources: { icon:'resources', title:'Resource Ledger', sub:'· treasury · production' },
  intel:     { icon:'intel', title:'Intelligence', sub:'· estimated enemy activity' },
  diplomacy: { icon:'diplomacy', title:'Diplomacy', sub:'· standing with the enemy' },
  doctrine:  { icon:'doctrine', title:'Doctrine', sub:'· strategic vector' },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "glow": 1,
  "stars": true
}/*EDITMODE-END*/;

const TOUR_STEPS = [
  { sel:'.t-tl', place:'bottom', title:'Your faction & viewpoint',
    body:'You command one of two factions. Use the A / B switch here to view the opposing side\u2019s command center — same UI, their officers and decisions.' },
  { sel:'.t-tc', place:'bottom', title:'Turn, phase & timer',
    body:'Each turn moves through phases. You\u2019re in the DECISION phase: your timer counts down, and any proposal you don\u2019t answer auto-defers when it hits zero.' },
  { sel:'.t-tr', place:'bottom', title:'Your resources',
    body:'Credits fund proposals. Political capital unlocks special actions. Control (0\u2013100) is the victory score — the higher of the two factions is winning.' },
  { sel:'.t-nav', place:'right', title:'Command panels',
    body:'Switch between the solar map and your command panels: personnel, resources, intelligence, diplomacy and doctrine.' },
  { sel:'.tac-map', place:'center', title:'The solar theater',
    body:'Your empire across the system. Blue = you, amber = the enemy, a split ring = contested, a pulsing ring = a colonization opportunity. Click any body for detail.' },
  { sel:'.t-inbox', place:'left', title:'Commander inbox',
    body:'Each turn your officers send proposals. Open one to read their reasoning, see why they proposed it, and allocate resources — approve, reject, or defer. The map stays visible while you read.' },
  { sel:'.t-submit', place:'top', title:'Submit your turn',
    body:'When you\u2019ve decided, lock in your turn. Both commanders submit, then the simulation resolves both turns at once.' },
];

function TacApp() {
  const [pov, setPov] = useState('imperium');
  const other = pov === 'imperium' ? 'accord' : 'imperium';
  const selfF = FACTIONS[pov], enemyF = FACTIONS[other];
  const roster = pov === 'imperium' ? PERSONNEL : ACCORD_PERSONNEL;
  const propSource = pov === 'imperium' ? PROPOSALS : ACCORD_PROPOSALS;
  const briefSource = pov === 'imperium' ? BRIEFINGS : ACCORD_BRIEFINGS;
  const intelItems = pov === 'imperium' ? IMP_INTEL : ACC_INTEL;
  const diploData = pov === 'imperium' ? IMP_DIPLO : ACC_DIPLO;
  const prodCities = pov === 'imperium'
    ? CITIES.filter(c => c.faction==='imperium' || c.faction==='contested')
    : ACCORD_CITIES;

  const [activePanel, setActivePanel] = useState('map');
  const [proposals, setProposals] = useState(propSource.map(p => ({ ...p })));
  const [briefings, setBriefings] = useState(briefSource);
  const [resolved, setResolved] = useState(false);
  const [selectedProp, setSelectedProp] = useState(null);
  const [openBriefing, setOpenBriefing] = useState(null);
  const [selectedBody, setSelectedBody] = useState('mars');
  const [cityOpen, setCityOpen] = useState(null);
  const [faction, setFaction] = useState({ ...selfF });
  const [secondsLeft, setSecondsLeft] = useState(SESSION.deadline);
  const [submitted, setSubmitted] = useState(false);
  const [oppReady, setOppReady] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tour, setTour] = useState(-1);
  const povMounted = useRef(false);
  const glow = tw.glow;

  // apply faction theme + tweaks to CSS vars
  useEffect(() => {
    const t = FTHEME[pov], r = document.documentElement.style;
    r.setProperty('--hud', t.hud);
    r.setProperty('--hud-2', t.hud2);
    r.setProperty('--hud-glow', t.glow);
    r.setProperty('--hud-ink', t.ink);
    r.setProperty('--hud-dim', t.dim);
  }, [pov]);
  useEffect(() => {
    document.documentElement.style.setProperty('--glow', tw.glow);
    document.body.classList.toggle('no-stars', !tw.stars);
  }, [tw.glow, tw.stars]);

  // re-seed when POV changes
  useEffect(() => {
    setProposals(propSource.map(p => ({ ...p })));
    setBriefings(briefSource); setResolved(false);
    setFaction({ ...selfF });
    setSelectedProp(null); setOpenBriefing(null); setCityOpen(null);
    setActivePanel('map'); setSubmitted(false);
    if (povMounted.current) pushToast(`Now viewing · ${selfF.name}`, FTHEME[pov].hud);
    else povMounted.current = true;
  }, [pov]);

  // first-run tutorial
  useEffect(() => {
    let done = false;
    try { done = localStorage.getItem('sd_tour_done') === '1'; } catch(e){}
    if (!done) { const t = setTimeout(()=>setTour(0), 700); return ()=>clearTimeout(t); }
  }, []);

  useEffect(() => {
    if (submitted) return;
    const t = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [submitted]);

  useEffect(() => {
    const t = setTimeout(() => { setOppReady(true); pushToast(`${enemyF.name} submitted their turn`, FTHEME[other].hud); }, 26000);
    return () => clearTimeout(t);
  }, [pov]);

  function pushToast(msg, color) {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, color }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3400);
  }

  function decide(propId, decision, alloc) {
    setProposals(ps => ps.map(p => p.id === propId ? { ...p, status: decision } : p));
    if (decision === 'approved') {
      setFaction(f => ({ ...f, credits: f.credits - alloc.credits }));
      pushToast(`Approved · ${alloc.credits} cr + ${alloc.teams} team${alloc.teams!==1?'s':''} allocated`, 'var(--hud-2)');
    } else if (decision === 'rejected') pushToast('Proposal rejected', 'var(--alert)');
    else pushToast('Proposal deferred to next turn', 'var(--warn)');
    setSelectedProp(null);
  }

  function endTour(skip) {
    setTour(-1);
    try { localStorage.setItem('sd_tour_done','1'); } catch(e){}
  }
  function startTour(){ setActivePanel('map'); setSelectedProp(null); setCityOpen(null); setOpenBriefing(null); setTimeout(()=>setTour(0),60); }

  const nextSummary = pov === 'imperium' ? TURN_SUMMARY_NEXT : ACCORD_TURN_SUMMARY_NEXT;
  function resolveTurn(){
    const sumBriefing = { id:'sum-next', from: nextSummary.officer.from, dept:'COMMAND', kind:'turn_summary',
      requiresDecision:false, subject: nextSummary.turnLabel + ' · Resolution Summary', summary: nextSummary };
    if (!resolved) { setBriefings(bs => [sumBriefing, ...bs]); setResolved(true); }
    setActivePanel('map'); setSelectedProp(null); setCityOpen(null);
    setOpenBriefing(sumBriefing);
    pushToast('Turn resolved · summary filed to Briefings', 'var(--hud-2)');
  }
  function openTurnLog(){
    const ts = briefings.find(b => b.kind === 'turn_summary');
    if (ts) { setActivePanel('map'); setSelectedProp(null); setCityOpen(null); setOpenBriefing(ts); }
  }

  const pendingCount = proposals.filter(p => !['approved','rejected','deferred','auto_deferred'].includes(p.status)).length;
  const selProp = proposals.find(p => p.id === selectedProp);
  const timerCls = secondsLeft <= 30 ? 'danger' : secondsLeft <= 60 ? 'warn' : '';
  const isMap = activePanel === 'map';
  const dockOpen = !!(selProp || cityOpen || openBriefing);
  const wsOpen = !isMap;
  const ws = WS_META[activePanel];
  const Crest = pov === 'imperium' ? CrestImperium : CrestAccord;

  function openBody(id){ setSelectedBody(id); setCityOpen(id); }

  return (
    <div className={'tac' + (isMap ? ' mapview':'') + (wsOpen ? ' dimmed':'') + (dockOpen ? ' docked':'')}>
      {/* ambient map */}
      <div className="tac-map">
        <SolarMap selectedBody={selectedBody} onSelectBody={openBody} glow={glow} alerts={pov==='imperium'?ALERTS:ACCORD_ALERTS} />
      </div>

      {/* top-left identity + POV switch */}
      <div className="tac-float glass t-tl">
        <span className="crest"><Crest size={34}/></span>
        <div>
          <div className="fname">{selfF.name}</div>
          <div className="ftag">{selfF.tag}</div>
        </div>
        <div className="pov-switch" title="Switch which faction's command you are viewing">
          <span className="pov-lab">View</span>
          <button className={'pov-btn' + (pov==='imperium'?' on':'')} onClick={()=>setPov('imperium')}>A</button>
          <button className={'pov-btn' + (pov==='accord'?' on':'')} onClick={()=>setPov('accord')}>B</button>
        </div>
      </div>

      {/* top-center turn cluster */}
      <div className={'tac-float glass t-tc ' + timerCls}>
        <div className="seg"><span className="k">Year</span><span className="v">{SESSION.year}</span></div>
        <div className="seg"><span className="k">Turn</span><span className="v">{SESSION.turn}/{SESSION.maxTurn}</span></div>
        <div className="seg"><span className="phase"><i></i>{(TURN_PHASES.find(p=>p.id===SESSION.phase)||{label:SESSION.phase}).label}</span></div>
        <div className="seg" title="Time left to decide. Unanswered proposals auto-defer at zero."><span className="k">Window</span><span className="tmr">{fmtClock(secondsLeft)}</span></div>
      </div>

      {/* turn-phase pipeline (spec: world_update → … → complete) — contextual on map view */}
      {isMap && <PhaseRail current={SESSION.phase}/>}

      {/* top-right resources */}
      <div className="tac-float t-tr">
        <div className="glass resp" title="Credits fund proposals and construction"><span className="k">Credits</span><span className="v" style={{color:'var(--accord-2)'}}>{faction.credits.toLocaleString()}</span><span className={'d ' + (faction.creditsDelta>=0?'up':'down')}>{faction.creditsDelta>=0?'+':''}{faction.creditsDelta}/t</span></div>
        <div className="glass resp" title="Political capital unlocks special actions like diplomacy"><span className="k">Pol · Cap</span><span className="v">{faction.politicalCapital}</span><span className={'d ' + (faction.pcDelta>=0?'up':'down')}>{faction.pcDelta>=0?'+':''}{faction.pcDelta}/t</span></div>
        <div className="glass resp" title="Control score (0–100). The higher faction is winning."><span className="k">Control</span><span className="v">{faction.controlScore}<small style={{fontSize:10,color:'var(--muted)'}}> /100</small></span><span className="d up">+2/t</span></div>
      </div>

      {/* left nav dock */}
      <div className="tac-float glass t-nav">
        {T_NAV.map(n => (
          <button key={n.id} className={'nbtn' + (activePanel===n.id?' on':'')} onClick={()=>setActivePanel(n.id)}>
            <Icon name={n.icon}/>
            {n.id==='map' && pendingCount>0 && <span className="badge">{pendingCount}</span>}
            <span className="tip"><b>{n.label}</b><em>{n.help}</em></span>
          </button>
        ))}
        <div className="nsep"></div>
        <button className="nbtn" onClick={openTurnLog}><Icon name="resolution"/><span className="tip"><b>Turn Log</b><em>Resolution summaries</em></span></button>
        <button className="nbtn help-btn" onClick={startTour}><HelpIcon/><span className="tip"><b>Tutorial</b><em>How to play</em></span></button>
      </div>

      {/* map-view floating extras */}
      {isMap && !dockOpen && (
        <>
          <div className="tac-float glass t-legend">
            <div style={{display:'flex',gap:14}}>
              <span className="lg"><i style={{background:'var(--imperium)'}}></i>Imperium</span>
              <span className="lg"><i style={{background:'var(--accord)'}}></i>Coalition</span>
              <span className="lg"><i style={{background:'var(--warn)'}}></i>Contested</span>
              <span className="lg"><i style={{background:'var(--cyan)'}}></i>Opportunity</span>
            </div>
            <div style={{width:1,height:22,background:'var(--hairline)'}}></div>
            <div className="ctrl" title="Control score — both factions. Higher is winning.">
              <span className="cv" style={{color:'var(--imperium-2)'}}>{FACTIONS.imperium.controlScore}</span>
              <div className="track"><div className="a" style={{width:FACTIONS.imperium.controlScore+'%'}}></div><div className="b" style={{width:FACTIONS.accord.controlScore+'%'}}></div></div>
              <span className="cv" style={{color:'var(--accord-2)'}}>{FACTIONS.accord.controlScore}</span>
            </div>
          </div>

          <div className="tac-float glass t-inbox">
            <Inbox proposals={proposals} briefings={briefings} selectedId={selectedProp} roster={roster}
              llm={pov==='imperium'?LLM_REQUESTS:ACCORD_LLM}
              onSelect={(id)=>{ setSelectedProp(id); setProposals(ps=>ps.map(p=>p.id===id&&p.status==='unread'?{...p,status:'read'}:p)); }}
              onOpenBriefing={setOpenBriefing} />
          </div>
        </>
      )}

      {/* sub-page workspace */}
      {!isMap && ws && (
        <div className="tac-float glass t-workspace">
          <div className="ws-head">
            <span className="ic"><Icon name={ws.icon} size={18}/></span>
            <div><div className="ti">{ws.title}</div></div>
            <span className="sub">{ws.sub}</span>
            <button className="ws-back" onClick={()=>setActivePanel('map')}><Icon name="map" size={15}/> Back to Map</button>
          </div>
          <div className="ws-body">
            {activePanel==='personnel' && <PersonnelPanel roster={roster} relationships={pov==='imperium'?RELATIONSHIPS:ACCORD_RELATIONSHIPS}/>}
            {activePanel==='resources' && <ResourcesPanel faction={faction} cities={prodCities}
              fleets={pov==='imperium'?FLEETS:ACCORD_FLEETS}
              ships={pov==='imperium'?COLONY_SHIPS:ACCORD_COLONY_SHIPS}
              projects={pov==='imperium'?PROJECTS:ACCORD_PROJECTS}
              llm={pov==='imperium'?LLM_REQUESTS:ACCORD_LLM}/>}
            {activePanel==='intel' && <IntelPanel items={intelItems}/>}
            {activePanel==='diplomacy' && <DiplomacyPanel data={diploData}/>}
            {activePanel==='doctrine' && <DoctrinePanel faction={selfF} enemy={enemyF}
              selfName={pov==='imperium'?'Imperium':'Coalition'} enemyName={pov==='imperium'?'Coalition':'Imperium'}
              selfColor={pov==='imperium'?'var(--imperium)':'var(--accord)'} selfColor2={pov==='imperium'?'var(--imperium-2)':'var(--accord-2)'}
              enemyColor={pov==='imperium'?'var(--accord)':'var(--imperium)'} enemyColor2={pov==='imperium'?'var(--accord-2)':'var(--imperium-2)'}/>}
          </div>
        </div>
      )}

      {/* bottom-left submit */}
      <div className="tac-float t-submit">
        {submitted && oppReady ? (
          <button className="submit-btn-tac" onClick={resolveTurn}>
            <Icon name="resolution" size={18}/> Resolve Turn
          </button>
        ) : (
          <button className={'submit-btn-tac' + (submitted?' submitted':'')} onClick={()=>{ if(!submitted){ setSubmitted(true); pushToast('Turn submitted · awaiting simulation', 'var(--hud-2)'); } }}>
            {submitted ? <><Icon name="check" size={18}/> Turn Submitted</> : <><Icon name="submit" size={18}/> Submit Turn</>}
          </button>
        )}
        <div className={'opp' + (oppReady?' ready':'')}><span className="pip"></span>{oppReady?`${enemyF.name} ready`:`${enemyF.name} deciding…`}</div>
      </div>

      {/* docked overlays (non-modal — map stays visible) */}
      {selProp && <ProposalReader proposal={selProp} faction={faction} roster={roster} onClose={()=>setSelectedProp(null)} onDecide={decide} />}
      {cityOpen && <CityDetail bodyId={cityOpen} onClose={()=>setCityOpen(null)} />}
      {openBriefing && <BriefingReader briefing={openBriefing} roster={roster} onClose={()=>setOpenBriefing(null)} />}

      {/* toasts */}
      <div className="toast-wrap">
        {toasts.map(t => <div key={t.id} className="toast"><span className="tdot" style={{background:t.color}}></span>{t.msg}</div>)}
      </div>

      {/* tutorial */}
      {tour >= 0 && <Tutorial key={tour} step={tour} setStep={setTour} onClose={endTour} />}

      {/* tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Aesthetic"/>
        <TweakSlider label="Glow" value={tw.glow} min={0} max={1.6} step={0.1} onChange={(v)=>setTweak('glow',v)}/>
        <TweakToggle label="Star field" value={tw.stars} onChange={(v)=>setTweak('stars',v)}/>
        <TweakSection label="Session"/>
        <TweakRadio label="Viewpoint" value={pov==='imperium'?'Imperium (A)':'Coalition (B)'} options={['Imperium (A)','Coalition (B)']}
          onChange={(v)=>setPov(v.startsWith('Imperium')?'imperium':'accord')}/>
        <TweakButton label="Replay tutorial" onClick={startTour}/>
      </TweaksPanel>
    </div>
  );
}

/* ---------- Turn-phase pipeline rail ---------- */
function PhaseRail({ current }) {
  const idx = TURN_PHASES.findIndex(p => p.id === current);
  return (
    <div className="tac-float glass t-phase" title="The turn moves through these phases. You are in DECISION.">
      {TURN_PHASES.map((p, i) => (
        <React.Fragment key={p.id}>
          {i > 0 && <span className={'pr-link' + (i <= idx ? ' done' : '')}></span>}
          <span className={'pr-step' + (i === idx ? ' on' : i < idx ? ' done' : '')} title={p.desc}>
            <span className="pr-dot">{i < idx ? '✓' : i + 1}</span>
            <span className="pr-lab">{p.label}</span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

/* ---------- Tutorial (spotlight coachmarks) ---------- */
function Tutorial({ step, setStep, onClose }) {
  const s = TOUR_STEPS[step];
  const [rect, setRect] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector(s.sel);
      if (el) setRect(el.getBoundingClientRect());
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [step]);

  if (!rect) return null;
  const vw = window.innerWidth, vh = window.innerHeight, pad = 8, cardW = 330;
  const big = rect.width > vw * 0.7;
  const hx = Math.max(0, rect.left - pad), hy = Math.max(0, rect.top - pad);
  const hw = rect.width + pad*2, hh = rect.height + pad*2;

  let cardStyle = {};
  if (big || s.place === 'center') {
    cardStyle = { left: vw/2 - cardW/2, top: vh*0.5 - 90 };
  } else if (s.place === 'right') {
    cardStyle = { left: Math.min(rect.right + 16, vw - cardW - 16), top: rect.top };
  } else if (s.place === 'left') {
    cardStyle = { left: Math.max(rect.left - cardW - 16, 16), top: Math.max(16, rect.top) };
  } else if (s.place === 'top') {
    cardStyle = { left: clamp(rect.left + rect.width/2 - cardW/2, 16, vw-cardW-16), top: rect.top - 14, transform:'translateY(-100%)' };
  } else {
    cardStyle = { left: clamp(rect.left + rect.width/2 - cardW/2, 16, vw-cardW-16), top: rect.bottom + 14 };
  }

  const last = step === TOUR_STEPS.length - 1;
  return (
    <div className="tut">
      <div className="tut-catch" onClick={()=>last?onClose():setStep(step+1)}></div>
      <div className="tut-spot" style={{ left:hx, top:hy, width:hw, height:hh }}></div>
      <div className="tut-card" style={cardStyle} onClick={e=>e.stopPropagation()}>
        <div className="tut-step">STEP {step+1} / {TOUR_STEPS.length}</div>
        <div className="tut-title">{s.title}</div>
        <div className="tut-body">{s.body}</div>
        <div className="tut-actions">
          <button className="tut-skip" onClick={onClose}>Skip</button>
          <div style={{flex:1}}></div>
          {step>0 && <button className="tut-back" onClick={()=>setStep(step-1)}>Back</button>}
          <button className="tut-next" onClick={()=>last?onClose():setStep(step+1)}>{last?'Got it':'Next'}</button>
        </div>
      </div>
    </div>
  );
}
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

const HelpIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M9.2 9.3a2.8 2.8 0 0 1 5.4 1c0 1.9-2.6 2-2.6 3.7"/><path d="M12 17.5v.01"/>
  </svg>
);

ReactDOM.createRoot(document.getElementById('root')).render(<TacApp/>);
