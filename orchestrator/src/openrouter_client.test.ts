import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_BASE_URL,
  OpenRouterConfigError,
  OpenRouterRequestError,
  createOpenRouterClient,
  readLlmProviderConfig,
} from "./openrouter_client.js";

describe("LLM provider config", () => {
  it("reads live OpenRouter config with model and Spacetime defaults", () => {
    const config = readLlmProviderConfig({
      LLM_MODE: "live",
      OPENROUTER_API_KEY: "  sk-live  ",
    });

    expect(config).toEqual({
      mode: "live",
      provider: "openrouter",
      openRouter: {
        apiKey: "sk-live",
        baseUrl: OPENROUTER_BASE_URL,
        model: DEFAULT_OPENROUTER_MODEL,
      },
      spacetime: {
        dbName: "solar-dominion",
        host: "http://localhost:3000",
      },
    });
  });

  it("keeps mock and fixture modes separate from live provider secrets", () => {
    expect(readLlmProviderConfig({ LLM_MODE: "mock" })).toEqual({
      mode: "mock",
      provider: "mock",
      spacetime: {
        dbName: "solar-dominion",
        host: "http://localhost:3000",
      },
    });

    expect(
      readLlmProviderConfig({
        LLM_MODE: "fixture",
        LLM_FIXTURE_PATH: "fixtures/proposals.json",
      })
    ).toEqual({
      mode: "fixture",
      provider: "fixture",
      fixturePath: "fixtures/proposals.json",
      spacetime: {
        dbName: "solar-dominion",
        host: "http://localhost:3000",
      },
    });
  });

  it("fails clearly for invalid live configuration", () => {
    expect(() => readLlmProviderConfig({ LLM_MODE: "live" })).toThrow(
      new OpenRouterConfigError(
        "openrouter_api_key_missing",
        "OPENROUTER_API_KEY is required when LLM_MODE=live"
      )
    );

    expect(() =>
      readLlmProviderConfig({
        LLM_MODE: "live",
        OPENROUTER_API_KEY: "sk-live",
        OPENROUTER_BASE_URL: "not-a-url",
      })
    ).toThrow(
      new OpenRouterConfigError(
        "openrouter_base_url_invalid",
        "OPENROUTER_BASE_URL must be a valid absolute URL"
      )
    );
  });

  it("rejects unsupported provider modes at the config boundary", () => {
    expect(() => readLlmProviderConfig({ LLM_MODE: "prod" })).toThrow(
      new OpenRouterConfigError(
        "llm_mode_invalid",
        "LLM_MODE must be one of: live, mock, fixture"
      )
    );
  });
});

describe("OpenRouter client wrapper", () => {
  it("sends provider details through the base request wrapper", async () => {
    const requests: Array<{ body: unknown; headers: Headers; url: string }> = [];
    const client = createOpenRouterClient(
      {
        apiKey: "sk-live",
        baseUrl: OPENROUTER_BASE_URL,
        model: DEFAULT_OPENROUTER_MODEL,
      },
      {
        fetch: async (url, init) => {
          requests.push({
            body: JSON.parse(String(init?.body)),
            headers: new Headers(init?.headers),
            url: String(url),
          });
          return new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"proposal":"hold"}' } }],
              model: DEFAULT_OPENROUTER_MODEL,
            }),
            {
              headers: { "content-type": "application/json" },
              status: 200,
            }
          );
        },
      }
    );

    const result = await client.completeText({
      maxTokens: 500,
      prompt: "Generate proposal candidates.",
      responseFormat: "json_object",
      system: "Return JSON only.",
      temperature: 0.1,
    });

    expect(result).toEqual({
      content: '{"proposal":"hold"}',
      model: DEFAULT_OPENROUTER_MODEL,
      provider: "openrouter",
      raw: expect.any(Object),
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(`${OPENROUTER_BASE_URL}/chat/completions`);
    expect(requests[0].headers.get("authorization")).toBe("Bearer sk-live");
    expect(requests[0].headers.get("content-type")).toBe("application/json");
    expect(requests[0].body).toEqual({
      max_tokens: 500,
      messages: [
        { content: "Return JSON only.", role: "system" },
        { content: "Generate proposal candidates.", role: "user" },
      ],
      model: DEFAULT_OPENROUTER_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
  });

  it("converts provider HTTP failures into explicit request errors", async () => {
    const client = createOpenRouterClient(
      {
        apiKey: "sk-live",
        baseUrl: OPENROUTER_BASE_URL,
        model: DEFAULT_OPENROUTER_MODEL,
      },
      {
        fetch: async () =>
          new Response(JSON.stringify({ error: { message: "quota exceeded" } }), {
            headers: { "content-type": "application/json" },
            status: 429,
          }),
      }
    );

    await expect(
      client.completeText({
        prompt: "Generate proposal candidates.",
        system: "Return JSON only.",
      })
    ).rejects.toMatchObject({
      message: "OpenRouter request failed with 429: quota exceeded",
      name: "OpenRouterRequestError",
      provider: "openrouter",
      status: 429,
    } satisfies Partial<OpenRouterRequestError>);
  });
});
