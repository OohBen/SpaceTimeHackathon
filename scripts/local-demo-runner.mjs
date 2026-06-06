import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

export const DEFAULTS = {
  dbName: "solar-dominion",
  frontendPort: 5173,
  fixturePath: path.join(repoRoot, "orchestrator", "fixtures", "scenarios.json"),
  mode: "fixture",
  openRouterBaseUrl: "https://openrouter.ai/api/v1",
  openRouterModel: "inception/mercury-2",
  openRouterTimeoutMs: 30_000,
  orchestratorPort: 8787,
  readinessTimeoutMs: 60_000,
  spacetimeHost: "http://localhost:3000",
  spacetimePort: 3000,
  spacetimeWsHost: "ws://localhost:3000",
};

const VALID_MODES = new Set(["live", "mock", "fixture"]);
const REQUIRED_EXECUTABLES = ["node", "npm", "spacetime"];
const MAX_OPENROUTER_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 500;

export function buildRunnerConfig(env = process.env, argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const mode = args.mode ?? readOptional(env.LLM_MODE) ?? DEFAULTS.mode;
  const spacetimeHost = readOptional(env.SPACETIME_HOST) ?? DEFAULTS.spacetimeHost;
  const spacetimeDbName =
    readOptional(env.SPACETIME_DB_NAME) ?? DEFAULTS.dbName;
  const spacetimeWsHost =
    readOptional(env.VITE_SPACETIME_HOST) ??
    toWsUrl(spacetimeHost, DEFAULTS.spacetimeWsHost);
  const frontendDbName =
    readOptional(env.VITE_SPACETIME_DB_NAME) ?? spacetimeDbName;
  const frontendModule =
    readOptional(env.VITE_SPACETIMEDB_MODULE) ?? spacetimeDbName;
  const frontendHttpUri =
    readOptional(env.VITE_SPACETIMEDB_URI) ?? spacetimeHost;
  const orchestratorPort = readPort(
    readOptional(env.PORT),
    DEFAULTS.orchestratorPort
  );
  const frontendPort = readPort(
    readOptional(env.VITE_PORT),
    DEFAULTS.frontendPort
  );

  return {
    fixturePath:
      readOptional(env.LLM_FIXTURE_PATH) ?? DEFAULTS.fixturePath,
    frontend: {
      dbName: frontendDbName,
      httpUri: frontendHttpUri,
      port: frontendPort,
      url: `http://localhost:${frontendPort}`,
      wsHost: spacetimeWsHost,
    },
    mode,
    openRouter: {
      apiKey: readOptional(env.OPENROUTER_API_KEY),
      baseUrl:
        readOptional(env.OPENROUTER_BASE_URL) ?? DEFAULTS.openRouterBaseUrl,
      model: readOptional(env.OPENROUTER_MODEL) ?? DEFAULTS.openRouterModel,
      timeoutMs: readOptional(env.OPENROUTER_TIMEOUT_MS),
    },
    orchestrator: {
      port: orchestratorPort,
      url: `http://localhost:${orchestratorPort}`,
    },
    readinessTimeoutMs: readPort(
      args.readinessTimeoutMs,
      DEFAULTS.readinessTimeoutMs
    ),
    repoRoot,
    requiredExecutables: REQUIRED_EXECUTABLES,
    smoke: args.smoke,
    spacetime: {
      dbName: spacetimeDbName,
      host: spacetimeHost,
      port: readPortFromUrl(spacetimeHost, DEFAULTS.spacetimePort),
      wsHost: spacetimeWsHost,
    },
    viteModule: frontendModule,
  };
}

export function buildChildEnvironments(config, baseEnv = process.env) {
  const shared = { ...baseEnv };
  return {
    frontend: {
      ...shared,
      VITE_LLM_MODE: config.mode,
      VITE_SPACETIME_DB_NAME: config.frontend.dbName,
      VITE_SPACETIME_HOST: config.frontend.wsHost,
      VITE_SPACETIMEDB_MODULE: config.viteModule,
      VITE_SPACETIMEDB_URI: config.frontend.httpUri,
    },
    orchestrator: {
      ...shared,
      LLM_FIXTURE_PATH: config.fixturePath,
      LLM_MODE: config.mode,
      OPENROUTER_BASE_URL: config.openRouter.baseUrl,
      OPENROUTER_MODEL: config.openRouter.model,
      OPENROUTER_TIMEOUT_MS:
        config.openRouter.timeoutMs ??
        String(DEFAULTS.openRouterTimeoutMs),
      PORT: String(config.orchestrator.port),
      SPACETIME_DB_NAME: config.spacetime.dbName,
      SPACETIME_HOST: config.spacetime.host,
      ...(config.openRouter.apiKey
        ? { OPENROUTER_API_KEY: config.openRouter.apiKey }
        : {}),
    },
  };
}

export async function runPreflight(config, deps = {}) {
  const commandExists = deps.commandExists ?? defaultCommandExists;
  const fileExists = deps.fileExists ?? defaultFileExists;
  const isPortAvailable = deps.isPortAvailable ?? defaultIsPortAvailable;
  const readTextFile = deps.readTextFile ?? ((file) => readFile(file, "utf8"));
  const errors = [];

  for (const command of config.requiredExecutables) {
    if (!(await commandExists(command))) {
      errors.push(
        `Missing executable: ${command}. Install prerequisites in DEVELOPMENT.md.`
      );
    }
  }

  if (!(await fileExists(path.join(config.repoRoot, "node_modules")))) {
    errors.push(
      "Missing workspace dependencies: run npm install from repo root."
    );
  }

  for (const service of [
    ["spacetimedb", config.spacetime.port],
    ["orchestrator", config.orchestrator.port],
    ["frontend", config.frontend.port],
  ]) {
    const [name, port] = service;
    if (!(await isPortAvailable(port))) {
      errors.push(`Port ${port} is already in use by ${name}.`);
    }
  }

  errors.push(...validateConfig(config));

  if (config.mode === "fixture") {
    try {
      validateFixtureCatalog(JSON.parse(await readTextFile(config.fixturePath)));
    } catch (cause) {
      errors.push(
        `Fixture file invalid at ${config.fixturePath}: ${formatError(cause)}`
      );
    }
  }

  return {
    errors,
    ok: errors.length === 0,
  };
}

export function operatorReadyLines(config) {
  return [
    `SpacetimeDB: ready ${config.spacetime.host} db=${config.spacetime.dbName}`,
    `Orchestrator: ready ${config.orchestrator.url} mode=${config.mode}`,
    `Frontend: ready ${config.frontend.url}`,
    "Shutdown: press Ctrl+C once; runner stops frontend, orchestrator, then SpacetimeDB",
  ];
}

export async function runLocalDemo(config = buildRunnerConfig()) {
  const preflight = await runPreflight(config);
  if (!preflight.ok) {
    console.error("Preflight failed:");
    for (const error of preflight.errors) {
      console.error(`- ${error}`);
    }
    return 1;
  }

  const env = buildChildEnvironments(config);
  const children = [];
  const shutdown = async () => {
    await stopChildren(children);
  };

  installSignalHandlers(shutdown);

  try {
    await runCommand("setup", "npm", ["run", "spacetime:build"], {
      cwd: config.repoRoot,
    });

    const spacetime = startManagedProcess(
      "spacetimedb",
      "npm",
      ["run", "spacetime:start"],
      { cwd: config.repoRoot }
    );
    children.push(spacetime);
    await waitForTcpPort(config.spacetime.port, config.readinessTimeoutMs);

    await runCommand("spacetimedb", "npm", ["run", "spacetime:publish"], {
      cwd: config.repoRoot,
    });

    const orchestrator = startManagedProcess(
      "orchestrator",
      "npm",
      ["--workspace", "orchestrator", "run", "start"],
      { cwd: config.repoRoot, env: env.orchestrator }
    );
    children.push(orchestrator);
    await waitForHttpOk(
      `${config.orchestrator.url}/health`,
      config.readinessTimeoutMs
    );

    await runCommand(
      "spacetimedb",
      "spacetime",
      [
        "call",
        config.spacetime.dbName,
        "--server",
        config.spacetime.host,
        "set_deliberation_mode",
        '"queue"',
      ],
      { cwd: config.repoRoot }
    );

    const frontend = startManagedProcess(
      "frontend",
      "npm",
      [
        "run",
        "dev:client",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        String(config.frontend.port),
        "--strictPort",
      ],
      { cwd: config.repoRoot, env: env.frontend }
    );
    children.push(frontend);
    await waitForHttpOk(config.frontend.url, config.readinessTimeoutMs);

    for (const line of operatorReadyLines(config)) {
      console.log(line);
    }

    if (config.smoke) {
      await shutdown();
      return 0;
    }

    return await waitForShutdown(children, shutdown);
  } catch (cause) {
    console.error(formatError(cause));
    await shutdown();
    return 1;
  }
}

function parseArgs(argv) {
  const args = { smoke: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--smoke") {
      args.smoke = true;
    } else if (arg === "--mode") {
      args.mode = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--mode=")) {
      args.mode = arg.slice("--mode=".length);
    } else if (arg === "--readiness-timeout-ms") {
      args.readinessTimeoutMs = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--readiness-timeout-ms=")) {
      args.readinessTimeoutMs = arg.slice("--readiness-timeout-ms=".length);
    }
  }
  return args;
}

function validateConfig(config) {
  const errors = [];
  if (!VALID_MODES.has(config.mode)) {
    errors.push(
      `Invalid LLM_MODE: ${config.mode}. Accepted values: live, mock, fixture. Default: ${DEFAULTS.mode}.`
    );
  }
  if (config.mode === "live" && !config.openRouter.apiKey) {
    errors.push("OPENROUTER_API_KEY is required when LLM_MODE=live");
  }
  if (!isNonEmpty(config.spacetime.dbName)) {
    errors.push("SPACETIME_DB_NAME must not be empty; default solar-dominion.");
  }
  if (!isNonEmpty(config.frontend.dbName)) {
    errors.push(
      "VITE_SPACETIME_DB_NAME must not be empty; default solar-dominion."
    );
  }
  if (!isNonEmpty(config.viteModule)) {
    errors.push(
      "VITE_SPACETIMEDB_MODULE must not be empty; default solar-dominion."
    );
  }
  if (!isHttpUrl(config.spacetime.host)) {
    errors.push(
      `SPACETIME_HOST must be an absolute http(s) URL; default ${DEFAULTS.spacetimeHost}.`
    );
  }
  if (!isWsUrl(config.frontend.wsHost)) {
    errors.push(
      `VITE_SPACETIME_HOST must start with ws:// or wss://; default ${DEFAULTS.spacetimeWsHost}.`
    );
  }
  if (!isHttpUrl(config.frontend.httpUri)) {
    errors.push(
      `VITE_SPACETIMEDB_URI must be an absolute http(s) URL; default ${DEFAULTS.spacetimeHost}.`
    );
  }
  if (!isHttpUrl(config.openRouter.baseUrl)) {
    errors.push("OPENROUTER_BASE_URL must be a valid absolute URL");
  }
  if (!isValidTimeout(config.openRouter.timeoutMs)) {
    errors.push(
      `OPENROUTER_TIMEOUT_MS must be a positive integer <= ${MAX_OPENROUTER_TIMEOUT_MS}`
    );
  }
  return errors;
}

function startManagedProcess(name, command, args, options) {
  const child = spawnProcess(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logs = [];
  const record = (line, stream) => {
    const text = `[${name}] ${line}`;
    logs.push(text);
    if (logs.length > 40) {
      logs.shift();
    }
    stream.write(`${text}\n`);
  };

  prefixLines(child.stdout, (line) => record(line, process.stdout));
  prefixLines(child.stderr, (line) => record(line, process.stderr));

  return {
    child,
    command: `${command} ${args.join(" ")}`,
    logs,
    name,
  };
}

async function runCommand(name, command, args, options) {
  const child = startManagedProcess(name, command, args, options);
  const code = await waitForExit(child.child);
  if (code !== 0) {
    throw new Error(
      `${child.command} failed with exit code ${code}\n${child.logs
        .slice(-10)
        .join("\n")}`
    );
  }
}

function prefixLines(stream, onLine) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.length > 0) {
        onLine(line);
      }
    }
  });
  stream.on("end", () => {
    if (buffer.length > 0) {
      onLine(buffer);
    }
  });
}

function waitForExit(child) {
  return new Promise((resolve) => {
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

async function waitForShutdown(children, shutdown) {
  return await new Promise((resolve) => {
    let done = false;
    const finish = async (code) => {
      if (done) {
        return;
      }
      done = true;
      await shutdown();
      resolve(code);
    };

    for (const child of children) {
      child.child.once("exit", (code) => {
        console.error(
          `${child.name} exited before shutdown with code ${code ?? 0}.`
        );
        void finish(1);
      });
    }

    process.once("SIGINT", () => void finish(0));
    process.once("SIGTERM", () => void finish(0));
  });
}

function installSignalHandlers(shutdown) {
  const handler = () => {
    void shutdown().finally(() => process.exit(0));
  };
  process.once("SIGINT", handler);
  process.once("SIGTERM", handler);
}

async function stopChildren(children) {
  for (const child of [...children].reverse()) {
    if (child.child.exitCode !== null || child.child.killed) {
      continue;
    }
    child.child.kill("SIGTERM");
    await Promise.race([
      waitForExit(child.child),
      delay(5_000).then(() => {
        if (child.child.exitCode === null && !child.child.killed) {
          child.child.kill("SIGKILL");
        }
      }),
    ]);
  }
}

async function waitForTcpPort(port, timeoutMs) {
  await pollUntil(
    async () => {
      try {
        await connectTcp(port);
        return true;
      } catch {
        return false;
      }
    },
    timeoutMs,
    `http://localhost:${port} did not become reachable`
  );
}

async function waitForHttpOk(url, timeoutMs) {
  await pollUntil(
    async () => {
      try {
        const response = await fetch(url);
        return response.ok;
      } catch {
        return false;
      }
    },
    timeoutMs,
    `${url} readiness failed`
  );
}

async function pollUntil(check, timeoutMs, failureMessage) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) {
      return;
    }
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error(failureMessage);
}

function connectTcp(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.end();
      resolve();
    });
    socket.once("error", reject);
    socket.setTimeout(1_000, () => {
      socket.destroy();
      reject(new Error("timeout"));
    });
  });
}

async function defaultCommandExists(command) {
  return await new Promise((resolve) => {
    let child;
    try {
      child = spawnProcess(command, ["--version"], {
        stdio: "ignore",
      });
    } catch {
      resolve(false);
      return;
    }
    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });
}

async function defaultFileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function defaultIsPortAvailable(port) {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function readPort(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readPortFromUrl(value, fallback) {
  try {
    const parsed = new URL(value);
    if (parsed.port) {
      return Number(parsed.port);
    }
    return parsed.protocol === "https:" || parsed.protocol === "wss:"
      ? 443
      : 80;
  } catch {
    return fallback;
  }
}

function toWsUrl(value, fallback) {
  try {
    const parsed = new URL(value);
    parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    return parsed.href.replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function readOptional(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isWsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "ws:" || parsed.protocol === "wss:";
  } catch {
    return false;
  }
}

function isValidTimeout(value) {
  if (value === undefined) {
    return true;
  }
  const parsed = Number(value);
  return (
    Number.isInteger(parsed) &&
    parsed > 0 &&
    parsed <= MAX_OPENROUTER_TIMEOUT_MS
  );
}

function validateFixtureCatalog(value) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.schema_version !== 1 ||
    !Array.isArray(value.scenarios) ||
    value.scenarios.length === 0
  ) {
    throw new Error(
      "expected schema_version=1 and a non-empty scenarios array"
    );
  }
}

function formatError(cause) {
  return cause instanceof Error ? cause.message : String(cause);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnProcess(command, args, options) {
  if (process.platform === "win32" && command === "npm") {
    return spawn(toCommandLine(command, args), [], {
      ...options,
      shell: true,
    });
  }
  return spawn(resolveCommand(command), args, options);
}

function resolveCommand(command) {
  if (process.platform === "win32" && command === "spacetime") {
    const candidates = [
      process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "SpacetimeDB", "spacetime.exe")
        : undefined,
      process.env.LOCALAPPDATA
        ? path.join(
            process.env.LOCALAPPDATA,
            "SpacetimeDB",
            "bin",
            "current",
            "spacetimedb-cli.exe"
          )
        : undefined,
    ];
    const found = candidates.find((candidate) => candidate && existsSync(candidate));
    if (found) {
      return found;
    }
  }
  return command;
}

function toCommandLine(command, args) {
  return [command, ...args].map(quoteCmdArg).join(" ");
}

function quoteCmdArg(value) {
  if (/^[a-zA-Z0-9_./:@=+-]+$/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runLocalDemo()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((cause) => {
      console.error(formatError(cause));
      process.exitCode = 1;
    });
}
