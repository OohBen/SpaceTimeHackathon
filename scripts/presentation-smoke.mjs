import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildRunnerConfig,
  operatorReadyLines,
} from "./local-demo-runner.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

export const PRESENTATION_SMOKE_STEPS = [
  {
    id: "startup",
    label: "Local stack startup contract",
    failure:
      "startup readiness check failed: demo scripts or runner ready lines changed",
    check: checkStartup,
  },
  {
    id: "scenario-entry",
    label: "Turn 8 judge scenario entry",
    failure:
      "Turn 8 judge scenario check failed: fixture, reducer, or binding changed",
    check: checkScenarioEntry,
  },
  {
    id: "player-a-action",
    label: "Player A proposal action path",
    failure:
      "player A action check failed: route, inbox action, or reducer binding changed",
    check: (root) => checkPlayerAction(root, "player_a"),
  },
  {
    id: "player-b-action",
    label: "Player B proposal action path",
    failure:
      "player B action check failed: route, inbox action, or reducer binding changed",
    check: (root) => checkPlayerAction(root, "player_b"),
  },
  {
    id: "sync-moment",
    label: "Turn sync and readiness signals",
    failure:
      "turn sync check failed: subscription bridge or readiness UI changed",
    check: checkSyncMoment,
  },
  {
    id: "resolution",
    label: "Resolution panel and acknowledgement path",
    failure:
      "resolution panel check failed: summary, ack, or reducer binding changed",
    check: checkResolution,
  },
];

export async function runPresentationSmoke({
  root = repoRoot,
  logger = console,
} = {}) {
  const failures = [];

  for (const step of PRESENTATION_SMOKE_STEPS) {
    try {
      await step.check(root);
      logger.log?.(`PASS ${step.id}: ${step.label}`);
    } catch (error) {
      const failure = {
        id: step.id,
        label: step.label,
        failure: step.failure,
        detail: formatError(error),
      };
      failures.push(failure);
      logger.error?.(`FAIL ${step.id}: ${step.failure}`);
      logger.error?.(`  ${failure.detail}`);
    }
  }

  return { ok: failures.length === 0, failures };
}

async function checkStartup(root) {
  const packageJson = await readJson(root, "package.json");
  const scripts = packageJson.scripts ?? {};

  requireEqual(
    scripts.demo,
    "node scripts/local-demo-runner.mjs",
    "npm run demo must start the managed local runner"
  );
  requireEqual(
    scripts["demo:smoke"],
    "node scripts/local-demo-runner.mjs --smoke",
    "npm run demo:smoke must use the same startup path in smoke mode"
  );

  const config = buildRunnerConfig({}, []);
  requireEqual(config.mode, "fixture", "fixture mode must remain the default");
  requireEqual(
    config.frontend.url,
    "http://localhost:5173",
    "frontend URL must match the script"
  );

  const ready = operatorReadyLines(config).join("\n");
  requireIncludes(
    ready,
    "SpacetimeDB: ready http://localhost:3000 db=solar-dominion",
    "spacetime ready line"
  );
  requireIncludes(
    ready,
    "Orchestrator: ready http://localhost:8787 mode=fixture",
    "orchestrator ready line"
  );
  requireIncludes(ready, "Frontend: ready http://localhost:5173", "frontend ready line");
}

async function checkScenarioEntry(root) {
  const fixture = await readJson(root, "orchestrator/fixtures/scenarios.json");
  const turn8 = fixture.scenarios?.find(
    (scenario) =>
      scenario.request_type === "proposals" &&
      scenario.scenario_id === "turn-8-judge"
  );
  if (!turn8) {
    throw new Error("missing proposals::turn-8-judge fixture");
  }

  const proposalTitles = JSON.stringify(turn8.response?.proposals ?? []);
  for (const title of [
    "Callisto Pre-Positioning Order",
    "Jupiter Foundry Expansion",
    "Doctrine Signaling Publication",
  ]) {
    requireIncludes(proposalTitles, title, `fixture proposal ${title}`);
  }

  const turn8Seed = await readText(root, "server/src/turn8_seed.ts");
  requireIncludes(turn8Seed, "mars_pressure_callisto_opportunity", "scenario id");
  requireIncludes(turn8Seed, "Pavonis Hub", "Mars pressure cue");
  requireIncludes(turn8Seed, "Callisto Outpost", "Callisto opportunity cue");

  const serverEntrypoint = await readText(root, "server/src/index.ts");
  requireIncludes(serverEntrypoint, "seed_demo_turn_8", "server reducer export");

  const bindings = await readText(root, "client/src/module_bindings/index.ts");
  requireIncludes(bindings, "seed_demo_turn_8", "generated client binding");
}

async function checkPlayerAction(root, slot) {
  const app = await readText(root, "client/src/routes/AppRouter.tsx");
  const inbox = await readText(root, "client/src/components/inbox/Inbox.tsx");
  const actions = await readText(root, "client/src/spacetime/session-actions.ts");
  const bindings = await readText(root, "client/src/module_bindings/index.ts");

  requireIncludes(app, slot, `${slot} route support`);
  requireIncludes(app, "LOCAL_DEMO_SESSION_ID", "local demo route fallback");
  requireIncludes(inbox, "Proposal decision controls", "proposal decision controls");
  requireIncludes(inbox, "Approve", "approve button");
  requireIncludes(inbox, "Submit turn", "submit turn button");
  requireIncludes(actions, "commanderDecisionAction", "commander decision action");
  requireIncludes(actions, "submitTurnAction", "submit turn action");
  requireIncludes(bindings, "commander_decision", "commander decision reducer binding");
  requireIncludes(bindings, "submit_turn", "submit turn reducer binding");
}

async function checkSyncMoment(root) {
  const bridge = await readText(root, "client/src/session/liveBridge.ts");
  const inbox = await readText(root, "client/src/components/inbox/Inbox.tsx");
  const store = await readText(root, "client/src/state/session-store.ts");

  requireIncludes(bridge, "subscriptionBuilder().subscribe", "live subscription bridge");
  requireIncludes(bridge, "tables.turn_summaries", "turn summary subscription");
  requireIncludes(bridge, "tables.game_sessions", "session subscription");
  requireIncludes(store, "turnSummariesById", "turn summary state");
  requireIncludes(inbox, "turn-readiness", "turn readiness signal");
  requireIncludes(inbox, "turn-submit-readiness", "turn submit readiness signal");
}

async function checkResolution(root) {
  const app = await readText(root, "client/src/routes/AppRouter.tsx");
  const inbox = await readText(root, "client/src/components/inbox/Inbox.tsx");
  const bindings = await readText(root, "client/src/module_bindings/index.ts");
  const reducer = await readText(root, "server/src/turn_resolution.ts");

  requireIncludes(app, "Turn resolution summary", "global resolution panel");
  requireIncludes(inbox, "Resolution review", "inbox resolution review");
  requireIncludes(inbox, "Acknowledge resolution", "acknowledge resolution button");
  requireIncludes(bindings, "ack_resolution", "ack reducer binding");
  requireIncludes(bindings, "turn_summaries", "turn summaries table binding");
  requireIncludes(reducer, "resolution_acknowledged", "resolution acknowledgement event");
}

async function readText(root, relativePath) {
  const target = path.join(root, relativePath);
  try {
    return await readFile(target, "utf8");
  } catch (error) {
    throw new Error(`${relativePath} missing or unreadable: ${formatError(error)}`);
  }
}

async function readJson(root, relativePath) {
  const text = await readText(root, relativePath);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${relativePath} has invalid JSON: ${formatError(error)}`);
  }
}

function requireIncludes(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`${label}: expected "${needle}"`);
  }
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected "${expected}", got "${actual}"`);
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runPresentationSmoke();
  if (!result.ok) {
    process.exitCode = 1;
  }
}
