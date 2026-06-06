export interface ClientConfig {
  host: string;
  dbName: string;
}

export function defaultClientConfig(): ClientConfig {
  return {
    host: import.meta.env?.VITE_SPACETIME_HOST ?? 'ws://localhost:3000',
    dbName: import.meta.env?.VITE_SPACETIME_DB_NAME ?? 'solar-dominion',
  };
}

export function createClientConfig(overrides: Partial<ClientConfig> = {}): ClientConfig {
  return { ...defaultClientConfig(), ...overrides };
}
