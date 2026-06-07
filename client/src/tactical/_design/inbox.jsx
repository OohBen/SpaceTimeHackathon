/* ============================================================
   SOLAR DOMINION — Commander inbox + proposal reader
   ============================================================ */
const { useState: useStateI, useMemo: useMemoI } = React;

const CONF_CLASS = { HIGH: 'conf-high', MEDIUM: 'conf-med', LOW: 'conf-low' };
const STATUS_CLASS = { approved: 'st-approved', rejected: 'st-rejected', deferred: 'st-deferred', auto_deferred: 'st-deferred' };
const STATUS_LABEL = { approved: 'Approved', rejected: 'Rejected', deferred: 'Deferred', auto_deferred: 'Auto-deferred' };

const Inbox = ({ proposals, briefings, selectedId, onSelect, onOpenBriefing, roster, llm }) => {
  const R = roster || PERSONNEL;
  const [tab, setTab] = useStateI('proposals');
  const pending = proposals.filter(p => !['approved','rejected','deferred','auto_deferred'].includes(p.status)).length;
  const propReq = (llm||[]).find(r => r.type === 'proposals');
  const LLM_DOT = { complete:'var(--ok)', processing:'var(--warn)', queued:'var(--muted)', failed:'var(--alert)' };

  return (
    <aside className="inbox">
      <div className="inbox-head">
        <span className="t">Commander Inbox</span>
        <span className="count">{pending} PENDING</span>
      </div>
      <div className="inbox-prov" title="Proposals are drafted by your officers during the deliberation phase, generated via the LLM orchestrator. Outcomes remain deterministic.">
        <span className="pv-dot" style={{ background: LLM_DOT[propReq?propReq.status:'complete'] }}></span>
        <span className="pv-txt">Drafted by officers · deliberation phase</span>
        <span className="pv-model">{propReq ? propReq.model : 'mercury-2'}</span>
      </div>
      <div className="inbox-tabs">
        <button className={'itab' + (tab==='proposals'?' on':'')} onClick={()=>setTab('proposals')}>Proposals · {proposals.length}</button>
        <button className={'itab' + (tab==='briefings'?' on':'')} onClick={()=>setTab('briefings')}>Briefings · {briefings.length}</button>
      </div>
      <div className="inbox-list">
        {tab==='proposals' ? proposals.map(p => {
          const off = R[p.from];
          if (!off) return null;
          const decided = ['approved','rejected','deferred','auto_deferred'].includes(p.status);
          return (
            <div key={p.id}
              className={'prop-card' + (p.status==='unread'?' unread':'') + (selectedId===p.id?' selected':'') + (decided?' decided':'')}
              onClick={()=>onSelect(p.id)}>
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
                <span className="pc-cost"><Icon name="credits" size={13}/> {p.cost.credits}</span>
                {p.cost.teams>0 && <span className="pc-cost"><Icon name="resources" size={13}/> {p.cost.teams} {p.cost.teams>1?'TEAMS':'TEAM'}</span>}
                {decided && <span className={'pc-status ' + STATUS_CLASS[p.status]}>{STATUS_LABEL[p.status]}</span>}
              </div>
            </div>
          );
        }) : briefings.map(b => {
          const off = R[b.from];
          if (!off) return null;
          return (
            <div key={b.id} className="prop-card" onClick={()=>onOpenBriefing(b)}>
              <div className="pc-top"><span className="pc-dept">{b.kind==='turn_summary'?'SUMMARY':b.dept}</span>{b.kind==='turn_summary' && <span className="pc-conf conf-high"><span className="d"></span>RESOLVED</span>}</div>
              <div className="pc-title" style={{fontSize:13.5}}>{b.subject}</div>
              <div className="pc-from"><span className="av">{off.init}</span>{off.name}</div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

/* ---------- Proposal reader overlay ---------- */
const ProposalReader = ({ proposal, onClose, onDecide, faction, roster }) => {
  const off = (roster || PERSONNEL)[proposal.from];
  const [credits, setCredits] = useStateI(proposal.cost.credits);
  const [teams, setTeams] = useStateI(proposal.cost.teams);
  if (!off) return null;
  const decided = ['approved','rejected','deferred','auto_deferred'].includes(proposal.status);
  const overBudget = credits > faction.credits;

  const traitDefs = [
    { k: 'Competence', v: off.competence }, { k: 'Creativity', v: off.creativity },
    { k: 'Reliability', v: off.reliability }, { k: 'Ambition', v: off.ambition },
    { k: 'Pol. Skill', v: off.political }, { k: 'Comms', v: off.comms },
    { k: 'Loyalty', v: off.loyalty }, { k: 'Autonomy', v: off.autonomy },
  ];

  return (
    <div className="reader-scrim" onClick={onClose}>
      <div className="reader" onClick={e=>e.stopPropagation()}>
        <div className="reader-head">
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <span className="pc-dept">{proposal.dept}</span>
            <span className={'pc-conf ' + CONF_CLASS[proposal.confidence]}><span className="d"></span>{proposal.confidence} CONFIDENCE</span>
            {decided && <span className={'pc-status ' + STATUS_CLASS[proposal.status]}>{STATUS_LABEL[proposal.status]}</span>}
            <button className="icon-btn" style={{marginLeft:'auto'}} onClick={onClose}><Icon name="x" size={16}/></button>
          </div>
          <h2 style={{ fontFamily:'var(--font-ui)', fontWeight:600, fontSize:22, margin:0, color:'var(--ink)', letterSpacing:'0.01em' }}>{proposal.title}</h2>
          <p style={{ fontFamily:'var(--font-prose)', fontSize:13.5, color:'var(--muted)', margin:'8px 0 0', lineHeight:1.5 }}>{proposal.summary}</p>
        </div>

        <div className="reader-body">
          {/* officer card with traits */}
          <div className="officer-card">
            <div className="portrait">{off.init}</div>
            <div style={{ flex:1 }}>
              <div className="oc-name">{off.name}</div>
              <div className="oc-role">{off.role} · {off.dept}</div>
              <div className="traits">
                {traitDefs.map(t => (
                  <div key={t.k} className={'trait' + (t.v>=80?' hi':'')}>
                    <span className="tk">{t.k} · {t.v}</span>
                    <span className="tbar"><i style={{ width: t.v+'%' }}></i></span>
                  </div>
                ))}
              </div>
              <div className="oc-vitals">
                <span title="Officer morale">MORALE <b style={{color: off.morale<55?'var(--warn)':'var(--ink-2)'}}>{off.morale}</b></span>
                <span title="Burnout risk">BURNOUT <b style={{color: off.burnout>=45?'var(--alert)':'var(--ink-2)'}}>{off.burnout}</b></span>
                <span title="Salary per turn">SALARY <b style={{color:'var(--ink-2)'}}>{off.salary} cr</b></span>
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
          <div style={{ display:'flex', gap:10, padding:'12px 13px', border:'1px solid var(--hairline)', borderRadius:7, background:'rgba(87,216,255,0.04)' }}>
            <span style={{ color:'var(--cyan)', flexShrink:0, marginTop:1 }}><Icon name="intel" size={16}/></span>
            <p style={{ fontFamily:'var(--font-prose)', fontSize:13, lineHeight:1.55, color:'var(--ink-2)', margin:0 }}>{proposal.rationale}</p>
          </div>

          {!decided && (
            <>
              <div className="section-label">Resource Allocation</div>
              <div className="alloc-grid">
                <div className="alloc-row">
                  <span className="al-k">Credits</span>
                  <input type="range" min="0" max={Math.max(proposal.cost.credits*1.5, faction.credits)} step="20"
                    value={credits} onChange={e=>setCredits(+e.target.value)} />
                  <span className={'al-v' + (overBudget?' over':'')}>{credits}</span>
                </div>
                <div className="alloc-row">
                  <span className="al-k">Construction</span>
                  <input type="range" min="0" max="4" step="1" value={teams} onChange={e=>setTeams(+e.target.value)} />
                  <span className="al-v">{teams} TEAM{teams!==1?'S':''}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--muted)', marginTop:2 }}>
                  <span>TREASURY AFTER · <span style={{ color: overBudget?'var(--alert)':'var(--ink-2)' }}>{faction.credits - credits} cr</span></span>
                  <span>RECOMMENDED · {proposal.cost.credits} cr / {proposal.cost.teams} team</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="reader-foot">
          {decided ? (
            <div style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'center', fontFamily:'var(--font-label)', letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--muted)', fontSize:13 }}>
              Decision recorded · <span className={STATUS_CLASS[proposal.status].replace('st-','')} style={{ color: proposal.status==='approved'?'var(--ok)':proposal.status==='rejected'?'var(--alert)':'var(--warn)' }}>{STATUS_LABEL[proposal.status]}</span>
            </div>
          ) : (
            <div className="btn-row">
              <button className="btn btn-reject" onClick={()=>onDecide(proposal.id,'rejected',{credits,teams})}><Icon name="x" size={15}/> Reject</button>
              <button className="btn btn-defer" onClick={()=>onDecide(proposal.id,'deferred',{credits,teams})}><Icon name="defer" size={15}/> Defer</button>
              <button className="btn btn-approve" disabled={overBudget} onClick={()=>onDecide(proposal.id,'approved',{credits,teams})}>
                <Icon name="check" size={15}/> {overBudget?'Over budget':'Approve'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { Inbox, ProposalReader });
