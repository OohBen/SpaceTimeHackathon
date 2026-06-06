import { afterEach, describe, expect, it } from "vitest";

import {
  buildHealthPayload,
  createOrchestratorHttpServer,
  readOrchestratorServerConfig,
} from "./http_server.js";

describe("orchestrator HTTP server", () => {
  const servers: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  it("reports mode, spacetime target, database name, and provider readiness", async () => {
    const config = readOrchestratorServerConfig({
      LLM_MODE: "fixture",
      PORT: "0",
      SPACETIME_DB_NAME: "solar-dominion",
      SPACETIME_HOST: "http://localhost:3000",
    });

    const payload = await buildHealthPayload(config);

    expect(payload).toMatchObject({
      dbName: "solar-dominion",
      mode: "fixture",
      provider: {
        name: "fixture",
        ready: true,
      },
      spacetimeHost: "http://localhost:3000",
      status: "ready",
    });
  });

  it("serves GET /health as JSON from a long-running HTTP server", async () => {
    const config = readOrchestratorServerConfig({
      LLM_MODE: "mock",
      PORT: "0",
      SPACETIME_DB_NAME: "solar-dominion",
      SPACETIME_HOST: "http://localhost:3000",
    });
    const server = await createOrchestratorHttpServer(config).listen();
    servers.push(server);

    const response = await fetch(`${server.url}/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toMatchObject({
      dbName: "solar-dominion",
      mode: "mock",
      provider: { name: "mock", ready: true },
      spacetimeHost: "http://localhost:3000",
      status: "ready",
    });
  });
});
