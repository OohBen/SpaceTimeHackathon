import assert from "node:assert/strict";
import { test } from "node:test";

import { GET } from "./health.ts";

test("GET returns hosted orchestrator health payload", async () => {
  const previousEnv = { ...process.env };
  process.env.FRONTEND_ORIGIN = "https://space-time-hackathon-client-git-epic-28-efe446-oohbens-projects.vercel.app";
  process.env.LLM_MODE = "mock";
  process.env.SPACETIME_DB_NAME = "solar-dominion";
  process.env.SPACETIME_HOST = "wss://maincloud.spacetimedb.com";

  try {
    const response = await GET();
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.status, "ok");
    assert.equal(payload.mode, "mock");
    assert.equal(payload.provider, "mock");
    assert.equal(payload.spacetime.dbName, "solar-dominion");
    assert.equal(payload.spacetime.host, "wss://maincloud.spacetimedb.com");
  } finally {
    process.env = previousEnv;
  }
});
