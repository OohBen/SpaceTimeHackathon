import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_SPACETIME_DB_NAME,
  DEFAULT_SPACETIME_HOST,
  readLlmProviderConfig,
  type LlmProviderConfig,
} from "./openrouter_client.js";

// LLM orchestrator entry point.
export const ORCHESTRATOR_VERSION = "0.0.0";

export interface OrchestratorHealthPayload {
  error?: string;
  frontendOrigin: string;
  mode: LlmProviderConfig["mode"] | null;
  provider: LlmProviderConfig["provider"] | null;
  spacetime: {
    dbName: string;
    host: string;
  };
  status: "error" | "ok";
  version: string;
}

export interface OrchestratorServerOptions {
  env?: NodeJS.ProcessEnv;
  host?: string;
  port?: number;
}

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

export function buildOrchestratorHealthPayload(
  env: NodeJS.ProcessEnv = process.env
): OrchestratorHealthPayload {
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
      error: errorMessage(error),
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

export function startOrchestratorServer(
  options: OrchestratorServerOptions = {}
): Server {
  const env = options.env ?? process.env;
  const port = options.port ?? readPort(env.PORT);
  const host = options.host ?? env.HOST ?? "0.0.0.0";
  const server = createServer((req, res) => handleRequest(req, res, env));

  server.listen(port, host, () => {
    console.log(`orchestrator listening on http://${host}:${port}`);
  });

  return server;
}

function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  env: NodeJS.ProcessEnv
): void {
  applyCors(res, env.FRONTEND_ORIGIN);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    const payload = buildOrchestratorHealthPayload(env);
    writeJson(res, payload.status === "ok" ? 200 : 500, payload);
    return;
  }

  writeJson(res, 404, {
    error: "not_found",
    message: "Supported endpoints: GET /health",
  });
}

function applyCors(res: ServerResponse, frontendOrigin: string | undefined): void {
  res.setHeader("access-control-allow-origin", frontendOrigin ?? "*");
  res.setHeader("access-control-allow-methods", "GET, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("vary", "origin");
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readPort(value: string | undefined): number {
  const parsed = Number(value ?? "4000");
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535");
  }
  return parsed;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isDirectRun(argv = process.argv, moduleUrl = import.meta.url): boolean {
  const entrypoint = argv[1];
  return Boolean(entrypoint && pathToFileURL(entrypoint).href === moduleUrl);
}

if (isDirectRun()) {
  startOrchestratorServer();
}
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
