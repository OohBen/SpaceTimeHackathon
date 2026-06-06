import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PanelId = 'overview' | 'session-brief' | 'map' | 'inbox' | 'strategic';

export interface PanelDef {
  id: PanelId;
  label: string;
}

export const CORE_PANELS: PanelDef[] = [
  { id: 'overview', label: 'Command Overview' },
  { id: 'session-brief', label: 'Session Brief' },
  { id: 'map', label: 'Star Map' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'strategic', label: 'Strategic View' },
];

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
