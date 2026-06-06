// Live LLM queue worker entry point.
//
// Connects to the published SpacetimeDB module, drains queued `llm_requests`
// (request_type=proposals), calls OpenRouter, and writes advisory text back via
// the `fulfill_deliberation` / `fail_deliberation` reducers. Run with:
//   LLM_MODE=live OPENROUTER_API_KEY=... npx tsx src/worker.ts

import { DbConnection } from "./module_bindings/index.js";
import {
  createOpenRouterClient,
  readLlmProviderConfig,
  type LlmTextClient,
} from "./openrouter_client.js";
import {
  LLM_REQUEST_STATUS,
  LLM_REQUEST_TYPE,
  processProposalsRequest,
  type QueueRequestRow,
  type WorkerDeps,
} from "./queue_worker.js";

type WorkerEnv = Record<string, string | undefined>;

function readWorkerConfig(env: WorkerEnv = process.env): {
  uri: string;
  dbName: string;
  token: string | undefined;
} {
  const rawHost = env.SPACETIME_URI ?? env.SPACETIME_HOST ?? "wss://maincloud.spacetimedb.com";
  return {
    uri: toWsUri(rawHost),
    dbName: env.SPACETIME_DB_NAME ?? "solar-dominion",
    token: env.SPACETIMEDB_TOKEN && env.SPACETIMEDB_TOKEN.trim() ? env.SPACETIMEDB_TOKEN.trim() : undefined,
  };
}

function toWsUri(value: string): string {
  const v = value.trim();
  if (v.startsWith("http://")) return `ws://${v.slice("http://".length)}`;
  if (v.startsWith("https://")) return `wss://${v.slice("https://".length)}`;
  return v;
}

function makeLlmClient(): LlmTextClient {
  const config = readLlmProviderConfig(process.env);
  if (config.mode !== "live") {
    throw new Error(
      `worker requires LLM_MODE=live (got ${config.mode}); set OPENROUTER_API_KEY and LLM_MODE=live`
    );
  }
  return createOpenRouterClient(config.openRouter, { fetch });
}

const logger = (message: string, fields?: Record<string, unknown>): void => {
  console.log(JSON.stringify({ at: "worker", message, ...fields }));
};

function buildDeps(ctx: { db: AnyDb; reducers: AnyReducers }, llm: LlmTextClient): WorkerDeps {
  const db = ctx.db;
  return {
    llm,
    log: logger,
    getFaction: (id) => {
      for (const f of db.factions.iter()) if (f.id === id) return f;
      return undefined;
    },
    getCitiesForFaction: (id) => [...db.cities.iter()].filter((c) => c.faction_id === id),
    getPersonnelForFaction: (id) => [...db.personnel.iter()].filter((p) => p.faction_id === id),
    getBodies: (sessionId) => [...db.celestial_bodies.iter()].filter((b) => b.session_id === sessionId),
    getRecentEvents: (sessionId, factionId) =>
      [...db.events.iter()]
        .filter((e) => e.session_id === sessionId && (e.faction_id == null || e.faction_id === factionId))
        .sort((a, b) => a.turn - b.turn),
    fulfill: (requestId, itemsJson) => {
      ctx.reducers.fulfillDeliberation({ requestId, itemsJson });
    },
    fail: (requestId, error, errorCode) => {
      ctx.reducers.failDeliberation({ requestId, error, errorCode });
    },
  };
}

const inFlight = new Set<number>();

function isDrainable(row: QueueRequestRow): boolean {
  return row.status === LLM_REQUEST_STATUS.queued && row.request_type === LLM_REQUEST_TYPE.proposals;
}

async function handle(ctx: { db: AnyDb; reducers: AnyReducers }, row: QueueRequestRow, llm: LlmTextClient): Promise<void> {
  if (!isDrainable(row) || inFlight.has(row.id)) return;
  inFlight.add(row.id);
  try {
    await processProposalsRequest(row, buildDeps(ctx, llm));
  } finally {
    inFlight.delete(row.id);
  }
}

function main(): void {
  const cfg = readWorkerConfig();
  const llm = makeLlmClient();
  logger("starting", { uri: cfg.uri, db: cfg.dbName });

  let builder = DbConnection.builder().withUri(cfg.uri).withDatabaseName(cfg.dbName);
  if (cfg.token) builder = builder.withToken(cfg.token);

  builder
    .onConnect((ctx, identity) => {
      logger("connected", { identity: identity.toHexString().slice(0, 12) });
      ctx
        .subscriptionBuilder()
        .onApplied(() => {
          logger("subscription applied; draining backlog");
          for (const row of ctx.db.llm_requests.iter()) {
            void handle(ctx, row as QueueRequestRow, llm);
          }
        })
        .subscribe([
          "SELECT * FROM llm_requests",
          "SELECT * FROM factions",
          "SELECT * FROM cities",
          "SELECT * FROM personnel",
          "SELECT * FROM celestial_bodies",
          "SELECT * FROM events",
          "SELECT * FROM game_sessions",
        ]);

      ctx.db.llm_requests.onInsert((rowCtx: { db: AnyDb; reducers: AnyReducers }, row: QueueRequestRow) => {
        void handle(rowCtx, row, llm);
      });
    })
    .onConnectError((_ctx, err) => {
      logger("connect_error", { error: err instanceof Error ? err.message : String(err) });
      process.exitCode = 1;
    })
    .onDisconnect(() => {
      logger("disconnected");
    })
    .build();
}

// Minimal structural types for the generated SDK surface used here.
type AnyTable<T> = { iter(): Iterable<T>; onInsert(cb: (ctx: never, row: T) => void): void };
type AnyDb = {
  llm_requests: AnyTable<QueueRequestRow> & { onInsert(cb: (ctx: { db: AnyDb; reducers: AnyReducers }, row: QueueRequestRow) => void): void };
  factions: { iter(): Iterable<{ id: number; name: string; doctrine_vector: string }> };
  cities: { iter(): Iterable<{ faction_id: number; name: string; population: number | bigint; morale: number; infrastructure_level: number }> };
  personnel: { iter(): Iterable<{ faction_id: number; name: string; department: string; competence: number; creativity: number; reliability: number; ambition: number; political_skill: number }> };
  celestial_bodies: { iter(): Iterable<{ session_id: number; name: string }> };
  events: { iter(): Iterable<{ session_id: number; faction_id: number | null | undefined; turn: number; event_type: string; payload: string }> };
};
type AnyReducers = {
  fulfillDeliberation(args: { requestId: number; itemsJson: string }): void;
  failDeliberation(args: { requestId: number; error: string; errorCode: string }): void;
};

main();
