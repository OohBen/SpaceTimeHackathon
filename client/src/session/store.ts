import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SessionContext {
  sessionId: number;
  factionId: number;
  playerSlot: string;
  playerName: string;
}

interface SessionState {
  status: 'idle' | 'loading' | 'error' | 'ready';
  error: string | null;
  sessionId: number | null;
  factionId: number | null;
  playerSlot: string | null;
  playerName: string | null;
  beginMutation(): void;
  setReady(ctx: SessionContext): void;
  setError(error: string): void;
  reset(): void;
}

export const SESSION_STORE_KEY = 'solar-dominion-session';

const initialState = {
  status: 'idle' as const,
  error: null,
  sessionId: null,
  factionId: null,
  playerSlot: null,
  playerName: null,
};

export function createSessionStore() {
  return create<SessionState>()((set) => ({
    ...initialState,
    beginMutation: () => set({ status: 'loading', error: null }),
    setReady: (ctx: SessionContext) => set({ status: 'ready', ...ctx, error: null }),
    setError: (error: string) => set({ status: 'error', error }),
    reset: () => set(initialState),
  }));
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ...initialState,
      beginMutation: () => set({ status: 'loading', error: null }),
      setReady: (ctx: SessionContext) => set({ status: 'ready', ...ctx, error: null }),
      setError: (error: string) => set({ status: 'error', error }),
      reset: () => set(initialState),
    }),
    {
      name: SESSION_STORE_KEY,
      partialize: (state) => ({
        sessionId: state.sessionId,
        factionId: state.factionId,
        playerSlot: state.playerSlot,
        playerName: state.playerName,
      }),
    }
  )
);
