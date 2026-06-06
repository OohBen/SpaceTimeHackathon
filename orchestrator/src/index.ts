// LLM orchestrator entry point.
// HTTP endpoints for processing LLM requests are added in subsequent tasks.
export const ORCHESTRATOR_VERSION = "0.0.0";

export {
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_OPENROUTER_TIMEOUT_MS,
  DEFAULT_SPACETIME_DB_NAME,
  DEFAULT_SPACETIME_HOST,
  MAX_OPENROUTER_TIMEOUT_MS,
  OPENROUTER_BASE_URL,
  OpenRouterConfigError,
  OpenRouterNetworkError,
  OpenRouterRequestError,
  OpenRouterTimeoutError,
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
export {
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_RETRY_MAX_ATTEMPTS,
  DEFAULT_RETRY_MAX_DELAY_MS,
  MAX_RETRY_MAX_ATTEMPTS,
  OpenRouterReliabilityError,
  classifyOpenRouterError,
  computeBackoffMs,
  isTransientCategory,
  withReliability,
} from "./llm_reliability.js";
export type {
  OpenRouterErrorCategory,
  ReliabilityOptions,
} from "./llm_reliability.js";
