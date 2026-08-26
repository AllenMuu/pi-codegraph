import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Checks whether the specified active workspace contains a .codegraph index directory.
 * Does not inspect or validate internal database files.
 */
export async function hasCodeGraphIndex(workspaceDir: string): Promise<boolean> {
  try {
    const targetPath = path.join(workspaceDir, ".codegraph");
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
