/* ============================================================
   SOLAR DOMINION — Solar system map (top-down orbital)
   Ported from _design/map.jsx. Prop-driven; no store wiring.
   ============================================================ */
import { useRef, useState } from 'react';
import type { MouseEvent, ReactElement } from 'react';
import type { TacAlert, TacBody, TacControl } from './types';
import { BODY_LAYOUT } from './staticLayout';

const BODIES: TacBody[] = BODY_LAYOUT;

const VIEW_W = 1000, VIEW_H = 770, CX = 470, CY = 352;

// angle (deg) per body around Sol
const ANGLES: Record<string, number> = {
  mercury: 205, venus: 150, earth: 22, mars: 252, ceres: 112, jupiter: 338, saturn: 58,
};

const CTRL_COLOR: Record<TacControl, string> = {
  imperium: 'var(--imperium)', accord: 'var(--accord)',
  contested: 'var(--warn)', neutral: 'var(--neutral)', star: 'var(--sun)',
};

interface Pos { x: number; y: number; }

function bodyPos(b: TacBody): Pos {
  if (b.id === 'sol') return { x: CX, y: CY };
  if (b.moonOf) {
    const parent = BODIES.find(p => p.id === b.moonOf) as TacBody;
    const pp = bodyPos(parent);
    const a = (b.moonAngle || 0) * Math.PI / 180;
    return { x: pp.x + Math.cos(a) * (b.moonDist || 0), y: pp.y + Math.sin(a) * (b.moonDist || 0) };
  }
  const a = (ANGLES[b.id] || 0) * Math.PI / 180;
  return { x: CX + Math.cos(a) * b.orbit, y: CY + Math.sin(a) * b.orbit };
}

export interface SolarMapProps {
  selectedBody: string | null;
  onSelectBody: (id: string) => void;
  glow: number;
  alerts?: TacAlert[];
}

export const SolarMap = ({ selectedBody, onSelectBody, glow, alerts }: SolarMapProps): ReactElement => {
  const [hover, setHover] = useState<TacBody | null>(null);
  const [tipPos, setTipPos] = useState<Pos>({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);

  const planets = BODIES.filter(b => !b.moonOf && b.id !== 'sol');
  const europa = BODIES.find(b => b.id === 'europa') as TacBody;
  const callisto = BODIES.find(b => b.id === 'callisto') as TacBody;
  const ePos = bodyPos(europa), cPos = bodyPos(callisto);

  const onMove = (e: MouseEvent<SVGGElement>, b: TacBody) => {
    const r = wrapRef.current!.getBoundingClientRect();
    setHover(b);
    setTipPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  return (
    <div className="map-wrap" ref={wrapRef}>
      <svg className="map-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--sun-core)"/>
            <stop offset="45%" stopColor="var(--sun)"/>
            <stop offset="100%" stopColor="rgba(255,160,70,0)"/>
          </radialGradient>
          <radialGradient id="impFill" cx="38%" cy="34%" r="70%">
            <stop offset="0%" stopColor="rgba(132,187,255,0.55)"/>
            <stop offset="100%" stopColor="rgba(40,80,150,0.25)"/>
          </radialGradient>
          <radialGradient id="accFill" cx="38%" cy="34%" r="70%">
            <stop offset="0%" stopColor="rgba(255,192,122,0.55)"/>
            <stop offset="100%" stopColor="rgba(150,80,20,0.25)"/>
          </radialGradient>
          <radialGradient id="neuFill" cx="38%" cy="34%" r="70%">
            <stop offset="0%" stopColor="rgba(140,155,185,0.4)"/>
            <stop offset="100%" stopColor="rgba(40,50,70,0.3)"/>
          </radialGradient>
          <filter id="soft"><feGaussianBlur stdDeviation="2.2"/></filter>
          {/* spherical light shading: lit top-left, terminator to bottom-right */}
          <radialGradient id="sphereShade" cx="33%" cy="29%" r="80%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.38)"/>
            <stop offset="26%" stopColor="rgba(255,255,255,0.05)"/>
            <stop offset="52%" stopColor="rgba(0,0,12,0)"/>
            <stop offset="100%" stopColor="rgba(0,1,10,0.66)"/>
          </radialGradient>
        </defs>

        {/* orbit rings */}
        {planets.map(b => (
          <circle key={'o'+b.id} className={'orbit' + (b.id==='jupiter'?' active':'')}
            cx={CX} cy={CY} r={b.orbit} />
        ))}

        {/* Sun */}
        <circle cx={CX} cy={CY} r={66} fill="url(#sunGrad)" opacity={0.5*glow + 0.3} />
        <circle cx={CX} cy={CY} r={26} fill="url(#sunGrad)" />
        <circle cx={CX} cy={CY} r={15} fill="var(--sun-core)" />
        <text x={CX} y={CY+46} textAnchor="middle" className="body-sub" fill="var(--sun)">SOL</text>

        {/* colony ship transit arc: Europa -> Callisto (the opportunity) */}
        <g>
          <path d={`M ${ePos.x} ${ePos.y} Q ${(ePos.x+cPos.x)/2 + 18} ${(ePos.y+cPos.y)/2 - 26} ${cPos.x} ${cPos.y}`}
            fill="none" stroke="var(--imperium)" strokeWidth="1.4" strokeDasharray="4 5" opacity="0.7">
            <animate attributeName="stroke-dashoffset" from="18" to="0" dur="1.1s" repeatCount="indefinite"/>
          </path>
          {/* ship marker mid-arc */}
          <g transform={`translate(${(ePos.x+cPos.x)/2 + 9} ${(ePos.y+cPos.y)/2 - 13})`}>
            <circle r="9" fill="rgba(8,12,22,0.9)" stroke="var(--imperium)" strokeWidth="1"/>
            <path d="M0 -4 C2 -1.5 2.4 1.5 0 4 C-2.4 1.5 -2 -1.5 0 -4Z" fill="var(--imperium-2)"/>
          </g>
        </g>

        {/* Bodies */}
        {BODIES.filter(b => b.id !== 'sol').map(b => {
          const pos = bodyPos(b);
          const sel = selectedBody === b.id;
          const col = CTRL_COLOR[b.control];
          const fill = b.control==='imperium' ? 'url(#impFill)' : b.control==='accord' ? 'url(#accFill)' : 'url(#neuFill)';
          return (
            <g key={b.id} className="body-hit"
               onMouseMove={(e)=>onMove(e,b)} onMouseLeave={()=>setHover(null)}
               onClick={()=>onSelectBody(b.id)}>
              {/* selection halo */}
              {sel && <circle cx={pos.x} cy={pos.y} r={b.r+9} fill="none" stroke="var(--cyan)" strokeWidth="1.2" strokeDasharray="3 4">
                <animateTransform attributeName="transform" type="rotate" from={`0 ${pos.x} ${pos.y}`} to={`360 ${pos.x} ${pos.y}`} dur="18s" repeatCount="indefinite"/>
              </circle>}

              {/* opportunity pulse */}
              {b.opportunity && (
                <circle cx={pos.x} cy={pos.y} r={b.r+4} fill="none" stroke="var(--cyan)" strokeWidth="1.4">
                  <animate attributeName="r" values={`${b.r+4};${b.r+16};${b.r+4}`} dur="2.4s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.8;0;0.8" dur="2.4s" repeatCount="indefinite"/>
                </circle>
              )}

              {/* hot/contested ring (split) */}
              {b.control === 'contested' ? (
                <>
                  <circle cx={pos.x} cy={pos.y} r={b.r} fill="url(#neuFill)" />
                  <path d={`M ${pos.x} ${pos.y-b.r} A ${b.r} ${b.r} 0 0 1 ${pos.x} ${pos.y+b.r} Z`} fill="rgba(79,155,255,0.32)"/>
                  <path d={`M ${pos.x} ${pos.y-b.r} A ${b.r} ${b.r} 0 0 0 ${pos.x} ${pos.y+b.r} Z`} fill="rgba(255,159,67,0.32)"/>
                  <circle cx={pos.x} cy={pos.y} r={b.r} fill="none" stroke="var(--warn)" strokeWidth="1.6"/>
                  <line x1={pos.x} y1={pos.y-b.r} x2={pos.x} y2={pos.y+b.r} stroke="var(--warn)" strokeWidth="1.2"/>
                </>
              ) : (
                <>
                  <circle cx={pos.x} cy={pos.y} r={b.r} fill={fill}
                    stroke={col} strokeWidth={b.capital?2.2:1.6}
                    style={{ filter: (b.control==='imperium'||b.control==='accord') ? `drop-shadow(0 0 ${6*glow}px ${col})` : 'none' }}/>
                  {b.id==='saturn' && <ellipse cx={pos.x} cy={pos.y} rx={b.r+10} ry={b.r*0.42} fill="none" stroke="var(--neutral)" strokeWidth="1.4" opacity="0.7" transform={`rotate(-18 ${pos.x} ${pos.y})`}/>}
                </>
              )}

              {/* spherical light shading overlay */}
              <circle cx={pos.x} cy={pos.y} r={b.r} fill="url(#sphereShade)" style={{pointerEvents:'none'}} />

              {/* capital star */}
              {b.capital && <text x={pos.x} y={pos.y+3.5} textAnchor="middle" fontSize="11" fill="var(--sun-core)">★</text>}

              {/* labels */}
              <text x={pos.x} y={pos.y - b.r - 8} textAnchor="middle" className="body-label"
                style={{ fontSize: b.r>14?13:11 }}>{b.name}</text>
              {(b.opportunity
                  || (b.moonOf && (b.control==='imperium' || b.control==='accord'))
                  || (!b.moonOf && b.id!=='mercury' && b.id!=='venus' && b.id!=='jupiter')) &&
                <text x={pos.x} y={pos.y + b.r + 15} textAnchor="middle" className="body-sub"
                  fill={b.hot?'var(--warn)':b.opportunity?'var(--cyan)':'var(--muted)'}>{b.sub}</text>}
            </g>
          );
        })}

        {/* alert markers (spec: map shows alerts) */}
        {(alerts||[]).map(al => {
          const b = BODIES.find(x => x.id === al.bodyId);
          if (!b) return null;
          const pos = bodyPos(b);
          const col = al.level==='critical' ? 'var(--alert)' : 'var(--cyan)';
          return (
            <g key={al.id} className="alert-mark" transform={`translate(${pos.x + b.r + 6} ${pos.y - b.r - 6})`} style={{pointerEvents:'none'}}>
              <circle r="7" fill="rgba(8,12,22,0.92)" stroke={col} strokeWidth="1.2"/>
              <circle r="7" fill="none" stroke={col} strokeWidth="1" opacity="0.7">
                <animate attributeName="r" values="7;13;7" dur="2.2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.7;0;0.7" dur="2.2s" repeatCount="indefinite"/>
              </circle>
              {al.level==='critical'
                ? <text x="0" y="3.2" textAnchor="middle" fontSize="9" fontWeight="700" fill={col} fontFamily="var(--font-mono)">!</text>
                : <text x="0" y="3.4" textAnchor="middle" fontSize="9" fill={col} fontFamily="var(--font-mono)">◎</text>}
            </g>
          );
        })}

        {/* fleet markers */}
        <g opacity="0.95">
          <FleetMark x={bodyPos(BODIES.find(b=>b.id==='mars') as TacBody).x - 22} y={bodyPos(BODIES.find(b=>b.id==='mars') as TacBody).y - 18} color="var(--imperium)"/>
          <FleetMark x={bodyPos(BODIES.find(b=>b.id==='ceres') as TacBody).x + 16} y={bodyPos(BODIES.find(b=>b.id==='ceres') as TacBody).y - 14} color="var(--accord)"/>
          <FleetMark x={bodyPos(BODIES.find(b=>b.id==='earth') as TacBody).x - 20} y={bodyPos(BODIES.find(b=>b.id==='earth') as TacBody).y + 16} color="var(--imperium)"/>
        </g>
      </svg>

      {/* hover tooltip */}
      {hover && hover.id !== 'sol' && (
        <div className="map-tip" style={{ left: Math.min(tipPos.x + 16, VIEW_W), top: tipPos.y + 14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ width:9, height:9, borderRadius:'50%', background: CTRL_COLOR[hover.control] }}></span>
            <span style={{ fontFamily:'var(--font-label)', fontSize:13, letterSpacing:'0.1em', color:'var(--ink)' }}>{hover.name}</span>
          </div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:10.5, color:'var(--muted)', lineHeight:1.6 }}>
            <div>CONTROL · <span style={{color:'var(--ink-2)'}}>{hover.control.toUpperCase()}</span></div>
            <div>COMMS LAG · <span style={{color:'var(--ink-2)'}}>{hover.lag} TURN{hover.lag!==1?'S':''}</span></div>
            <div>TRAVEL · <span style={{color:'var(--ink-2)'}}>{hover.travel} TURN{hover.travel!==1?'S':''}</span></div>
            {hover.deposits && <div style={{ marginTop:5, paddingTop:5, borderTop:'1px solid var(--hairline)' }}>
              {Object.entries(hover.deposits).map(([k,v])=>(
                <div key={k}>{k.toUpperCase()} · <span style={{ color: v==='EXTREME'?'var(--cyan)':v==='HIGH'?'var(--ink-2)':'var(--muted)' }}>{v}</span></div>
              ))}
            </div>}
          </div>
        </div>
      )}
    </div>
  );
};

export interface FleetMarkProps {
  x: number;
  y: number;
  color: string;
}

export const FleetMark = ({ x, y, color }: FleetMarkProps): ReactElement => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M0 -5 L4 4 L0 1.5 L-4 4 Z" fill={color} stroke="rgba(0,0,0,0.4)" strokeWidth="0.5"/>
  </g>
);
