# pi-codegraph Context

This project provides a Pi-native path to CodeGraph's structural code exploration for the active workspace. The language below keeps its agent, extension, and index boundaries explicit.

## Language

**Active workspace**:
The single directory associated with the currently running Pi session; it is the only directory that pi-codegraph may inspect through CodeGraph.
_Avoid_: Project path, target directory

**CodeGraph index**:
The `.codegraph/` data prepared for an active workspace by a user-initiated CodeGraph initialization; v0.1 treats it as authoritative without checking whether it is current.
_Avoid_: Graph database, cache

**Explore request**:
A natural-language `query` supplied to the `codegraph_explore` tool for structural code investigation, rather than simple file reading or exact text search.
_Avoid_: Shell command, CLI argument string

**Pi extension**:
The Pi-loaded TypeScript integration that registers pi-codegraph's native tool and operates within a Pi session.
_Avoid_: MCP adapter, CodeGraph plugin
