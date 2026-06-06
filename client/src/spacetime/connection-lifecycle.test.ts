import { describe, expect, it } from 'vitest';
import {
  createSpacetimeClient,
  type ConnectionLifecycleEvent,
  type ConnectionTransport,
} from './client';
import {
  buildClientDiagnostics,
  createClientConfig,
  normalizeSpacetimeHost,
} from './config';

describe('connection lifecycle handling', () => {
  it('emits loading and connected states with local dev diagnostics', () => {
    const events: ConnectionLifecycleEvent[] = [];
    const config = createClientConfig({
      host: 'http://localhost:3000',
      dbName: 'solar-dominion',
    });

    const client = createSpacetimeClient(config, {
      onLifecycleChange: (event) => events.push(event),
    });

    client.connect();

    expect(events.map((event) => event.status)).toEqual(['loading', 'connected']);
    expect(events.at(-1)?.diagnostics.host).toBe('ws://localhost:3000');
    expect(events.at(-1)?.diagnostics.dbName).toBe('solar-dominion');
  });

  it('rebuilds stored session subscriptions on reconnect', () => {
    const subscribedQueries: string[][] = [];
    const events: ConnectionLifecycleEvent[] = [];
    const transport: ConnectionTransport = {
      connect: () => ({ disconnect: () => undefined }),
      subscribe: (_handle, queries) => subscribedQueries.push(queries),
      callReducer: () => Promise.resolve(),
    };
    const client = createSpacetimeClient(createClientConfig(), {
      transport,
      onLifecycleChange: (event) => events.push(event),
    });

    client.connect();
    client.subscribe(['SELECT * FROM sessions', 'SELECT * FROM player_slots']);
    client.reconnect();

    expect(subscribedQueries).toEqual([
      ['SELECT * FROM sessions', 'SELECT * FROM player_slots'],
      ['SELECT * FROM sessions', 'SELECT * FROM player_slots'],
    ]);
    expect(events.map((event) => event.status)).toContain('reconnecting');
  });

  it('emits failed state with actionable diagnostics when the backend is unavailable', () => {
    const events: ConnectionLifecycleEvent[] = [];
    const client = createSpacetimeClient(createClientConfig(), {
      transport: {
        connect: () => {
          throw new Error('connection refused');
        },
        subscribe: () => undefined,
        callReducer: () => Promise.resolve(),
      },
      onLifecycleChange: (event) => events.push(event),
    });

    expect(() => client.connect()).toThrow('connection refused');
    expect(events.at(-1)?.status).toBe('failed');
    expect(events.at(-1)?.error).toBe('connection refused');
    expect(events.at(-1)?.diagnostics.issues).toEqual([]);
  });
});

describe('local dev connection config diagnostics', () => {
  it('normalizes HTTP local backend URLs into WebSocket targets', () => {
    expect(normalizeSpacetimeHost('http://localhost:3000')).toBe('ws://localhost:3000');
    expect(normalizeSpacetimeHost('https://db.example.test')).toBe('wss://db.example.test');
  });

  it('reports empty host and database values as obvious setup issues', () => {
    const diagnostics = buildClientDiagnostics({ host: '', dbName: '' });

    expect(diagnostics.issues).toEqual([
      'VITE_SPACETIME_HOST is empty; set it to ws://localhost:3000 for local SpacetimeDB.',
      'VITE_SPACETIME_DB_NAME is empty; publish or target the solar-dominion database.',
    ]);
  });
});
