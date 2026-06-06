import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_OPENROUTER_TIMEOUT_MS,
  MAX_OPENROUTER_TIMEOUT_MS,
  OPENROUTER_BASE_URL,
  OpenRouterConfigError,
  OpenRouterNetworkError,
  OpenRouterRequestError,
  OpenRouterTimeoutError,
  createOpenRouterClient,
  readLlmProviderConfig,
} from "./openrouter_client.js";
import {
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
import type { LlmTextClient } from "./openrouter_client.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function okCompletion(): Response {
  return jsonResponse({
    choices: [{ message: { content: "ok" } }],
    model: DEFAULT_OPENROUTER_MODEL,
  });
}

const baseConfig = {
  apiKey: "sk-live",
  baseUrl: OPENROUTER_BASE_URL,
  model: DEFAULT_OPENROUTER_MODEL,
} as const;

describe("timeout enforcement", () => {
  it("documents a bounded upper limit", () => {
    expect(DEFAULT_OPENROUTER_TIMEOUT_MS).toBeGreaterThan(0);
    expect(DEFAULT_OPENROUTER_TIMEOUT_MS).toBeLessThanOrEqual(
      MAX_OPENROUTER_TIMEOUT_MS
    );
    expect(MAX_OPENROUTER_TIMEOUT_MS).toBe(120_000);
  });

  it("rejects out-of-band timeout config from env", () => {
    expect(() =>
      readLlmProviderConfig({
        LLM_MODE: "live",
        OPENROUTER_API_KEY: "sk-live",
        OPENROUTER_TIMEOUT_MS: "0",
      })
    ).toThrow(OpenRouterConfigError);

    expect(() =>
      readLlmProviderConfig({
        LLM_MODE: "live",
        OPENROUTER_API_KEY: "sk-live",
        OPENROUTER_TIMEOUT_MS: String(MAX_OPENROUTER_TIMEOUT_MS + 1),
      })
    ).toThrow(OpenRouterConfigError);

    expect(() =>
      readLlmProviderConfig({
        LLM_MODE: "live",
        OPENROUTER_API_KEY: "sk-live",
        OPENROUTER_TIMEOUT_MS: "abc",
      })
    ).toThrow(OpenRouterConfigError);
  });

  it("accepts in-band timeout config from env", () => {
    const config = readLlmProviderConfig({
      LLM_MODE: "live",
      OPENROUTER_API_KEY: "sk-live",
      OPENROUTER_TIMEOUT_MS: "5000",
    });
    expect(config).toMatchObject({
      mode: "live",
      openRouter: { timeoutMs: 5000 },
    });
  });

  it("aborts fetch and surfaces OpenRouterTimeoutError when the timeout elapses", async () => {
    const client = createOpenRouterClient(
      { ...baseConfig, timeoutMs: 25 },
      {
        fetch: (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      }
    );

    await expect(
      client.completeText({ prompt: "p", system: "s" })
    ).rejects.toMatchObject({
      name: "OpenRouterTimeoutError",
      timeoutMs: 25,
    });
  });

  it("classifies non-abort transport failures as network errors", async () => {
    const client = createOpenRouterClient(baseConfig, {
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });

    await expect(
      client.completeText({ prompt: "p", system: "s" })
    ).rejects.toBeInstanceOf(OpenRouterNetworkError);
  });
});

describe("error classification", () => {
  it("returns stable categories for each known failure mode", () => {
    expect(classifyOpenRouterError(new OpenRouterTimeoutError(1000))).toBe(
      "timeout"
    );
    expect(
      classifyOpenRouterError(new OpenRouterNetworkError(new Error("x")))
    ).toBe("network");
    expect(
      classifyOpenRouterError(new OpenRouterRequestError(429, "limit"))
    ).toBe("rate_limited");
    expect(
      classifyOpenRouterError(new OpenRouterRequestError(500, "boom"))
    ).toBe("server_error");
    expect(
      classifyOpenRouterError(new OpenRouterRequestError(503, "down"))
    ).toBe("server_error");
    expect(
      classifyOpenRouterError(new OpenRouterRequestError(401, "no"))
    ).toBe("auth");
    expect(
      classifyOpenRouterError(new OpenRouterRequestError(403, "no"))
    ).toBe("auth");
    expect(
      classifyOpenRouterError(new OpenRouterRequestError(400, "bad"))
    ).toBe("invalid_request");
    expect(
      classifyOpenRouterError(new OpenRouterRequestError(404, "miss"))
    ).toBe("invalid_request");
    expect(classifyOpenRouterError(new Error("nope"))).toBe("unknown");
  });

  it("partitions categories into transient vs terminal", () => {
    expect(isTransientCategory("timeout")).toBe(true);
    expect(isTransientCategory("network")).toBe(true);
    expect(isTransientCategory("rate_limited")).toBe(true);
    expect(isTransientCategory("server_error")).toBe(true);
    expect(isTransientCategory("auth")).toBe(false);
    expect(isTransientCategory("invalid_request")).toBe(false);
    expect(isTransientCategory("unknown")).toBe(false);
  });
});

describe("retry policy", () => {
  it("uses deterministic exponential backoff without random jitter", () => {
    expect(computeBackoffMs(1, 500, 8000)).toBe(0);
    expect(computeBackoffMs(2, 500, 8000)).toBe(500);
    expect(computeBackoffMs(3, 500, 8000)).toBe(1000);
    expect(computeBackoffMs(4, 500, 8000)).toBe(2000);
    expect(computeBackoffMs(10, 500, 8000)).toBe(8000);

    const sequence = Array.from({ length: 5 }, (_, idx) =>
      computeBackoffMs(idx + 1, 500, 8000)
    );
    const repeat = Array.from({ length: 5 }, (_, idx) =>
      computeBackoffMs(idx + 1, 500, 8000)
    );
    expect(sequence).toEqual(repeat);
  });

  it("documents default retry bounds", () => {
    expect(DEFAULT_RETRY_MAX_ATTEMPTS).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_RETRY_MAX_ATTEMPTS).toBeLessThanOrEqual(
      MAX_RETRY_MAX_ATTEMPTS
    );
    expect(DEFAULT_RETRY_BASE_DELAY_MS).toBeGreaterThan(0);
    expect(DEFAULT_RETRY_MAX_DELAY_MS).toBeGreaterThanOrEqual(
      DEFAULT_RETRY_BASE_DELAY_MS
    );
  });

  it("retries transient categories up to the configured attempt count", async () => {
    const upstream = vi
      .fn<LlmTextClient["completeText"]>()
      .mockRejectedValueOnce(new OpenRouterRequestError(503, "down"))
      .mockRejectedValueOnce(new OpenRouterRequestError(429, "limit"))
      .mockResolvedValueOnce({
        content: "ok",
        model: DEFAULT_OPENROUTER_MODEL,
        provider: "openrouter",
        raw: {},
      });

    const sleep = vi.fn().mockResolvedValue(undefined);
    const wrapped = withReliability(
      { completeText: upstream },
      {
        baseDelayMs: 10,
        maxAttempts: 3,
        maxDelayMs: 100,
        sleep,
      }
    );

    const result = await wrapped.completeText({ prompt: "p", system: "s" });
    expect(result.content).toBe("ok");
    expect(upstream).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls[0][0]).toBe(10);
    expect(sleep.mock.calls[1][0]).toBe(20);
  });

  it("stops immediately on terminal categories", async () => {
    const upstream = vi
      .fn<LlmTextClient["completeText"]>()
      .mockRejectedValue(new OpenRouterRequestError(401, "unauthorized"));

    const sleep = vi.fn();
    const wrapped = withReliability(
      { completeText: upstream },
      { baseDelayMs: 10, maxAttempts: 5, maxDelayMs: 100, sleep }
    );

    await expect(
      wrapped.completeText({ prompt: "p", system: "s" })
    ).rejects.toMatchObject({
      name: "OpenRouterReliabilityError",
      category: "auth",
      attempts: 1,
    });
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("surfaces a reliability error after exhausting transient attempts", async () => {
    const upstream = vi
      .fn<LlmTextClient["completeText"]>()
      .mockRejectedValue(new OpenRouterTimeoutError(1000));

    const sleep = vi.fn().mockResolvedValue(undefined);
    const wrapped = withReliability(
      { completeText: upstream },
      { baseDelayMs: 10, maxAttempts: 3, maxDelayMs: 100, sleep }
    );

    await expect(
      wrapped.completeText({ prompt: "p", system: "s" })
    ).rejects.toMatchObject({
      name: "OpenRouterReliabilityError",
      category: "timeout",
      attempts: 3,
    });
    expect(upstream).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("never introduces non-deterministic primitives", async () => {
    const randomSpy = vi.spyOn(Math, "random");
    const dateSpy = vi.spyOn(Date, "now");

    const upstream = vi
      .fn<LlmTextClient["completeText"]>()
      .mockRejectedValueOnce(new OpenRouterRequestError(500, "boom"))
      .mockResolvedValueOnce({
        content: "ok",
        model: DEFAULT_OPENROUTER_MODEL,
        provider: "openrouter",
        raw: {},
      });

    const wrapped = withReliability(
      { completeText: upstream },
      {
        baseDelayMs: 5,
        maxAttempts: 2,
        maxDelayMs: 50,
        sleep: async () => undefined,
      }
    );

    await wrapped.completeText({ prompt: "p", system: "s" });
    expect(randomSpy).not.toHaveBeenCalled();
    expect(dateSpy).not.toHaveBeenCalled();

    randomSpy.mockRestore();
    dateSpy.mockRestore();
  });

  it("never leaks retry metadata into the response content stream", async () => {
    const upstream = vi
      .fn<LlmTextClient["completeText"]>()
      .mockRejectedValueOnce(new OpenRouterRequestError(503, "down"))
      .mockResolvedValueOnce({
        content: "ok",
        model: DEFAULT_OPENROUTER_MODEL,
        provider: "openrouter",
        raw: { choices: [{ message: { content: "ok" } }] },
      });

    const wrapped = withReliability(
      { completeText: upstream },
      {
        baseDelayMs: 0,
        maxAttempts: 2,
        maxDelayMs: 0,
        sleep: async () => undefined,
      }
    );

    const result = await wrapped.completeText({ prompt: "p", system: "s" });

    expect(Object.keys(result).sort()).toEqual([
      "content",
      "model",
      "provider",
      "raw",
    ]);
    expect(result.content).toBe("ok");
  });

  it("wraps real client end-to-end with retries and recovery", async () => {
    let calls = 0;
    const client = createOpenRouterClient(baseConfig, {
      fetch: async () => {
        calls += 1;
        if (calls < 2) {
          return new Response("server boom", { status: 502 });
        }
        return okCompletion();
      },
    });

    const wrapped = withReliability(client, {
      baseDelayMs: 0,
      maxAttempts: 3,
      maxDelayMs: 0,
      sleep: async () => undefined,
    });

    const result = await wrapped.completeText({ prompt: "p", system: "s" });
    expect(result.content).toBe("ok");
    expect(calls).toBe(2);
  });
});

describe("provider unavailable end-to-end", () => {
  it("surfaces a deterministic reliability error when the provider is unavailable", async () => {
    let calls = 0;
    const client = createOpenRouterClient(baseConfig, {
      fetch: async () => {
        calls += 1;
        throw new TypeError("ECONNREFUSED");
      },
    });

    const wrapped = withReliability(client, {
      baseDelayMs: 0,
      maxAttempts: 3,
      maxDelayMs: 0,
      sleep: async () => undefined,
    });

    await expect(
      wrapped.completeText({ prompt: "p", system: "s" })
    ).rejects.toMatchObject({
      attempts: 3,
      category: "network",
      name: "OpenRouterReliabilityError",
    });
    expect(calls).toBe(3);
  });
});

describe("OpenRouterReliabilityError", () => {
  it("preserves category, attempts, and last underlying error", () => {
    const root = new OpenRouterTimeoutError(123);
    const err = new OpenRouterReliabilityError("timeout", 4, root);
    expect(err.category).toBe("timeout");
    expect(err.attempts).toBe(4);
    expect(err.lastError).toBe(root);
    expect(err.provider).toBe("openrouter");
  });
});
