import * as fs from "node:fs/promises";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface DetectOptions {
  pathEnv?: string;
  platform?: string;
}

export interface CodeGraphDetectionResult {
  available: boolean;
  executablePath?: string;
  version?: string;
}

/**
 * Searches PATH for the CodeGraph executable.
 * On Windows, checks 'codegraph' then 'codegraph.cmd' / 'codegraph.exe' / 'codegraph.bat'.
 * Captures version diagnostic metadata if available.
 */
export async function detectCodeGraphExecutable(
  options: DetectOptions = {}
): Promise<CodeGraphDetectionResult> {
  const platform = options.platform ?? process.platform;
  const rawPath = options.pathEnv ?? process.env.PATH ?? "";
  
  // Handle cross-platform path delimiters gracefully (both ; and :)
  const pathDirs = rawPath
    .split(platform === "win32" && rawPath.includes(";") ? ";" : path.delimiter)
    .filter(Boolean);

  const candidateNames = platform === "win32"
    ? ["codegraph", "codegraph.cmd", "codegraph.exe", "codegraph.bat"]
    : ["codegraph"];

  let foundPath: string | undefined;

  for (const dir of pathDirs) {
    for (const name of candidateNames) {
      const fullPath = path.join(dir, name);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isFile() || stat.isSymbolicLink()) {
          foundPath = fullPath;
          break;
        }
      } catch {
        // Continue searching
      }
    }
    if (foundPath) break;
  }

  if (!foundPath) {
    return { available: false };
  }

  let version: string | undefined;
  try {
    const { stdout } = await execFileAsync(foundPath, ["--version"], {
      timeout: 10000
    });
    version = stdout.trim();
  } catch {
    // Version probe failure does not block availability in v0.1
  }

  return {
    available: true,
    executablePath: foundPath,
    version
  };
}
