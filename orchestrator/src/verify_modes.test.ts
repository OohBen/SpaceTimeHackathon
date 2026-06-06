import { describe, expect, it } from "vitest";
import { readLlmProviderConfig } from "./openrouter_client.js";
import { selectLlmModeProvider } from "./llm_mode_provider.js";
import { createMockLlmModeProvider } from "./mock_llm_provider.js";
import { createFixtureLlmModeProvider, loadFixtureCatalog, defaultFixturePath } from "./fixture_llm_provider.js";

describe("Mode Switching Verification", () => {
  it("verifies mock mode selection and response", async () => {
    const config = readLlmProviderConfig({ LLM_MODE: "mock" });
    expect(config.mode).toBe("mock");

    const provider = selectLlmModeProvider(config, {
      createMockProvider: () => createMockLlmModeProvider(),
      createFixtureProvider: () => { throw new Error("Should not be called"); },
      createLiveProvider: () => { throw new Error("Should not be called"); },
    });

    expect(provider.mode).toBe("mock");
    const response = await provider.completeRequest({
      context: {},
      faction_id: 1,
      request_type: "proposals",
      session_id: 1,
      turn: 1,
    });
    expect(response.source).toBe("mock");
    expect(response.response_json).toContain("Mock");
  });

  it("verifies fixture mode selection and response", async () => {
    const config = readLlmProviderConfig({ LLM_MODE: "fixture" });
    expect(config.mode).toBe("fixture");

    const catalog = await loadFixtureCatalog(defaultFixturePath());
    const provider = selectLlmModeProvider(config, {
      createMockProvider: () => { throw new Error("Should not be called"); },
      createFixtureProvider: () => createFixtureLlmModeProvider({ catalog }),
      createLiveProvider: () => { throw new Error("Should not be called"); },
    });

    expect(provider.mode).toBe("fixture");
    const response = await provider.completeRequest({
      context: {},
      faction_id: 1,
      request_type: "proposals",
      session_id: 1,
      turn: 1,
    });
    expect(response.source).toBe("fixture");
    expect(response.response_json).toContain("Demo fixture");
  });

  it("verifies live mode requires API key", () => {
    expect(() => readLlmProviderConfig({ LLM_MODE: "live" })).toThrow("OPENROUTER_API_KEY is required");
  });
});
