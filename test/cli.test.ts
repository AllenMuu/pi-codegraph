import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runCodeGraph, TRUNCATION_MARKER } from "../src/codegraph/cli.js";
import { CodeGraphError, CodeGraphErrorCode } from "../src/codegraph/errors.js";
import { createFakeCodeGraphCli } from "./helpers/fake-cli.js";
import * as os from "node:os";

describe("runCodeGraph subprocess runner", () => {
  it("executes arguments safely as an array without shell interpolation", async () => {
    const fake = await createFakeCodeGraphCli({
      stdout: "Architecture analysis results"
    });
    try {
      const maliciousQuery = `'; touch /tmp/cg-should-not-exist; echo "pwned" && echo \`date\``;
      const result = await runCodeGraph({
        executablePath: fake.executablePath,
        args: ["explore", maliciousQuery],
        cwd: os.tmpdir()
      });

      assert.equal(result.stdout.trim(), "Architecture analysis results");
      assert.equal(result.truncated, false);

      const calls = await fake.getInvocations();
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].args, ["explore", maliciousQuery]);
    } finally {
      await fake.cleanup();
    }
  });

  it("handles unicode, quotes, and whitespace in query arguments", async () => {
    const fake = await createFakeCodeGraphCli({
      stdout: "Unicode query output"
    });
    try {
      const complexQuery = 'How does "User认证Service" handle retry \\ & symbols? 🚀';
      await runCodeGraph({
        executablePath: fake.executablePath,
        args: ["explore", complexQuery],
        cwd: os.tmpdir()
      });

      const calls = await fake.getInvocations();
      assert.equal(calls.length, 1);
      assert.equal(calls[0].args[1], complexQuery);
    } finally {
      await fake.cleanup();
    }
  });

  it("enforces 30-second timeout and raises CODEGRAPH_TIMEOUT", async () => {
    const fake = await createFakeCodeGraphCli({
      delayMs: 2000
    });
    try {
      await assert.rejects(
        async () => {
          await runCodeGraph({
            executablePath: fake.executablePath,
            args: ["explore", "slow query"],
            cwd: os.tmpdir(),
            timeoutMs: 100 // fast timeout for unit testing
          });
        },
        (err: any) => {
          assert.ok(err instanceof CodeGraphError);
          assert.equal(err.code, CodeGraphErrorCode.TIMEOUT);
          assert.match(err.message, /timed out/i);
          return true;
        }
      );
    } finally {
      await fake.cleanup();
    }
  });

  it("respects AbortSignal cancellation and terminates child process", async () => {
    const fake = await createFakeCodeGraphCli({
      delayMs: 2000
    });
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 100);

      await assert.rejects(
        async () => {
          await runCodeGraph({
            executablePath: fake.executablePath,
            args: ["explore", "cancelled query"],
            cwd: os.tmpdir(),
            signal: controller.signal,
            timeoutMs: 10000
          });
        },
        (err: any) => {
          assert.ok(err instanceof CodeGraphError);
          assert.equal(err.code, CodeGraphErrorCode.ABORTED);
          return true;
        }
      );
    } finally {
      await fake.cleanup();
    }
  });

  it("bounds stdout to 50 KB and marks output as truncated", async () => {
    const fake = await createFakeCodeGraphCli({
      generateSize: 60 * 1024 // 60 KB
    });
    try {
      const result = await runCodeGraph({
        executablePath: fake.executablePath,
        args: ["explore", "large output"],
        cwd: os.tmpdir(),
        maxStdoutBytes: 50 * 1024
      });

      assert.equal(result.truncated, true);
      assert.ok(result.stdout.includes(TRUNCATION_MARKER));
      assert.ok(result.stdout.length <= 55 * 1024);
    } finally {
      await fake.cleanup();
    }
  });

  it("bounds stdout to 2,000 lines and marks output as truncated", async () => {
    const fake = await createFakeCodeGraphCli({
      generateLines: 2500
    });
    try {
      const result = await runCodeGraph({
        executablePath: fake.executablePath,
        args: ["explore", "many lines"],
        cwd: os.tmpdir(),
        maxStdoutLines: 2000
      });

      assert.equal(result.truncated, true);
      assert.ok(result.stdout.includes(TRUNCATION_MARKER));
    } finally {
      await fake.cleanup();
    }
  });

  it("normalizes non-zero exit code to CODEGRAPH_COMMAND_FAILED and caps stderr at 4 KB", async () => {
    const longStderr = "E".repeat(10 * 1024); // 10 KB
    const fake = await createFakeCodeGraphCli({
      stderr: longStderr,
      exitCode: 1
    });
    try {
      await assert.rejects(
        async () => {
          await runCodeGraph({
            executablePath: fake.executablePath,
            args: ["explore", "failing query"],
            cwd: os.tmpdir()
          });
        },
        (err: any) => {
          assert.ok(err instanceof CodeGraphError);
          assert.equal(err.code, CodeGraphErrorCode.COMMAND_FAILED);
          assert.ok(err.stderrTail);
          assert.ok(err.stderrTail.length <= 4096);
          return true;
        }
      );
    } finally {
      await fake.cleanup();
    }
  });
});
