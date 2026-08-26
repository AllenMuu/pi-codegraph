import { createExploreTool, type ExploreToolOptions, type PiToolDefinition } from "./tools/explore.js";

export const VERSION = "0.1.0";

export const PROMPT_GUIDELINES = `
# CodeGraph Exploration Guidelines

Use \`codegraph_explore\` first when understanding:
- High-level system, module, or service architecture
- Feature implementations across multiple files
- Symbol relationships (who defines, uses, or implements a symbol)
- Call paths, execution flow, and request lifecycles
- Cross-file dependencies and change blast radius
- Relevant code by concept rather than exact text

Prefer \`grep\` / \`find\` / \`read\` when:
- Searching for an exact literal string or pattern
- Reading a known file with known line numbers
- Inspecting documentation, configuration files, or build scripts
- Inspecting generated files or dependencies

Avoid immediately re-reading all source files returned by CodeGraph unless specific details are missing.
`.trim();

export const PROMPT_SNIPPET = "Use codegraph_explore for structural code understanding and symbol relationships.";

export interface PiExtensionHost {
  registerTool?: (tool: PiToolDefinition) => boolean | void;
  tools?: Map<string, any> | Record<string, any>;
  addPromptGuidelines?: (guidelines: string) => void;
  promptGuidelines?: string[];
  addPromptSnippet?: (snippet: string) => void;
}

/**
 * Registers the pi-codegraph extension in the Pi session context.
 * Idempotent: If `codegraph_explore` is already registered, duplicate registrations are skipped.
 */
export function registerPiExtension(
  pi: PiExtensionHost,
  options: ExploreToolOptions = {}
): void {
  const exploreTool = createExploreTool(options);

  if (typeof pi.registerTool === "function") {
    pi.registerTool(exploreTool);
  }

  if (typeof pi.addPromptGuidelines === "function") {
    pi.addPromptGuidelines(PROMPT_GUIDELINES);
  } else if (Array.isArray(pi.promptGuidelines)) {
    pi.promptGuidelines.push(PROMPT_GUIDELINES);
  }

  if (typeof pi.addPromptSnippet === "function") {
    pi.addPromptSnippet(PROMPT_SNIPPET);
  }
}

export default registerPiExtension;
