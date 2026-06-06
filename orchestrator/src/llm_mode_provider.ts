import type {
  LlmProviderConfig,
  LlmProviderMode,
} from "./openrouter_client.js";

export const LLM_REQUEST_TYPES = [
  "proposals",
  "inbox",
  "event_narrative",
  "resume_briefing",
] as const;

export type LlmRequestType = (typeof LLM_REQUEST_TYPES)[number];

export const LLM_MODE_PROVIDER_SCHEMA_VERSION = 1;

export type LlmModeRequest = {
  context: unknown;
  faction_id: number;
  request_type: LlmRequestType;
  scenario_id?: string;
  session_id: number;
  turn: number;
};

export type LlmModeResponse = {
  faction_id: number;
  request_type: LlmRequestType;
  response_json: string;
  schema_version: number;
  scenario_id: string;
  session_id: number;
  source: LlmProviderMode;
  turn: number;
};

export type LlmModeProvider = {
  completeRequest(request: LlmModeRequest): Promise<LlmModeResponse>;
  mode: LlmProviderMode;
};

export class LlmModeRequestError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "LlmModeRequestError";
  }
}

export function assertRequestType(value: unknown): LlmRequestType {
  if (typeof value !== "string") {
    throw new LlmModeRequestError(
      "request_type_invalid",
      `request_type must be a string, received ${typeof value}`
    );
  }
  if (!isLlmRequestType(value)) {
    throw new LlmModeRequestError(
      "request_type_invalid",
      `request_type must be one of ${LLM_REQUEST_TYPES.join(", ")}`
    );
  }
  return value;
}

export function isLlmRequestType(value: string): value is LlmRequestType {
  return (LLM_REQUEST_TYPES as readonly string[]).includes(value);
}

export function defaultScenarioId(request: LlmModeRequest): string {
  if (request.scenario_id) {
    return request.scenario_id;
  }
  return `${request.request_type}/turn-${request.turn}/faction-${request.faction_id}`;
}

export function stableContextHash(value: unknown): number {
  const json = stableJson(value);
  let hash = 2166136261;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)])
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type SelectLlmModeProviderDeps = {
  createFixtureProvider: (
    config: Extract<LlmProviderConfig, { mode: "fixture" }>
  ) => LlmModeProvider;
  createLiveProvider: (
    config: Extract<LlmProviderConfig, { mode: "live" }>
  ) => LlmModeProvider;
  createMockProvider: (
    config: Extract<LlmProviderConfig, { mode: "mock" }>
  ) => LlmModeProvider;
};

export function selectLlmModeProvider(
  config: LlmProviderConfig,
  deps: SelectLlmModeProviderDeps
): LlmModeProvider {
  if (config.mode === "mock") {
    return deps.createMockProvider(config);
  }
  if (config.mode === "fixture") {
    return deps.createFixtureProvider(config);
  }
  return deps.createLiveProvider(config);
}
