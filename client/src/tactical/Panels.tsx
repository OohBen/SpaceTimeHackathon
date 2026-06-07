/* ============================================================
   SOLAR DOMINION — Secondary panels (TS port of _design/panels.jsx)
   Pure, prop-driven. DOM + class names replicated verbatim.
   Global data refs (PERSONNEL / BODIES / CITIES / FACTIONS /
   IMP_INTEL / IMP_DIPLO) are now required/optional props.
   ============================================================ */
import type { ReactElement } from 'react';
import { Icon } from './icons';
import type {
  TacRoster,
  TacRelationship,
  TacRelationshipType,
  TacFaction,
  TacEnemy,
  TacCity,
  TacFleet,
  TacColonyShip,
  TacProject,
  TacLlmReq,
  TacLlmStatus,
  TacShipStatus,
  TacIntel,
  TacDiplo,
  TacBody,
  TacControl,
  TacTurnSummary,
  TacBriefing,
} from './types';

const DEPT_COLOR: Record<string, string> = {
  COMMAND: 'var(--imperium)', MILITARY: 'var(--alert)', RESEARCH: 'var(--cyan)',
  INDUSTRY: 'var(--accord)', INTEL: 'var(--warn)',
};

interface BarProps { v: number; color?: string; max?: number; }
const Bar = ({ v, color, max = 100 }: BarProps): ReactElement => (
  <span className="meter"><i style={{ width: (v / max * 100) + '%', background: color || 'var(--imperium)' }}></i></span>
);

/* ---------- PERSONNEL ---------- */
const REL_COLOR: Record<string, string> = { trust: 'var(--cyan)', alliance: 'var(--imperium-2)', mentor: 'var(--ok)', rivalry: 'var(--alert)', tension: 'var(--warn)' };

export interface PersonnelPanelProps {
  roster: TacRoster;
  relationships?: TacRelationship[];
}

export const PersonnelPanel = ({ roster, relationships }: PersonnelPanelProps): ReactElement => {
  const R = roster;
  const rels = relationships || [];
  return (
  <div className="panel-view">
    <div style={{ fontFamily: 'var(--font-prose)', fontSize: 13, color: 'var(--muted)', maxWidth: 860, marginBottom: 16, lineHeight: 1.5 }}>
      Your officers generate the proposals you act on each turn. Their traits shape <b style={{ color: 'var(--ink-2)' }}>what</b> they propose and how reliably it executes — high competence &amp; reliability mean fewer surprises; high ambition &amp; creativity mean bolder, riskier ideas.
    </div>
    <div className="pv-grid" style={{ gridTemplateColumns: '1fr', maxWidth: 860 }}>
      {Object.values(R).map(p => (
        <div key={p.id} className="person-row">
          <div className="pa" style={{ background: 'rgba(79,155,255,0.16)', border: '1px solid rgba(79,155,255,0.3)', color: 'var(--imperium-2)' }}>{p.init}</div>
          <div>
            <div className="pn">{p.name}</div>
            <div className="pr" style={{ color: DEPT_COLOR[p.dept] }}>{p.role} · {p.dept} · {p.city}</div>
            <div style={{ display: 'flex', gap: 14, marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--muted)' }}>
              <span>MORALE <b style={{ color: p.morale < 55 ? 'var(--warn)' : 'var(--ink-2)' }}>{p.morale}</b></span>
              <span>BURNOUT <b style={{ color: p.burnout >= 45 ? 'var(--alert)' : 'var(--ink-2)' }}>{p.burnout}</b></span>
              <span>SALARY <b style={{ color: 'var(--ink-2)' }}>{p.salary} cr/t</b></span>
            </div>
          </div>
          <div className="mini-traits" style={{ gap: 9 }}>
            {([['COMP', p.competence], ['CREA', p.creativity], ['RELY', p.reliability], ['AMB', p.ambition], ['POL', p.political], ['COM', p.comms], ['LOY', p.loyalty], ['AUT', p.autonomy]] as [string, number][]).map(([k, v]) => (
              <div className="mini-trait" key={k}><span className="mk">{k}</span><span className="mv" style={{ color: v >= 80 ? 'var(--cyan)' : v < 50 ? 'var(--muted)' : 'var(--ink-2)' }}>{v}</span></div>
            ))}
          </div>
        </div>
      ))}
    </div>
    {rels.length > 0 && (
      <div style={{ maxWidth: 860, marginTop: 18 }}>
        <div className="section-label">Relationships</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {rels.map(rel => {
            const a = R[rel.a], b = R[rel.b]; if (!a || !b) return null;
            const col = REL_COLOR[rel.type as TacRelationshipType] || 'var(--muted)';
            return (
              <div key={rel.id} className="card" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{a.name.split(' ').slice(-1)} ↔ {b.name.split(' ').slice(-1)}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-label)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: col }}>{rel.type}</span>
                </div>
                <Bar v={rel.strength} color={col} />
                <p style={{ fontFamily: 'var(--font-prose)', fontSize: 12, lineHeight: 1.5, color: 'var(--muted)', margin: '8px 0 0' }}>{rel.note}</p>
              </div>
            );
          })}
        </div>
      </div>
    )}
  </div>
  );
};

/* ---------- RESOURCES & OPERATIONS ---------- */
const SHIP_STATUS: Record<string, string> = { preparing: 'var(--warn)', in_transit: 'var(--cyan)', arrived: 'var(--ok)', lost: 'var(--alert)' };
const LLM_STATUS: Record<string, string> = { complete: 'var(--ok)', processing: 'var(--warn)', queued: 'var(--muted)', failed: 'var(--alert)' };

export interface ResourcesPanelProps {
  faction: TacFaction;
  cities: TacCity[];
  /** Resolves a body id to its display name (replaces design global BODIES lookup). */
  bodyNames?: Record<string, string>;
  /** kept from design signature; unused in render. */
  prodOwners?: unknown;
  fleets?: TacFleet[];
  ships?: TacColonyShip[];
  projects?: TacProject[];
  llm?: TacLlmReq[];
}

export const ResourcesPanel = ({ faction, cities, bodyNames, fleets, ships, projects, llm }: ResourcesPanelProps): ReactElement => {
  const bodyName = (id: string): string => (bodyNames && bodyNames[id]) || id;
  return (
  <div className="panel-view">
    <div style={{ fontFamily: 'var(--font-prose)', fontSize: 13, color: 'var(--muted)', maxWidth: 820, marginBottom: 16, lineHeight: 1.5 }}>
      <b style={{ color: 'var(--ink-2)' }}>Credits</b> pay for proposals and construction. <b style={{ color: 'var(--ink-2)' }}>Political capital</b> unlocks special actions like diplomacy. City output is your income engine each turn.
    </div>
    <div className="pv-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', maxWidth: 820 }}>
      <div className="card">
        <div className="ch"><span style={{ color: 'var(--accord)' }}><Icon name="credits" size={17} /></span><span className="ct">Treasury</span></div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, color: 'var(--ink)', marginBottom: 4 }}>{faction.credits.toLocaleString()} <small style={{ fontSize: 13, color: 'var(--muted)' }}>cr</small></div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ok)' }}>+{faction.creditsDelta} / turn projected</div>
      </div>
      <div className="card">
        <div className="ch"><span style={{ color: 'var(--imperium)' }}><Icon name="capital" size={17} /></span><span className="ct">Political Capital</span></div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, color: 'var(--ink)', marginBottom: 4 }}>{faction.politicalCapital}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: faction.pcDelta < 0 ? 'var(--alert)' : 'var(--ok)' }}>{faction.pcDelta > 0 ? '+' : ''}{faction.pcDelta} / turn</div>
      </div>
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="ch"><span style={{ color: 'var(--cyan)' }}><Icon name="city" size={17} /></span><span className="ct">Production by City</span></div>
        {(cities || []).map(c => (
          <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 14, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--hairline)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>{c.name}</span>
            <div><div style={{ fontFamily: 'var(--font-label)', fontSize: 9, color: 'var(--muted)', marginBottom: 3 }}>INDUSTRY {c.ind}</div><Bar v={c.ind} color="var(--accord)" /></div>
            <div><div style={{ fontFamily: 'var(--font-label)', fontSize: 9, color: 'var(--muted)', marginBottom: 3 }}>RESEARCH {c.res}</div><Bar v={c.res} color="var(--cyan)" /></div>
          </div>
        ))}
      </div>
    </div>

    <div className="section-label" style={{ maxWidth: 820 }}>Operations</div>
    <div className="pv-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', maxWidth: 820 }}>
      {/* Fleets */}
      <div className="card">
        <div className="ch"><span style={{ color: 'var(--imperium)' }}><Icon name="fleet" size={16} /></span><span className="ct">Fleets · {(fleets || []).length}</span></div>
        {(fleets || []).map(f => (
          <div key={f.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{f.name}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>STR {f.strength}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>@ {bodyName(f.postingBodyId)} · {f.orders}</div>
          </div>
        ))}
      </div>
      {/* Colony ships */}
      <div className="card">
        <div className="ch"><span style={{ color: 'var(--cyan)' }}><Icon name="ship" size={16} /></span><span className="ct">Colony Ships · {(ships || []).length}</span></div>
        {(ships || []).length ? (ships || []).map(s => (
          <div key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{s.name}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: SHIP_STATUS[s.status as TacShipStatus] }}>{s.status.replace('_', ' ')}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{bodyName(s.originBodyId)} → {bodyName(s.destBodyId)} · arr. T{s.arrivesTurn}</div>
            <div style={{ fontFamily: 'var(--font-prose)', fontSize: 11.5, color: 'var(--ink-2)', marginTop: 3 }}>{s.manifest}</div>
          </div>
        )) : <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', padding: '4px 0' }}>No ships in transit.</div>}
      </div>
      {/* Projects */}
      <div className="card">
        <div className="ch"><span style={{ color: 'var(--accord)' }}><Icon name="resources" size={16} /></span><span className="ct">Projects · {(projects || []).length}</span></div>
        {(projects || []).map(pj => (
          <div key={pj.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{pj.name}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: pj.status === 'active' ? 'var(--ok)' : 'var(--muted)' }}>{pj.status}</span>
            </div>
            <Bar v={pj.progress} color="var(--accord)" />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{pj.city} · {pj.assigned} · {pj.estCompletion}</div>
          </div>
        ))}
      </div>
      {/* LLM orchestrator queue */}
      <div className="card">
        <div className="ch"><span style={{ color: 'var(--cyan)' }}><Icon name="doctrine" size={16} /></span><span className="ct">Officer-AI Queue</span></div>
        <p style={{ fontFamily: 'var(--font-prose)', fontSize: 11.5, color: 'var(--muted)', margin: '0 0 8px', lineHeight: 1.5 }}>Proposal &amp; narrative text is generated via the LLM orchestrator. Simulation outcomes stay deterministic.</p>
        {(llm || []).map(r => (
          <div key={r.id} className="kv">
            <span className="k" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: LLM_STATUS[r.status as TacLlmStatus] }}></span>{r.type.replace('_', ' ')}</span>
            <span className="v" style={{ color: LLM_STATUS[r.status as TacLlmStatus], fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{r.status}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
  );
};

/* ---------- DOCTRINE ---------- */
export interface DoctrinePanelProps {
  faction: TacFaction;
  enemy: TacEnemy | TacFaction;
  selfName?: string;
  enemyName?: string;
  selfColor?: string;
  selfColor2?: string;
  enemyColor?: string;
  enemyColor2?: string;
}

export const DoctrinePanel = ({ faction, enemy, selfName, enemyName, selfColor, selfColor2, enemyColor, enemyColor2 }: DoctrinePanelProps): ReactElement => {
  const opp = enemy;
  const sc = selfColor || 'var(--imperium)', ec = enemyColor || 'var(--accord)';
  const sc2 = selfColor2 || 'var(--imperium-2)', ec2 = enemyColor2 || 'var(--accord-2)';
  return (
    <div className="panel-view">
      <div style={{ fontFamily: 'var(--font-prose)', fontSize: 13, color: 'var(--muted)', maxWidth: 680, marginBottom: 16, lineHeight: 1.5 }}>
        Your doctrine vector shows where your faction leans across five strategic axes, measured against your opponent. It biases which proposals your officers tend to favor.
      </div>
      <div className="card" style={{ maxWidth: 680 }}>
        <div className="ch"><span style={{ color: sc }}><Icon name="doctrine" size={17} /></span><span className="ct">Doctrine Vector · {selfName || 'Imperium'} vs {enemyName || 'Coalition'}</span></div>
        {(Object.keys(faction.doctrine) as (keyof typeof faction.doctrine)[]).map(k => (
          <div key={k} style={{ padding: '11px 0', borderBottom: '1px solid var(--hairline)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-label)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>{k}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}><span style={{ color: sc2 }}>{faction.doctrine[k]}</span> <span style={{ color: 'var(--faint-solid)' }}>vs</span> <span style={{ color: ec2 }}>{opp.doctrine[k]}</span></span>
            </div>
            <div style={{ position: 'relative', height: 6 }}>
              <span className="meter" style={{ position: 'absolute', inset: 0 }}><i style={{ width: faction.doctrine[k] + '%', background: sc }}></i></span>
              <span style={{ position: 'absolute', top: -3, bottom: -3, left: opp.doctrine[k] + '%', width: 2, background: ec }}></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------- INTEL ---------- */
export interface IntelPanelProps {
  items: TacIntel[];
}

export const IntelPanel = ({ items }: IntelPanelProps): ReactElement => (
  <div className="panel-view">
    <div style={{ fontFamily: 'var(--font-prose)', fontSize: 13, color: 'var(--muted)', maxWidth: 760, marginBottom: 16, lineHeight: 1.5 }}>
      Intelligence is <b style={{ color: 'var(--ink-2)' }}>estimated, not certain</b> — each report carries an accuracy rating. Use it to anticipate the enemy, but expect noise.
    </div>
    <div className="pv-grid" style={{ gridTemplateColumns: '1fr', maxWidth: 760 }}>
      {items.map(b => (
        <div key={b.id} className="card">
          <div className="ch"><span style={{ color: 'var(--warn)' }}><Icon name="intel" size={16} /></span><span className="ct">{b.subject}</span>
            {b.acc && <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: b.acc >= 75 ? 'var(--ok)' : 'var(--warn)' }}>{b.acc}% ACC</span>}</div>
          <p style={{ fontFamily: 'var(--font-prose)', fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)', margin: 0 }}>{b.body}</p>
        </div>
      ))}
    </div>
  </div>
);

/* ---------- DIPLOMACY ---------- */
export interface DiplomacyPanelProps {
  data: TacDiplo;
}

export const DiplomacyPanel = ({ data }: DiplomacyPanelProps): ReactElement => {
  const d = data;
  return (
    <div className="panel-view">
      <div style={{ fontFamily: 'var(--font-prose)', fontSize: 13, color: 'var(--muted)', maxWidth: 680, marginBottom: 16, lineHeight: 1.5 }}>
        Diplomacy lets you negotiate trade or ceasefires with the opposing faction. Offers cost <b style={{ color: 'var(--ink-2)' }}>political capital</b> and can fail.
      </div>
      <div className="card" style={{ maxWidth: 680 }}>
        <div className="ch"><span style={{ color: 'var(--imperium)' }}><Icon name="diplomacy" size={17} /></span><span className="ct">Standing · {d.enemyName}</span></div>
        <div className="kv"><span className="k">Posture</span><span className="v" style={{ color: 'var(--alert)' }}>{d.posture}</span></div>
        <div className="kv"><span className="k">Active trade agreements</span><span className="v">{d.trades}</span></div>
        <div className="kv"><span className="k">Last negotiation</span><span className="v">{d.lastNeg}</span></div>
        <div className="kv"><span className="k">Ceasefire viability</span><span className="v" style={{ color: 'var(--warn)' }}>{d.ceasefire}</span></div>
        <p style={{ fontFamily: 'var(--font-prose)', fontSize: 13, lineHeight: 1.55, color: 'var(--muted)', marginTop: 14 }}>
          {d.note}
        </p>
      </div>
    </div>
  );
};

/* ---------- CITY DETAIL (opened from map) ---------- */
const CTRL_COLOR: Record<TacControl, string> = {
  imperium: 'var(--imperium)', accord: 'var(--accord)', contested: 'var(--warn)', neutral: 'var(--neutral)', star: 'var(--sun)',
};

export interface CityDetailProps {
  /** The celestial body to render. Replaces design global BODIES.find(...). */
  body: TacBody | null | undefined;
  /** Settlements on this body. Replaces design global CITIES.filter(...). */
  cities?: TacCity[];
  onClose: () => void;
}

export const CityDetail = ({ body, cities, onClose }: CityDetailProps): ReactElement | null => {
  if (!body) return null;
  const list = (cities || []).filter(c => c.bodyId === body.id);
  const ctrlColor = CTRL_COLOR[body.control];
  return (
    <div className="reader-scrim" onClick={onClose}>
      <div className="reader" style={{ width: 'min(560px,70%)' }} onClick={e => e.stopPropagation()}>
        <div className="reader-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 13, height: 13, borderRadius: '50%', background: ctrlColor, boxShadow: `0 0 10px ${ctrlColor}` }}></span>
            <h2 style={{ fontFamily: 'var(--font-label)', fontWeight: 600, fontSize: 24, letterSpacing: '0.08em', margin: 0, color: 'var(--ink)' }}>{body.name}</h2>
            <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose}><Icon name="x" size={16} /></button>
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted)' }}>
            <span>CONTROL · <b style={{ color: ctrlColor }}>{body.control.toUpperCase()}</b></span>
            <span>COMMS LAG · <b style={{ color: 'var(--ink-2)' }}>{body.lag}T</b></span>
            <span>TRAVEL · <b style={{ color: 'var(--ink-2)' }}>{body.travel}T</b></span>
          </div>
        </div>
        <div className="reader-body">
          {body.deposits && (<>
            <div className="section-label">Resource Deposits</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(body.deposits).map(([k, v]) => (
                <div key={k} style={{ padding: '8px 13px', border: '1px solid var(--hairline)', borderRadius: 7, background: 'rgba(120,150,210,0.04)' }}>
                  <div style={{ fontFamily: 'var(--font-label)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--muted)' }}>{k.toUpperCase()}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: v === 'EXTREME' ? 'var(--cyan)' : v === 'HIGH' ? 'var(--ink)' : 'var(--ink-2)' }}>{v}</div>
                </div>
              ))}
            </div>
          </>)}
          {list.length > 0 ? (<>
            <div className="section-label">Settlements · {list.length}</div>
            {list.map(c => {
              const cc = ({ imperium: 'var(--imperium)', accord: 'var(--accord)', contested: 'var(--warn)' } as Record<string, string>)[c.faction];
              return (
                <div key={c.id} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: cc }}></span>
                    <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{c.name}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>POP {c.pop} · INFRA {c.infra}/5</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 11, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--muted)' }}>
                    {c.stage && <span>STAGE · <b style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{c.stage.toUpperCase()}</b></span>}
                    {c.supply && <span>SUPPLY · <b style={{ fontWeight: 600, color: c.supply === 'cut off' ? 'var(--alert)' : c.supply === 'secure' ? 'var(--ok)' : 'var(--warn)' }}>{c.supply.toUpperCase()}</b></span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                    {([['MORALE', c.morale, c.morale < 50 ? 'var(--alert)' : 'var(--ok)'], ['INDUSTRY', c.ind, 'var(--accord)'], ['RESEARCH', c.res, 'var(--cyan)'], ['GARRISON', c.garrison, 'var(--imperium)']] as [string, number, string][]).map(([k, v, col]) => (
                      <div key={k}><div style={{ fontFamily: 'var(--font-label)', fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>{k} {v}</div><Bar v={v} color={col} /></div>
                    ))}
                  </div>
                </div>
              );
            })}
          </>) : (
            <div style={{ marginTop: 24, padding: '18px', border: '1px dashed var(--hairline-strong)', borderRadius: 8, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: body.opportunity ? 'var(--cyan)' : 'var(--muted)' }}>
              {body.opportunity ? '◎ NO SETTLEMENTS · COLONIZATION OPPORTUNITY' : 'NO SETTLEMENTS ON THIS BODY'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- TURN SUMMARY VIEW ---------- */
const EV_COLOR: Record<string, string> = { a: 'var(--imperium)', b: 'var(--accord)', n: 'var(--muted)' };

export interface TurnSummaryViewProps {
  summary: TacTurnSummary;
  roster: TacRoster;
}

export const TurnSummaryView = ({ summary, roster }: TurnSummaryViewProps): ReactElement => {
  const s = summary; const c = s.control;
  const off = roster[s.officer.from];
  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ch"><span style={{ color: 'var(--cyan)' }}><Icon name="doctrine" size={16} /></span><span className="ct">Control Score</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 9 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: 'var(--imperium-2)' }}>{c.selfName === 'Imperium' ? c.self : c.enemy}</span>
          <div style={{ flex: 1, height: 9, borderRadius: 5, overflow: 'hidden', display: 'flex', border: '1px solid var(--hairline)' }}>
            <div style={{ width: (c.selfName === 'Imperium' ? c.self : c.enemy) + '%', background: 'linear-gradient(90deg,#3f88d8,#5bb6ff)' }}></div>
            <div style={{ width: (c.selfName === 'Imperium' ? c.enemy : c.self) + '%', background: 'linear-gradient(90deg,#ffc078,#ffab4d)' }}></div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: 'var(--accord-2)' }}>{c.selfName === 'Imperium' ? c.enemy : c.self}</span>
        </div>
        <p style={{ fontFamily: 'var(--font-prose)', fontSize: 12.5, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
          {c.selfName} <span style={{ color: c.delta >= 0 ? 'var(--ok)' : 'var(--alert)' }}>{c.delta >= 0 ? '+' : ''}{c.delta}</span> this turn — {c.note}
        </p>
      </div>

      <div className="section-label" style={{ whiteSpace: 'nowrap' }}>Resolution Feed</div>
      {s.phases.map((ph, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 0 7px' }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, background: 'rgba(91,182,255,0.14)', color: 'var(--imperium-2)', border: '1px solid rgba(91,182,255,0.3)' }}>{i + 1}</span>
            <span style={{ fontFamily: 'var(--font-label)', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{ph.name}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginLeft: 31 }}>
            {ph.events.map((e, j) => (
              <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 11px', borderRadius: 9, background: 'rgba(14,20,34,0.5)', border: '1px solid var(--hairline)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: EV_COLOR[e.f] }}></span>
                <span style={{ flex: 1, fontFamily: 'var(--font-prose)', fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink-2)' }} dangerouslySetInnerHTML={{ __html: e.t }}></span>
                {e.tag && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, padding: '3px 7px', borderRadius: 6, whiteSpace: 'nowrap', background: e.tag === 'win' ? 'rgba(143,212,255,0.16)' : 'rgba(255,106,69,0.16)', color: e.tag === 'win' ? 'var(--cyan)' : 'var(--alert)' }}>{e.tagt}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="section-label" style={{ whiteSpace: 'nowrap' }}>Net Changes</div>
      {s.deltas.map((g, i) => (
        <div key={i} className="card" style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: 'var(--font-label)', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>{g.group}</div>
          {g.rows.map((r, j) => (
            <div key={j} className="kv">
              <span className="k">{r.k}</span>
              <span className="v" style={{ color: r.dir === 'up' ? 'var(--ok)' : r.dir === 'down' ? 'var(--alert)' : 'var(--ink)' }}>{r.v}{r.d && <span style={{ marginLeft: 7, color: 'var(--ok)' }}>{r.d}</span>}</span>
            </div>
          ))}
        </div>
      ))}

      {off && (
        <div style={{ display: 'flex', gap: 10, padding: '12px 13px', border: '1px solid var(--hairline)', borderRadius: 7, background: 'rgba(87,216,255,0.04)' }}>
          <span className="av" style={{ flexShrink: 0 }}>{off.init}</span>
          <p style={{ fontFamily: 'var(--font-prose)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-2)', margin: 0 }}>
            <b style={{ color: 'var(--ink)' }}>{off.name}:</b> “{s.officer.text}”
          </p>
        </div>
      )}
    </>
  );
};

/* ---------- BRIEFING READER ---------- */
export interface BriefingReaderProps {
  briefing: TacBriefing | null | undefined;
  onClose: () => void;
  roster: TacRoster;
}

export const BriefingReader = ({ briefing, onClose, roster }: BriefingReaderProps): ReactElement | null => {
  if (!briefing) return null;
  const off = roster[briefing.from];
  if (!off) return null;
  const isSummary = briefing.kind === 'turn_summary' && briefing.summary;
  return (
    <div className="reader-scrim" onClick={onClose}>
      <div className="reader" style={{ width: isSummary ? undefined : 'min(520px,66%)' }} onClick={e => e.stopPropagation()}>
        <div className="reader-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span className="pc-dept">{isSummary ? 'SUMMARY' : briefing.dept}</span>
            <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose}><Icon name="x" size={16} /></button>
          </div>
          <h2 style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 20, margin: 0, color: 'var(--ink)' }}>{briefing.subject}</h2>
          <div className="pc-from" style={{ marginTop: 8 }}><span className="av">{off.init}</span>{off.name} · {off.role}</div>
        </div>
        <div className="reader-body">
          {isSummary && briefing.summary
            ? <TurnSummaryView summary={briefing.summary} roster={roster} />
            : <p style={{ fontFamily: 'var(--font-prose)', fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>{briefing.body}</p>}
        </div>
      </div>
    </div>
  );
};
