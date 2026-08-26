# Project roadmap

## Guiding principle

Build a small, dependable native Pi experience first. Add capability only after the CLI-based exploration path is secure, observable, and tested.

CodeGraph upstream integrations are compatibility references, not prerequisites or a future migration target for this project.

## Milestone 0 — Project foundation

**Outcome:** a contributor can understand the project boundary and begin implementation confidently.

- Publish the repository and project documentation.
- Publish the MIT license and establish contribution conventions.
- Establish the npm package, a copyable single-file extension example, linting, test runner, and CI baseline.
- Declare Node.js 22+ and test it on supported LTS lines in CI.
- State the no-telemetry/no-extension-network policy in published documentation.
- Verify the target Pi extension API and supported CodeGraph CLI contract.

## Milestone 1 — v0.1.0: Native Explore

**Outcome:** Pi can safely ask one structural question about the current indexed workspace.

- Register `codegraph_explore({ query })`.
- Build a reusable CodeGraph process runner based on `spawn`.
- Detect CodeGraph availability and `.codegraph/` initialization.
- Record CodeGraph CLI version as non-blocking diagnostic metadata.
- Return raw useful `codegraph explore` output without semantic rewriting.
- Cover successful output, non-zero exits, missing executable, absent index, cancellation, the 30-second timeout, the 50 KB/2,000-line output limits, duplicate registration, and shell-sensitive query inputs with tests.
- Test macOS/Linux as supported platforms and Windows command launching as experimental compatibility.
- Add deterministic unit tests and a small fixed-fixture CodeGraph integration suite to CI.
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
