import { buildClientDiagnostics, type ClientConfig, type ClientDiagnostics } from './config';
import type { ReducerCallDescriptor } from './reducers';

// Minimal structural type of the generated `DbConnection`. Kept structural so
// this module does not pull in the full module_bindings just to define a
// transport boundary.
export interface DbConnectionLike {
  reducers: Record<string, (args: unknown) => unknown>;
  subscriptionBuilder?: () => {
    subscribe: (queries: unknown) => unknown;
  };
}

export interface ConnectionHandle {
  disconnect: () => void;
}

export type ConnectionLifecycleStatus =
  | 'loading'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

export interface ConnectionLifecycleEvent {
  status: ConnectionLifecycleStatus;
  error: string | null;
  diagnostics: ClientDiagnostics;
  reconnectAttempt: number;
}

export interface ConnectionTransport {
  connect: (config: ClientConfig) => ConnectionHandle;
  subscribe: (handle: ConnectionHandle, queries: string[]) => void;
  callReducer: (handle: ConnectionHandle, call: ReducerCallDescriptor) => void;
}

export interface SpacetimeClientOptions {
  transport?: ConnectionTransport;
  onLifecycleChange?: (event: ConnectionLifecycleEvent) => void;
}

export interface SpacetimeClient {
  connect: () => ConnectionHandle;
  reconnect: () => ConnectionHandle;
  disconnect: () => void;
  subscribe: (queries: string[]) => void;
  callReducer: (call: ReducerCallDescriptor) => void;
  diagnostics: () => ClientDiagnostics;
}

const defaultTransport: ConnectionTransport = {
  connect: () => ({
    disconnect() {
      return undefined;
    },
  }),
  subscribe: () => undefined,
  callReducer: () => undefined,
};

export function createSpacetimeClient(
  config: ClientConfig,
  options: SpacetimeClientOptions = {},
): SpacetimeClient {
  const transport = options.transport ?? defaultTransport;
  let activeConnection: ConnectionHandle | null = null;
  let reconnectAttempt = 0;
  const subscriptions = new Map<string, string[]>();

  function emit(status: ConnectionLifecycleStatus, error: string | null = null): void {
    options.onLifecycleChange?.({
      status,
      error,
      diagnostics: buildClientDiagnostics(config),
      reconnectAttempt,
    });
  }

  function establish(status: Extract<ConnectionLifecycleStatus, 'loading' | 'reconnecting'>) {
    emit(status);

    try {
      activeConnection = transport.connect(config);
      emit('connected');
      replaySubscriptions();
      return activeConnection;
    } catch (error) {
      activeConnection = null;
      emit('failed', errorMessage(error));
      throw error;
    }
  }

  function replaySubscriptions(): void {
    if (!activeConnection) return;
    for (const queries of subscriptions.values()) {
      transport.subscribe(activeConnection, [...queries]);
    }
  }

  return {
    connect(): ConnectionHandle {
      return establish('loading');
    },

    reconnect(): ConnectionHandle {
      reconnectAttempt += 1;
      activeConnection?.disconnect();
      activeConnection = null;
      return establish('reconnecting');
    },

    disconnect(): void {
      activeConnection?.disconnect();
      activeConnection = null;
      emit('disconnected');
    },

    subscribe(queries: string[]): void {
      subscriptions.set(queries.join('\n'), [...queries]);
      if (!activeConnection) return;
      transport.subscribe(activeConnection, [...queries]);
    },

    callReducer(call: ReducerCallDescriptor): void {
      if (!activeConnection) return;
      transport.callReducer(activeConnection, call);
    },

    diagnostics(): ClientDiagnostics {
      return buildClientDiagnostics(config);
    },
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'unknown connection error';
}

// Bridge a generated SpacetimeDB `DbConnection` into the `ConnectionTransport`
// shape used by `createSpacetimeClient`. The descriptor's `reducer` field is
// the snake_case wire name; the generated client exposes camelCase methods, so
// the adapter translates before dispatch.
export function createDbConnectionTransport(
  conn: DbConnectionLike,
): ConnectionTransport {
  const handle: ConnectionHandle = {
    disconnect() {
      return undefined;
    },
  };

  return {
    connect() {
      return handle;
    },
    subscribe(_handle, queries) {
      const builder = conn.subscriptionBuilder?.();
      if (!builder) return;
      builder.subscribe(queries);
    },
    callReducer(_handle, call) {
      const methodName = snakeToCamel(call.reducer);
      const method = conn.reducers[methodName];
      if (typeof method !== 'function') {
        throw new Error(
          `reducer ${call.reducer} (method ${methodName}) is not exposed on conn.reducers`,
        );
      }
      method(call.args);
    },
  };
}

function snakeToCamel(snake: string): string {
  return snake.replace(/_([a-z])/g, (_match, ch: string) => ch.toUpperCase());
}
