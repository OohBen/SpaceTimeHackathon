import { describe, expect, it } from 'vitest';
import { getRuntimeConfig } from './runtime';

describe('getRuntimeConfig', () => {
  it('reads Vite spacetime env values into a typed object', () => {
    const config = getRuntimeConfig({
      VITE_SPACETIME_HOST: 'wss://spacetime.example.com',
      VITE_SPACETIME_DB_NAME: 'judge_demo',
    });

    expect(config).toEqual({
      spacetimeHost: 'wss://spacetime.example.com',
      spacetimeDb: 'judge_demo',
    });
  });

  it('uses local bootstrap defaults when env values are absent', () => {
    expect(getRuntimeConfig({})).toEqual({
      spacetimeHost: 'ws://localhost:3000',
      spacetimeDb: 'solar_dominion',
    });
  });
});
