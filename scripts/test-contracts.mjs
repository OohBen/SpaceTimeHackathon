import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const contractPath = resolve(root, "contracts/llm-orchestrator.contract.json");
const specsPath = resolve(root, "SPECS.md");

function fail(message) {
  throw new Error(
    `Contract check failed: ${message}\nRemediation: update contracts/llm-orchestrator.contract.json and SPECS.md together.`
  );
}

function requireArray(owner, key) {
  const value = owner?.[key];
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${key} must be a non-empty array`);
  }
  return value;
}

function requireIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    fail(`${label} missing ${needle}`);
  }
}

const contract = JSON.parse(readFileSync(contractPath, "utf8"));
const specs = readFileSync(specsPath, "utf8");

if (contract.version !== 1) {
  fail("contract version must be 1");
}

for (const reducer of requireArray(contract.backend, "requiredReducers")) {
  requireIncludes(specs, `\`${reducer}(`, "SPECS reducer list");
}

for (const route of requireArray(contract.frontend, "requiredRoutes")) {
  requireIncludes(specs, route, "SPECS frontend routes");
}

for (const envName of requireArray(contract.frontend, "requiredEnv")) {
  requireIncludes(specs, `\`${envName}\``, "SPECS environment table");
}

const llm = contract.llm ?? {};
for (const key of [
  "requestTypes",
  "requestRequiredFields",
  "contextRequiredFields",
  "responseRequiredFields",
  "itemRequiredFields",
  "confidenceValues"
]) {
  requireArray(llm, key);
}

for (const requestType of llm.requestTypes) {
  requireIncludes(specs, requestType, "SPECS llm_requests request_type list");
}

for (const confidence of llm.confidenceValues) {
  requireIncludes(specs, confidence, "SPECS proposal confidence values");
}

const requiredRequestFields = new Set(llm.requestRequiredFields);
for (const field of ["sessionId", "factionId", "requestType", "turn", "context"]) {
  if (!requiredRequestFields.has(field)) {
    fail(`LLM request field missing ${field}`);
  }
}

const requiredResponseFields = new Set(llm.responseRequiredFields);
for (const field of ["status", "items", "usage"]) {
  if (!requiredResponseFields.has(field)) {
    fail(`LLM response field missing ${field}`);
  }
}

if (/OPENROUTER_API_KEY\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/.test(JSON.stringify(contract))) {
  fail("contract fixture must not contain live app secrets");
}

console.log("Contract checks passed: reducers, routes, env, and LLM fixture shape match SPECS.md");
