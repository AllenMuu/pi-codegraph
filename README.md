# pi-codegraph

A Pi-native extension that provides the [Pi coding agent](https://github.com/badlogic/pi-mono) with structural code exploration capabilities through the [CodeGraph](https://github.com/colbymchenry/codegraph) CLI.

## Core Philosophy

- **Pi-native:** Integrates using Pi's native extension APIs (`registerTool`, `addPromptGuidelines`, `addPromptSnippet`) rather than introducing an MCP server lifecycle or adapter layer.
- **CodeGraph-compatible:** Interacts strictly through CodeGraph's public CLI interface (`codegraph explore <query>`). It does not touch `.codegraph` database internals or import internal CodeGraph packages.
- **Upstream-independent:** Functions independently without requiring CodeGraph upstream modifications, forks, or PRs.

## Prerequisites

1. **Node.js 22+** (macOS, Linux; Windows experimental).
2. **CodeGraph CLI** installed and available on your system `PATH`:
   ```sh
   # Verify CodeGraph CLI is available
   codegraph --version
   ```
3. **Initialized Workspace Index:** The active workspace must have a `.codegraph/` index:
   ```sh
   # Run in your project root once
   codegraph init
   ```

## Installation

### Option 1: npm Package

Install the package in your Pi environment:

```sh
npm install pi-codegraph
```

And load it in your Pi configuration:

```ts
import registerPiExtension from "pi-codegraph";

export default function (pi) {
  registerPiExtension(pi);
}
```

### Option 2: Copyable Single-File Extension

For local trial or direct audit without npm dependencies, copy [`examples/pi-codegraph.ts`](examples/pi-codegraph.ts) into your local Pi extensions directory.

## Features & LLM Capabilities

### `codegraph_explore`

Exposes exactly one focused LLM-callable tool:

```json
{
  "query": "How does authentication flow from API endpoints to the database?"
}
```

### Prompt Routing Guidance

The extension injects native prompt guidelines advising the agent when to choose `codegraph_explore`:

- **Use `codegraph_explore` for:**
  - System or module architecture
  - Multi-file feature implementations
  - Symbol relationships and implementations
  - Call paths and request lifecycles
  - Cross-file dependencies and change blast radius
- **Use built-in `grep` / `find` / `read` for:**
  - Exact literal string matching
  - Known files and line numbers
  - Documentation, configuration, build scripts, or generated files

## Security & Reliability Guardrails

- **Workspace Sandbox:** Derived exclusively from the active Pi session (`cwd`); LLM cannot supply arbitrary directory paths.
- **Safe Process Spawning:** Uses argument arrays (`spawn`), strictly preventing shell interpolation and injection risks.
- **Output Bounds:** Exploration output is capped at 50 KB or 2,000 lines with an explicit truncation notice to prevent model context exhaustion.
- **Timeout & Cancellation:** 30-second timeout (`CODEGRAPH_TIMEOUT`) and `AbortSignal` cancellation propagation ensure child processes are terminated promptly.
- **Zero Network & Zero Telemetry:** Sends no external network requests and collects no telemetry.

## Normalized Error Codes

Process failures return actionable error messages without leaking internal Node stack traces:

| Error Code | Meaning | Remediation |
| --- | --- | --- |
| `CODEGRAPH_NOT_FOUND` | CLI binary not located on `PATH` | Install CodeGraph or update system `PATH`. |
| `CODEGRAPH_NOT_INITIALIZED` | Workspace missing `.codegraph/` | Run `codegraph init` in workspace. |
| `CODEGRAPH_TIMEOUT` | Process exceeded 30 seconds | Refine query to be more specific. |
| `CODEGRAPH_ABORTED` | Cancelled by agent signal | Re-run if cancelled unintentionally. |
| `CODEGRAPH_COMMAND_FAILED` | CLI returned non-zero exit | Inspect the bounded stderr tail (up to 4 KB). |

## Development

```sh
npm install       # Install dependencies
npm run build     # Compile TypeScript (tsc)
npm test          # Run test suite
npm run lint      # Static type-check
```

## License

[MIT](LICENSE)
