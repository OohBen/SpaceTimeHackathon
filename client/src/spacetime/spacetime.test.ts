import { describe, it, expect } from 'vitest';
import { createClientConfig, defaultClientConfig } from './config';
import { createSpacetimeClient } from './client';
import { reducerRegistry } from './reducers';

describe('createClientConfig', () => {
  it('returns default local dev config when no overrides given', () => {
    const cfg = defaultClientConfig();
    expect(cfg.host).toBe('ws://localhost:3000');
    expect(cfg.dbName).toBe('solar-dominion');
  });

  it('merges overrides into config', () => {
    const cfg = createClientConfig({ host: 'ws://remote:3000' });
    expect(cfg.host).toBe('ws://remote:3000');
    expect(cfg.dbName).toBe('solar-dominion');
  });
});

describe('createSpacetimeClient', () => {
  it('returns an object with connect, subscribe, and callReducer methods', () => {
    const client = createSpacetimeClient(defaultClientConfig());
    expect(typeof client.connect).toBe('function');
    expect(typeof client.subscribe).toBe('function');
    expect(typeof client.callReducer).toBe('function');
  });

  it('connect returns a connection handle with disconnect', () => {
    const client = createSpacetimeClient(defaultClientConfig());
    const handle = client.connect();
    expect(handle).toBeDefined();
    expect(typeof handle.disconnect).toBe('function');
  });
});

describe('reducerRegistry', () => {
  it('exposes createSession reducer wrapper', () => {
    expect(typeof reducerRegistry.createSession).toBe('function');
  });

  it('exposes joinSession reducer wrapper', () => {
    expect(typeof reducerRegistry.joinSession).toBe('function');
  });

  it('createSession returns a typed reducer call descriptor', () => {
    const call = reducerRegistry.createSession({ playerName: 'Atlas' });
    expect(call.reducer).toBe('create_session');
    expect(call.args.playerName).toBe('Atlas');
  });

  it('joinSession returns a typed reducer call descriptor', () => {
    const call = reducerRegistry.joinSession({ sessionId: 'abc123', playerName: 'Rex' });
    expect(call.reducer).toBe('join_session');
    expect(call.args.sessionId).toBe('abc123');
  });
});
