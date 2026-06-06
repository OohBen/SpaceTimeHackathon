import { describe, it, expect } from 'vitest';
import { createClientConfig, defaultClientConfig } from './config';
import { createSpacetimeClient, createDbConnectionTransport, type DbConnectionLike } from './client';
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
  it('exposes createSession wrapper with two-player args', () => {
    const call = reducerRegistry.createSession({ playerAName: 'Atlas', playerBName: 'Rex' });
    expect(call.reducer).toBe('create_session');
    expect(call.args).toEqual({ playerAName: 'Atlas', playerBName: 'Rex' });
  });

  it('exposes joinOrResumeSession wrapper with session_id + player_slot args', () => {
    const call = reducerRegistry.joinOrResumeSession({ sessionId: 1, playerSlot: 'player_a' });
    expect(call.reducer).toBe('join_or_resume_session');
    expect(call.args).toEqual({ sessionId: 1, playerSlot: 'player_a' });
  });

  it.each([
    ['advanceWorld', { sessionId: 1 }, 'advance_world'],
    ['advanceTurnPhase', { sessionId: 1, nextPhase: 'deliberation' as const }, 'advance_turn_phase'],
    ['runDeliberation', { factionId: 1 }, 'run_deliberation'],
    ['setDeliberationMode', { mode: 'queue' as const }, 'set_deliberation_mode'],
    ['submitTurn', { factionId: 1 }, 'submit_turn'],
    ['expireTurn', { sessionId: 1 }, 'expire_turn'],
    ['simulateTurn', { sessionId: 1 }, 'simulate_turn'],
    ['ackResolution', { factionId: 1 }, 'ack_resolution'],
    ['checkVictory', { sessionId: 1 }, 'check_victory'],
  ] as const)(
    'wraps %s into a descriptor with the snake_case reducer name',
    (method, args, expectedReducer) => {
      const wrapper = (reducerRegistry as Record<string, (a: unknown) => { reducer: string; args: unknown }>)[method];
      expect(typeof wrapper).toBe('function');
      expect(wrapper(args)).toEqual({ reducer: expectedReducer, args });
    },
  );
});

describe('createDbConnectionTransport', () => {
  it('translates snake_case reducer names to camelCase methods on conn.reducers', () => {
    const calls: Array<{ method: string; args: unknown }> = [];
    const conn: DbConnectionLike = {
      reducers: new Proxy({}, {
        get(_target, prop: string) {
          return (args: unknown) => {
            calls.push({ method: prop, args });
          };
        },
      }) as Record<string, (args: unknown) => unknown>,
    };

    const transport = createDbConnectionTransport(conn);
    const handle = transport.connect(defaultClientConfig());

    transport.callReducer(handle, reducerRegistry.commanderDecision({
      factionId: 7,
      proposalId: 101,
      decision: 'approved',
      allocation: 25,
    }));
    transport.callReducer(handle, reducerRegistry.joinOrResumeSession({
      sessionId: 1,
      playerSlot: 'player_b',
    }));

    expect(calls).toEqual([
      { method: 'commanderDecision', args: { factionId: 7, proposalId: 101, decision: 'approved', allocation: 25 } },
      { method: 'joinOrResumeSession', args: { sessionId: 1, playerSlot: 'player_b' } },
    ]);
  });

  it('forwards subscribe to the generated subscriptionBuilder', () => {
    const subscribed: unknown[] = [];
    const conn: DbConnectionLike = {
      reducers: {},
      subscriptionBuilder: () => ({
        subscribe: (queries) => {
          subscribed.push(queries);
        },
      }),
    };

    const transport = createDbConnectionTransport(conn);
    const handle = transport.connect(defaultClientConfig());
    transport.subscribe(handle, ['SELECT * FROM proposals']);

    expect(subscribed).toEqual([['SELECT * FROM proposals']]);
  });

  it('throws if a reducer name is not exposed on conn.reducers', () => {
    const conn: DbConnectionLike = { reducers: {} };
    const transport = createDbConnectionTransport(conn);
    const handle = transport.connect(defaultClientConfig());

    expect(() =>
      transport.callReducer(handle, reducerRegistry.submitTurn({ factionId: 1 })),
    ).toThrow(/submit_turn/);
  });
});
