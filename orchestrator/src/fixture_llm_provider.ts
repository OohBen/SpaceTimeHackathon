import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LLM_MODE_PROVIDER_SCHEMA_VERSION,
  LlmModeProvider,
  LlmModeRequest,
  LlmModeRequestError,
  LlmModeResponse,
  LlmRequestType,
  isLlmRequestType,
  stableJson,
} from "./llm_mode_provider.js";

export const FIXTURE_DEFAULT_SCENARIO_ID = "default";
export const FIXTURE_SCHEMA_VERSION = 1;

export type FixtureScenario = {
  request_type: LlmRequestType;
  response: unknown;
  scenario_id: string;
};

export type FixtureCatalog = {
  schema_version: number;
  scenarios: FixtureScenario[];
};

export type FixtureProviderOptions = {
  catalog: FixtureCatalog;
};

export class FixtureLookupError extends LlmModeRequestError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "FixtureLookupError";
  }
}

export function createFixtureLlmModeProvider(
  options: FixtureProviderOptions
): LlmModeProvider {
  const index = indexCatalog(options.catalog);
  return {
    mode: "fixture",
    async completeRequest(request: LlmModeRequest): Promise<LlmModeResponse> {
      return lookupResponse(index, request);
    },
  };
}

export function defaultFixturePath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "fixtures", "scenarios.json");
}

export async function loadFixtureCatalog(
  path: string,
  readFileImpl: (p: string) => Promise<string> = (p) => readFile(p, "utf8")
): Promise<FixtureCatalog> {
  let raw: string;
  try {
    raw = await readFileImpl(path);
  } catch (cause) {
    throw new FixtureLookupError(
      "fixture_file_unreadable",
      `Fixture file not readable at ${path}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    );
  }
  return parseFixtureCatalog(raw, path);
}

export function parseFixtureCatalog(raw: string, source: string): FixtureCatalog {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new FixtureLookupError(
      "fixture_file_invalid_json",
      `Fixture file ${source} is not valid JSON: ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    );
  }

  if (!isRecord(parsed)) {
    throw new FixtureLookupError(
      "fixture_file_invalid_shape",
      `Fixture file ${source} must be a JSON object`
    );
  }

  if (parsed.schema_version !== FIXTURE_SCHEMA_VERSION) {
    throw new FixtureLookupError(
      "fixture_file_schema_mismatch",
      `Fixture file ${source} schema_version must be ${FIXTURE_SCHEMA_VERSION}, received ${String(parsed.schema_version)}`
    );
  }

  if (!Array.isArray(parsed.scenarios)) {
    throw new FixtureLookupError(
      "fixture_file_missing_scenarios",
      `Fixture file ${source} must contain a scenarios array`
    );
  }

  if (parsed.scenarios.length === 0) {
    throw new FixtureLookupError(
      "fixture_file_empty_scenarios",
      `Fixture file ${source} contains no scenarios; at least one is required`
    );
  }

  const scenarios = parsed.scenarios.map((scenario, index) =>
    parseScenario(scenario, source, index)
  );

  return { schema_version: FIXTURE_SCHEMA_VERSION, scenarios };
}

function parseScenario(
  value: unknown,
  source: string,
  index: number
): FixtureScenario {
  if (!isRecord(value)) {
    throw new FixtureLookupError(
      "fixture_scenario_invalid",
      `Fixture file ${source} scenarios[${index}] must be an object`
    );
  }

  if (typeof value.request_type !== "string" || !isLlmRequestType(value.request_type)) {
    throw new FixtureLookupError(
      "fixture_scenario_invalid_request_type",
      `Fixture file ${source} scenarios[${index}] has invalid request_type`
    );
  }

  if (typeof value.scenario_id !== "string" || value.scenario_id.length === 0) {
    throw new FixtureLookupError(
      "fixture_scenario_invalid_id",
      `Fixture file ${source} scenarios[${index}] must declare a non-empty scenario_id`
    );
  }

  if (!("response" in value) || value.response === null || value.response === undefined) {
    throw new FixtureLookupError(
      "fixture_scenario_missing_response",
      `Fixture file ${source} scenarios[${index}] must declare a non-null response`
    );
  }

  return {
    request_type: value.request_type,
    response: value.response,
    scenario_id: value.scenario_id,
  };
}

type FixtureIndex = Map<string, FixtureScenario>;

function indexCatalog(catalog: FixtureCatalog): FixtureIndex {
  const index: FixtureIndex = new Map();
  for (const scenario of catalog.scenarios) {
    index.set(indexKey(scenario.request_type, scenario.scenario_id), scenario);
  }
  return index;
}

function indexKey(requestType: LlmRequestType, scenarioId: string): string {
  return `${requestType}::${scenarioId}`;
}

function lookupResponse(
  index: FixtureIndex,
  request: LlmModeRequest
): LlmModeResponse {
  const scenarioId =
    request.scenario_id && request.scenario_id.length > 0
      ? request.scenario_id
      : FIXTURE_DEFAULT_SCENARIO_ID;

  const scenario =
    index.get(indexKey(request.request_type, scenarioId)) ??
    index.get(indexKey(request.request_type, FIXTURE_DEFAULT_SCENARIO_ID));

  if (!scenario) {
    throw new FixtureLookupError(
      "fixture_scenario_not_found",
      `No fixture scenario for request_type=${request.request_type} scenario_id=${scenarioId} (and no default fallback)`
    );
  }

  return {
    faction_id: request.faction_id,
    request_type: request.request_type,
    response_json: stableJson(scenario.response),
    schema_version: LLM_MODE_PROVIDER_SCHEMA_VERSION,
    scenario_id: scenario.scenario_id,
    session_id: request.session_id,
    source: "fixture",
    turn: request.turn,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
