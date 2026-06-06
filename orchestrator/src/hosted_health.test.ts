import { describe, expect, it } from "vitest";

import { buildOrchestratorHealthPayload } from "./hosted_health.js";
import { ORCHESTRATOR_VERSION } from "./version.js";

describe("buildOrchestratorHealthPayload", () => {
  it("returns ok payload when env is valid", () => {
    const payload = buildOrchestratorHealthPayload({
      FRONTEND_ORIGIN:
        "https://space-time-hackathon-client-git-epic-28-efe446-oohbens-projects.vercel.app",
      LLM_MODE: "mock",
      SPACETIME_DB_NAME: "solar-dominion",
      SPACETIME_HOST: "wss://maincloud.spacetimedb.com",
    } as NodeJS.ProcessEnv);

    expect(payload.status).toBe("ok");
    expect(payload.mode).toBe("mock");
    expect(payload.provider).toBe("mock");
    expect(payload.spacetime).toEqual({
      dbName: "solar-dominion",
      host: "wss://maincloud.spacetimedb.com",
    });
    expect(payload.frontendOrigin).toBe(
      "https://space-time-hackathon-client-git-epic-28-efe446-oohbens-projects.vercel.app",
    );
    expect(payload.version).toBe(ORCHESTRATOR_VERSION);
    expect(payload.error).toBeUndefined();
  });

  it("falls back to defaults when env is empty", () => {
    const payload = buildOrchestratorHealthPayload({
      LLM_MODE: "mock",
    } as NodeJS.ProcessEnv);

    expect(payload.status).toBe("ok");
    expect(payload.frontendOrigin).toBe("*");
    expect(payload.spacetime.dbName).toBe("solar-dominion");
    expect(payload.spacetime.host).toBe("http://localhost:3000");
  });

  it("returns error payload when LLM provider config is invalid", () => {
    const payload = buildOrchestratorHealthPayload({
      LLM_MODE: "live",
      // missing OPENROUTER_API_KEY → readLlmProviderConfig throws
      FRONTEND_ORIGIN: "https://example.test",
      SPACETIME_DB_NAME: "fallback-db",
      SPACETIME_HOST: "wss://fallback.example.test",
    } as NodeJS.ProcessEnv);

    expect(payload.status).toBe("error");
    expect(payload.mode).toBeNull();
    expect(payload.provider).toBeNull();
    expect(payload.frontendOrigin).toBe("https://example.test");
    expect(payload.spacetime).toEqual({
      dbName: "fallback-db",
      host: "wss://fallback.example.test",
    });
    expect(typeof payload.error).toBe("string");
  });
});
