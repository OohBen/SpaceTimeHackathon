// LLM orchestrator entry point.
import { fileURLToPath } from "node:url";
import path from "node:path";

import { startOrchestratorServer } from "./http_server.js";

export { ORCHESTRATOR_VERSION } from "./version.js";

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
export {
  noopTelemetryLogger,
  redactPayloadShape,
  redactSecret,
  summarizeRequest,
} from "./logging.js";
export type {
  TelemetryEvent,
  TelemetryFields,
  TelemetryLevel,
  TelemetryLogger,
} from "./logging.js";
export {
  PROPOSAL_ADVISORY_CONFIDENCE_VALUES,
  PROPOSAL_ADVISORY_LIMITS,
  PROPOSAL_ADVISORY_POLICY,
  PROPOSAL_ADVISORY_SCHEMA_VERSION,
  createProposalAdvisoryClient,
  validateProposalAdvisory,
} from "./proposal_advisory.js";
export type {
  ProposalAdvisoryClient,
  ProposalAdvisoryConfidence,
  ProposalAdvisoryFailure,
  ProposalAdvisoryFailureCategory,
  ProposalAdvisoryFallback,
  ProposalAdvisoryItem,
  ProposalAdvisoryOutcome,
  ProposalAdvisoryPayload,
  ProposalAdvisoryRepairStep,
  ProposalAdvisoryResult,
  ProposalAdvisorySuccess,
} from "./proposal_advisory.js";
export {
  LLM_MODE_PROVIDER_SCHEMA_VERSION,
  LLM_REQUEST_TYPES,
  LlmModeRequestError,
  assertRequestType,
  defaultScenarioId,
  isLlmRequestType,
  selectLlmModeProvider,
  stableContextHash,
  stableJson,
} from "./llm_mode_provider.js";
export type {
  LlmModeProvider,
  LlmModeRequest,
  LlmModeResponse,
  LlmRequestType,
  SelectLlmModeProviderDeps,
} from "./llm_mode_provider.js";
export {
  buildMockResponse,
  createMockLlmModeProvider,
} from "./mock_llm_provider.js";
export {
  FIXTURE_DEFAULT_SCENARIO_ID,
  FIXTURE_SCHEMA_VERSION,
  FixtureLookupError,
  createFixtureLlmModeProvider,
  defaultFixturePath,
  loadFixtureCatalog,
  parseFixtureCatalog,
} from "./fixture_llm_provider.js";
export type {
  FixtureCatalog,
  FixtureProviderOptions,
  FixtureScenario,
} from "./fixture_llm_provider.js";
export {
  NARRATIVE_CONTENT_LIMITS,
  NARRATIVE_PAYLOAD_SCHEMA_VERSION,
  NARRATIVE_REQUEST_CONTRACTS,
  NARRATIVE_REQUEST_TYPES,
  buildFallbackNarrativePayload,
  buildNarrativePrompt,
  validateNarrativePayload,
} from "./narrative_contract.js";
export type {
  NarrativePayload,
  NarrativePayloadMetadata,
  NarrativeRequestContract,
  NarrativeRequestType,
  NarrativeSource,
  NarrativeSurface,
  NarrativeValidationFailure,
  NarrativeValidationOutcome,
  NarrativeValidationSuccess,
} from "./narrative_contract.js";
export {
  PROPOSAL_PROMPT_LIMITS,
  buildProposalPrompt,
} from "./proposal_prompt.js";
export type {
  BodyState,
  CityState,
  FactionDoctrine,
  IntelSummary,
  OfficerTraits,
  OutstandingRequest,
  ProposalPromptInput,
  RecentEvent,
} from "./proposal_prompt.js";
export {
  buildHealthPayload,
  createOrchestratorHttpServer,
  readOrchestratorServerConfig,
  startOrchestratorServer,
} from "./http_server.js";
export type {
  OrchestratorHealthPayload,
  OrchestratorHttpServer,
  OrchestratorHttpServerHandle,
  OrchestratorServerConfig,
} from "./http_server.js";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startOrchestratorServer().catch((cause) => {
    console.error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  });
}
