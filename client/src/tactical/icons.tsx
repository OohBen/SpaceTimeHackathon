/* ============================================================
   SOLAR DOMINION — Icons + original faction crests (TS port)
   Stroke-based, currentColor. No third-party marks.
   Ported verbatim from _design/icons.jsx.
   ============================================================ */
import type { ReactElement } from 'react';

export type IconName =
  | 'map'
  | 'inbox'
  | 'personnel'
  | 'resources'
  | 'intel'
  | 'diplomacy'
  | 'doctrine'
  | 'city'
  | 'resolution'
  | 'fleet'
  | 'ship'
  | 'credits'
  | 'capital'
  | 'timer'
  | 'submit'
  | 'check'
  | 'x'
  | 'defer'
  | 'expand'
  | 'alert'
  | 'sync'
  | 'chevron'
  | 'settings';

export interface IconProps {
  name: IconName | string;
  size?: number;
}

export const Icon = ({ name, size = 21 }: IconProps): ReactElement => {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const paths: Record<string, ReactElement> = {
    map: (<><circle cx="12" cy="12" r="2.2"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(30 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-30 12 12)"/></>),
    inbox: (<><path d="M3.5 13.5 6 5.5a1.5 1.5 0 0 1 1.4-1h9.2a1.5 1.5 0 0 1 1.4 1l2.5 8"/><path d="M3.5 13.5h4l1.2 2.2h6.6l1.2-2.2h4v4a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/></>),
    personnel: (<><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 6.2a3 3 0 0 1 0 5.6"/><path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 19"/></>),
    resources: (<><path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5"/><path d="M12 12v9"/></>),
    intel: (<><circle cx="11" cy="11" r="6"/><path d="m20 20-4.3-4.3"/><path d="M11 8.5v5M8.5 11h5" opacity="0"/><circle cx="11" cy="11" r="2.2"/></>),
    diplomacy: (<><path d="M8 11.5 4 8V5.5L8 4l4 2 4-2 4 1.5V8l-4 3.5"/><path d="M7 12.5c1.5-1 3-1 4.5.3l2 1.7c.8.7.4 2-.7 2.1l-1.8.1"/><path d="M12 18.5 9.5 21M14.5 17 12 19.5"/></>),
    doctrine: (<><path d="M12 3v18"/><path d="m5 6 7-3 7 3"/><circle cx="5" cy="9" r="2.4"/><circle cx="19" cy="9" r="2.4"/><path d="M2.6 15c.5 1.6 1.5 2.4 2.4 2.4S6.9 16.6 7.4 15M16.6 15c.5 1.6 1.5 2.4 2.4 2.4s1.9-.8 2.4-2.4"/></>),
    city: (<><path d="M3 21h18"/><path d="M5 21V8l5-3v16"/><path d="M10 21V11l5 2v8"/><path d="M15 21v-6l4 1.5V21"/><path d="M7.5 9.5v0M7.5 12.5v0M7.5 15.5v0"/></>),
    resolution: (<><path d="M4 5h16"/><path d="M4 10h11"/><path d="M4 15h16"/><path d="M4 20h8"/><circle cx="18.5" cy="11" r="3.2"/><path d="m17.2 11 1 1 1.6-1.8"/></>),
    fleet: (<><path d="M12 3c2.5 2 4 5 4 9l-4 2-4-2c0-4 1.5-7 4-9z"/><path d="m8 12-3 3 3-.5M16 12l3 3-3-.5"/><path d="M12 17v3"/></>),
    ship: (<><path d="M5 14c4-1 10-1 14 0"/><path d="M7 14c0-5 2.5-9 5-9s5 4 5 9"/><circle cx="12" cy="9" r="1.4"/><path d="M9 17.5c1.5.8 4.5.8 6 0"/></>),
    credits: (<><circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.3 9.2C9.3 8 10.5 7.3 12 7.3s2.7.7 2.7 1.9-1.2 1.8-2.7 1.8-2.7.7-2.7 1.9 1.2 1.9 2.7 1.9 2.7-.7 2.7-1.9"/></>),
    capital: (<><path d="M12 3 4 6v5c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/></>),
    timer: (<><circle cx="12" cy="13" r="8"/><path d="M12 13V8.5"/><path d="M9.5 3h5"/><path d="m18.5 6 1.2-1.2"/></>),
    submit: (<><path d="M5 12h13"/><path d="m12 5 7 7-7 7"/></>),
    check: (<><path d="m5 12 4.5 4.5L19 7"/></>),
    x: (<><path d="M6 6l12 12M18 6 6 18"/></>),
    defer: (<><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3 2"/></>),
    expand: (<><path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"/></>),
    alert: (<><path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17v.5"/></>),
    sync: (<><path d="M4 12a8 8 0 0 1 13.5-5.8L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.5 5.8L4 16"/><path d="M4 20v-4h4"/></>),
    chevron: (<><path d="m9 6 6 6-6 6"/></>),
    settings: (<><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></>),
  };
  return <svg {...p}>{paths[name] ?? null}</svg>;
};

/* ---- Original faction crests (geometric, no trademarks) ---- */
export interface CrestProps {
  size?: number;
}

export const CrestImperium = ({ size = 36 }: CrestProps): ReactElement => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    {/* angular azure command sigil: hexagon + inward chevrons + core */}
    <polygon points="24,3 41,13 41,35 24,45 7,35 7,13" stroke="var(--imperium)" strokeWidth="1.6" fill="rgba(79,155,255,0.06)"/>
    <polygon points="24,9 35,15.5 35,32.5 24,39 13,32.5 13,15.5" stroke="var(--imperium-2)" strokeWidth="1" opacity="0.5"/>
    <path d="M24 14 L31 24 L24 21 L17 24 Z" fill="var(--imperium)"/>
    <path d="M24 34 L31 24 L24 27 L17 24 Z" fill="var(--imperium)" opacity="0.55"/>
    <circle cx="24" cy="24" r="2.4" fill="var(--imperium-2)"/>
    <path d="M24 3v6M24 39v6M7 13l5 2.5M41 13l-5 2.5M7 35l5-2.5M41 35l-5-2.5" stroke="var(--imperium)" strokeWidth="1" opacity="0.6"/>
  </svg>
);

export const CrestAccord = ({ size = 36 }: CrestProps): ReactElement => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    {/* rising-sun coalition sigil: broken ring + ascending rays */}
    <circle cx="24" cy="26" r="17" stroke="var(--accord)" strokeWidth="1.6" fill="rgba(255,159,67,0.06)" strokeDasharray="58 12" transform="rotate(-90 24 26)"/>
    <path d="M9 31 H39" stroke="var(--accord)" strokeWidth="1.6"/>
    <path d="M24 31 L24 14 M24 31 L15 18 M24 31 L33 18 M24 31 L11 25 M24 31 L37 25" stroke="var(--accord-2)" strokeWidth="1.4"/>
    <circle cx="24" cy="31" r="2.6" fill="var(--accord)"/>
  </svg>
);

export interface FactionCrestProps {
  faction?: string;
  size?: number;
}

export const Crest = ({ faction, size }: FactionCrestProps): ReactElement =>
  faction === 'accord' ? <CrestAccord size={size} /> : <CrestImperium size={size} />;

export const HelpIcon = (): ReactElement => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M9.2 9.3a2.8 2.8 0 0 1 5.4 1c0 1.9-2.6 2-2.6 3.7"/><path d="M12 17.5v.01"/>
  </svg>
);
