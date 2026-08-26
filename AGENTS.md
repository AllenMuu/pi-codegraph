# Repository Guidelines

## Project Structure & Module Organization

This repository is currently in the v0.1 planning stage; the accepted scope is in `docs/specs/2026-08-26-v0.1-native-explore.md`. Architecture and constraints live in `docs/architecture.md`, and durable decisions live in `docs/adr/`. Keep terminology aligned with `CONTEXT.md`.

The planned TypeScript layout is:

```text
src/index.ts                 Pi extension registration
src/tools/explore.ts         codegraph_explore tool
src/codegraph/               CLI launch, detection, and error mapping
src/project/detect.ts        .codegraph index check
test/                        unit and fixed-fixture integration tests
examples/                    copyable single-file extension
```

Do not access `.codegraph` internals or add an MCP adapter. The only v0.1 tool is `codegraph_explore({ query })`.

## Build, Test, and Development Commands

Node.js 22+ is required. The implementation has not yet added a package manifest or scripts, so do not claim unimplemented commands work. Once the package is introduced, use its declared scripts as the source of truth; the expected workflow is:

```sh
npm install       # install repository dependencies
npm run build     # compile the extension
npm test          # run deterministic and fixture tests
npm run lint      # run configured static checks
```

Run the relevant test, then the complete suite before review.

## Coding Style & Naming Conventions

Use TypeScript with 2-space indentation, semicolons, and explicit types at process and Pi API boundaries. Name files in lowercase kebab-free paths such as `src/tools/explore.ts`; use `camelCase` for values/functions and `PascalCase` for types. Keep `index.ts` thin and put subprocess behavior behind a reusable internal runner.

Launch CodeGraph with a command-and-argument array, never shell interpolation. Derive the working directory exclusively from the Pi context; never accept a model-supplied path or executable override. Bound stdout and stderr, preserve cancellation, and return normalized error codes with remediation.

## Testing Guidelines

Test observable tool behavior, not helper call sequences. Use a controlled fake `codegraph` executable for argument preservation, missing CLI/index, non-zero exits, timeout, cancellation, truncation, duplicate registration, and Windows `.cmd` fallback. Keep a small fixed real-CodeGraph fixture for CI. Test names should describe behavior, for example `returns_CODEGRAPH_TIMEOUT_after_30_seconds`.

## Commit & Pull Request Guidelines

Follow the existing Conventional Commit style: `docs: add v0.1 native explore specification`. Use a focused type and imperative summary, e.g. `feat: add explore tool runner`. Keep commits scoped and do not stage local `handoff.md` or `.DS_Store` files.

PRs should state the user-facing change, link the issue, list tests run, and call out CLI, timeout, output-bound, or platform changes. Update architecture, ADR, or specification documents when a durable design decision changes.
