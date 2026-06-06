import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([
  ".git",
  ".claude",
  ".codex-tmp",
  "artifacts",
  "node_modules",
  "dist",
  "build",
  "target",
  ".venv",
  "venv"
]);
const scannedExtensions = new Set([
  ".cjs",
  ".env",
  ".example",
  ".js",
  ".json",
  ".jsonc",
  ".md",
  ".mjs",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml"
]);

const patterns = [
  {
    id: "private-key",
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/
  },
  {
    id: "github-token",
    regex: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/
  },
  {
    id: "openrouter-key",
    regex: /OPENROUTER_API_KEY\s*=\s*(?![('"]|example|your_|<|redacted|$)[^\s#]+/i
  },
  {
    id: "generic-secret-assignment",
    regex: /\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*["'](?!example|placeholder|redacted|dummy|test|mock|fixture|<|\$\{\{)[A-Za-z0-9_./+=-]{20,}["']/i
  }
];

const files = [];

function shouldScan(name) {
  if (name === ".env.example") {
    return true;
  }
  return scannedExtensions.has(extname(name));
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!ignoredDirs.has(name)) {
        walk(full);
      }
      continue;
    }
    if (shouldScan(name)) {
      files.push(full);
    }
  }
}

walk(root);

const findings = [];

for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, "/");
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        findings.push({ file: rel, line: index + 1, ruleId: pattern.id });
      }
    }
  });
}

const sarif = {
  version: "2.1.0",
  $schema: "https://json.schemastore.org/sarif-2.1.0.json",
  runs: [
    {
      tool: {
        driver: {
          name: "local-secret-pattern-scan",
          informationUri: "https://github.com/gitleaks/gitleaks",
          rules: patterns.map((pattern) => ({
            id: pattern.id,
            shortDescription: { text: pattern.id },
            help: { text: "Remediation: remove the secret, rotate it, and use env/config injection." }
          }))
        }
      },
      results: findings.map((finding) => ({
        ruleId: finding.ruleId,
        message: {
          text: `Potential secret in ${finding.file}. Remediation: remove and rotate before merge.`
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: finding.file },
              region: { startLine: finding.line }
            }
          }
        ]
      }))
    }
  ]
};

mkdirSync(resolve(root, "artifacts"), { recursive: true });
writeFileSync(resolve(root, "artifacts", "gitleaks.sarif"), `${JSON.stringify(sarif, null, 2)}\n`);

if (findings.length > 0) {
  console.error("Secret scan failed");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.ruleId}`);
  }
  console.error("Remediation: remove the secret, rotate it, then rerun npm run scan:secrets.");
  process.exit(1);
}

console.log(`Secret scan passed: ${files.length} file(s) checked, SARIF written to artifacts/gitleaks.sarif`);
