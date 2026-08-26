# Distribute through npm with a bounded cross-platform runtime contract

pi-codegraph will use npm as its supported release channel and also publish a copyable single-file extension example. It requires Node.js 22 or later and supports macOS, Linux, and Windows, while Windows is experimental in v0.1 because command launcher behavior needs dedicated validation. If global and project-level copies both load, the first registered `codegraph_explore` tool remains active and later duplicates are skipped.

Each explore result is capped at 50 KB or 2,000 lines, whichever limit is reached first, and is marked when truncated. v0.1 trusts the existing CodeGraph index rather than adding a per-call freshness check. Missing prerequisites and command failures are raised as normalized Pi tool errors rather than returned as successful exploration text.

The extension invokes exploration only for structural questions, respects Pi cancellation, and terminates an unresponsive CLI after 30 seconds with `CODEGRAPH_TIMEOUT`. It records the detected CodeGraph version for diagnostics without enforcing a version range in v0.1.

The extension itself makes no network requests and collects no telemetry. On Windows it resolves `codegraph` before falling back to `codegraph.cmd`, without accepting a model-supplied executable path. Verification uses deterministic unit tests for process behavior plus a small real-CodeGraph fixture suite in CI.

For a non-zero CLI exit, the tool raises a normalized error with a stable error code and suggested remediation, plus at most the final 4 KB of stderr for diagnostic context. It never return raw Node stacks or unbounded command output.
