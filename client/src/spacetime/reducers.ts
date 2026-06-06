export interface ReducerCallDescriptor<A = Record<string, unknown>> {
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

export const reducerRegistry = {
  createSession(args: CreateSessionArgs): ReducerCallDescriptor<CreateSessionArgs> {
    return { reducer: 'create_session', args };
  },

  joinSession(args: JoinSessionArgs): ReducerCallDescriptor<JoinSessionArgs> {
    return { reducer: 'join_session', args };
  },
} as const;
