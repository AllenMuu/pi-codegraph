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
3. It checks that `.codegraph/` exists; it never runs `codegraph init` automatically.
4. It checks that the CodeGraph executable is available.
5. The CLI runner calls `spawn("codegraph", ["explore", query], { cwd })`.
6. The runner returns useful stdout, or a normalized failure, to Pi.

## Security and reliability constraints

- Never shell-interpolate the query. Use `spawn` with an argument array.
- Never expose `projectPath` as an LLM tool parameter.
- Test quotes, shell metacharacters, whitespace, backslashes, and Unicode in queries.
- Keep stdout/stderr separate and cap captured output to protect the agent context.
- Respect cancellation signals and clean up the child process.
- Report `CODEGRAPH_NOT_FOUND` and `CODEGRAPH_NOT_INITIALIZED` without Node stack traces.

## Non-goals for v0.1

- MCP client or `codegraph serve --mcp` integration.
- Automatic CodeGraph install, `init`, index rebuild, or daemon lifecycle.
- Direct `.codegraph` database access or CodeGraph internal SDK imports.
- Arbitrary workspace selection, result rewriting, caching, fallback grep, or background sync.
- Multiple CodeGraph tools.
