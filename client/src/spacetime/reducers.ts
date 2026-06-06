export interface ReducerCallDescriptor<A = unknown> {
  reducer: string;
  args: A;
}

export interface CreateSessionArgs {
  playerName: string;
}

export interface JoinSessionArgs {
  sessionId: string;
  playerName: string;
}

export type CommanderDecision = 'approved' | 'rejected' | 'deferred';

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

export interface RunDeliberationArgs {
  factionId: number;
}

export interface SimulateTurnArgs {
  sessionId: number;
}

export interface AckResolutionArgs {
  factionId: number;
}

export const reducerRegistry = {
  createSession(args: CreateSessionArgs): ReducerCallDescriptor<CreateSessionArgs> {
    return { reducer: 'create_session', args };
  },

  joinSession(args: JoinSessionArgs): ReducerCallDescriptor<JoinSessionArgs> {
    return { reducer: 'join_session', args };
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

  runDeliberation(args: RunDeliberationArgs): ReducerCallDescriptor<RunDeliberationArgs> {
    return { reducer: 'run_deliberation', args };
  },

  simulateTurn(args: SimulateTurnArgs): ReducerCallDescriptor<SimulateTurnArgs> {
    return { reducer: 'simulate_turn', args };
  },

  ackResolution(args: AckResolutionArgs): ReducerCallDescriptor<AckResolutionArgs> {
    return { reducer: 'ack_resolution', args };
  },
} as const;
