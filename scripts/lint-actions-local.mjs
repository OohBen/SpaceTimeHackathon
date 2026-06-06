import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const workflowDir = resolve(process.cwd(), ".github", "workflows");
const workflows = readdirSync(workflowDir)
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .map((name) => join(workflowDir, name));

const failures = [];

function check(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

for (const file of workflows) {
  const text = readFileSync(file, "utf8");
  const relative = file.replace(`${process.cwd()}\\`, "").replace(`${process.cwd()}/`, "");

  check(/^name:\s+\S/m.test(text), `${relative}: missing workflow name`);
  check(/^on:\s*$/m.test(text), `${relative}: missing on block`);
  check(/^jobs:\s*$/m.test(text), `${relative}: missing jobs block`);
  check(!text.includes("${{ secrets."), `${relative}: live app secrets are not allowed in quality gates`);

  const uses = [...text.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => match[1]);
  for (const action of uses) {
    check(action.includes("@"), `${relative}: action ${action} is not version-pinned`);
  }
}

check(workflows.length > 0, "no workflows found in .github/workflows");

if (failures.length > 0) {
  console.error("Workflow lint failed");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Workflow lint passed: ${workflows.length} workflow file(s) checked`);
