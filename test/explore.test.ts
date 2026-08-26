import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { createExploreTool } from "../src/tools/explore.js";
import { registerPiExtension, PROMPT_GUIDELINES } from "../src/index.js";
import { createFakeCodeGraphCli } from "./helpers/fake-cli.js";

interface MockPiTool {
  name: string;
  description: string;
  parameters: any;
  execute: (args: any, context: any) => Promise<any>;
}

class MockPiContext {
  tools = new Map<string, MockPiTool>();
  guidelines: string[] = [];

  registerTool(tool: MockPiTool): boolean {
    if (this.tools.has(tool.name)) {
      // Duplicate registration should be skipped/ignored
      return false;
    }
    this.tools.set(tool.name, tool);
    return true;
  }

  addPromptGuidelines(text: string): void {
    this.guidelines.push(text);
  }
}

describe("codegraph_explore tool", () => {
  it("executes exploration against active workspace and returns stdout", async () => {
    const rawWsDir = await fs.mkdtemp(path.join(os.tmpdir(), "cg-ws-"));
    const wsDir = await fs.realpath(rawWsDir);
    await fs.mkdir(path.join(wsDir, ".codegraph"));

    const fake = await createFakeCodeGraphCli({
      stdout: "### Architecture Overview\nFound 3 symbols in auth module."
    });

    try {
      const tool = createExploreTool({
        executablePath: fake.executablePath
      });

      const context = {
        workspacePath: wsDir
      };

      const result = await tool.execute({ query: "How does auth work?" }, context);
      assert.match(result.content[0].text, /Found 3 symbols in auth module/);

      const invocations = await fake.getInvocations();
      assert.equal(invocations.length, 1);
      assert.deepEqual(invocations[0].args, ["explore", "How does auth work?"]);
      assert.equal(invocations[0].cwd, wsDir);
    } finally {
      await fake.cleanup();
      await fs.rm(rawWsDir, { recursive: true, force: true });
    }
  });

  it("fails with CODEGRAPH_NOT_INITIALIZED when .codegraph is absent", async () => {
    const wsDir = await fs.mkdtemp(path.join(os.tmpdir(), "cg-ws-uninit-"));
    const fake = await createFakeCodeGraphCli({ stdout: "ok" });

    try {
      const tool = createExploreTool({
        executablePath: fake.executablePath
      });

      await assert.rejects(
        async () => {
          await tool.execute({ query: "explore" }, { workspacePath: wsDir });
        },
        (err: any) => {
          assert.match(err.message, /CODEGRAPH_NOT_INITIALIZED/);
          assert.match(err.message, /codegraph init/);
          return true;
        }
      );
    } finally {
      await fake.cleanup();
      await fs.rm(wsDir, { recursive: true, force: true });
    }
  });

  it("fails with CODEGRAPH_NOT_FOUND when executable is missing on PATH", async () => {
    const wsDir = await fs.mkdtemp(path.join(os.tmpdir(), "cg-ws-"));
    await fs.mkdir(path.join(wsDir, ".codegraph"));

    try {
      const tool = createExploreTool({
        pathEnv: "/nonexistent-path-abc"
      });

      await assert.rejects(
        async () => {
          await tool.execute({ query: "explore" }, { workspacePath: wsDir });
        },
        (err: any) => {
          assert.match(err.message, /CODEGRAPH_NOT_FOUND/);
          return true;
        }
      );
    } finally {
      await fs.rm(wsDir, { recursive: true, force: true });
    }
  });

  it("fails with CODEGRAPH_COMMAND_FAILED on non-zero exit code", async () => {
    const wsDir = await fs.mkdtemp(path.join(os.tmpdir(), "cg-ws-"));
    await fs.mkdir(path.join(wsDir, ".codegraph"));

    const fake = await createFakeCodeGraphCli({
      stderr: "Syntax error in graph database",
      exitCode: 1
    });

    try {
      const tool = createExploreTool({
        executablePath: fake.executablePath
      });

      await assert.rejects(
        async () => {
          await tool.execute({ query: "explore" }, { workspacePath: wsDir });
        },
        (err: any) => {
          assert.match(err.message, /CODEGRAPH_COMMAND_FAILED/);
          assert.match(err.message, /Syntax error in graph database/);
          return true;
        }
      );
    } finally {
      await fake.cleanup();
      await fs.rm(wsDir, { recursive: true, force: true });
    }
  });
});

describe("Pi extension registration", () => {
  it("registers codegraph_explore and prompt guidelines idempotently", () => {
    const pi = new MockPiContext();

    registerPiExtension(pi as any);
    assert.equal(pi.tools.has("codegraph_explore"), true);
    assert.equal(pi.guidelines.length, 1);
    assert.match(pi.guidelines[0], /CodeGraph/);

    // Registering a second time should not throw or duplicate
    registerPiExtension(pi as any);
    assert.equal(pi.tools.size, 1);
  });

  it("contains prompt guidance favoring CodeGraph for structural queries", () => {
    assert.match(PROMPT_GUIDELINES, /architecture/i);
    assert.match(PROMPT_GUIDELINES, /grep/i);
  });
});
