# P5E3 CI Gate Matrix

Issue: #100

Parent epic: #30 P5E3 - Security and Quality Gates

Purpose: define the gate plan that #101 can implement and #99 can verify. This task does not add workflows. It fixes the expected workflow entry point, local entry point, artifact, and handoff shape first.

## Gate Matrix

| Gate | Workflow entry point | Local developer invocation | Expected artifact | Notes |
|---|---|---|---|---|
| gitleaks | `.github/workflows/security-quality-gates.yml`, job `secrets-scan`, on `pull_request` and `push` to `main` or `epic/**` | `gitleaks detect --source . --redact --report-format sarif --report-path artifacts/gitleaks.sarif` | `artifacts/gitleaks.sarif`, GitHub code scanning upload when permitted, job summary with redacted finding paths | Must not require repository secrets. Failures should name the file, rule, and remediation path. |
| dependency review | `.github/workflows/security-quality-gates.yml`, job `dependency-review`, on `pull_request` | GitHub-hosted gate only. Local substitute: `npm audit --audit-level=moderate` per workspace once lockfiles exist. | Pull request annotations and dependency review summary | Requires dependency graph and lockfiles. Use `actions/dependency-review-action`; no live app secrets. |
| CodeQL | Preferred: `.github/workflows/codeql.yml`, jobs for JavaScript/TypeScript. Matrix may also be linked from `.github/workflows/security-quality-gates.yml`. | Optional local deep check: `codeql database create artifacts/codeql-db --language=javascript-typescript --source-root .` then `codeql database analyze`. Normal local path can be skipped when CodeQL CLI is absent. | Code scanning SARIF results and Actions summary | Requires `security-events: write` for upload. Public repos normally support this with `GITHUB_TOKEN`. |
| actionlint | `.github/workflows/security-quality-gates.yml`, job `workflow-lint`, on `pull_request` and `push` to `main` or `epic/**` | `npx actionlint` or packaged script `npm run lint:actions` | Actions log annotations and job summary | Scope `.github/workflows/**/*.yml` and `.yaml`. Pin actionlint setup version in workflow. |
| markdownlint | `.github/workflows/security-quality-gates.yml`, job `markdown-lint`, on `pull_request` and `push` to `main` or `epic/**` | `npx markdownlint-cli2 "**/*.md" "#node_modules"` or packaged script `npm run lint:markdown` | Actions log annotations and optional markdownlint text artifact | Scope repo markdown, excluding `node_modules`, generated build output, and session artifacts. |
| contract checks | `.github/workflows/security-quality-gates.yml`, job `contract-check`, after app workspaces exist | `npm run test:contracts` or `npm --prefix <workspace> test -- <contract test path>` | Test log plus machine-readable test output when available | First useful contract: backend/frontend/LLM boundary shapes for reducer names, generated bindings, prompt request/response fields, and mock fixture expectations. |

## Baseline Tooling Entry Points

Expected scripts after #101 lands:

| Script | Purpose |
|---|---|
| `npm run lint:actions` | Run actionlint locally against workflow files. |
| `npm run lint:markdown` | Run markdownlint locally against tracked Markdown. |
| `npm run scan:secrets` | Run gitleaks locally with redacted SARIF output. |
| `npm run audit:dependencies` | Run dependency audit locally without requiring GitHub APIs. |
| `npm run test:contracts` | Run cross-boundary contract checks without live app secrets. |

Until a root workspace exists, #101 can place equivalent scripts in the relevant workspace and document the command in workflow failure messages.

## Assumptions, Secrets, and Permissions

- Normal pull request validation must not need live app secrets such as deployment tokens, hosted database credentials, or LLM API keys.
- `GITHUB_TOKEN` is enough for dependency review comments, workflow checkout, and CodeQL upload when repo security settings allow code scanning.
- Dependency review needs GitHub dependency graph data and committed lockfiles.
- CodeQL is CI-first. Local CodeQL is optional because the CLI may not be installed on developer machines.
- Gitleaks must redact secret values in logs and artifacts.
- Contract checks should use generated or mock fixtures only.

## Local Developer Invocation

Fast local sequence once #101 adds scripts:

```powershell
npm run lint:actions
npm run lint:markdown
npm run scan:secrets
npm run audit:dependencies
npm run test:contracts
```

Fallback sequence if scripts are not available yet:

```powershell
npx actionlint
npx markdownlint-cli2 "**/*.md" "#node_modules"
gitleaks detect --source . --redact
npm audit --audit-level=moderate
```

CodeQL local fallback, only when the CLI is installed:

```powershell
codeql database create artifacts/codeql-db --language=javascript-typescript --source-root .
codeql database analyze artifacts/codeql-db --format=sarif-latest --output=artifacts/codeql.sarif
```

## Missing Repo Prerequisites

Current P5E3 epic base is still a scaffold branch. Before workflows become useful, implementation tasks need these prerequisites from dependent epics or local additions:

- `.github/workflows/` directory for CI entry points.
- Root `package.json` or clearly documented workspace-level package scripts.
- Committed package lockfiles so dependency review and local audit can inspect real dependencies.
- Stable Node version declaration through `.nvmrc`, `package.json engines`, or workflow `setup-node` version.
- Contract surface to test: generated SpacetimeDB bindings, reducer names, orchestrator request/response schema, or fixture JSON.
- Markdownlint configuration if default rules conflict with existing project docs.
- Artifact directory policy, likely `artifacts/` ignored locally and uploaded only from CI.

## Handoff

- #101 P5E3-T2/T4 should implement `.github/workflows/security-quality-gates.yml`, add the scripts above where practical, and include actionable failure messages.
- #102 P5E3-T3 is the hygiene slice for actionlint and markdownlint. If already closed, #101 should preserve its intent in the compressed workflow.
- #104 P5E3-T4 is the contract/failure-doc slice. If already closed, #101 should still use this matrix for the contract job shape.
- #99 P5E3-T5 should verify CI triggers, `npm test` or the current project success script, failure readability, and no live secret dependency.

