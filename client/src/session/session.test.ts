import { beforeEach, describe, expect, it } from 'vitest';

import { createSessionStore } from './store';

describe('session store', () => {
  let store: ReturnType<typeof createSessionStore>;

  beforeEach(() => {
    store = createSessionStore();
  });

  it('starts idle with null context', () => {
    const s = store.getState();
    expect(s.status).toBe('idle');
    expect(s.sessionId).toBeNull();
    expect(s.error).toBeNull();
  });

  it('beginMutation transitions to loading and clears error', () => {
    store.getState().setError('old error');
    store.getState().beginMutation();
    const s = store.getState();
    expect(s.status).toBe('loading');
    expect(s.error).toBeNull();
  });

  it('setReady transitions to ready and stores full context', () => {
    store.getState().setReady({ sessionId: 42, factionId: 1, playerSlot: 'player_a', playerName: 'Atlas' });
    const s = store.getState();
    expect(s.status).toBe('ready');
    expect(s.sessionId).toBe(42);
    expect(s.factionId).toBe(1);
    expect(s.playerSlot).toBe('player_a');
    expect(s.playerName).toBe('Atlas');
  });

  it('setError transitions to error with message', () => {
    store.getState().setError('Duplicate session');
    const s = store.getState();
    expect(s.status).toBe('error');
    expect(s.error).toBe('Duplicate session');
  });

  it('reset clears everything back to idle', () => {
    store.getState().setReady({ sessionId: 99, factionId: 2, playerSlot: 'player_b', playerName: 'Rex' });
    store.getState().reset();
    const s = store.getState();
    expect(s.status).toBe('idle');
    expect(s.sessionId).toBeNull();
    expect(s.factionId).toBeNull();
    expect(s.playerSlot).toBeNull();
    expect(s.playerName).toBeNull();
  });
});
