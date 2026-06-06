import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([".git", ".claude", ".codex-tmp", "node_modules", "dist", "build"]);
const ignoredFiles = new Set(["AIDER.md", "ANTIGRAVITY.md", "CLAUDE.md", "CODEX.md", "GEMINI.md"]);
const markdownFiles = [];

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
    if (name.endsWith(".md") && !ignoredFiles.has(name)) {
      markdownFiles.push(full);
    }
  }
}

walk(root);

const failures = [];

for (const file of markdownFiles) {
  const rel = relative(root, file);
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  let fenceCount = 0;
  let inFence = false;

  lines.forEach((line, index) => {
    if (/^```/.test(line.trim())) {
      fenceCount += 1;
      inFence = !inFence;
      return;
    }
    if (inFence) {
      return;
    }
    if (line.startsWith("\t")) {
      failures.push(`${rel}:${index + 1}: heading/list indentation starts with a tab`);
    }
    if (/^#{1,6}(?![#\s\d])/.test(line)) {
      failures.push(`${rel}:${index + 1}: heading marker needs a following space`);
    }
  });

  if (fenceCount % 2 !== 0) {
    failures.push(`${rel}: unbalanced fenced code block`);
  }
}

if (failures.length > 0) {
  console.error("Markdown lint failed");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Markdown lint passed: ${markdownFiles.length} markdown file(s) checked`);
