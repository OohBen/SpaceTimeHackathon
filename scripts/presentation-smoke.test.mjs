import assert from "node:assert/strict";
import test from "node:test";

import {
  PRESENTATION_SMOKE_STEPS,
  runPresentationSmoke,
} from "./presentation-smoke.mjs";

test("covers every presentation-critical demo milestone", () => {
  assert.deepEqual(
    PRESENTATION_SMOKE_STEPS.map((step) => step.id),
    [
      "startup",
      "scenario-entry",
      "player-a-action",
      "player-b-action",
      "sync-moment",
      "resolution",
    ]
  );

  const failures = PRESENTATION_SMOKE_STEPS.map((step) => step.failure).join(
    "\n"
  );
  for (const phrase of [
    "startup readiness",
    "Turn 8 judge scenario",
    "player A action",
    "player B action",
    "turn sync",
    "resolution panel",
  ]) {
    assert.match(failures, new RegExp(phrase, "i"));
  }
});

test("passes against the committed local demo path without starting services", async () => {
  const result = await runPresentationSmoke({
    logger: { log() {}, error() {} },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
});
