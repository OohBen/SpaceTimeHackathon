export interface ClientConfig {
  host: string;
  dbName: string;
}

export interface ClientDiagnostics {
  host: string;
  dbName: string;
  issues: string[];
}

export function defaultClientConfig(): ClientConfig {
  return {
    host: normalizeSpacetimeHost(import.meta.env?.VITE_SPACETIME_HOST ?? 'ws://localhost:3000'),
    dbName: import.meta.env?.VITE_SPACETIME_DB_NAME ?? 'solar-dominion',
  };
}

export function createClientConfig(overrides: Partial<ClientConfig> = {}): ClientConfig {
  const config = { ...defaultClientConfig(), ...overrides };
  return {
    host: normalizeSpacetimeHost(config.host),
    dbName: config.dbName,
  };
}

export function normalizeSpacetimeHost(host: string): string {
  const trimmedHost = host.trim();
  if (trimmedHost.startsWith('http://')) {
    return `ws://${trimmedHost.slice('http://'.length)}`;
  }
  if (trimmedHost.startsWith('https://')) {
    return `wss://${trimmedHost.slice('https://'.length)}`;
  }
  return trimmedHost;
}

export function buildClientDiagnostics(config: ClientConfig): ClientDiagnostics {
  const host = normalizeSpacetimeHost(config.host);
  const dbName = config.dbName.trim();
  const issues: string[] = [];

  if (!host) {
    issues.push(
      'VITE_SPACETIME_HOST is empty; set it to ws://localhost:3000 for local SpacetimeDB.',
    );
  } else if (!host.startsWith('ws://') && !host.startsWith('wss://')) {
    issues.push('VITE_SPACETIME_HOST must start with ws:// or wss:// for browser connections.');
  }

  if (!dbName) {
    issues.push(
      'VITE_SPACETIME_DB_NAME is empty; publish or target the solar-dominion database.',
    );
  }

  return {
    host,
    dbName,
    issues,
  };
}
