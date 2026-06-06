// LLM orchestrator entry point.
// HTTP endpoints for processing LLM requests are added in subsequent tasks.
export const ORCHESTRATOR_VERSION = "0.0.0";

export {
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_SPACETIME_DB_NAME,
  DEFAULT_SPACETIME_HOST,
  OPENROUTER_BASE_URL,
  OpenRouterConfigError,
  OpenRouterRequestError,
  createOpenRouterClient,
  readLlmProviderConfig,
} from "./openrouter_client.js";
export type {
  FetchLike,
  FixtureLlmProviderConfig,
  LiveLlmProviderConfig,
  LlmProviderConfig,
  LlmProviderMode,
  LlmTextClient,
  LlmTextRequest,
  LlmTextResponse,
  MockLlmProviderConfig,
  OpenRouterConfig,
  SpacetimeConfig,
} from "./openrouter_client.js";
