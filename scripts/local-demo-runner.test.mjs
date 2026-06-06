import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import {
  DEFAULTS,
  buildChildEnvironments,
  buildFrontendDevArgs,
  buildRunnerConfig,
  buildSpacetimePublishArgs,
  buildSpacetimeStartArgs,
  buildWindowsTaskkillArgs,
  operatorReadyLines,
  runPreflight,
  waitForManagedReadiness,
} from "./local-demo-runner.mjs";

test("defaults to judge-ready fixture mode and required local endpoints", () => {
  const config = buildRunnerConfig({}, []);

  assert.equal(config.mode, "fixture");
  assert.equal(config.spacetime.host, "http://localhost:3000");
  assert.match(config.spacetime.dataDir, /[\\/]\.spacetimedb-local-data$/);
  assert.equal(config.spacetime.wsHost, "ws://localhost:3000");
  assert.equal(config.spacetime.dbName, "solar-dominion");
  assert.equal(config.orchestrator.port, 8787);
  assert.equal(config.frontend.port, 5173);
  assert.deepEqual(config.requiredExecutables, ["node", "npm", "spacetime"]);
});

test("uses a runner-owned SpacetimeDB data dir and destructive publish reset for repeatable smoke", () => {
  const config = buildRunnerConfig({}, []);

  assert.deepEqual(buildSpacetimeStartArgs(config), [
    "start",
    "--listen-addr",
    "0.0.0.0:3000",
    "--data-dir",
    config.spacetime.dataDir,
    "--non-interactive",
  ]);
  assert.deepEqual(buildSpacetimePublishArgs(config), [
    "publish",
    "solar-dominion",
    "--server",
    "http://localhost:3000",
    "--anonymous",
    "--yes",
    "--delete-data=always",
    "--module-path",
    "server",
  ]);
});

test("builds a Windows process-tree kill command for managed teardown", () => {
  assert.deepEqual(buildWindowsTaskkillArgs(1234), [
    "/PID",
    "1234",
    "/T",
    "/F",
  ]);
});

test("starts Vite through the client workspace so CLI flags reach Vite", () => {
  const config = buildRunnerConfig({}, []);

  assert.deepEqual(buildFrontendDevArgs(config), [
    "--workspace",
    "client",
    "run",
    "dev",
    "--",
    "--host",
    "127.0.0.1",
    "--port",
    "5173",
    "--strictPort",
  ]);
});

test("sets all child env surfaces needed by the demo stack", () => {
  const config = buildRunnerConfig({}, []);
  const env = buildChildEnvironments(config, { PATH: "test-path" });

  assert.equal(env.orchestrator.LLM_MODE, "fixture");
  assert.equal(env.orchestrator.PORT, "8787");
  assert.equal(env.orchestrator.SPACETIME_HOST, "http://localhost:3000");
  assert.equal(env.orchestrator.SPACETIME_DB_NAME, "solar-dominion");
  assert.equal(env.frontend.VITE_LLM_MODE, "fixture");
  assert.equal(env.frontend.VITE_SPACETIME_HOST, "ws://localhost:3000");
  assert.equal(env.frontend.VITE_SPACETIME_DB_NAME, "solar-dominion");
  assert.equal(env.frontend.VITE_SPACETIMEDB_URI, "http://localhost:3000");
  assert.equal(env.frontend.VITE_SPACETIMEDB_MODULE, "solar-dominion");
  assert.equal(env.frontend.PATH, "test-path");
});

test("preflight reports missing dependencies, occupied ports, and live-mode env gaps", async () => {
  const config = buildRunnerConfig({ LLM_MODE: "live" }, []);
  const result = await runPreflight(config, {
    commandExists: async (command) => command !== "spacetime",
    fileExists: async (path) => !path.endsWith("node_modules"),
    isPortAvailable: async (port) => port !== DEFAULTS.frontendPort,
    readTextFile: async () => "{}",
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Missing executable: spacetime/);
  assert.match(result.errors.join("\n"), /npm install/);
  assert.match(result.errors.join("\n"), /Port 5173 is already in use by frontend/);
  assert.match(
    result.errors.join("\n"),
    /OPENROUTER_API_KEY is required when LLM_MODE=live/
  );
});

test("operator ready output matches the judge runbook contract", () => {
  const config = buildRunnerConfig({}, []);

  assert.deepEqual(operatorReadyLines(config), [
    "SpacetimeDB: ready http://localhost:3000 db=solar-dominion",
    "Orchestrator: ready http://localhost:8787 mode=fixture",
    "Frontend: ready http://localhost:5173",
    "Shutdown: press Ctrl+C once; runner stops frontend, orchestrator, then SpacetimeDB",
  ]);
});

test("preflight rejects invalid fixture catalogs before startup", async () => {
  const config = buildRunnerConfig({ LLM_MODE: "fixture" }, []);
  const result = await runPreflight(config, {
    commandExists: async () => true,
    fileExists: async () => true,
    isPortAvailable: async () => true,
    readTextFile: async () => "{}",
  });

  assert.equal(result.ok, false);
  assert.match(
    result.errors.join("\n"),
    /expected schema_version=1 and a non-empty scenarios array/
  );
});

test("managed readiness fails immediately with recent child logs when service exits early", async () => {
  const child = new EventEmitter();
  const managed = {
    child,
    logs: ["[spacetimedb] failed to create initial log file"],
    name: "spacetimedb",
  };

  const waiting = waitForManagedReadiness(
    managed,
    async () => false,
    10_000,
    "http://localhost:3000 did not become reachable",
    1
  );
  child.emit("exit", 1);

  await assert.rejects(waiting, {
    message: /spacetimedb exited before readiness with code 1[\s\S]*failed to create initial log file/,
  });
});
