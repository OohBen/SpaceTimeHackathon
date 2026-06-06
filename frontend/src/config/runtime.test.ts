import { describe, expect, it } from 'vitest';
import { getRuntimeConfig } from './runtime';

describe('getRuntimeConfig', () => {
  it('reads Vite spacetime env values into a typed object', () => {
    const config = getRuntimeConfig({
      VITE_SPACETIME_HOST: 'ws://localhost:3000',
      VITE_SPACETIME_DB: 'solar_dominion',
    });

    expect(config).toEqual({
      spacetimeHost: 'ws://localhost:3000',
      spacetimeDb: 'solar_dominion',
    });
  });
});
