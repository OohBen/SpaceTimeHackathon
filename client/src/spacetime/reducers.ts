export interface ReducerCallDescriptor<A = unknown> {
  reducer: string;
  args: A;
}

export type PlayerSlot = 'player_a' | 'player_b';
export type CommanderDecision = 'approved' | 'rejected' | 'deferred';
export type DeliberationMode = 'queue' | 'fallback';
export type TurnPhase =
  | 'setup'
  | 'world_update'
  | 'deliberation'
  | 'decision'
  | 'resolution'
  | 'summary'
  | 'complete';

export interface CreateSessionArgs {
  playerAName: string;
  playerBName: string;
}

export interface JoinOrResumeSessionArgs {
  sessionId: number;
  playerSlot: PlayerSlot;
}

export interface AdvanceWorldArgs {
  sessionId: number;
}

export interface AdvanceTurnPhaseArgs {
  sessionId: number;
  nextPhase: TurnPhase;
}

export interface RunDeliberationArgs {
  factionId: number;
}

export interface SetDeliberationModeArgs {
  mode: DeliberationMode;
}

export interface CommanderDecisionArgs {
  factionId: number;
  proposalId: number;
  decision: CommanderDecision;
  allocation: number;
}

export interface SubmitTurnArgs {
  factionId: number;
}

export interface ExpireTurnArgs {
  sessionId: number;
}

export interface SimulateTurnArgs {
  sessionId: number;
}

export interface AckResolutionArgs {
  factionId: number;
}

export interface CheckVictoryArgs {
  sessionId: number;
}

export const reducerRegistry = {
  createSession(args: CreateSessionArgs): ReducerCallDescriptor<CreateSessionArgs> {
    return { reducer: 'create_session', args };
  },

  joinOrResumeSession(
    args: JoinOrResumeSessionArgs,
  ): ReducerCallDescriptor<JoinOrResumeSessionArgs> {
    return { reducer: 'join_or_resume_session', args };
  },

  advanceWorld(args: AdvanceWorldArgs): ReducerCallDescriptor<AdvanceWorldArgs> {
    return { reducer: 'advance_world', args };
  },

  advanceTurnPhase(
    args: AdvanceTurnPhaseArgs,
  ): ReducerCallDescriptor<AdvanceTurnPhaseArgs> {
    return { reducer: 'advance_turn_phase', args };
  },

  runDeliberation(
    args: RunDeliberationArgs,
  ): ReducerCallDescriptor<RunDeliberationArgs> {
    return { reducer: 'run_deliberation', args };
  },

  setDeliberationMode(
    args: SetDeliberationModeArgs,
  ): ReducerCallDescriptor<SetDeliberationModeArgs> {
    return { reducer: 'set_deliberation_mode', args };
  },

  commanderDecision(
    args: CommanderDecisionArgs,
  ): ReducerCallDescriptor<CommanderDecisionArgs> {
    return { reducer: 'commander_decision', args };
  },

  submitTurn(args: SubmitTurnArgs): ReducerCallDescriptor<SubmitTurnArgs> {
    return { reducer: 'submit_turn', args };
  },

  expireTurn(args: ExpireTurnArgs): ReducerCallDescriptor<ExpireTurnArgs> {
    return { reducer: 'expire_turn', args };
  },

  simulateTurn(args: SimulateTurnArgs): ReducerCallDescriptor<SimulateTurnArgs> {
    return { reducer: 'simulate_turn', args };
  },

  ackResolution(args: AckResolutionArgs): ReducerCallDescriptor<AckResolutionArgs> {
    return { reducer: 'ack_resolution', args };
  },

  checkVictory(args: CheckVictoryArgs): ReducerCallDescriptor<CheckVictoryArgs> {
    return { reducer: 'check_victory', args };
  },
} as const;
