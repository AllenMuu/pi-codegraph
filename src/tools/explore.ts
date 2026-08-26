import { Type, type Static } from "@sinclair/typebox";
import { hasCodeGraphIndex } from "../project/detect.js";
import { detectCodeGraphExecutable, type DetectOptions } from "../codegraph/detect.js";
import { runCodeGraph } from "../codegraph/cli.js";
import { CodeGraphError, CodeGraphErrorCode, formatToolError } from "../codegraph/errors.js";

export const ExploreParamsSchema = Type.Object({
  query: Type.String({
    description:
      "Natural-language question about code architecture, symbols, relationships, implementation, or execution flow."
  })
});

export type ExploreParams = Static<typeof ExploreParamsSchema>;

export interface ExploreToolOptions extends DetectOptions {
  executablePath?: string;
}

export interface ToolExecutionContext {
  workspacePath?: string;
  cwd?: string;
  signal?: AbortSignal;
}

export interface ToolExecutionResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

export interface PiToolDefinition {
  name: string;
  description: string;
  parameters: typeof ExploreParamsSchema;
  execute: (
    args: ExploreParams,
    context: ToolExecutionContext
  ) => Promise<ToolExecutionResult>;
}

/**
 * Creates the `codegraph_explore` tool definition for the Pi extension.
 * Derives the working directory strictly from the active Pi workspace context.
 */
export function createExploreTool(
  options: ExploreToolOptions = {}
): PiToolDefinition {
  return {
    name: "codegraph_explore",
    description:
      "Explore code structure, symbols, relationships, implementations, and call paths using the current project's CodeGraph index.",
    parameters: ExploreParamsSchema,
    async execute(
      args: ExploreParams,
      context: ToolExecutionContext
    ): Promise<ToolExecutionResult> {
      const workspaceDir = context.workspacePath ?? context.cwd ?? process.cwd();

      try {
        const hasIndex = await hasCodeGraphIndex(workspaceDir);
        if (!hasIndex) {
          throw new CodeGraphError(
            CodeGraphErrorCode.NOT_INITIALIZED,
            "CodeGraph is not initialized for the active workspace.",
            "Run 'codegraph init' in the workspace directory to create a CodeGraph index."
          );
        }

        let executable = options.executablePath;
        if (!executable) {
          const detection = await detectCodeGraphExecutable({
            pathEnv: options.pathEnv,
            platform: options.platform
          });

          if (!detection.available || !detection.executablePath) {
            throw new CodeGraphError(
              CodeGraphErrorCode.NOT_FOUND,
              "CodeGraph CLI is not available on PATH.",
              "Install CodeGraph (e.g. npm i -g @codegraph/cli) and ensure 'codegraph' is on your PATH."
            );
          }
          executable = detection.executablePath;
        }

        const result = await runCodeGraph({
          executablePath: executable,
          args: ["explore", args.query],
          cwd: workspaceDir,
          signal: context.signal
        });

        return {
          content: [
            {
              type: "text",
              text: result.stdout
            }
          ]
        };
      } catch (err: unknown) {
        const formatted = formatToolError(err);
        throw new Error(formatted);
      }
    }
  };
}
