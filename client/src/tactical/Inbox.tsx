/* ============================================================
   SOLAR DOMINION — Commander inbox + proposal reader (TS port)
   Ported from _design/inbox.jsx. BriefingReader + TurnSummaryView
   ported from _design/panels.jsx (referenced by the deliverable).
   Pure, prop-driven. No store wiring — shell passes props.
   ============================================================ */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { Icon } from './icons';
import type {
  TacProposal,
  TacProposalStatus,
  TacBriefing,
  TacRoster,
  TacPersonnel,
  TacLlmReq,
  TacFaction,
  TacTurnSummary,
} from './types';

const CONF_CLASS: Record<string, string> = { HIGH: 'conf-high', MEDIUM: 'conf-med', LOW: 'conf-low' };
const STATUS_CLASS: Record<string, string> = { approved: 'st-approved', rejected: 'st-rejected', deferred: 'st-deferred', auto_deferred: 'st-deferred' };
const STATUS_LABEL: Record<string, string> = { approved: 'Approved', rejected: 'Rejected', deferred: 'Deferred', auto_deferred: 'Auto-deferred' };

const DECIDED_STATUSES: TacProposalStatus[] = ['approved', 'rejected', 'deferred', 'auto_deferred'];
const isDecided = (status: TacProposalStatus): boolean => DECIDED_STATUSES.includes(status);

/* ---------- Allocation decision payload exposed to the shell ---------- */
export interface TacAllocation {
  credits: number;
  teams: number;
}
export type TacDecision = 'approved' | 'rejected' | 'deferred';

/* ============================================================
   Inbox
   ============================================================ */
export interface InboxProps {
  proposals: TacProposal[];
  briefings: TacBriefing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenBriefing: (briefing: TacBriefing) => void;
  roster: TacRoster;
  llm: TacLlmReq[];
}

export const Inbox = ({ proposals, briefings, selectedId, onSelect, onOpenBriefing, roster, llm }: InboxProps): ReactElement => {
  const R = roster;
  const [tab, setTab] = useState<'proposals' | 'briefings'>('proposals');
  const pending = proposals.filter(p => !isDecided(p.status)).length;
  const propReq = (llm || []).find(r => r.type === 'proposals');
  const LLM_DOT: Record<string, string> = { complete: 'var(--ok)', processing: 'var(--warn)', queued: 'var(--muted)', failed: 'var(--alert)' };

  return (
    <aside className="inbox">
      <div className="inbox-head">
        <span className="t">Commander Inbox</span>
        <span className="count">{pending} PENDING</span>
      </div>
      <div className="inbox-prov" title="Proposals are drafted by your officers during the deliberation phase, generated via the LLM orchestrator. Outcomes remain deterministic.">
        <span className="pv-dot" style={{ background: LLM_DOT[propReq ? propReq.status : 'complete'] }}></span>
        <span className="pv-txt">Drafted by officers · deliberation phase</span>
        <span className="pv-model">{propReq ? propReq.model : 'mercury-2'}</span>
      </div>
      <div className="inbox-tabs">
        <button className={'itab' + (tab === 'proposals' ? ' on' : '')} onClick={() => setTab('proposals')}>Proposals · {proposals.length}</button>
        <button className={'itab' + (tab === 'briefings' ? ' on' : '')} onClick={() => setTab('briefings')}>Briefings · {briefings.length}</button>
      </div>
      <div className="inbox-list">
        {tab === 'proposals' ? proposals.map(p => {
          const off = R[p.from];
          if (!off) return null;
          const decided = isDecided(p.status);
          return (
            <div key={p.id}
              className={'prop-card' + (p.status === 'unread' ? ' unread' : '') + (selectedId === p.id ? ' selected' : '') + (decided ? ' decided' : '')}
              onClick={() => onSelect(p.id)}>
              <div className="pc-top">
                <span className="pc-dept">{p.dept}</span>
                <span className={'pc-conf ' + CONF_CLASS[p.confidence]}><span className="d"></span>{p.confidence}</span>
              </div>
              <div className="pc-title">{p.title}</div>
              <div className="pc-from">
                <span className="av">{off.init}</span>
                {off.name} · {off.role}
              </div>
              <div className="pc-meta">
                <span className="pc-cost"><Icon name="credits" size={13} /> {p.cost.credits}</span>
                {p.cost.teams > 0 && <span className="pc-cost"><Icon name="resources" size={13} /> {p.cost.teams} {p.cost.teams > 1 ? 'TEAMS' : 'TEAM'}</span>}
                {decided && <span className={'pc-status ' + STATUS_CLASS[p.status]}>{STATUS_LABEL[p.status]}</span>}
              </div>
            </div>
          );
        }) : briefings.map(b => {
          const off = R[b.from];
          if (!off) return null;
          return (
            <div key={b.id} className="prop-card" onClick={() => onOpenBriefing(b)}>
              <div className="pc-top"><span className="pc-dept">{b.kind === 'turn_summary' ? 'SUMMARY' : b.dept}</span>{b.kind === 'turn_summary' && <span className="pc-conf conf-high"><span className="d"></span>RESOLVED</span>}</div>
              <div className="pc-title" style={{ fontSize: 13.5 }}>{b.subject}</div>
              <div className="pc-from"><span className="av">{off.init}</span>{off.name}</div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

/* ============================================================
   ProposalReader — overlay
   ============================================================ */
export interface ProposalReaderProps {
  proposal: TacProposal;
  onClose: () => void;
  onDecide: (propId: string, decision: TacDecision, alloc: TacAllocation) => void;
  faction: TacFaction;
  roster: TacRoster;
}

export const ProposalReader = ({ proposal, onClose, onDecide, faction, roster }: ProposalReaderProps): ReactElement | null => {
  const off = roster[proposal.from];
  const [credits, setCredits] = useState<number>(proposal.cost.credits);
  const [teams, setTeams] = useState<number>(proposal.cost.teams);
  if (!off) return null;
  const decided = isDecided(proposal.status);
  const overBudget = credits > faction.credits;

  const traitDefs: { k: string; v: number }[] = [
    { k: 'Competence', v: off.competence }, { k: 'Creativity', v: off.creativity },
    { k: 'Reliability', v: off.reliability }, { k: 'Ambition', v: off.ambition },
    { k: 'Pol. Skill', v: off.political }, { k: 'Comms', v: off.comms },
    { k: 'Loyalty', v: off.loyalty }, { k: 'Autonomy', v: off.autonomy },
  ];

  return (
    <div className="reader-scrim" onClick={onClose}>
      <div className="reader" onClick={e => e.stopPropagation()}>
        <div className="reader-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span className="pc-dept">{proposal.dept}</span>
            <span className={'pc-conf ' + CONF_CLASS[proposal.confidence]}><span className="d"></span>{proposal.confidence} CONFIDENCE</span>
            {decided && <span className={'pc-status ' + STATUS_CLASS[proposal.status]}>{STATUS_LABEL[proposal.status]}</span>}
            <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose}><Icon name="x" size={16} /></button>
          </div>
          <h2 style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 22, margin: 0, color: 'var(--ink)', letterSpacing: '0.01em' }}>{proposal.title}</h2>
          <p style={{ fontFamily: 'var(--font-prose)', fontSize: 13.5, color: 'var(--muted)', margin: '8px 0 0', lineHeight: 1.5 }}>{proposal.summary}</p>
        </div>

        <div className="reader-body">
          {/* officer card with traits */}
          <div className="officer-card">
            <div className="portrait">{off.init}</div>
            <div style={{ flex: 1 }}>
              <div className="oc-name">{off.name}</div>
              <div className="oc-role">{off.role} · {off.dept}</div>
              <div className="traits">
                {traitDefs.map(t => (
                  <div key={t.k} className={'trait' + (t.v >= 80 ? ' hi' : '')}>
                    <span className="tk">{t.k} · {t.v}</span>
                    <span className="tbar"><i style={{ width: t.v + '%' }}></i></span>
                  </div>
                ))}
              </div>
              <div className="oc-vitals">
                <span title="Officer morale">MORALE <b style={{ color: off.morale < 55 ? 'var(--warn)' : 'var(--ink-2)' }}>{off.morale}</b></span>
                <span title="Burnout risk">BURNOUT <b style={{ color: off.burnout >= 45 ? 'var(--alert)' : 'var(--ink-2)' }}>{off.burnout}</b></span>
                <span title="Salary per turn">SALARY <b style={{ color: 'var(--ink-2)' }}>{off.salary} cr</b></span>
              </div>
            </div>
          </div>

          <div className="section-label">Officer Brief</div>
          <div className="prose">
            {proposal.body.map((para, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: para.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
            ))}
          </div>

          <div className="section-label">Why this officer · why now</div>
          <div style={{ display: 'flex', gap: 10, padding: '12px 13px', border: '1px solid var(--hairline)', borderRadius: 7, background: 'rgba(87,216,255,0.04)' }}>
            <span style={{ color: 'var(--cyan)', flexShrink: 0, marginTop: 1 }}><Icon name="intel" size={16} /></span>
            <p style={{ fontFamily: 'var(--font-prose)', fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)', margin: 0 }}>{proposal.rationale}</p>
          </div>

          {!decided && (
            <>
              <div className="section-label">Resource Allocation</div>
              <div className="alloc-grid">
                <div className="alloc-row">
                  <span className="al-k">Credits</span>
                  <input type="range" min="0" max={Math.max(proposal.cost.credits * 1.5, faction.credits)} step="20"
                    value={credits} onChange={e => setCredits(+e.target.value)} />
                  <span className={'al-v' + (overBudget ? ' over' : '')}>{credits}</span>
                </div>
                <div className="alloc-row">
                  <span className="al-k">Construction</span>
                  <input type="range" min="0" max="4" step="1" value={teams} onChange={e => setTeams(+e.target.value)} />
                  <span className="al-v">{teams} TEAM{teams !== 1 ? 'S' : ''}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  <span>TREASURY AFTER · <span style={{ color: overBudget ? 'var(--alert)' : 'var(--ink-2)' }}>{faction.credits - credits} cr</span></span>
                  <span>RECOMMENDED · {proposal.cost.credits} cr / {proposal.cost.teams} team</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="reader-foot">
          {decided ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', fontFamily: 'var(--font-label)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', fontSize: 13 }}>
              Decision recorded · <span className={(STATUS_CLASS[proposal.status] || '').replace('st-', '')} style={{ color: proposal.status === 'approved' ? 'var(--ok)' : proposal.status === 'rejected' ? 'var(--alert)' : 'var(--warn)' }}>{STATUS_LABEL[proposal.status]}</span>
            </div>
          ) : (
            <div className="btn-row">
              <button className="btn btn-reject" onClick={() => onDecide(proposal.id, 'rejected', { credits, teams })}><Icon name="x" size={15} /> Reject</button>
              <button className="btn btn-defer" onClick={() => onDecide(proposal.id, 'deferred', { credits, teams })}><Icon name="defer" size={15} /> Defer</button>
              <button className="btn btn-approve" disabled={overBudget} onClick={() => onDecide(proposal.id, 'approved', { credits, teams })}>
                <Icon name="check" size={15} /> {overBudget ? 'Over budget' : 'Approve'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   TurnSummaryView — resolution feed rendered inside BriefingReader
   Ported from _design/panels.jsx.
   ============================================================ */
const EV_COLOR: Record<string, string> = { a: 'var(--imperium)', b: 'var(--accord)', n: 'var(--muted)' };

interface TurnSummaryViewProps {
  summary: TacTurnSummary;
  roster: TacRoster;
}

const TurnSummaryView = ({ summary, roster }: TurnSummaryViewProps): ReactElement => {
  const s = summary; const c = s.control;
  const off: TacPersonnel | undefined = roster[s.officer.from];
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

/* ============================================================
   BriefingReader — overlay
   Ported from _design/panels.jsx (referenced by the deliverable).
   ============================================================ */
export interface BriefingReaderProps {
  briefing: TacBriefing | null;
  onClose: () => void;
  roster: TacRoster;
}

export const BriefingReader = ({ briefing, onClose, roster }: BriefingReaderProps): ReactElement | null => {
  if (!briefing) return null;
  const off = roster[briefing.from];
  if (!off) return null;
  const isSummary = briefing.kind === 'turn_summary' && !!briefing.summary;
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
