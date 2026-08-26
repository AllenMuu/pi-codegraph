import { spawn, type ChildProcess } from "node:child_process";
import { CodeGraphError, CodeGraphErrorCode } from "./errors.js";

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_STDOUT_BYTES = 50 * 1024; // 50 KB
export const DEFAULT_MAX_STDOUT_LINES = 2_000;
export const DEFAULT_MAX_STDERR_BYTES = 4 * 1024; // 4 KB

export const TRUNCATION_MARKER =
  "\n\n[Warning: CodeGraph output exceeded limit and was truncated. Refine query for specific results.]";

export interface RunCodeGraphOptions {
  args: string[];
  cwd: string;
  executablePath?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxStdoutBytes?: number;
  maxStdoutLines?: number;
  maxStderrTailBytes?: number;
}

export interface CodeGraphResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  truncated: boolean;
}

function terminateProcess(child: ChildProcess): void {
  try {
    if (child.pid && !child.killed) {
      child.kill("SIGTERM");
      // Safety fallback to SIGKILL if not exited after 1 second
      const killTimer = setTimeout(() => {
        try {
          if (!child.killed) child.kill("SIGKILL");
        } catch {}
      }, 1000);
      killTimer.unref?.();
    }
  } catch {}
}

/**
 * Spawns the CodeGraph CLI using safe argument-array execution (no shell interpolation).
 * Enforces timeout, cancellation, output size limits, and normalized error handling.
 */
export async function runCodeGraph(
  options: RunCodeGraphOptions
): Promise<CodeGraphResult> {
  const executablePath = options.executablePath ?? "codegraph";
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxStdoutBytes = options.maxStdoutBytes ?? DEFAULT_MAX_STDOUT_BYTES;
  const maxStdoutLines = options.maxStdoutLines ?? DEFAULT_MAX_STDOUT_LINES;
  const maxStderrBytes = options.maxStderrTailBytes ?? DEFAULT_MAX_STDERR_BYTES;

  if (options.signal?.aborted) {
    throw new CodeGraphError(
      CodeGraphErrorCode.ABORTED,
      "CodeGraph execution was cancelled before starting.",
      "The request was aborted by Pi session signal."
    );
  }

  return new Promise<CodeGraphResult>((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(executablePath, options.args, {
        cwd: options.cwd,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      });
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return reject(
          new CodeGraphError(
            CodeGraphErrorCode.NOT_FOUND,
            `CodeGraph executable '${executablePath}' not found on PATH.`,
            "Install CodeGraph or ensure it is accessible on PATH."
          )
        );
      }
      return reject(err);
    }

    let stdoutText = "";
    let stdoutBytes = 0;
    let stdoutLines = 0;
    let truncated = false;

    let stderrBuffer = "";
    let timedOut = false;
    let aborted = false;

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      terminateProcess(child);
    }, timeoutMs);

    const onAbort = () => {
      aborted = true;
      terminateProcess(child);
    };

    if (options.signal) {
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      if (truncated) return;

      const chunkStr = chunk.toString("utf-8");
      const nextBytes = stdoutBytes + Buffer.byteLength(chunkStr, "utf-8");

      // Count newlines in chunk
      let linesInChunk = 0;
      for (let i = 0; i < chunkStr.length; i++) {
        if (chunkStr[i] === "\n") linesInChunk++;
      }
      const nextLines = stdoutLines + linesInChunk;

      if (nextBytes > maxStdoutBytes || nextLines > maxStdoutLines) {
        truncated = true;
        // Trim slice to keep within limit
        const remainingBytes = Math.max(0, maxStdoutBytes - stdoutBytes);
        if (remainingBytes > 0) {
          stdoutText += chunkStr.slice(0, remainingBytes);
        }
      } else {
        stdoutText += chunkStr;
        stdoutBytes = nextBytes;
        stdoutLines = nextLines;
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString("utf-8");
      // Keep only rolling tail of maxStderrBytes
      if (Buffer.byteLength(stderrBuffer, "utf-8") > maxStderrBytes) {
        const excess = Buffer.byteLength(stderrBuffer, "utf-8") - maxStderrBytes;
        stderrBuffer = stderrBuffer.slice(excess);
      }
    });

    child.on("error", (err: any) => {
      clearTimeout(timeoutTimer);
      if (options.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }
      if (err.code === "ENOENT") {
        reject(
          new CodeGraphError(
            CodeGraphErrorCode.NOT_FOUND,
            `CodeGraph executable '${executablePath}' not found on PATH.`,
            "Install CodeGraph or ensure it is accessible on PATH."
          )
        );
      } else {
        reject(err);
      }
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeoutTimer);
      if (options.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }

      if (aborted) {
        return reject(
          new CodeGraphError(
            CodeGraphErrorCode.ABORTED,
            "CodeGraph execution was cancelled by agent signal.",
            "The request was cancelled before completion."
          )
        );
      }

      if (timedOut) {
        return reject(
          new CodeGraphError(
            CodeGraphErrorCode.TIMEOUT,
            `CodeGraph CLI execution timed out after ${timeoutMs / 1000} seconds.`,
            "Refine your query to be more specific, or verify that CodeGraph index is healthy."
          )
        );
      }

      const code = exitCode ?? 0;
      if (code !== 0) {
        return reject(
          new CodeGraphError(
            CodeGraphErrorCode.COMMAND_FAILED,
            `CodeGraph CLI exited with status ${code}.`,
            "Verify that the active workspace contains a valid CodeGraph index and valid query syntax.",
            stderrBuffer
          )
        );
      }

      let finalStdout = stdoutText;
      if (truncated) {
        finalStdout += TRUNCATION_MARKER;
      }

      resolve({
        stdout: finalStdout,
        stderr: stderrBuffer,
        exitCode: code,
        truncated
      });
    });
  });
}
