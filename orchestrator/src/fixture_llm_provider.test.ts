import { describe, expect, it } from "vitest";

import {
  FixtureLookupError,
  createFixtureLlmModeProvider,
  defaultFixturePath,
  loadFixtureCatalog,
  parseFixtureCatalog,
} from "./fixture_llm_provider.js";
import { LlmModeRequest } from "./llm_mode_provider.js";

const sampleCatalog = `{
  "schema_version": 1,
  "scenarios": [
    {
      "request_type": "proposals",
      "scenario_id": "default",
      "response": {
        "schema_version": 1,
        "proposals": [
          {
            "title": "Test",
            "body": "Sample fixture body",
            "department": "Executive",
            "confidence": "HIGH",
            "resource_cost": 90
          }
        ]
      }
    },
    {
      "request_type": "event_narrative",
      "scenario_id": "colony-arrival",
      "response": {
        "schema_version": 1,
        "narrative": "Colony ship docks at Callisto."
      }
    }
  ]
}`;

const baseRequest = (
  overrides: Partial<LlmModeRequest> = {}
): LlmModeRequest => ({
  context: undefined,
  faction_id: 1,
  request_type: "proposals",
  session_id: 1,
  turn: 1,
  ...overrides,
});

describe("fixture provider", () => {
  it("parses a valid fixture catalog", () => {
    const catalog = parseFixtureCatalog(sampleCatalog, "sample");
    expect(catalog.schema_version).toBe(1);
    expect(catalog.scenarios.length).toBe(2);
  });

  it("rejects an invalid schema_version", () => {
    const raw = JSON.stringify({ schema_version: 99, scenarios: [] });
    expect(() => parseFixtureCatalog(raw, "bad")).toThrowError(FixtureLookupError);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseFixtureCatalog("{not json", "bad")).toThrowError(
      FixtureLookupError
    );
  });

  it("rejects a scenario with an unknown request_type", () => {
    const raw = JSON.stringify({
      schema_version: 1,
      scenarios: [
        { request_type: "unknown", scenario_id: "x", response: {} },
      ],
    });
    expect(() => parseFixtureCatalog(raw, "bad")).toThrowError(FixtureLookupError);
  });

  it("returns scenarios by explicit scenario_id", async () => {
    const catalog = parseFixtureCatalog(sampleCatalog, "sample");
    const provider = createFixtureLlmModeProvider({ catalog });
    const response = await provider.completeRequest(
      baseRequest({
        request_type: "event_narrative",
        scenario_id: "colony-arrival",
      })
    );
    expect(response.source).toBe("fixture");
    expect(response.scenario_id).toBe("colony-arrival");
    const parsed = JSON.parse(response.response_json) as { narrative: string };
    expect(parsed.narrative).toContain("Callisto");
  });

  it("falls back to the default scenario when explicit id is missing", async () => {
    const catalog = parseFixtureCatalog(sampleCatalog, "sample");
    const provider = createFixtureLlmModeProvider({ catalog });
    const response = await provider.completeRequest(
      baseRequest({ request_type: "proposals", scenario_id: "missing" })
    );
    expect(response.scenario_id).toBe("default");
  });

  it("throws when neither requested nor default scenario exists", async () => {
    const catalog = parseFixtureCatalog(sampleCatalog, "sample");
    const provider = createFixtureLlmModeProvider({ catalog });
    await expect(
      provider.completeRequest(baseRequest({ request_type: "resume_briefing" }))
    ).rejects.toThrowError(FixtureLookupError);
  });

  it("loads the curated repo catalog by default and serves the canonical scenarios", async () => {
    const catalog = await loadFixtureCatalog(defaultFixturePath());
    const provider = createFixtureLlmModeProvider({ catalog });
    const response = await provider.completeRequest(baseRequest());
    expect(response.scenario_id).toBe("default");
    const parsed = JSON.parse(response.response_json) as {
      proposals: Array<{ title: string }>;
    };
    expect(parsed.proposals.length).toBeGreaterThan(0);
  });

  it("surfaces a typed error when the file cannot be read", async () => {
    await expect(
      loadFixtureCatalog("/nonexistent/scenarios.json")
    ).rejects.toThrowError(FixtureLookupError);
  });
});
