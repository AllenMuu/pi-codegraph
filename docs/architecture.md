# Project architecture

## Goal

`pi-codegraph` is an independent Pi extension that lets the Pi coding agent explore the code structure of its current workspace through an existing CodeGraph index.

The integration boundary is the public CodeGraph CLI, not CodeGraph internals or its SQLite data. This keeps the extension small, portable, and independent of upstream acceptance.

## System boundary

```text
┌────────────────────────────────────────────────────┐
│ Pi session                                          │
│  ┌──────────────┐    registerTool()                 │
│  │ Pi agent     │ ─────────────────► pi-codegraph   │
│  └──────────────┘                      extension    │
└─────────────────────────────────────────┬──────────┘
                                          │ spawn(args)
                                          ▼
                                 CodeGraph CLI
                                          │
                                          ▼
                         .codegraph/ in Pi workspace
```

The extension derives the working directory from the active Pi session. The tool accepts no project-path parameter, preventing model-directed access to arbitrary directories.

## Distribution and compatibility

The supported release artifact is an npm package. The repository will also include a single-file extension example for local review and trial use. The target runtime is Node.js 22+ on macOS, Linux, and Windows; Windows support is experimental in v0.1 while command-launcher differences are validated. If a global and a project-local installation both load, the first `codegraph_explore` registration stays active and later duplicate registrations are skipped.

The extension makes no network requests and records no telemetry. It relies only on Pi's runtime and the local CodeGraph CLI selected from `PATH`; it never accepts a model-supplied executable path.

## v0.1 components

```text
src/
├── index.ts                 Pi registration layer
├── tools/explore.ts         codegraph_explore tool
├── codegraph/
│   ├── cli.ts               subprocess runner
│   ├── detect.ts            executable/version detection
│   └── errors.ts            agent-friendly error mapping
└── project/detect.ts        .codegraph/ workspace check
```

### Responsibilities

| Component | Responsibility |
| --- | --- |
| `index.ts` | Register Pi tools and provide prompt guidance; keep framework glue thin. |
| `tools/explore.ts` | Validate `{ query }`, resolve the active workspace, and orchestrate the exploration flow. |
| `codegraph/cli.ts` | Spawn `codegraph` safely, collect stdout/stderr, handle cancellation and output limits. |
| `codegraph/detect.ts` | Determine whether CodeGraph is executable on `PATH`. |
| `codegraph/errors.ts` | Convert process failures into concise, actionable errors. |
| `project/detect.ts` | Confirm that the current workspace contains `.codegraph/`. |

## Runtime flow

1. Pi invokes `codegraph_explore` with a natural-language `query`.
2. The extension resolves Pi's current workspace as the only working directory.
3. It checks that `.codegraph/` exists and treats the existing index as authoritative; it neither checks freshness nor runs `codegraph init` automatically.
4. It checks that the CodeGraph executable is available. On Windows it tries `codegraph`, then `codegraph.cmd`.
5. It records the detected CodeGraph version for diagnostics without enforcing a version range.
6. The CLI runner calls `spawn("codegraph", ["explore", query], { cwd, signal })` and terminates it after 30 seconds if it has not completed.
7. The runner returns useful stdout, capped at 50 KB or 2,000 lines and marked if truncated; normalized failures are raised as Pi tool errors.

## Security and reliability constraints

- Never shell-interpolate the query. Use `spawn` with an argument array.
- Never expose `projectPath` as an LLM tool parameter.
- Never expose an executable-path override as an LLM tool parameter.
- Test quotes, shell metacharacters, whitespace, backslashes, and Unicode in queries.
- Keep stdout/stderr separate and cap captured output to protect the agent context.
- Cap returned exploration output at 50 KB or 2,000 lines, whichever occurs first, and clearly indicate truncation.
- Respect cancellation signals and clean up the child process.
- Terminate unresponsive CLI processes after 30 seconds and report `CODEGRAPH_TIMEOUT`.
- Raise `CODEGRAPH_NOT_FOUND`, `CODEGRAPH_NOT_INITIALIZED`, and non-zero CLI failures as normalized tool errors without Node stack traces; include at most the final 4 KB of stderr for a non-zero exit.
- Make no extension-originated network request and collect no telemetry.

## Tool-routing guidance

`codegraph_explore` is intended for architecture, symbol relationships, call paths, implementation discovery, and impact-oriented questions. It is not the default for a simple file read or an exact text search, where Pi's built-in tools are cheaper and more direct.

## Non-goals for v0.1

- MCP client or `codegraph serve --mcp` integration.
- Automatic CodeGraph install, `init`, index rebuild, or daemon lifecycle.
- Direct `.codegraph` database access or CodeGraph internal SDK imports.
- Arbitrary workspace selection, result rewriting, caching, fallback grep, or background sync.
- Multiple CodeGraph tools.

## Verification strategy

Unit tests use controlled child-process fakes to cover argument handling, cancellation, timeout, output limits, duplicate registration, Windows executable fallback, and normalized errors. A small CI integration suite runs against a fixed CodeGraph fixture to detect public CLI-contract drift without depending on an arbitrary user repository.
