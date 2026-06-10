import { mkdtemp, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { detectPackageManager } from "../src/services/package-manager.js";

async function tempWorkspace() {
  return mkdtemp(path.join(os.tmpdir(), "sf-preflight-"));
}

describe("detectPackageManager", () => {
  it("prefers packageManager field over lockfiles", async () => {
    const workspace = await tempWorkspace();
    await writeFile(
      path.join(workspace, "package.json"),
      JSON.stringify({ packageManager: "pnpm@9.0.0" })
    );
    await writeFile(path.join(workspace, "yarn.lock"), "");

    const manager = await detectPackageManager(workspace);

    expect(manager.name).toBe("pnpm");
  });

  it("detects yarn from lockfile", async () => {
    const workspace = await tempWorkspace();
    await writeFile(path.join(workspace, "yarn.lock"), "");

    const manager = await detectPackageManager(workspace);

    expect(manager.name).toBe("yarn");
  });

  it("falls back to npm", async () => {
    const manager = await detectPackageManager(undefined);

    expect(manager.name).toBe("npm");
  });
});
