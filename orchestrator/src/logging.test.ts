import { describe, expect, it } from "vitest";
import {
  TelemetryEvent,
  TelemetryLogger,
  noopTelemetryLogger,
  redactPayloadShape,
  redactSecret,
  summarizeRequest,
} from "./logging.js";
import {
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_BASE_URL,
  createOpenRouterClient,
} from "./openrouter_client.js";
import { withReliability } from "./llm_reliability.js";

function captureLogger(): {
  events: TelemetryEvent[];
  logger: TelemetryLogger;
} {
  const events: TelemetryEvent[] = [];
  return {
    events,
    logger: { log: (event) => events.push(event) },
  };
}

function flatten(value: unknown): string {
  return JSON.stringify(value);
}

const liveApiKey = "test-openrouter-key-value";
const liveSystem = "Return JSON only. Internal-only chain-of-thought hint.";
const livePrompt = "Generate proposals using classified faction roster.";

describe("redactSecret", () => {
  it("masks long secrets with head + tail markers", () => {
    expect(redactSecret(liveApiKey)).toBe("tes***ue");
  });

  it("masks short secrets to placeholder only", () => {
    expect(redactSecret("abc")).toBe("***");
  });

  it("handles missing or blank values explicitly", () => {
    expect(redactSecret(undefined)).toBe("<missing>");
    expect(redactSecret(null)).toBe("<missing>");
    expect(redactSecret("   ")).toBe("<missing>");
  });
});

describe("redactPayloadShape", () => {
  it("summarizes strings by length without exposing content", () => {
    expect(redactPayloadShape("classified prompt")).toBe("<string:17>");
  });

  it("summarizes arrays and objects by size", () => {
    expect(redactPayloadShape([1, 2, 3])).toBe("<array:3>");
    expect(redactPayloadShape({ a: 1, b: 2 })).toBe("<object:2>");
  });
});

describe("summarizeRequest", () => {
  it("never logs raw prompt or system content", () => {
    const fields = summarizeRequest({
      maxTokens: 500,
      prompt: livePrompt,
      responseFormat: "json_object",
      system: liveSystem,
      temperature: 0.1,
    });
    const blob = flatten(fields);
    expect(blob).not.toContain("classified");
    expect(blob).not.toContain("chain-of-thought");
    expect(fields.prompt).toBe(`<string:${livePrompt.length}>`);
    expect(fields.system).toBe(`<string:${liveSystem.length}>`);
    expect(fields.max_tokens).toBe(500);
  });
});

describe("noopTelemetryLogger", () => {
  it("is safe to call and returns nothing", () => {
    expect(
      noopTelemetryLogger.log({
        event: "noop",
        fields: { a: 1 },
        level: "info",
      })
    ).toBeUndefined();
  });
});

describe("openrouter client telemetry", () => {
  const baseConfig = {
    apiKey: liveApiKey,
    baseUrl: OPENROUTER_BASE_URL,
    model: DEFAULT_OPENROUTER_MODEL,
  } as const;

  it("never logs raw API key on http failure", async () => {
    const { events, logger } = captureLogger();
    const client = createOpenRouterClient(baseConfig, {
      fetch: async () =>
        new Response(JSON.stringify({ error: { message: "quota" } }), {
          headers: { "content-type": "application/json" },
          status: 429,
        }),
      logger,
    });

    await expect(
      client.completeText({ prompt: livePrompt, system: liveSystem })
    ).rejects.toThrow();

    expect(events).toHaveLength(1);
    const blob = flatten(events[0]);
    expect(blob).not.toContain(liveApiKey);
    expect(blob).not.toContain(liveApiKey.slice(3, -2));
    expect(blob).not.toContain("classified");
    expect(events[0].event).toBe("openrouter.http_error");
    expect(events[0].fields.status).toBe(429);
    expect(events[0].fields.api_key_fingerprint).toBe("tes***ue");
  });

  it("never logs raw API key on network failure", async () => {
    const { events, logger } = captureLogger();
    const client = createOpenRouterClient(baseConfig, {
      fetch: async () => {
        throw new TypeError(
          `fetch failed for ${livePrompt} with ${liveApiKey}`
        );
      },
      logger,
    });

    await expect(
      client.completeText({ prompt: livePrompt, system: liveSystem })
    ).rejects.toThrow();

    expect(events[0].event).toBe("openrouter.network_error");
    expect(events[0].fields.cause).toEqual({ name: "TypeError" });
    const blob = flatten(events[0]);
    expect(blob).not.toContain(liveApiKey);
    expect(blob).not.toContain("classified");
  });

  it("never logs raw prompt on timeout", async () => {
    const { events, logger } = captureLogger();
    const client = createOpenRouterClient(
      { ...baseConfig, timeoutMs: 10 },
      {
        fetch: (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
        logger,
      }
    );

    await expect(
      client.completeText({ prompt: livePrompt, system: liveSystem })
    ).rejects.toThrow();

    expect(events[0].event).toBe("openrouter.timeout");
    const blob = flatten(events[0]);
    expect(blob).not.toContain(liveApiKey);
    expect(blob).not.toContain("classified");
    expect(blob).not.toContain("chain-of-thought");
    expect(events[0].fields.timeout_ms).toBe(10);
  });

  it("emits no telemetry on the happy path", async () => {
    const { events, logger } = captureLogger();
    const client = createOpenRouterClient(baseConfig, {
      fetch: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "ok" } }],
            model: DEFAULT_OPENROUTER_MODEL,
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          }
        ),
      logger,
    });

    await client.completeText({ prompt: livePrompt, system: liveSystem });
    expect(events).toEqual([]);
  });
});

describe("reliability wrapper telemetry", () => {
  it("emits retry and gave_up events without leaking secrets", async () => {
    const { events, logger } = captureLogger();
    const upstream = {
      completeText: async () => {
        throw new Error("transient");
      },
    };
    const wrapped = withReliability(upstream, {
      baseDelayMs: 0,
      logger,
      maxAttempts: 2,
      maxDelayMs: 0,
      sleep: async () => undefined,
    });

    await expect(
      wrapped.completeText({ prompt: livePrompt, system: liveSystem })
    ).rejects.toThrow();

    expect(events.map((e) => e.event)).toEqual([
      "openrouter.retry_attempt",
      "openrouter.gave_up",
    ]);
    expect(flatten(events)).not.toContain("classified");
  });
});
