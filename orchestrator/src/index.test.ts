import { describe, it, expect } from "vitest";
import { ORCHESTRATOR_VERSION, buildOrchestratorHealthPayload } from "./index.js";

describe("orchestrator scaffold", () => {
  it("exports a version string", () => {
    expect(typeof ORCHESTRATOR_VERSION).toBe("string");
    expect(ORCHESTRATOR_VERSION.length).toBeGreaterThan(0);
  });

  it("builds an actionable hosted health payload from environment config", () => {
    expect(
      buildOrchestratorHealthPayload({
        FRONTEND_ORIGIN: "https://solar-dominion.vercel.app",
        LLM_MODE: "mock",
        SPACETIME_DB_NAME: "solar-dominion-prod",
        SPACETIME_HOST: "https://db.spacetimedb.example",
      })
    ).toEqual({
      frontendOrigin: "https://solar-dominion.vercel.app",
      mode: "mock",
      provider: "mock",
      spacetime: {
        dbName: "solar-dominion-prod",
        host: "https://db.spacetimedb.example",
      },
      status: "ok",
      version: ORCHESTRATOR_VERSION,
    });
  });

  it("reports invalid mode as unhealthy without throwing during smoke checks", () => {
    expect(
      buildOrchestratorHealthPayload({
        LLM_MODE: "prod",
        SPACETIME_DB_NAME: "solar-dominion-prod",
        SPACETIME_HOST: "https://db.spacetimedb.example",
      })
    ).toEqual({
      error: "LLM_MODE must be one of: live, mock, fixture",
      frontendOrigin: "*",
      mode: null,
      provider: null,
      spacetime: {
        dbName: "solar-dominion-prod",
        host: "https://db.spacetimedb.example",
      },
      status: "error",
      version: ORCHESTRATOR_VERSION,
    });
  });
});
