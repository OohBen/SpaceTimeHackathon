export type RuntimeConfig = {
  spacetimeHost: string;
  spacetimeDb: string;
};

type RuntimeEnv = {
  VITE_SPACETIME_HOST?: string;
  VITE_SPACETIME_DB?: string;
};

export function getRuntimeConfig(env: RuntimeEnv): RuntimeConfig {
  return {
    spacetimeHost: env.VITE_SPACETIME_HOST ?? 'ws://localhost:3000',
    spacetimeDb: env.VITE_SPACETIME_DB ?? 'solar_dominion',
  };
}

export const runtimeConfig = getRuntimeConfig(import.meta.env);
