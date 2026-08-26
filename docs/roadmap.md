# Project roadmap

## Guiding principle

Build a small, dependable native Pi experience first. Add capability only after the CLI-based exploration path is secure, observable, and tested.

## Milestone 0 — Project foundation

**Outcome:** a contributor can understand the project boundary and begin implementation confidently.

- Publish the repository and project documentation.
- Choose a license and contribution conventions.
- Establish TypeScript package, linting, test runner, and CI baseline.
- Verify the target Pi extension API and supported CodeGraph CLI contract.

## Milestone 1 — v0.1.0: Native Explore

**Outcome:** Pi can safely ask one structural question about the current indexed workspace.

- Register `codegraph_explore({ query })`.
- Build a reusable CodeGraph process runner based on `spawn`.
- Detect CodeGraph availability and `.codegraph/` initialization.
- Return raw useful `codegraph explore` output without semantic rewriting.
- Cover successful output, non-zero exits, missing executable, absent index, cancellation, output limits, and shell-sensitive query inputs with tests.
- Publish installation and usage instructions.

## Milestone 2 — Stabilization

**Outcome:** the initial integration is dependable across supported environments.

- Gather real-world query and error feedback.
- Clarify compatibility guarantees and supported CodeGraph/Pi versions.
- Improve error messages only where usage demonstrates a need.
- Add regression fixtures for CLI-output and subprocess edge cases.

## Future candidates — not committed

These are intentionally excluded from v0.1 and need separate design approval:

- Additional focused tools for query or impact analysis.
- Explicit, controlled multi-project support.
- Optional user-initiated index helpers.
- Version compatibility diagnostics.

MCP adaptation, background indexing, caching, and direct graph-database access remain outside the planned native-extension architecture unless a compelling use case changes that decision.
