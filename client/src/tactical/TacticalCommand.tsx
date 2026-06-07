/* ============================================================
   SOLAR DOMINION — TACTICAL COMMAND (live)
   Ported from _design/tactical-app.jsx. Ambient full-bleed map +
   floating holographic chrome, wired to the live `sessionStore`
   via useTacticalData(). POV A/B switch removed — the game is
   single-faction: you only command your own faction.
   ============================================================ */
import { useEffect, useLayoutEffect, useState } from 'react';
import type { ReactElement } from 'react';
import './tactical.css';

import type { SpacetimeClient } from '../spacetime/client';
import { sessionStore } from '../state/session-store';
import {
  useTacticalData,
  BODY_LAYOUT_BY_KEY,
  commanderDecisionAction,
  submitTurnAction,
  simulateTurnAction,
  ackResolutionAction,
} from './useTacticalData';
import { TURN_PHASES } from './staticLayout';
import type { TacBody, TacBriefing, TacProposal, TacProposalStatus } from './types';

import { SolarMap } from './SolarMap';
import { Inbox, ProposalReader } from './Inbox';
import type { TacAllocation, TacDecision } from './Inbox';
import {
  PersonnelPanel,
  ResourcesPanel,
  IntelPanel,
  DiplomacyPanel,
  DoctrinePanel,
  CityDetail,
  BriefingReader,
} from './Panels';
import { Icon, CrestImperium, HelpIcon } from './icons';
import {
  TweaksPanel,
  TweakSection,
  TweakSlider,
  TweakToggle,
  TweakButton,
  useTweaks,
} from './Tweaks';

/* ---------- static nav + metadata (verbatim from design) ---------- */
const T_NAV = [
  { id: 'map', icon: 'map', label: 'Solar Map', help: 'The system at a glance' },
  { id: 'personnel', icon: 'personnel', label: 'Personnel', help: 'Your officers & their traits' },
  { id: 'resources', icon: 'resources', label: 'Resources', help: 'Treasury, capital & production' },
  { id: 'intel', icon: 'intel', label: 'Intelligence', help: 'Estimated enemy activity' },
  { id: 'diplomacy', icon: 'diplomacy', label: 'Diplomacy', help: 'Standing with the enemy' },
  { id: 'doctrine', icon: 'doctrine', label: 'Doctrine', help: 'Your strategic leanings' },
] as const;

type PanelId = (typeof T_NAV)[number]['id'];

const WS_META: Record<string, { icon: string; title: string; sub: string }> = {
  personnel: { icon: 'personnel', title: 'Personnel Roster', sub: '· officers & traits' },
  resources: { icon: 'resources', title: 'Resource Ledger', sub: '· treasury · production' },
  intel: { icon: 'intel', title: 'Intelligence', sub: '· estimated enemy activity' },
  diplomacy: { icon: 'diplomacy', title: 'Diplomacy', sub: '· standing with the enemy' },
  doctrine: { icon: 'doctrine', title: 'Doctrine', sub: '· strategic vector' },
};

/* imperium/azure palette — the design default, kept as the base theme */
const DEFAULT_THEME = {
  hud: '#5bb6ff',
  hud2: '#8fd4ff',
  glow: 'rgba(91,182,255,0.5)',
  ink: '#04101f',
  dim: '#3f88d8',
};

const TWEAK_DEFAULTS = { glow: 1, stars: true };

const DEFAULT_DEADLINE_SECONDS = 180;

function fmtClock(s: number): string {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

const TOUR_STEPS = [
  {
    sel: '.t-tl',
    place: 'bottom',
    title: 'Your faction',
    body: 'You command your faction here — its crest, name, and slot. Every panel and decision below is yours.',
  },
  {
    sel: '.t-tc',
    place: 'bottom',
    title: 'Turn, phase & timer',
    body: 'Each turn moves through phases. In the DECISION phase your timer counts down, and any proposal you don’t answer auto-defers when it hits zero.',
  },
  {
    sel: '.t-tr',
    place: 'bottom',
    title: 'Your resources',
    body: 'Credits fund proposals. Political capital unlocks special actions. Control (0–100) is the victory score — the higher of the two factions is winning.',
  },
  {
    sel: '.t-nav',
    place: 'right',
    title: 'Command panels',
    body: 'Switch between the solar map and your command panels: personnel, resources, intelligence, diplomacy and doctrine.',
  },
  {
    sel: '.tac-map',
    place: 'center',
    title: 'The solar theater',
    body: 'Your empire across the system. Blue = you, amber = the enemy, a split ring = contested, a pulsing ring = a colonization opportunity. Click any body for detail.',
  },
  {
    sel: '.t-inbox',
    place: 'left',
    title: 'Commander inbox',
    body: 'Each turn your officers send proposals. Open one to read their reasoning and allocate resources — approve, reject, or defer. The map stays visible while you read.',
  },
  {
    sel: '.t-submit',
    place: 'top',
    title: 'Submit your turn',
    body: 'When you’ve decided, lock in your turn. Both commanders submit, then the simulation resolves both turns at once.',
  },
] as const;

interface Toast {
  id: string;
  msg: string;
  color: string;
}

export interface TacticalCommandProps {
  client: SpacetimeClient | null;
}

export default function TacticalCommand({ client }: TacticalCommandProps): ReactElement {
  const bundle = useTacticalData(sessionStore);

  const [activePanel, setActivePanel] = useState<PanelId>('map');
  const [readStatusById, setReadStatusById] = useState<Record<string, TacProposalStatus>>({});
  const [selectedProp, setSelectedProp] = useState<string | null>(null);
  const [openBriefing, setOpenBriefing] = useState<TacBriefing | null>(null);
  const [selectedBody, setSelectedBody] = useState<string>('mars');
  const [cityOpen, setCityOpen] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(DEFAULT_DEADLINE_SECONDS);
  const [submitted, setSubmitted] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tour, setTour] = useState(-1);
  const glow = tw.glow;

  /* apply theme to CSS vars once — single faction, no A/B swap */
  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty('--hud', DEFAULT_THEME.hud);
    r.setProperty('--hud-2', DEFAULT_THEME.hud2);
    r.setProperty('--hud-glow', DEFAULT_THEME.glow);
    r.setProperty('--hud-ink', DEFAULT_THEME.ink);
    r.setProperty('--hud-dim', DEFAULT_THEME.dim);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--glow', String(tw.glow));
    document.body.classList.toggle('no-stars', !tw.stars);
  }, [tw.glow, tw.stars]);

  /* first-run tutorial */
  useEffect(() => {
    let done = false;
    try {
      done = localStorage.getItem('sd_tour_done') === '1';
    } catch {
      /* ignore */
    }
    if (!done) {
      const t = setTimeout(() => setTour(0), 700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  /* initialize the countdown from the live deadline if present, else default */
  const deadline = bundle.session?.deadline ?? 0;
  useEffect(() => {
    setSecondsLeft(deadline > 0 ? deadline : DEFAULT_DEADLINE_SECONDS);
  }, [deadline]);

  /* client-side countdown */
  useEffect(() => {
    if (submitted) return undefined;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [submitted]);

  function pushToast(msg: string, color: string): void {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, color }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }

  /* ---- decide: optimistic toast + read state; reducer is source of truth ---- */
  function decide(propId: string, decision: TacDecision, alloc: TacAllocation): void {
    const factionId = bundle.faction ? Number(bundle.faction.id) : null;
    const proposalId = Number(propId);
    if (client && factionId !== null && Number.isFinite(factionId) && Number.isFinite(proposalId)) {
      commanderDecisionAction(sessionStore, client, {
        factionId,
        proposalId,
        decision,
        allocation: decision === 'approved' ? alloc.credits : 0,
      });
    }
    if (decision === 'approved') {
      pushToast(
        `Approved · ${alloc.credits} cr + ${alloc.teams} team${alloc.teams !== 1 ? 's' : ''} allocated`,
        'var(--hud-2)',
      );
    } else if (decision === 'rejected') {
      pushToast('Proposal rejected', 'var(--alert)');
    } else {
      pushToast('Proposal deferred to next turn', 'var(--warn)');
    }
    setSelectedProp(null);
  }

  function submitTurn(): void {
    if (submitted) return;
    const factionId = bundle.faction ? Number(bundle.faction.id) : null;
    if (client && factionId !== null && Number.isFinite(factionId)) {
      submitTurnAction(sessionStore, client, { factionId });
    }
    setSubmitted(true);
    pushToast('Turn submitted · awaiting simulation', 'var(--hud-2)');
  }

  function resolveTurn(): void {
    const sessionId = bundle.session ? Number(bundle.session.id) : null;
    const factionId = bundle.faction ? Number(bundle.faction.id) : null;
    const phase = bundle.session?.phase;
    if (client && phase === 'resolution' && sessionId !== null && Number.isFinite(sessionId)) {
      simulateTurnAction(sessionStore, client, { sessionId });
    } else if (client && factionId !== null && Number.isFinite(factionId)) {
      ackResolutionAction(sessionStore, client, { factionId });
    }
    const ts = bundle.briefings.find((b) => b.kind === 'turn_summary');
    if (ts) {
      setActivePanel('map');
      setSelectedProp(null);
      setCityOpen(null);
      setOpenBriefing(ts);
    }
    pushToast('Turn resolution requested', 'var(--hud-2)');
  }

  function openTurnLog(): void {
    const ts = bundle.briefings.find((b) => b.kind === 'turn_summary');
    if (ts) {
      setActivePanel('map');
      setSelectedProp(null);
      setCityOpen(null);
      setOpenBriefing(ts);
    }
  }

  function endTour(): void {
    setTour(-1);
    try {
      localStorage.setItem('sd_tour_done', '1');
    } catch {
      /* ignore */
    }
  }

  function startTour(): void {
    setActivePanel('map');
    setSelectedProp(null);
    setCityOpen(null);
    setOpenBriefing(null);
    setTimeout(() => setTour(0), 60);
  }

  function openBody(id: string): void {
    setSelectedBody(id);
    setCityOpen(id);
  }

  /* not-ready guard: minimal themed link-up state */
  if (!bundle.ready || !bundle.faction || !bundle.session) {
    return (
      <div className="tac" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="tac-float glass" style={{ position: 'static', padding: '22px 28px', textAlign: 'center' }}>
          <span className="crest" style={{ display: 'inline-flex', marginBottom: 10 }}>
            <CrestImperium size={40} />
          </span>
          <div style={{ fontFamily: 'var(--font-label)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--hud-2)', fontSize: 13 }}>
            Establishing command link…
          </div>
        </div>
      </div>
    );
  }

  const faction = bundle.faction;
  const enemy = bundle.enemy;
  const session = bundle.session;
  const roster = bundle.roster;

  /* fold optimistic local read/decision status over the live proposals */
  const proposals: TacProposal[] = bundle.proposals.map((p) =>
    readStatusById[p.id] ? { ...p, status: readStatusById[p.id] } : p,
  );

  const prodCities = bundle.cities.filter((c) => c.faction === 'imperium' || c.faction === 'contested');
  const pendingCount = proposals.filter(
    (p) => !['approved', 'rejected', 'deferred', 'auto_deferred'].includes(p.status),
  ).length;
  const selProp = proposals.find((p) => p.id === selectedProp) ?? null;
  const timerCls = secondsLeft <= 30 ? 'danger' : secondsLeft <= 60 ? 'warn' : '';
  const isMap = activePanel === 'map';
  const dockOpen = Boolean(selProp || cityOpen || openBriefing);
  const wsOpen = !isMap;
  const ws = WS_META[activePanel];

  const selfControl = faction.controlScore;
  const enemyControl = enemy?.controlScore ?? 0;

  /* resolve the selected body to a TacBody for CityDetail */
  const cityBody: TacBody | null = cityOpen
    ? bundle.bodies.find((b) => b.id === cityOpen) ?? BODY_LAYOUT_BY_KEY[cityOpen] ?? null
    : null;

  const phaseLabel = (TURN_PHASES.find((p) => p.id === session.phase) || { label: session.phase }).label;

  return (
    <div className={'tac' + (isMap ? ' mapview' : '') + (wsOpen ? ' dimmed' : '') + (dockOpen ? ' docked' : '')}>
      {/* ambient map */}
      <div className="tac-map">
        <SolarMap selectedBody={selectedBody} onSelectBody={openBody} glow={glow} alerts={bundle.alerts} />
      </div>

      {/* top-left identity (POV switch removed — single faction) */}
      <div className="tac-float glass t-tl">
        <span className="crest"><CrestImperium size={34} /></span>
        <div>
          <div className="fname">{faction.name}</div>
          <div className="ftag">{faction.tag || `Session ${session.id}`}</div>
        </div>
      </div>

      {/* top-center turn cluster */}
      <div className={'tac-float glass t-tc ' + timerCls}>
        <div className="seg"><span className="k">Year</span><span className="v">{session.year}</span></div>
        <div className="seg"><span className="k">Turn</span><span className="v">{session.turn}/{session.maxTurn}</span></div>
        <div className="seg"><span className="phase"><i></i>{phaseLabel}</span></div>
        <div className="seg" title="Time left to decide. Unanswered proposals auto-defer at zero."><span className="k">Window</span><span className="tmr">{fmtClock(secondsLeft)}</span></div>
      </div>

      {/* turn-phase pipeline — contextual on map view */}
      {isMap && <PhaseRail current={session.phase} />}

      {/* top-right resources */}
      <div className="tac-float t-tr">
        <div className="glass resp" title="Credits fund proposals and construction"><span className="k">Credits</span><span className="v" style={{ color: 'var(--accord-2)' }}>{faction.credits.toLocaleString()}</span><span className={'d ' + (faction.creditsDelta >= 0 ? 'up' : 'down')}>{faction.creditsDelta >= 0 ? '+' : ''}{faction.creditsDelta}/t</span></div>
        <div className="glass resp" title="Political capital unlocks special actions like diplomacy"><span className="k">Pol · Cap</span><span className="v">{faction.politicalCapital}</span><span className={'d ' + (faction.pcDelta >= 0 ? 'up' : 'down')}>{faction.pcDelta >= 0 ? '+' : ''}{faction.pcDelta}/t</span></div>
        <div className="glass resp" title="Control score (0–100). The higher faction is winning."><span className="k">Control</span><span className="v">{faction.controlScore}<small style={{ fontSize: 10, color: 'var(--muted)' }}> /100</small></span><span className="d up">+0/t</span></div>
      </div>

      {/* left nav dock */}
      <div className="tac-float glass t-nav">
        {T_NAV.map((n) => (
          <button key={n.id} className={'nbtn' + (activePanel === n.id ? ' on' : '')} onClick={() => setActivePanel(n.id)}>
            <Icon name={n.icon} />
            {n.id === 'map' && pendingCount > 0 && <span className="badge">{pendingCount}</span>}
            <span className="tip"><b>{n.label}</b><em>{n.help}</em></span>
          </button>
        ))}
        <div className="nsep"></div>
        <button className="nbtn" onClick={openTurnLog}><Icon name="resolution" /><span className="tip"><b>Turn Log</b><em>Resolution summaries</em></span></button>
        <button className="nbtn help-btn" onClick={startTour}><HelpIcon /><span className="tip"><b>Tutorial</b><em>How to play</em></span></button>
      </div>

      {/* map-view floating extras */}
      {isMap && !dockOpen && (
        <>
          <div className="tac-float glass t-legend">
            <div style={{ display: 'flex', gap: 14 }}>
              <span className="lg"><i style={{ background: 'var(--imperium)' }}></i>{faction.name}</span>
              <span className="lg"><i style={{ background: 'var(--accord)' }}></i>{enemy?.name ?? 'Enemy'}</span>
              <span className="lg"><i style={{ background: 'var(--warn)' }}></i>Contested</span>
              <span className="lg"><i style={{ background: 'var(--cyan)' }}></i>Opportunity</span>
            </div>
            <div style={{ width: 1, height: 22, background: 'var(--hairline)' }}></div>
            <div className="ctrl" title="Control score — both factions. Higher is winning.">
              <span className="cv" style={{ color: 'var(--imperium-2)' }}>{selfControl}</span>
              <div className="track"><div className="a" style={{ width: selfControl + '%' }}></div><div className="b" style={{ width: enemyControl + '%' }}></div></div>
              <span className="cv" style={{ color: 'var(--accord-2)' }}>{enemyControl}</span>
            </div>
          </div>

          <div className="tac-float glass t-inbox">
            <Inbox
              proposals={proposals}
              briefings={bundle.briefings}
              selectedId={selectedProp}
              roster={roster}
              llm={bundle.llmRequests}
              onSelect={(id) => {
                setSelectedProp(id);
                const p = proposals.find((x) => x.id === id);
                if (p && p.status === 'unread') {
                  setReadStatusById((prev) => ({ ...prev, [id]: 'read' }));
                }
              }}
              onOpenBriefing={setOpenBriefing}
            />
          </div>
        </>
      )}

      {/* sub-page workspace */}
      {!isMap && ws && (
        <div className="tac-float glass t-workspace">
          <div className="ws-head">
            <span className="ic"><Icon name={ws.icon} size={18} /></span>
            <div><div className="ti">{ws.title}</div></div>
            <span className="sub">{ws.sub}</span>
            <button className="ws-back" onClick={() => setActivePanel('map')}><Icon name="map" size={15} /> Back to Map</button>
          </div>
          <div className="ws-body">
            {activePanel === 'personnel' && <PersonnelPanel roster={roster} relationships={bundle.relationships} />}
            {activePanel === 'resources' && (
              <ResourcesPanel
                faction={faction}
                cities={prodCities}
                fleets={bundle.fleets}
                ships={bundle.colonyShips}
                projects={bundle.projects}
                llm={bundle.llmRequests}
              />
            )}
            {activePanel === 'intel' && <IntelPanel items={bundle.intel} />}
            {activePanel === 'diplomacy' && bundle.diplo && <DiplomacyPanel data={bundle.diplo} />}
            {activePanel === 'doctrine' && enemy && (
              <DoctrinePanel
                faction={faction}
                enemy={enemy}
                selfName={faction.name}
                enemyName={enemy.name}
              />
            )}
          </div>
        </div>
      )}

      {/* bottom-left submit / resolve */}
      <div className="tac-float t-submit">
        {submitted && (session.phase === 'resolution' || session.phase === 'summary') ? (
          <button className="submit-btn-tac" onClick={resolveTurn}>
            <Icon name="resolution" size={18} /> Resolve Turn
          </button>
        ) : (
          <button className={'submit-btn-tac' + (submitted ? ' submitted' : '')} onClick={submitTurn}>
            {submitted ? <><Icon name="check" size={18} /> Turn Submitted</> : <><Icon name="submit" size={18} /> Submit Turn</>}
          </button>
        )}
        <div className={'opp' + (submitted ? ' ready' : '')}>
          <span className="pip"></span>{submitted ? `${enemy?.name ?? 'Opponent'} deciding…` : `vs ${enemy?.name ?? 'Opponent'}`}
        </div>
      </div>

      {/* docked overlays (non-modal — map stays visible) */}
      {selProp && (
        <ProposalReader proposal={selProp} faction={faction} roster={roster} onClose={() => setSelectedProp(null)} onDecide={decide} />
      )}
      {cityOpen && <CityDetail body={cityBody} cities={bundle.cities} onClose={() => setCityOpen(null)} />}
      {openBriefing && <BriefingReader briefing={openBriefing} roster={roster} onClose={() => setOpenBriefing(null)} />}

      {/* toasts */}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className="toast"><span className="tdot" style={{ background: t.color }}></span>{t.msg}</div>
        ))}
      </div>

      {/* tutorial */}
      {tour >= 0 && <Tutorial key={tour} step={tour} setStep={setTour} onClose={endTour} />}

      {/* tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Aesthetic" />
        <TweakSlider label="Glow" value={tw.glow} min={0} max={1.6} step={0.1} onChange={(v) => setTweak('glow', v)} />
        <TweakToggle label="Star field" value={tw.stars} onChange={(v) => setTweak('stars', v)} />
        <TweakSection label="Session" />
        <TweakButton label="Replay tutorial" onClick={startTour} />
      </TweaksPanel>
    </div>
  );
}

/* ---------- Turn-phase pipeline rail ---------- */
function PhaseRail({ current }: { current: string }): ReactElement {
  const idx = TURN_PHASES.findIndex((p) => p.id === current);
  return (
    <div className="tac-float glass t-phase" title="The turn moves through these phases.">
      {TURN_PHASES.map((p, i) => (
        <div key={p.id} style={{ display: 'contents' }}>
          {i > 0 && <span className={'pr-link' + (i <= idx ? ' done' : '')}></span>}
          <span className={'pr-step' + (i === idx ? ' on' : i < idx ? ' done' : '')} title={p.desc}>
            <span className="pr-dot">{i < idx ? '✓' : i + 1}</span>
            <span className="pr-lab">{p.label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Tutorial (spotlight coachmarks) ---------- */
function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

interface TutorialProps {
  step: number;
  setStep: (n: number) => void;
  onClose: () => void;
}

function Tutorial({ step, setStep, onClose }: TutorialProps): ReactElement | null {
  const s = TOUR_STEPS[step];
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector(s.sel);
      if (el) setRect(el.getBoundingClientRect());
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [step, s.sel]);

  if (!rect) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 8;
  const cardW = 330;
  const big = rect.width > vw * 0.7;
  const hx = Math.max(0, rect.left - pad);
  const hy = Math.max(0, rect.top - pad);
  const hw = rect.width + pad * 2;
  const hh = rect.height + pad * 2;

  let cardStyle: React.CSSProperties = {};
  if (big || s.place === 'center') {
    cardStyle = { left: vw / 2 - cardW / 2, top: vh * 0.5 - 90 };
  } else if (s.place === 'right') {
    cardStyle = { left: Math.min(rect.right + 16, vw - cardW - 16), top: rect.top };
  } else if (s.place === 'left') {
    cardStyle = { left: Math.max(rect.left - cardW - 16, 16), top: Math.max(16, rect.top) };
  } else if (s.place === 'top') {
    cardStyle = { left: clamp(rect.left + rect.width / 2 - cardW / 2, 16, vw - cardW - 16), top: rect.top - 14, transform: 'translateY(-100%)' };
  } else {
    cardStyle = { left: clamp(rect.left + rect.width / 2 - cardW / 2, 16, vw - cardW - 16), top: rect.bottom + 14 };
  }

  const last = step === TOUR_STEPS.length - 1;
  return (
    <div className="tut">
      <div className="tut-catch" onClick={() => (last ? onClose() : setStep(step + 1))}></div>
      <div className="tut-spot" style={{ left: hx, top: hy, width: hw, height: hh }}></div>
      <div className="tut-card" style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div className="tut-step">STEP {step + 1} / {TOUR_STEPS.length}</div>
        <div className="tut-title">{s.title}</div>
        <div className="tut-body">{s.body}</div>
        <div className="tut-actions">
          <button className="tut-skip" onClick={onClose}>Skip</button>
          <div style={{ flex: 1 }}></div>
          {step > 0 && <button className="tut-back" onClick={() => setStep(step - 1)}>Back</button>}
          <button className="tut-next" onClick={() => (last ? onClose() : setStep(step + 1))}>{last ? 'Got it' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
