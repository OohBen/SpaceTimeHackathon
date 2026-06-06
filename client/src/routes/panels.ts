import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PanelId =
  | 'overview'
  | 'session-brief'
  | 'map'
  | 'inbox'
  | 'turn-controls'
  | 'strategic'
  | 'personnel'
  | 'resources'
  | 'intelligence'
  | 'diplomacy'
  | 'doctrine'
  | 'resolution'
  | 'end-game';

export interface PanelDef {
  id: PanelId;
  label: string;
  unavailableMessage?: string;
}

export const CORE_PANELS: PanelDef[] = [
  { id: 'overview', label: 'Command Overview' },
  { id: 'session-brief', label: 'Session Brief' },
  { id: 'map', label: 'Star Map' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'turn-controls', label: 'Turn Controls' },
  { id: 'strategic', label: 'Strategic View' },
  {
    id: 'personnel',
    label: 'Personnel',
    unavailableMessage: 'Personnel roster data is not yet available.',
  },
  {
    id: 'resources',
    label: 'Resources',
    unavailableMessage: 'Resource ledger data is not yet available.',
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    unavailableMessage: 'Intelligence reports are not yet available.',
  },
  {
    id: 'diplomacy',
    label: 'Diplomacy',
    unavailableMessage: 'Diplomacy channel data is not yet available.',
  },
  {
    id: 'doctrine',
    label: 'Doctrine',
    unavailableMessage: 'Doctrine posture data is not yet available.',
  },
  {
    id: 'resolution',
    label: 'Turn Resolution',
    unavailableMessage: 'Turn resolution data is not yet available.',
  },
  {
    id: 'end-game',
    label: 'End Game',
    unavailableMessage: 'End-game victory data is not yet available.',
  },
];

export function findPanelDef(panel: PanelId): PanelDef {
  return CORE_PANELS.find((p) => p.id === panel) ?? CORE_PANELS[0];
}

interface PanelStoreState {
  activePanel: PanelId;
  setPanel: (panel: PanelId) => void;
  reset: () => void;
}

export const PANEL_STORE_KEY = 'solar-dominion-panel';

export const usePanelStore = create<PanelStoreState>()(
  persist(
    (set) => ({
      activePanel: 'overview',
      setPanel: (panel) => set({ activePanel: panel }),
      reset: () => set({ activePanel: 'overview' }),
    }),
    { name: PANEL_STORE_KEY },
  ),
);
