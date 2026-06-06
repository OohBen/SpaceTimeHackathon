export type RuntimeConfig = {
  spacetimeHost: string;
  spacetimeDb: string;
};

type RuntimeEnv = {
  VITE_SPACETIME_HOST?: string;
  VITE_SPACETIME_DB_NAME?: string;
};

export function getRuntimeConfig(env: RuntimeEnv): RuntimeConfig {
  return {
    spacetimeHost: env.VITE_SPACETIME_HOST ?? 'ws://localhost:3000',
    spacetimeDb: env.VITE_SPACETIME_DB_NAME ?? 'solar_dominion',
  };
}

export const runtimeConfig = getRuntimeConfig({
  VITE_SPACETIME_HOST: import.meta.env.VITE_SPACETIME_HOST,
  VITE_SPACETIME_DB_NAME: import.meta.env.VITE_SPACETIME_DB_NAME,
});
