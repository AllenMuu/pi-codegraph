import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

export interface FakeCliOptions {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  delayMs?: number;
  generateSize?: number; // generate output of exact size in bytes
  generateLines?: number; // generate exact number of lines
  executableName?: string;
  createCmdWrapper?: boolean;
}

export interface FakeCliInvocation {
  args: string[];
  cwd: string;
  timestamp: number;
}

export interface FakeCliInstance {
  binDir: string;
  executablePath: string;
  env: Record<string, string>;
  getInvocations: () => Promise<FakeCliInvocation[]>;
  cleanup: () => Promise<void>;
}

export async function createFakeCodeGraphCli(options: FakeCliOptions = {}): Promise<FakeCliInstance> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fake-codegraph-"));
  const logFile = path.join(tmpDir, "invocations.jsonl");
  const isWin = process.platform === "win32";
  const binName = options.executableName ?? "codegraph";
  const scriptPath = path.join(tmpDir, isWin ? `${binName}.js` : binName);

  const scriptContent = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const logFile = ${JSON.stringify(logFile)};
const args = process.argv.slice(2);
const cwd = process.cwd();

try {
  fs.appendFileSync(logFile, JSON.stringify({ args, cwd, timestamp: Date.now() }) + "\\n");
} catch (e) {}

const delayMs = ${options.delayMs ?? 0};
const exitCode = ${options.exitCode ?? 0};
const stdout = ${JSON.stringify(options.stdout ?? "")};
const stderr = ${JSON.stringify(options.stderr ?? "")};
const generateSize = ${options.generateSize ?? 0};
const generateLines = ${options.generateLines ?? 0};

async function main() {
  if (delayMs > 0) {
    await new Promise(r => setTimeout(r, delayMs));
  }

  if (args.includes("--version")) {
    process.stdout.write("codegraph 0.1.0-fake\\n", () => {
      process.exit(0);
    });
    return;
  }

  if (generateSize > 0) {
    const chunk = "A".repeat(1024);
    let written = 0;
    while (written < generateSize) {
      const toWrite = Math.min(1024, generateSize - written);
      const canWrite = process.stdout.write("A".repeat(toWrite));
      written += toWrite;
      if (!canWrite) {
        await new Promise(r => process.stdout.once("drain", r));
      }
    }
  } else if (generateLines > 0) {
    for (let i = 1; i <= generateLines; i++) {
      const canWrite = process.stdout.write(\`line \${i}\\n\`);
      if (!canWrite) {
        await new Promise(r => process.stdout.once("drain", r));
      }
    }
  } else if (stdout) {
    process.stdout.write(stdout);
    if (!stdout.endsWith("\\n")) process.stdout.write("\\n");
  }

  if (stderr) {
    process.stderr.write(stderr);
    if (!stderr.endsWith("\\n")) process.stderr.write("\\n");
  }

  process.exit(exitCode);
}

main().catch(err => {
  process.stderr.write(String(err));
  process.exit(1);
});
`;

  await fs.writeFile(scriptPath, scriptContent, { mode: 0o755 });

  let executablePath = scriptPath;
  if (isWin || options.createCmdWrapper) {
    const cmdPath = path.join(tmpDir, `${binName}.cmd`);
    const cmdContent = `@echo off\r\nnode "${scriptPath}" %*`;
    await fs.writeFile(cmdPath, cmdContent, { mode: 0o755 });
    if (isWin) {
      executablePath = cmdPath;
    }
  }

  const env = {
    PATH: `${tmpDir}${path.delimiter}${process.env.PATH ?? ""}`
  };

  return {
    binDir: tmpDir,
    executablePath,
    env,
    async getInvocations(): Promise<FakeCliInvocation[]> {
      try {
        const content = await fs.readFile(logFile, "utf-8");
        return content
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line));
      } catch {
        return [];
      }
    },
    async cleanup(): Promise<void> {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  };
}
