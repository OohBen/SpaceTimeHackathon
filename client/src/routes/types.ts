export type SessionMode = 'create' | 'resume' | 'demo';

export interface SetupParams {
  mode: SessionMode;
}

export interface SetupState {
  playerName: string;
  mode: SessionMode;
}
