export const DEFAULT_OPENROUTER_MODEL = "inception/mercury-2";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_SPACETIME_HOST = "http://localhost:3000";
export const DEFAULT_SPACETIME_DB_NAME = "solar-dominion";

export const DEFAULT_OPENROUTER_TIMEOUT_MS = 30_000;
export const MAX_OPENROUTER_TIMEOUT_MS = 120_000;

type EnvRecord = Record<string, string | undefined>;

export type LlmProviderMode = "live" | "mock" | "fixture";

export type SpacetimeConfig = {
  dbName: string;
  host: string;
};

export type OpenRouterConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
};

export type LiveLlmProviderConfig = {
  mode: "live";
  openRouter: OpenRouterConfig;
  provider: "openrouter";
  spacetime: SpacetimeConfig;
};

export type MockLlmProviderConfig = {
  mode: "mock";
  provider: "mock";
  spacetime: SpacetimeConfig;
};

export type FixtureLlmProviderConfig = {
  fixturePath?: string;
  mode: "fixture";
  provider: "fixture";
  spacetime: SpacetimeConfig;
};

export type LlmProviderConfig =
  | FixtureLlmProviderConfig
  | LiveLlmProviderConfig
  | MockLlmProviderConfig;

export type LlmTextRequest = {
  maxTokens?: number;
  prompt: string;
  responseFormat?: "json_object" | "text";
  system: string;
  temperature?: number;
};

export type LlmTextResponse = {
  content: string;
  model: string;
  provider: "openrouter";
  raw: unknown;
};

export type LlmTextClient = {
  completeText(request: LlmTextRequest): Promise<LlmTextResponse>;
};

type FetchRequestInit = {
  body: string;
  headers: Record<string, string>;
  method: "POST";
  signal?: AbortSignal;
};

export type FetchLike = (
  url: string,
  init: FetchRequestInit
) => Promise<Response>;

export class OpenRouterConfigError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "OpenRouterConfigError";
  }
}

export class OpenRouterRequestError extends Error {
  public readonly provider = "openrouter";

  constructor(public readonly status: number, detail: string) {
    super(`OpenRouter request failed with ${status}: ${detail}`);
    this.name = "OpenRouterRequestError";
  }
}

export class OpenRouterTimeoutError extends Error {
  public readonly provider = "openrouter";

  constructor(public readonly timeoutMs: number) {
    super(`OpenRouter request timed out after ${timeoutMs}ms`);
    this.name = "OpenRouterTimeoutError";
  }
}

export class OpenRouterNetworkError extends Error {
  public readonly provider = "openrouter";

  constructor(public readonly cause: unknown) {
    super(
      `OpenRouter transport failure: ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    );
    this.name = "OpenRouterNetworkError";
  }
}

export function readLlmProviderConfig(
  env: EnvRecord = process.env
): LlmProviderConfig {
  const mode = readOptional(env.LLM_MODE) ?? "mock";
  const spacetime = readSpacetimeConfig(env);

  if (mode === "mock") {
    return { mode, provider: "mock", spacetime };
  }

  if (mode === "fixture") {
    const fixturePath = readOptional(env.LLM_FIXTURE_PATH);
    return fixturePath
      ? { fixturePath, mode, provider: "fixture", spacetime }
      : { mode, provider: "fixture", spacetime };
  }

  if (mode === "live") {
    return {
      mode,
      openRouter: readOpenRouterConfig(env),
      provider: "openrouter",
      spacetime,
    };
  }

  throw new OpenRouterConfigError(
    "llm_mode_invalid",
    "LLM_MODE must be one of: live, mock, fixture"
  );
}

export function createOpenRouterClient(
  config: OpenRouterConfig,
  deps: { fetch?: FetchLike } = {}
): LlmTextClient {
  const fetchImpl = deps.fetch ?? fetch;
  const normalizedConfig = normalizeOpenRouterConfig(config);

  return {
    async completeText(request) {
      const controller = new AbortController();
      const timeoutMs = normalizedConfig.timeoutMs ?? DEFAULT_OPENROUTER_TIMEOUT_MS;
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetchImpl(
          `${normalizedConfig.baseUrl}/chat/completions`,
          {
            body: JSON.stringify(
              toOpenRouterChatRequest(normalizedConfig, request)
            ),
            headers: {
              authorization: `Bearer ${normalizedConfig.apiKey}`,
              "content-type": "application/json",
            },
            method: "POST",
            signal: controller.signal,
          }
        );
      } catch (cause) {
        if (controller.signal.aborted) {
          throw new OpenRouterTimeoutError(timeoutMs);
        }
        throw new OpenRouterNetworkError(cause);
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        throw new OpenRouterRequestError(
          response.status,
          await readProviderError(response)
        );
      }

      const raw = await response.json();
      return {
        content: readCompletionContent(raw),
        model: readResponseModel(raw, normalizedConfig.model),
        provider: "openrouter",
        raw,
      };
    },
  };
}

function readOpenRouterConfig(env: EnvRecord): OpenRouterConfig {
  return normalizeOpenRouterConfig({
    apiKey: readRequiredLiveValue(
      env.OPENROUTER_API_KEY,
      "openrouter_api_key_missing",
      "OPENROUTER_API_KEY is required when LLM_MODE=live"
    ),
    baseUrl: readOptional(env.OPENROUTER_BASE_URL) ?? OPENROUTER_BASE_URL,
    model: readOptional(env.OPENROUTER_MODEL) ?? DEFAULT_OPENROUTER_MODEL,
    timeoutMs: readTimeoutMs(env.OPENROUTER_TIMEOUT_MS),
  });
}

function normalizeOpenRouterConfig(config: OpenRouterConfig): OpenRouterConfig {
  return {
    apiKey: readRequiredLiveValue(
      config.apiKey,
      "openrouter_api_key_missing",
      "OPENROUTER_API_KEY is required when LLM_MODE=live"
    ),
    baseUrl: normalizeBaseUrl(config.baseUrl),
    model: readRequiredLiveValue(
      config.model,
      "openrouter_model_missing",
      "OPENROUTER_MODEL must not be blank"
    ),
    timeoutMs: normalizeTimeoutMs(config.timeoutMs),
  };
}

function readTimeoutMs(value: string | undefined): number | undefined {
  const trimmed = readOptional(value);
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new OpenRouterConfigError(
      "openrouter_timeout_invalid",
      `OPENROUTER_TIMEOUT_MS must be a positive integer <= ${MAX_OPENROUTER_TIMEOUT_MS}`
    );
  }
  return normalizeTimeoutMs(parsed);
}

function normalizeTimeoutMs(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(value) || value <= 0 || value > MAX_OPENROUTER_TIMEOUT_MS) {
    throw new OpenRouterConfigError(
      "openrouter_timeout_invalid",
      `OPENROUTER_TIMEOUT_MS must be a positive integer <= ${MAX_OPENROUTER_TIMEOUT_MS}`
    );
  }
  return value;
}

function readSpacetimeConfig(env: EnvRecord): SpacetimeConfig {
  return {
    dbName: readOptional(env.SPACETIME_DB_NAME) ?? DEFAULT_SPACETIME_DB_NAME,
    host: readOptional(env.SPACETIME_HOST) ?? DEFAULT_SPACETIME_HOST,
  };
}

function toOpenRouterChatRequest(
  config: OpenRouterConfig,
  request: LlmTextRequest
): Record<string, unknown> {
  return omitUndefined({
    max_tokens: request.maxTokens,
    messages: [
      { content: request.system, role: "system" },
      { content: request.prompt, role: "user" },
    ],
    model: config.model,
    response_format:
      request.responseFormat === "json_object"
        ? { type: "json_object" }
        : undefined,
    temperature: request.temperature,
  });
}

function readOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readRequiredLiveValue(
  value: string | undefined,
  code: string,
  message: string
): string {
  const trimmed = readOptional(value);
  if (!trimmed) {
    throw new OpenRouterConfigError(code, message);
  }
  return trimmed;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = readRequiredLiveValue(
    value,
    "openrouter_base_url_invalid",
    "OPENROUTER_BASE_URL must be a valid absolute URL"
  );

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    return parsed.href.replace(/\/+$/, "");
  } catch {
    throw new OpenRouterConfigError(
      "openrouter_base_url_invalid",
      "OPENROUTER_BASE_URL must be a valid absolute URL"
    );
  }
}

function omitUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  );
}

async function readProviderError(response: Response): Promise<string> {
  const body = await response.text();
  if (!body) {
    return response.statusText || "provider error";
  }

  try {
    const parsed = JSON.parse(body) as unknown;
    if (
      isRecord(parsed) &&
      isRecord(parsed.error) &&
      typeof parsed.error.message === "string"
    ) {
      return parsed.error.message;
    }
    if (isRecord(parsed) && typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch {
    // Fall through to raw body.
  }

  return body;
}

function readCompletionContent(raw: unknown): string {
  if (!isRecord(raw) || !Array.isArray(raw.choices)) {
    throw new OpenRouterRequestError(
      200,
      "OpenRouter response missing choices"
    );
  }

  const first = raw.choices[0] as unknown;
  if (
    !isRecord(first) ||
    !isRecord(first.message) ||
    typeof first.message.content !== "string"
  ) {
    throw new OpenRouterRequestError(
      200,
      "OpenRouter response missing choices[0].message.content"
    );
  }

  return first.message.content;
}

function readResponseModel(raw: unknown, fallback: string): string {
  return isRecord(raw) && typeof raw.model === "string" ? raw.model : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
