import type { ClientConfig } from './config';
import type { ReducerCallDescriptor } from './reducers';

export interface ConnectionHandle {
  disconnect: () => void;
}

export interface SpacetimeClient {
  connect: () => ConnectionHandle;
  subscribe: (queries: string[]) => void;
  callReducer: (call: ReducerCallDescriptor) => void;
}

export function createSpacetimeClient(config: ClientConfig): SpacetimeClient {
  void config;
  let activeConnection: ConnectionHandle | null = null;

  return {
    connect(): ConnectionHandle {
      // Returns a handle for managing the SpacetimeDB WebSocket connection.
      // Actual DbConnectionBuilder wiring happens when tables/reducers are defined (P1E2+).
      const handle: ConnectionHandle = {
        disconnect() {
          activeConnection = null;
        },
      };
      activeConnection = handle;
      return handle;
    },

    subscribe(queries: string[]): void {
      if (!activeConnection) return;
      // Subscription call surface — wired to DbConnectionBuilder.subscribe in P1E2+.
      void queries;
    },

    callReducer(call: ReducerCallDescriptor): void {
      if (!activeConnection) return;
      // Reducer dispatch surface — wired to connection.reducers in P1E2+.
      void call;
    },
  };
}
