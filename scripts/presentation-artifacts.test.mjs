import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readDoc() {
  return readFile(
    path.join(repoRoot, "docs", "P4E5-media-capture-recovery.md"),
    "utf8"
  );
}

test("media capture checklist maps to every live script moment", async () => {
  const doc = await readDoc();

  for (const required of [
    "M01-startup-ready-lines",
    "M02-turn-8-scenario-entry",
    "M03-player-a-callisto-action",
    "M04-player-b-jupiter-action",
    "M05-sync-moment",
    "M06-resolution-summary",
    "screenshot",
    "video",
    "docs/P4E5-live-demo-script.md",
  ]) {
    assert.match(doc, new RegExp(escapeRegExp(required), "i"));
  }
});

test("recovery and rehearsal protocol protects known presentation risks", async () => {
  const doc = await readDoc();

  for (const required of [
    "startup failure",
    "stale state",
    "browser desync",
    "missing narrative output",
    "npm run demo:presentation-smoke",
    "npm run demo:smoke",
    "operator checklist",
    "fallback path",
  ]) {
    assert.match(doc, new RegExp(escapeRegExp(required), "i"));
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
