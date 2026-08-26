# pi-codegraph

A Pi-native extension that gives the [Pi coding agent](https://github.com/badlogic/pi-mono) structural understanding of the current workspace through the [CodeGraph](https://github.com/colbymchenry/codegraph) CLI.

## Status

Planning for `v0.1.0 — Native Explore`. The project is not implemented yet.

## Purpose

`pi-codegraph` exposes one focused Pi tool, `codegraph_explore`, for questions about code structure, symbols, relationships, implementations, and call paths. It runs CodeGraph in the active Pi workspace and returns the useful command output to the agent.

The project is **Pi-native, CodeGraph-compatible, and upstream-independent**:

- Pi-native: use Pi's extension APIs rather than embedding a generic MCP client.
- CodeGraph-compatible: depend on CodeGraph's public CLI contract only.
- Upstream-independent: do not require a CodeGraph fork or upstream Pi support.

## Initial architecture

```text
Pi agent
  └─ Pi extension: pi-codegraph
       └─ CodeGraph CLI (`codegraph explore <query>`)
            └─ current workspace's .codegraph/ index
```

See [the architecture document](docs/architecture.md) and [the roadmap](docs/roadmap.md) for the boundaries and planned milestones.

## v0.1 scope

- One LLM-callable tool: `codegraph_explore({ query })`.
- Execute `codegraph explore` in the active Pi workspace.
- Detect a missing CodeGraph CLI and missing `.codegraph/` index with actionable errors.
- Spawn the CLI using an argument array; never interpolate user input into a shell command.

Out of scope: MCP adapter/client support, automatic installation or indexing, direct database access, caching, background synchronization, and multiple tools.

## Contributing

The implementation plan will be added before development begins. Issues and design feedback are welcome.

## License

License selection is pending.
