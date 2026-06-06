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
  await checkOrchestrator(config.orchestratorBaseUrl);

  console.log('hosted-smoke: PASS');
}

function readSmokeConfig(env) {
  return {
    hostedFrontendUrl: requiredUrl(env.HOSTED_FRONTEND_URL, 'HOSTED_FRONTEND_URL'),
    orchestratorBaseUrl: requiredUrl(env.ORCHESTRATOR_BASE_URL, 'ORCHESTRATOR_BASE_URL'),
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

async function checkOrchestrator(baseUrl) {
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

  if (parsed.status !== 'ok') {
    throw new Error(`orchestrator unhealthy payload: ${JSON.stringify(parsed)}`);
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

main().catch((error) => {
  console.error(`hosted-smoke: FAIL: ${errorMessage(error)}`);
  process.exit(1);
});
