import {
  DEFAULT_SPACETIME_DB_NAME,
  DEFAULT_SPACETIME_HOST,
  type LlmProviderConfig,
  readLlmProviderConfig,
} from "./openrouter_client.js";
import { ORCHESTRATOR_VERSION } from "./version.js";

export type HostedOrchestratorHealthPayload = {
  error?: string;
  frontendOrigin: string;
  mode: LlmProviderConfig["mode"] | null;
  provider: LlmProviderConfig["provider"] | null;
  spacetime: {
    dbName: string;
    host: string;
  };
  status: "ok" | "error";
  version: string;
};

export function buildOrchestratorHealthPayload(
  env: NodeJS.ProcessEnv = process.env
): HostedOrchestratorHealthPayload {
  try {
    const config = readLlmProviderConfig(env);
    return {
      frontendOrigin: env.FRONTEND_ORIGIN ?? "*",
      mode: config.mode,
      provider: config.provider,
      spacetime: config.spacetime,
      status: "ok",
      version: ORCHESTRATOR_VERSION,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      frontendOrigin: env.FRONTEND_ORIGIN ?? "*",
      mode: null,
      provider: null,
      spacetime: {
        dbName: env.SPACETIME_DB_NAME ?? DEFAULT_SPACETIME_DB_NAME,
        host: env.SPACETIME_HOST ?? DEFAULT_SPACETIME_HOST,
      },
      status: "error",
      version: ORCHESTRATOR_VERSION,
    };
  }
}
