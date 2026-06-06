import {
  LlmTextClient,
  LlmTextRequest,
  LlmTextResponse,
  OpenRouterNetworkError,
  OpenRouterRequestError,
  OpenRouterTimeoutError,
} from "./openrouter_client.js";

export const DEFAULT_RETRY_MAX_ATTEMPTS = 3;
export const DEFAULT_RETRY_BASE_DELAY_MS = 500;
export const DEFAULT_RETRY_MAX_DELAY_MS = 8_000;
export const MAX_RETRY_MAX_ATTEMPTS = 6;

export type OpenRouterErrorCategory =
  | "auth"
  | "invalid_request"
  | "network"
  | "rate_limited"
  | "server_error"
  | "timeout"
  | "unknown";

const TRANSIENT_CATEGORIES = new Set<OpenRouterErrorCategory>([
  "network",
  "rate_limited",
  "server_error",
  "timeout",
]);

export function isTransientCategory(
  category: OpenRouterErrorCategory
): boolean {
  return TRANSIENT_CATEGORIES.has(category);
}

export function classifyOpenRouterError(
  error: unknown
): OpenRouterErrorCategory {
  if (error instanceof OpenRouterTimeoutError) {
    return "timeout";
  }
  if (error instanceof OpenRouterNetworkError) {
    return "network";
  }
  if (error instanceof OpenRouterRequestError) {
    const status = error.status;
    if (status === 429) {
      return "rate_limited";
    }
    if (status >= 500 && status <= 599) {
      return "server_error";
    }
    if (status === 401 || status === 403) {
      return "auth";
    }
    if (status >= 400 && status <= 499) {
      return "invalid_request";
    }
    return "unknown";
  }
  return "unknown";
}

export class OpenRouterReliabilityError extends Error {
  public readonly provider = "openrouter";

  constructor(
    public readonly category: OpenRouterErrorCategory,
    public readonly attempts: number,
    public readonly lastError: unknown
  ) {
    super(
      `OpenRouter request gave up after ${attempts} attempt(s) (${category}): ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
    this.name = "OpenRouterReliabilityError";
  }
}

export type ReliabilityOptions = {
  baseDelayMs?: number;
  maxAttempts?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

type NormalizedReliabilityOptions = {
  baseDelayMs: number;
  maxAttempts: number;
  maxDelayMs: number;
  sleep: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function normalizeReliabilityOptions(
  options: ReliabilityOptions | undefined
): NormalizedReliabilityOptions {
  const maxAttempts = Math.min(
    Math.max(options?.maxAttempts ?? DEFAULT_RETRY_MAX_ATTEMPTS, 1),
    MAX_RETRY_MAX_ATTEMPTS
  );
  const baseDelayMs = Math.max(
    options?.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
    0
  );
  const maxDelayMs = Math.max(
    options?.maxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS,
    baseDelayMs
  );
  return {
    baseDelayMs,
    maxAttempts,
    maxDelayMs,
    sleep: options?.sleep ?? defaultSleep,
  };
}

export function computeBackoffMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  if (attempt <= 1) {
    return 0;
  }
  const exponent = attempt - 2;
  const raw = baseDelayMs * 2 ** exponent;
  return Math.min(Math.max(raw, 0), maxDelayMs);
}

export function withReliability(
  client: LlmTextClient,
  options?: ReliabilityOptions
): LlmTextClient {
  const settings = normalizeReliabilityOptions(options);

  return {
    async completeText(request: LlmTextRequest): Promise<LlmTextResponse> {
      let lastError: unknown;
      let lastCategory: OpenRouterErrorCategory = "unknown";

      for (let attempt = 1; attempt <= settings.maxAttempts; attempt += 1) {
        if (attempt > 1) {
          const delay = computeBackoffMs(
            attempt,
            settings.baseDelayMs,
            settings.maxDelayMs
          );
          if (delay > 0) {
            await settings.sleep(delay);
          }
        }

        try {
          return await client.completeText(request);
        } catch (error) {
          lastError = error;
          lastCategory = classifyOpenRouterError(error);
          if (!isTransientCategory(lastCategory)) {
            throw new OpenRouterReliabilityError(
              lastCategory,
              attempt,
              error
            );
          }
        }
      }

      throw new OpenRouterReliabilityError(
        lastCategory,
        settings.maxAttempts,
        lastError
      );
    },
  };
}
