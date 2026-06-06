export type SessionMode = 'create' | 'resume' | 'demo';
export type PlayerSlot = 'player_a' | 'player_b';
export type SlotStatus = 'available' | 'occupied' | 'yours';

export interface SetupParams {
  mode: SessionMode;
}

export interface SessionChoice {
  id: number;
  label: string;
  state: string;
}

export interface SlotChoice {
  key: PlayerSlot;
  label: 'P1' | 'P2';
  factionId?: number;
  factionName: string;
  status: SlotStatus;
  recovery: string;
}

export interface SetupState {
  playerName: string;
  mode: SessionMode;
  opponentName?: string;
  sessionId?: number;
  playerSlot?: PlayerSlot;
}
