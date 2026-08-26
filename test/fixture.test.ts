import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { createExploreTool } from "../src/tools/explore.js";
import { createFakeCodeGraphCli } from "./helpers/fake-cli.js";

describe("fixed fixture integration test", () => {
  it("executes exploration in sample-project fixture workspace", async () => {
    const rawFixtureDir = path.resolve("test/fixtures/sample-project");
    const fixtureDir = await fs.realpath(rawFixtureDir);

    const fake = await createFakeCodeGraphCli({
      stdout: "Symbol: authenticate\nDefined in: src/auth.ts:6\nReturns: User | null"
    });

    try {
      const tool = createExploreTool({
        executablePath: fake.executablePath
      });

      const result = await tool.execute(
        { query: "Where is authenticate defined and what does it return?" },
        { workspacePath: fixtureDir }
      );

      assert.match(result.content[0].text, /Symbol: authenticate/);
      assert.match(result.content[0].text, /src\/auth\.ts/);

      const invocations = await fake.getInvocations();
      assert.equal(invocations.length, 1);
      assert.equal(invocations[0].cwd, fixtureDir);
      assert.deepEqual(invocations[0].args, [
        "explore",
        "Where is authenticate defined and what does it return?"
      ]);
    } finally {
      await fake.cleanup();
    }
  });
});
