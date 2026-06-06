import { describe, expect, it } from 'vitest';
import {
  normalizeSpacetimeEndpoint,
  readHostedRuntime,
  validateHostedRuntime,
} from './hostedRuntime';

describe('hosted runtime config', () => {
  it('normalizes hosted frontend, SpacetimeDB, orchestrator, and demo mode env', () => {
    const config = readHostedRuntime({
      VITE_DEMO_MODE: 'live',
      VITE_HOSTED_FRONTEND_URL: 'https://solar-dominion.vercel.app/',
      VITE_ORCHESTRATOR_BASE_URL: 'https://solar-dominion-orchestrator.fly.dev/',
      VITE_SPACETIME_DB_NAME: 'solar-dominion-prod',
      VITE_SPACETIME_HOST: 'https://db.spacetimedb.example',
    });

    expect(config).toMatchObject({
      demoMode: 'live',
      hostedFrontendUrl: 'https://solar-dominion.vercel.app',
      isHosted: true,
      orchestratorBaseUrl: 'https://solar-dominion-orchestrator.fly.dev',
      spacetimeDbName: 'solar-dominion-prod',
      spacetimeUri: 'wss://db.spacetimedb.example',
    });
    expect(config.issues).toEqual([]);
  });

  it('keeps legacy Spacetime env aliases working for older session wiring', () => {
    const config = readHostedRuntime({
      VITE_LLM_MODE: 'fixture',
      VITE_SPACETIMEDB_MODULE: 'solar-dominion-preview',
      VITE_SPACETIMEDB_URI: 'ws://127.0.0.1:3000',
    });

    expect(config.demoMode).toBe('fixture');
    expect(config.spacetimeDbName).toBe('solar-dominion-preview');
    expect(config.spacetimeUri).toBe('ws://127.0.0.1:3000');
  });

  it('reports actionable hosted config issues', () => {
    const issues = validateHostedRuntime({
      demoMode: 'mock',
      hostedFrontendUrl: null,
      isHosted: true,
      issues: [],
      orchestratorBaseUrl: 'solar-dominion-orchestrator.fly.dev',
      spacetimeDbName: '',
      spacetimeUri: 'https://db.example.test',
    });

    expect(issues).toEqual([
      'VITE_SPACETIME_HOST must resolve to ws:// or wss:// for browser use.',
      'VITE_SPACETIME_DB_NAME is empty; set the published SpacetimeDB module name.',
      'VITE_ORCHESTRATOR_BASE_URL must be an http:// or https:// URL.',
    ]);
  });

  it('converts HTTP endpoints to browser WebSocket targets', () => {
    expect(normalizeSpacetimeEndpoint('http://localhost:3000')).toBe('ws://localhost:3000');
    expect(normalizeSpacetimeEndpoint('https://db.example.test')).toBe('wss://db.example.test');
  });
});
