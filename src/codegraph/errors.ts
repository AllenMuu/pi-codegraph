export enum CodeGraphErrorCode {
  NOT_FOUND = "CODEGRAPH_NOT_FOUND",
  NOT_INITIALIZED = "CODEGRAPH_NOT_INITIALIZED",
  COMMAND_FAILED = "CODEGRAPH_COMMAND_FAILED",
  TIMEOUT = "CODEGRAPH_TIMEOUT",
  ABORTED = "CODEGRAPH_ABORTED",
  OUTPUT_TOO_LARGE = "CODEGRAPH_OUTPUT_TOO_LARGE"
}

export class CodeGraphError extends Error {
  readonly code: CodeGraphErrorCode;
  readonly remediation: string;
  readonly stderrTail?: string;

  constructor(
    code: CodeGraphErrorCode,
    message: string,
    remediation: string,
    stderrTail?: string
  ) {
    super(message);
    this.name = "CodeGraphError";
    this.code = code;
    this.remediation = remediation;
    this.stderrTail = stderrTail;
  }
}

/**
 * Formats an error into a clean, agent-actionable string without Node stack traces.
 */
export function formatToolError(error: unknown): string {
  if (error instanceof CodeGraphError) {
    let output = `[${error.code}] ${error.message}\nRemediation: ${error.remediation}`;
    if (error.stderrTail && error.stderrTail.trim().length > 0) {
      output += `\n\nCommand stderr (last 4 KB):\n${error.stderrTail.trim()}`;
    }
    return output;
  }

  if (error instanceof Error) {
    return `[CODEGRAPH_ERROR] ${error.message}`;
  }

  return `[CODEGRAPH_ERROR] ${String(error)}`;
}
