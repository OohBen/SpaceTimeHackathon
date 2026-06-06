import { describe, expect, it } from "vitest";

import {
  LLM_REQUEST_TYPES,
  LlmModeRequestError,
  assertRequestType,
  defaultScenarioId,
  isLlmRequestType,
  selectLlmModeProvider,
  stableContextHash,
  stableJson,
} from "./llm_mode_provider.js";

describe("llm mode contract", () => {
  it("enumerates the four canonical request types", () => {
    expect([...LLM_REQUEST_TYPES]).toEqual([
      "proposals",
      "inbox",
      "event_narrative",
      "resume_briefing",
    ]);
  });

  it("accepts a valid request_type value", () => {
    for (const type of LLM_REQUEST_TYPES) {
      expect(assertRequestType(type)).toBe(type);
      expect(isLlmRequestType(type)).toBe(true);
    }
  });

  it("rejects an unknown request_type with a stable code", () => {
    expect(() => assertRequestType("unknown")).toThrowError(LlmModeRequestError);
    try {
      assertRequestType("unknown");
    } catch (error) {
      expect(error).toBeInstanceOf(LlmModeRequestError);
      expect((error as LlmModeRequestError).code).toBe("request_type_invalid");
    }
  });

  it("rejects a non-string request_type with a stable code", () => {
    try {
      assertRequestType(42);
    } catch (error) {
      expect(error).toBeInstanceOf(LlmModeRequestError);
      expect((error as LlmModeRequestError).code).toBe("request_type_invalid");
    }
  });

  it("computes a deterministic scenario id when none is supplied", () => {
    const request = {
      context: { ignored: true },
      faction_id: 2,
      request_type: "proposals" as const,
      session_id: 7,
      turn: 4,
    };
    expect(defaultScenarioId(request)).toBe("proposals/turn-4/faction-2");
  });

  it("honors an explicit scenario_id", () => {
    expect(
      defaultScenarioId({
        context: undefined,
        faction_id: 1,
        request_type: "inbox",
        scenario_id: "judge-turn-8",
        session_id: 1,
        turn: 8,
      })
    ).toBe("judge-turn-8");
  });

  it("hashes equivalent objects to the same value regardless of key order", () => {
    const left = { a: 1, b: { c: 2, d: 3 } };
    const right = { b: { d: 3, c: 2 }, a: 1 };
    expect(stableContextHash(left)).toBe(stableContextHash(right));
    expect(stableJson(left)).toBe(stableJson(right));
  });

  it("hashes different payloads to different values", () => {
    expect(stableContextHash({ a: 1 })).not.toBe(stableContextHash({ a: 2 }));
  });

  it("dispatches to the right provider for each mode", () => {
    const spacetime = { dbName: "solar-dominion", host: "http://localhost:3000" };
    const calls: string[] = [];
    const deps = {
      createFixtureProvider: () => {
        calls.push("fixture");
        return { mode: "fixture" as const, completeRequest: async () => stub };
      },
      createLiveProvider: () => {
        calls.push("live");
        return { mode: "live" as const, completeRequest: async () => stub };
      },
      createMockProvider: () => {
        calls.push("mock");
        return { mode: "mock" as const, completeRequest: async () => stub };
      },
    };
    const stub = {
      faction_id: 0,
      request_type: "proposals" as const,
      response_json: "{}",
      schema_version: 1,
      scenario_id: "default",
      session_id: 0,
      source: "mock" as const,
      turn: 0,
    };

    selectLlmModeProvider({ mode: "mock", provider: "mock", spacetime }, deps);
    selectLlmModeProvider({ mode: "fixture", provider: "fixture", spacetime }, deps);
    selectLlmModeProvider(
      {
        mode: "live",
        openRouter: {
          apiKey: "sk-test",
          baseUrl: "https://openrouter.ai/api/v1",
          model: "inception/mercury-2",
        },
        provider: "openrouter",
        spacetime,
      },
      deps
    );

    expect(calls).toEqual(["mock", "fixture", "live"]);
  });
});
