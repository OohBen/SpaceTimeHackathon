import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const smokeScript = resolve(__dirname, "hosted-smoke.mjs");

async function main() {
  await rejectsMismatchedMode();
  await rejectsMismatchedProvider();
  await rejectsMismatchedSpacetimeDbName();
  await acceptsMatchingHostedSurfaces();
  console.log("Hosted smoke self-test passed");
}

async function rejectsMismatchedMode() {
  const result = await withHostedSurfaces({ dbName: "solar-dominion", mode: "fixture" }, (urls) =>
    runSmoke({
      HOSTED_FRONTEND_URL: urls.frontend,
      ORCHESTRATOR_BASE_URL: urls.orchestrator,
      SPACETIME_DB_NAME: "solar-dominion",
      SPACETIME_URI: urls.spacetime,
      VITE_DEMO_MODE: "mock",
    }),
  );

  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /mode mismatch/i);
}

async function rejectsMismatchedProvider() {
  const result = await withHostedSurfaces(
    { dbName: "solar-dominion", mode: "mock", provider: "fixture" },
    (urls) =>
      runSmoke({
        HOSTED_FRONTEND_URL: urls.frontend,
        ORCHESTRATOR_BASE_URL: urls.orchestrator,
        SPACETIME_DB_NAME: "solar-dominion",
        SPACETIME_URI: urls.spacetime,
        VITE_DEMO_MODE: "mock",
      }),
  );

  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /provider mismatch/i);
}

async function rejectsMismatchedSpacetimeDbName() {
  const result = await withHostedSurfaces({ dbName: "solar-dominion-preview", mode: "mock" }, (urls) =>
    runSmoke({
      HOSTED_FRONTEND_URL: urls.frontend,
      ORCHESTRATOR_BASE_URL: urls.orchestrator,
      SPACETIME_DB_NAME: "solar-dominion",
      SPACETIME_URI: urls.spacetime,
      VITE_DEMO_MODE: "mock",
    }),
  );

  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /SpacetimeDB name mismatch/i);
}

async function acceptsMatchingHostedSurfaces() {
  const result = await withHostedSurfaces({ dbName: "solar-dominion", mode: "mock" }, (urls) =>
    runSmoke({
      HOSTED_FRONTEND_URL: urls.frontend,
      ORCHESTRATOR_BASE_URL: urls.orchestrator,
      SPACETIME_DB_NAME: "solar-dominion",
      SPACETIME_URI: urls.spacetime,
      VITE_DEMO_MODE: "mock",
    }),
  );

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /hosted-smoke: PASS/);
}

async function withHostedSurfaces(health, callback) {
  const frontend = await listen((_, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<!doctype html><title>Solar Dominion</title>");
  });
  const spacetime = await listen((_, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  });
  const orchestrator = await listen((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          frontendOrigin: frontend.url,
          mode: health.mode,
          provider: health.provider ?? (health.mode === "live" ? "openrouter" : health.mode),
          spacetime: {
            dbName: health.dbName,
            host: spacetime.url,
          },
          status: "ok",
          version: "test",
        }),
      );
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "not_found" }));
  });

  try {
    return await callback({
      frontend: frontend.url,
      orchestrator: orchestrator.url,
      spacetime: spacetime.url,
    });
  } finally {
    await Promise.all([frontend.close(), spacetime.close(), orchestrator.close()]);
  }
}

async function listen(handler) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  return {
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
    url: `http://127.0.0.1:${address.port}`,
  };
}

function runSmoke(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [smokeScript], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("close", (status) => {
      resolve({ output, status });
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
