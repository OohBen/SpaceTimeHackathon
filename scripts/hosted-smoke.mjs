import net from 'node:net';
import tls from 'node:tls';

const DEFAULT_TIMEOUT_MS = 10_000;

async function main() {
  const config = readSmokeConfig(process.env);

  console.log('hosted-smoke: checking frontend');
  await checkHttp('frontend', config.hostedFrontendUrl);

  console.log('hosted-smoke: checking SpacetimeDB endpoint');
  await checkSpacetime(config.spacetimeUri);

  console.log('hosted-smoke: checking orchestrator health');
  await checkOrchestrator(config.orchestratorBaseUrl, config);

  console.log('hosted-smoke: PASS');
}

function readSmokeConfig(env) {
  return {
    expectedDemoMode: readExpectedDemoMode(env),
    hostedFrontendUrl: requiredUrl(env.HOSTED_FRONTEND_URL, 'HOSTED_FRONTEND_URL'),
    orchestratorBaseUrl: requiredUrl(env.ORCHESTRATOR_BASE_URL, 'ORCHESTRATOR_BASE_URL'),
    spacetimeDbName: optionalString(env.SPACETIME_DB_NAME),
    spacetimeUri: requiredUrl(env.SPACETIME_URI, 'SPACETIME_URI'),
  };
}

function requiredUrl(value, name) {
  if (!value || !value.trim()) {
    throw new Error(`${name} is required`);
  }

  try {
    return new URL(value.trim());
  } catch {
    throw new Error(`${name} must be a valid URL; received ${JSON.stringify(value)}`);
  }
}

async function checkHttp(name, url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} must be http:// or https://; received ${url.href}`);
  }

  let response;
  try {
    response = await fetchWithTimeout(url.href);
  } catch (error) {
    throw new Error(`${name} request failed for ${url.href}: ${errorMessage(error)}`);
  }

  if (!response.ok) {
    throw new Error(`${name} returned HTTP ${response.status} for ${url.href}`);
  }
}

async function checkOrchestrator(baseUrl, config) {
  const healthUrl = new URL('/health', baseUrl);
  let response;
  try {
    response = await fetchWithTimeout(healthUrl.href);
  } catch (error) {
    throw new Error(`orchestrator /health failed for ${healthUrl.href}: ${errorMessage(error)}`);
  }

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`orchestrator /health returned HTTP ${response.status}: ${body.slice(0, 400)}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`orchestrator /health returned non-JSON body: ${body.slice(0, 120)}`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`orchestrator /health returned non-object JSON body: ${body.slice(0, 120)}`);
  }

  if (parsed.status !== 'ok') {
    throw new Error(`orchestrator unhealthy payload: ${JSON.stringify(parsed)}`);
  }

  if (config.expectedDemoMode && parsed.mode !== config.expectedDemoMode) {
    throw new Error(
      `orchestrator mode mismatch: expected ${config.expectedDemoMode}, received ${formatValue(parsed.mode)}`,
    );
  }

  const expectedProvider = expectedProviderForMode(config.expectedDemoMode);
  if (expectedProvider && parsed.provider !== expectedProvider) {
    throw new Error(
      `orchestrator provider mismatch: expected ${expectedProvider}, received ${formatValue(parsed.provider)}`,
    );
  }

  if (config.spacetimeDbName) {
    const actualDbName = isRecord(parsed.spacetime) ? parsed.spacetime.dbName : undefined;
    if (actualDbName !== config.spacetimeDbName) {
      throw new Error(
        `orchestrator SpacetimeDB name mismatch: expected ${config.spacetimeDbName}, received ${formatValue(actualDbName)}`,
      );
    }
  }
}

async function checkSpacetime(url) {
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    await checkHttp('SpacetimeDB', url);
    return;
  }

  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error(`SPACETIME_URI must be ws://, wss://, http://, or https://; received ${url.href}`);
  }

  await checkTcp('SpacetimeDB', url);
}

function checkTcp(name, url) {
  const port = Number(url.port || (url.protocol === 'wss:' ? 443 : 80));
  const host = url.hostname;

  return new Promise((resolve, reject) => {
    const secure = url.protocol === 'wss:';
    const socket =
      secure
        ? tls.connect({ host, port, servername: host })
        : net.connect({ host, port });

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`${name} TCP timeout for ${host}:${port}`));
    }, DEFAULT_TIMEOUT_MS);

    const readyEvent = secure ? 'secureConnect' : 'connect';
    socket.once(readyEvent, () => {
      clearTimeout(timer);
      socket.end();
      resolve();
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`${name} TCP check failed for ${host}:${port}: ${errorMessage(error)}`));
    });
  });
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function readExpectedDemoMode(env) {
  const value = optionalString(env.VITE_DEMO_MODE) ?? optionalString(env.DEMO_MODE);
  if (!value) {
    return null;
  }
  if (value === 'fixture' || value === 'live' || value === 'mock') {
    return value;
  }
  throw new Error(`VITE_DEMO_MODE or DEMO_MODE must be one of: fixture, live, mock; received ${JSON.stringify(value)}`);
}

function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function expectedProviderForMode(mode) {
  if (!mode) {
    return null;
  }
  return mode === 'live' ? 'openrouter' : mode;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatValue(value) {
  return value === undefined ? 'undefined' : JSON.stringify(value);
}

main().catch((error) => {
  console.error(`hosted-smoke: FAIL: ${errorMessage(error)}`);
  process.exit(1);
});
