# CI Quality Gates

Issue #101 adds the security, hygiene, and contract gates from `docs/P5E3-ci-gate-matrix.md`.

## Local Commands

Run the fast local path before pushing:

```powershell
npm run lint:actions
npm run lint:markdown
npm run scan:secrets
npm run audit:dependencies
npm run test:contracts
```

`npm run ci:quality` runs the same sequence.

## Fast diagnosis

| Gate | First command | Failure signal |
|---|---|---|
| Secrets scan | `npm run scan:secrets` | File, line, and rule id in the console; SARIF in `artifacts/gitleaks.sarif`. |
| Dependency review | Pull request check | Package name, advisory, severity, and changed lockfile in the check annotation. |
| CodeQL | CodeQL check | SARIF alert path and query name in the GitHub Security annotation. |
| Actionlint | `npm run lint:actions`, then `actionlint` | Workflow file and expression or YAML syntax location. |
| Markdownlint | `npm run lint:markdown`, then `npx markdownlint-cli2 "**/*.md" "#**/node_modules/**"` | Markdown file and rule id. |
| Contract check | `npm run test:contracts` | Missing reducer, route, env key, request type, or LLM field. |

## Remediation

- Secrets: remove the committed value, rotate it outside the repo, then rerun `npm run scan:secrets`.
- Dependencies: upgrade or remove the vulnerable package and regenerate the lockfile.
- CodeQL: fix the source path named by the SARIF alert; do not suppress without PR rationale.
- Actions: fix the workflow expression or YAML location named by actionlint.
- Markdown: fix the rule violation or narrow `.markdownlint-cli2.jsonc` when the default rule conflicts with repo docs.
- Contracts: update `contracts/llm-orchestrator.contract.json` and `SPECS.md` together so backend reducers, frontend routes/env, and LLM shape stay aligned.

Normal validation does not require live app secrets. Workflows use `GITHUB_TOKEN` through the GitHub runtime context and mock contract fixtures only.
