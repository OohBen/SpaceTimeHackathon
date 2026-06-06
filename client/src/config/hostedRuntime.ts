export type DemoMode = 'fixture' | 'live' | 'mock';

export interface HostedRuntimeConfig {
  demoMode: DemoMode;
  hostedFrontendUrl: string | null;
  isHosted: boolean;
  issues: string[];
  orchestratorBaseUrl: string;
  spacetimeDbName: string;
  spacetimeUri: string;
}

type RuntimeEnv = Record<string, string | boolean | undefined>;

const DEFAULT_SPACETIME_URI = 'ws://localhost:3000';
const DEFAULT_SPACETIME_DB_NAME = 'solar-dominion';
const DEFAULT_ORCHESTRATOR_BASE_URL = 'http://localhost:4000';
const DEFAULT_DEMO_MODE: DemoMode = 'mock';

export function readHostedRuntime(
  env: RuntimeEnv = (import.meta as ImportMeta & { env?: RuntimeEnv }).env ?? {},
): HostedRuntimeConfig {
  const spacetimeUri = normalizeSpacetimeEndpoint(
    readFirst(env, ['VITE_SPACETIME_HOST', 'VITE_SPACETIMEDB_URI', 'VITE_SPACETIME_URI']) ??
      DEFAULT_SPACETIME_URI,
  );
  const spacetimeDbName =
    readFirst(env, ['VITE_SPACETIME_DB_NAME', 'VITE_SPACETIMEDB_MODULE']) ??
    DEFAULT_SPACETIME_DB_NAME;
  const orchestratorBaseUrl = trimTrailingSlash(
    readFirst(env, ['VITE_ORCHESTRATOR_BASE_URL']) ?? DEFAULT_ORCHESTRATOR_BASE_URL,
  );
  const hostedFrontendUrl = optionalUrl(readFirst(env, ['VITE_HOSTED_FRONTEND_URL']));
  const demoMode = normalizeDemoMode(readFirst(env, ['VITE_DEMO_MODE', 'VITE_LLM_MODE']));
  const isHosted =
    readBoolean(env.VITE_HOSTED) ||
    Boolean(hostedFrontendUrl) ||
    !/^(ws|http):\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(spacetimeUri);

  return {
    demoMode,
    hostedFrontendUrl,
    isHosted,
    issues: validateHostedRuntime({
      demoMode,
      hostedFrontendUrl,
      isHosted,
      issues: [],
      orchestratorBaseUrl,
      spacetimeDbName,
      spacetimeUri,
    }),
    orchestratorBaseUrl,
    spacetimeDbName,
    spacetimeUri,
  };
}

export function normalizeSpacetimeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (trimmed.startsWith('http://')) {
    return `ws://${trimmed.slice('http://'.length)}`;
  }
  if (trimmed.startsWith('https://')) {
    return `wss://${trimmed.slice('https://'.length)}`;
  }
  return trimmed;
}

export function validateHostedRuntime(config: HostedRuntimeConfig): string[] {
  const issues: string[] = [];

  if (!config.spacetimeUri) {
    issues.push('VITE_SPACETIME_HOST is empty; set a ws:// or wss:// SpacetimeDB endpoint.');
  } else if (!/^wss?:\/\//i.test(config.spacetimeUri)) {
    issues.push('VITE_SPACETIME_HOST must resolve to ws:// or wss:// for browser use.');
  }

  if (!config.spacetimeDbName.trim()) {
    issues.push('VITE_SPACETIME_DB_NAME is empty; set the published SpacetimeDB module name.');
  }

  if (!/^https?:\/\//i.test(config.orchestratorBaseUrl)) {
    issues.push('VITE_ORCHESTRATOR_BASE_URL must be an http:// or https:// URL.');
  }

  return issues;
}

function readFirst(env: RuntimeEnv, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function readBoolean(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') return value;
  return typeof value === 'string' && value.toLowerCase() === 'true';
}

function normalizeDemoMode(value: string | undefined): DemoMode {
  if (value === 'fixture' || value === 'live' || value === 'mock') {
    return value;
  }
  return DEFAULT_DEMO_MODE;
}

function optionalUrl(value: string | undefined): string | null {
  return value ? trimTrailingSlash(value) : null;
}

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, '');
}
