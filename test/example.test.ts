import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { createFakeCodeGraphCli } from "./helpers/fake-cli.js";

describe("copyable single-file extension example", () => {
  it("can be imported and registers codegraph_explore tool", async () => {
    // Import the standalone example
    const exampleModule = await import("../examples/pi-codegraph.js");
    assert.equal(typeof exampleModule.registerPiExtension, "function");

    const registeredTools: any[] = [];
    const mockPi = {
      registerTool(tool: any) {
        registeredTools.push(tool);
      },
      addPromptGuidelines() {}
    };

    exampleModule.registerPiExtension(mockPi);
    assert.equal(registeredTools.length, 1);
    assert.equal(registeredTools[0].name, "codegraph_explore");

    // Test execution through the standalone tool
    const wsDir = await fs.mkdtemp(path.join(os.tmpdir(), "cg-example-ws-"));
    const realWs = await fs.realpath(wsDir);
    await fs.mkdir(path.join(realWs, ".codegraph"));

    const fake = await createFakeCodeGraphCli({
      stdout: "Standalone example exploration result"
    });

    try {
      const tool = registeredTools[0];
      const result = await tool.execute(
        { query: "How does auth flow work?" },
        { workspacePath: realWs, env: fake.env }
      );
      assert.match(result.content[0].text, /Standalone example exploration result/);
    } finally {
      await fake.cleanup();
      await fs.rm(wsDir, { recursive: true, force: true });
    }
  });
});
