import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { hasCodeGraphIndex } from "../src/project/detect.js";
import { detectCodeGraphExecutable } from "../src/codegraph/detect.js";
import { CodeGraphError, CodeGraphErrorCode, formatToolError } from "../src/codegraph/errors.js";
import { createFakeCodeGraphCli } from "./helpers/fake-cli.js";

describe("detectCodeGraphIndex", () => {
  it("returns true when .codegraph directory exists in workspace", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cg-test-ws-"));
    try {
      await fs.mkdir(path.join(tmpDir, ".codegraph"));
      const exists = await hasCodeGraphIndex(tmpDir);
      assert.equal(exists, true);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns false when .codegraph does not exist", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cg-test-ws-"));
    try {
      const exists = await hasCodeGraphIndex(tmpDir);
      assert.equal(exists, false);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("detectCodeGraphExecutable", () => {
  it("detects executable on PATH and reads version diagnostic", async () => {
    const fake = await createFakeCodeGraphCli({ stdout: "codegraph 0.1.0-fake" });
    try {
      const result = await detectCodeGraphExecutable({
        pathEnv: fake.env.PATH
      });
      assert.equal(result.available, true);
      assert.equal(typeof result.executablePath, "string");
      assert.match(result.version ?? "", /0\.1\.0-fake/);
    } finally {
      await fake.cleanup();
    }
  });

  it("returns available=false when codegraph is not on PATH", async () => {
    const result = await detectCodeGraphExecutable({
      pathEnv: "/nonexistent-path-12345"
    });
    assert.equal(result.available, false);
    assert.equal(result.executablePath, undefined);
  });

  it("falls back to codegraph.cmd on Windows platform if only codegraph.cmd exists", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cg-win-test-"));
    try {
      const cmdPath = path.join(tmpDir, "codegraph.cmd");
      await fs.writeFile(cmdPath, "@echo off\necho 0.1.0-win", { mode: 0o755 });

      const result = await detectCodeGraphExecutable({
        pathEnv: `${tmpDir};C:\\Windows\\System32`,
        platform: "win32"
      });
      assert.equal(result.available, true);
      assert.equal(result.executablePath, cmdPath);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("CodeGraphError and normalization", () => {
  it("creates agent-friendly error with code and remediation", () => {
    const err = new CodeGraphError(
      CodeGraphErrorCode.NOT_FOUND,
      "CodeGraph CLI is not available on PATH.",
      "Install CodeGraph (e.g. npm i -g @codegraph/cli) and ensure 'codegraph' is on your PATH."
    );

    assert.equal(err.code, "CODEGRAPH_NOT_FOUND");
    assert.equal(err.name, "CodeGraphError");

    const formatted = formatToolError(err);
    assert.match(formatted, /CODEGRAPH_NOT_FOUND/);
    assert.match(formatted, /Install CodeGraph/);
    assert.ok(!formatted.includes("node:internal"), "should not leak Node stack traces");
  });

  it("formats NOT_INITIALIZED error with init remediation", () => {
    const err = new CodeGraphError(
      CodeGraphErrorCode.NOT_INITIALIZED,
      "CodeGraph is not initialized for the active workspace.",
      "Run 'codegraph init' in the workspace directory to create a CodeGraph index."
    );

    const formatted = formatToolError(err);
    assert.match(formatted, /CODEGRAPH_NOT_INITIALIZED/);
    assert.match(formatted, /codegraph init/);
    assert.ok(!formatted.includes("node:internal"));
  });
});
