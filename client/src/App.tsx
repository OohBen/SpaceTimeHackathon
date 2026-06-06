import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AppRouter } from './routes/AppRouter';
import type { SessionBackend } from './session/spacetime';
import { createSpacetimeClient, type SpacetimeClient } from './spacetime/client';
import { applyConnectionLifecycleEvent } from './spacetime/connection-lifecycle';
import { createClientConfig } from './spacetime/config';
import { wireSessionSubscriptions } from './spacetime/session-subscriptions';
import {
  sessionStore,
  type ConnectionState,
  type SessionStore,
} from './state/session-store';

interface AppProps {
  backend?: SessionBackend;
  store?: SessionStore;
  client?: SpacetimeClient;
  showConnectionStatus?: boolean;
}

interface ConnectionStatusPanelProps {
  connection: ConnectionState;
  onReconnect: () => void;
}

const connectionLabels: Record<ConnectionState['status'], string> = {
  idle: 'Connection idle',
  loading: 'Connection loading',
  connected: 'Connection connected',
  reconnecting: 'Connection reconnecting',
  disconnected: 'Connection disconnected',
  failed: 'Connection failed',
};

export function ConnectionStatusPanel({
  connection,
  onReconnect,
}: ConnectionStatusPanelProps) {
  const { diagnostics } = connection;
  const issues = connection.error
    ? [
        ...diagnostics.issues,
        `SpacetimeDB is unreachable at ${diagnostics.host}: ${connection.error}.`,
      ]
    : diagnostics.issues;

  return (
    <section
      aria-label="Connection status"
      style={{
        border: '1px solid #d5d7dc',
        borderRadius: 8,
        maxWidth: 560,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, margin: 0 }}>{connectionLabels[connection.status]}</h2>
          <p style={{ margin: '8px 0 0' }}>
            Host: <code>{diagnostics.host}</code>
          </p>
          <p style={{ margin: '4px 0 0' }}>
            Database: <code>{diagnostics.dbName}</code>
          </p>
        </div>
        <button
          type="button"
          onClick={onReconnect}
          disabled={connection.status === 'loading' || connection.status === 'reconnecting'}
        >
          Reconnect
        </button>
      </div>

      {issues.length > 0 ? (
        <ul style={{ margin: '12px 0 0', paddingLeft: 20 }}>
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default function App({
  backend,
  store = sessionStore,
  client,
  showConnectionStatus = false,
}: AppProps) {
  const config = useMemo(() => createClientConfig(), []);
  const clientRef = useRef<SpacetimeClient | null>(client ?? null);
  const connection = useStoreSelector(store, (state) => state.connection);

  if (showConnectionStatus && !clientRef.current) {
    clientRef.current = createSpacetimeClient(config, {
      onLifecycleChange: (event) => applyConnectionLifecycleEvent(store, event),
    });
  }

  useEffect(() => {
    if (!showConnectionStatus) return undefined;

    const activeClient = clientRef.current;
    if (!activeClient) return undefined;

    try {
      const handle = activeClient.connect();
      wireSessionSubscriptions(store, activeClient);
      return () => {
        handle.disconnect();
        store.getState().actions.setConnection({ status: 'disconnected' });
      };
    } catch {
      return undefined;
    }
  }, [showConnectionStatus, store]);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      {showConnectionStatus ? (
        <ConnectionStatusPanel
          connection={connection}
          onReconnect={() => {
            try {
              clientRef.current?.reconnect();
            } catch {
              return undefined;
            }
          }}
        />
      ) : null}
      <AppRouter backend={backend} />
    </main>
  );
}

function useStoreSelector<T>(
  store: SessionStore,
  selector: (state: ReturnType<SessionStore['getState']>) => T,
): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
