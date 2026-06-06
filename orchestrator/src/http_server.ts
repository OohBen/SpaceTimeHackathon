import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import {
  defaultFixturePath,
  loadFixtureCatalog,
} from "./fixture_llm_provider.js";
import {
  type LlmProviderConfig,
  readLlmProviderConfig,
} from "./openrouter_client.js";
import { ORCHESTRATOR_VERSION } from "./version.js";

export type OrchestratorServerConfig = {
  llm: LlmProviderConfig;
  port: number;
};

export type OrchestratorHealthPayload = {
  mode: LlmProviderConfig["mode"];
  provider: LlmProviderConfig["provider"];
  spacetime: {
    dbName: string;
    host: string;
  };
  status: "ok";
  version: string;
};

export type OrchestratorHttpServer = {
  listen: () => Promise<OrchestratorHttpServerHandle>;
};

export type OrchestratorHttpServerHandle = {
  close: () => Promise<void>;
  url: string;
};

type EnvRecord = Record<string, string | undefined>;

export function readOrchestratorServerConfig(
  env: EnvRecord = process.env
): OrchestratorServerConfig {
  return {
    llm: readLlmProviderConfig(env),
    port: readPort(env.PORT, 8787),
  };
}

export async function buildHealthPayload(
  config: OrchestratorServerConfig
): Promise<OrchestratorHealthPayload> {
  if (config.llm.mode === "fixture") {
    await loadFixtureCatalog(config.llm.fixturePath ?? defaultFixturePath());
  }

  return {
    mode: config.llm.mode,
    provider: config.llm.provider,
    spacetime: {
      dbName: config.llm.spacetime.dbName,
      host: config.llm.spacetime.host,
    },
    status: "ok",
    version: ORCHESTRATOR_VERSION,
  };
}

export function createOrchestratorHttpServer(
  config: OrchestratorServerConfig
): OrchestratorHttpServer {
  const server = createServer((request, response) => {
    void handleRequest(config, request, response);
  });

  return {
    async listen() {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(config.port, "127.0.0.1", resolve);
      });

      const address = server.address() as AddressInfo;
      return {
        async close() {
          await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          });
        },
        url: `http://127.0.0.1:${address.port}`,
      };
    },
  };
}

export async function startOrchestratorServer(
  env: EnvRecord = process.env,
  logger: Pick<Console, "error" | "log"> = console
): Promise<OrchestratorHttpServerHandle> {
  const config = readOrchestratorServerConfig(env);
  const server = await createOrchestratorHttpServer(config).listen();
  logger.log(
    `Orchestrator: listening ${server.url} mode=${config.llm.mode} db=${config.llm.spacetime.dbName}`
  );
  return server;
}

async function handleRequest(
  config: OrchestratorServerConfig,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  if (request.method === "GET" && request.url === "/health") {
    try {
      writeJson(response, 200, await buildHealthPayload(config));
    } catch (cause) {
      writeJson(response, 503, {
        error: cause instanceof Error ? cause.message : String(cause),
        status: "not_ready",
      });
    }
    return;
  }

  writeJson(response, 404, {
    error: "not_found",
  });
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function readPort(value: string | undefined, fallback: number): number {
  if (!value || value.trim().length === 0) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65_535) {
    throw new Error("PORT must be an integer between 0 and 65535");
  }
  return parsed;
}
