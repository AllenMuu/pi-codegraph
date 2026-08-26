import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createFakeCodeGraphCli } from "./helpers/fake-cli.js";
import { runCodeGraph } from "../src/codegraph/cli.js";
import { CodeGraphError, CodeGraphErrorCode } from "../src/codegraph/errors.js";
import * as os from "node:os";

describe("fake codegraph CLI test harness", () => {
  it("creates an executable fake CLI and records invocations", async () => {
    const fake = await createFakeCodeGraphCli({
      stdout: "fake exploration output",
      exitCode: 0
    });

    try {
      const result = await runCodeGraph({
        executablePath: fake.executablePath,
        args: ["explore", "query with 'quotes' and spaces"],
        cwd: os.tmpdir()
      });

      assert.equal(result.stdout.trim(), "fake exploration output");
      const calls = await fake.getInvocations();
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].args, ["explore", "query with 'quotes' and spaces"]);
    } finally {
      await fake.cleanup();
    }
  });

  it("handles stderr and non-zero exit codes", async () => {
    const fake = await createFakeCodeGraphCli({
      stderr: "error from codegraph",
      exitCode: 1
    });

    try {
      await assert.rejects(
        async () => {
          await runCodeGraph({
            executablePath: fake.executablePath,
            args: ["explore", "fail"],
            cwd: os.tmpdir()
          });
        },
        (err: any) => {
          assert.ok(err instanceof CodeGraphError);
          assert.equal(err.code, CodeGraphErrorCode.COMMAND_FAILED);
          assert.match(err.stderrTail ?? "", /error from codegraph/);
          return true;
        }
      );
    } finally {
      await fake.cleanup();
    }
  });
});
