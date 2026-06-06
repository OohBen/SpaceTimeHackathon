import { useStore } from 'zustand';
import {
  sessionStore,
  selectConnectionStatus,
  selectActiveSession,
  selectPublicGameState,
  selectCurrentPlayerSlot,
  selectPrivateFactionState,
  type ConnectionStatus,
} from '../state/session-store';

export interface HudData {
  connectionStatus: ConnectionStatus;
  factionName: string | null;
  turn: number | null;
  year: number | null;
  phase: string | null;
  controlScore: number | null;
  resources: Record<string, number> | null;
}

export function useHudData(factionId: string | null): HudData {
  const connectionStatus = useStore(sessionStore, selectConnectionStatus);
  const activeSession = useStore(sessionStore, selectActiveSession);
  const publicGameState = useStore(sessionStore, selectPublicGameState);
  const currentPlayerSlot = useStore(sessionStore, selectCurrentPlayerSlot);
  const privateFactionState = useStore(sessionStore, (state) =>
    factionId ? selectPrivateFactionState(state, factionId) : null,
  );

  return {
    connectionStatus,
    factionName: currentPlayerSlot?.factionName ?? null,
    turn: publicGameState?.turn ?? null,
    year: publicGameState?.year ?? null,
    phase: publicGameState?.phase ?? activeSession?.phase ?? null,
    controlScore:
      factionId && publicGameState?.controlScores[factionId] != null
        ? publicGameState.controlScores[factionId]
        : null,
    resources: privateFactionState?.resources ?? null,
  };
}
