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
} as const;
