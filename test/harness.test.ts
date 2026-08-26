import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createFakeCodeGraphCli } from "./helpers/fake-cli.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

describe("fake codegraph CLI test harness", () => {
  it("creates an executable fake CLI and records invocations", async () => {
    const fake = await createFakeCodeGraphCli({
      stdout: "fake exploration output",
      exitCode: 0
    });

    try {
      const { stdout } = await execFileAsync(fake.executablePath, ["explore", "query with 'quotes' and spaces"], {
        env: { ...process.env, ...fake.env },
        shell: process.platform === "win32"
      });

      assert.equal(stdout.trim(), "fake exploration output");
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
          await execFileAsync(fake.executablePath, ["explore", "fail"], {
            env: { ...process.env, ...fake.env },
            shell: process.platform === "win32"
          });
        },
        (err: any) => {
          assert.equal(err.code, 1);
          assert.match(err.stderr, /error from codegraph/);
          return true;
        }
      );
    } finally {
      await fake.cleanup();
    }
  });
});
