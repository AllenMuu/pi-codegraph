# Use a native Pi extension with the CodeGraph CLI boundary

pi-codegraph will register native Pi tools and invoke the public `codegraph` CLI in the active workspace. It will not embed an MCP client, depend on CodeGraph internals, or access `.codegraph/` directly, keeping the integration Pi-native and independent of upstream CodeGraph support. Upstream Pi integration work is a compatibility reference only; this project neither waits for nor migrates to an upstream implementation.

## Considered Options

- Pi extension → CodeGraph CLI — accepted for the smallest, explicit process boundary.
- Pi → MCP adapter → CodeGraph MCP server — rejected for v0.1 because it adds protocol and server-lifecycle complexity without improving the native Pi experience.
