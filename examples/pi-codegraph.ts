/**
 * pi-codegraph: Standalone copyable single-file Pi extension.
 *
 * Provides the `codegraph_explore` tool for structural code exploration
 * using an existing CodeGraph index in the active workspace.
 *
 * Requirements: Node.js 22+, CodeGraph CLI on PATH.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_STDOUT_BYTES = 50 * 1024; // 50 KB
const MAX_STDOUT_LINES = 2_000;
const MAX_STDERR_BYTES = 4 * 1024; // 4 KB
const TRUNCATION_MARKER =
  "\n\n[Warning: CodeGraph output exceeded limit and was truncated. Refine query for specific results.]";

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

async function hasCodeGraphIndex(workspaceDir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path.join(workspaceDir, ".codegraph"));
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function detectCodeGraphExecutable(options: { pathEnv?: string; platform?: string } = {}) {
  const platform = options.platform ?? process.platform;
  const rawPath = options.pathEnv ?? process.env.PATH ?? "";
  const delimiter = platform === "win32" && rawPath.includes(";") ? ";" : path.delimiter;
  const pathDirs = rawPath.split(delimiter).filter(Boolean);

  const candidateNames = platform === "win32"
    ? ["codegraph", "codegraph.cmd", "codegraph.exe", "codegraph.bat"]
    : ["codegraph"];

  for (const dir of pathDirs) {
    for (const name of candidateNames) {
      const fullPath = path.join(dir, name);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isFile() || stat.isSymbolicLink()) {
          return { available: true, executablePath: fullPath };
        }
      } catch {}
    }
  }
  return { available: false };
}

function terminateProcess(child: ChildProcess): void {
  try {
    if (child.pid && !child.killed) {
      child.kill("SIGTERM");
      const killTimer = setTimeout(() => {
        try {
          if (!child.killed) child.kill("SIGKILL");
        } catch {}
      }, 1000);
      killTimer.unref?.();
    }
  } catch {}
}

async function runCodeGraph(options: {
  args: string[];
  cwd: string;
  executablePath?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  env?: Record<string, string>;
}) {
  const executablePath = options.executablePath ?? "codegraph";
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (options.signal?.aborted) {
    throw new Error("[CODEGRAPH_ABORTED] CodeGraph execution was cancelled before starting.");
  }

  return new Promise<{ stdout: string; truncated: boolean }>((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(executablePath, options.args, {
        cwd: options.cwd,
        env: options.env ? { ...process.env, ...options.env } : process.env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      });
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return reject(
          new Error(`[CODEGRAPH_NOT_FOUND] CodeGraph executable '${executablePath}' not found on PATH.`)
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
      const str = chunk.toString("utf-8");
      const nextBytes = stdoutBytes + Buffer.byteLength(str, "utf-8");
      let lines = 0;
      for (let i = 0; i < str.length; i++) {
        if (str[i] === "\n") lines++;
      }
      if (nextBytes > MAX_STDOUT_BYTES || stdoutLines + lines > MAX_STDOUT_LINES) {
        truncated = true;
        const remain = Math.max(0, MAX_STDOUT_BYTES - stdoutBytes);
        if (remain > 0) stdoutText += str.slice(0, remain);
      } else {
        stdoutText += str;
        stdoutBytes = nextBytes;
        stdoutLines += lines;
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString("utf-8");
      if (Buffer.byteLength(stderrBuffer, "utf-8") > MAX_STDERR_BYTES) {
        const excess = Buffer.byteLength(stderrBuffer, "utf-8") - MAX_STDERR_BYTES;
        stderrBuffer = stderrBuffer.slice(excess);
      }
    });

    child.on("error", (err: any) => {
      clearTimeout(timeoutTimer);
      if (options.signal) options.signal.removeEventListener("abort", onAbort);
      if (err.code === "ENOENT") {
        reject(new Error(`[CODEGRAPH_NOT_FOUND] CodeGraph executable '${executablePath}' not found on PATH.`));
      } else {
        reject(err);
      }
    });

    child.on("close", (code) => {
      clearTimeout(timeoutTimer);
      if (options.signal) options.signal.removeEventListener("abort", onAbort);

      if (aborted) {
        return reject(new Error("[CODEGRAPH_ABORTED] CodeGraph execution was cancelled by agent."));
      }
      if (timedOut) {
        return reject(
          new Error(`[CODEGRAPH_TIMEOUT] CodeGraph execution timed out after ${timeoutMs / 1000}s.`)
        );
      }
      if (code !== 0) {
        return reject(
          new Error(`[CODEGRAPH_COMMAND_FAILED] CodeGraph exited with code ${code}.\n${stderrBuffer.trim()}`)
        );
      }

      let finalStdout = stdoutText;
      if (truncated) finalStdout += TRUNCATION_MARKER;
      resolve({ stdout: finalStdout, truncated });
    });
  });
}

export function createExploreTool() {
  return {
    name: "codegraph_explore",
    description:
      "Explore code structure, symbols, relationships, implementations, and call paths using the current project's CodeGraph index.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Natural-language question about code architecture, symbols, relationships, implementation, or execution flow."
        }
      },
      required: ["query"]
    },
    async execute(args: { query: string }, context: { workspacePath?: string; cwd?: string; signal?: AbortSignal; env?: Record<string, string> } = {}) {
      const workspaceDir = context.workspacePath ?? context.cwd ?? process.cwd();

      const hasIndex = await hasCodeGraphIndex(workspaceDir);
      if (!hasIndex) {
        throw new Error(
          "[CODEGRAPH_NOT_INITIALIZED] CodeGraph is not initialized for the active workspace.\nRemediation: Run 'codegraph init' in the workspace directory."
        );
      }

      const detection = await detectCodeGraphExecutable({
        pathEnv: context.env?.PATH ?? process.env.PATH
      });

      if (!detection.available || !detection.executablePath) {
        throw new Error(
          "[CODEGRAPH_NOT_FOUND] CodeGraph CLI is not available on PATH.\nRemediation: Install CodeGraph and ensure 'codegraph' is on PATH."
        );
      }

      const result = await runCodeGraph({
        executablePath: detection.executablePath,
        args: ["explore", args.query],
        cwd: workspaceDir,
        signal: context.signal,
        env: context.env
      });

      return {
        content: [
          {
            type: "text",
            text: result.stdout
          }
        ]
      };
    }
  };
}

export function registerPiExtension(pi: any): void {
  const tool = createExploreTool();
  if (typeof pi.registerTool === "function") {
    pi.registerTool(tool);
  }
  if (typeof pi.addPromptGuidelines === "function") {
    pi.addPromptGuidelines(PROMPT_GUIDELINES);
  }
  if (typeof pi.addPromptSnippet === "function") {
    pi.addPromptSnippet(PROMPT_SNIPPET);
  }
}

export default registerPiExtension;
