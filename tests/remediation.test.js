import { mkdtemp, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  Uri: {
    parse: (value) => ({ value }),
  },
  env: {
    clipboard: {
      writeText: vi.fn(),
    },
    openExternal: vi.fn(),
  },
  commands: {
    executeCommand: vi.fn(),
  },
  window: {
    createTerminal: vi.fn(() => ({
      show: vi.fn(),
      sendText: vi.fn(),
    })),
    showInformationMessage: vi.fn(),
    showQuickPick: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_k, d) => d),
    })),
  },
  extensions: {
    getExtension: vi.fn(),
  },
}));

const { buildRemediationItems } = await import(
  "../src/services/remediation.js"
);

async function tempWorkspace() {
  return mkdtemp(path.join(os.tmpdir(), "sf-preflight-"));
}

describe("buildRemediationItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the workspace package manager for missing packages", async () => {
    const workspace = await tempWorkspace();
    await writeFile(
      path.join(workspace, "package.json"),
      JSON.stringify({ packageManager: "pnpm@9.0.0" })
    );

    const items = await buildRemediationItems({
      node: { installed: true, valid: true },
      java: { installed: true, valid: true, recommended: true },
      salesforceCLI: { installed: true },
      packages: {
        allInstalled: false,
        missing: ["prettier", "prettier-plugin-apex"],
      },
      sfPlugins: { allInstalled: true },
      projectInfo: { workspacePath: workspace },
    });

    expect(items.some((item) => item.command?.startsWith("pnpm add"))).toBe(
      true
    );
  });

  it("builds Salesforce CLI plugin commands without executing them", async () => {
    const items = await buildRemediationItems({
      node: { installed: true, valid: true },
      java: { installed: true, valid: true, recommended: true },
      salesforceCLI: { installed: true },
      packages: { allInstalled: true },
      sfPlugins: {
        allInstalled: false,
        missing: ["code-analyzer"],
      },
    });

    expect(items).toContainEqual(
      expect.objectContaining({
        action: "terminal",
        command: "sf plugins install code-analyzer",
      })
    );
  });

  it("offers method-aware CLI install for homebrew", async () => {
    const items = await buildRemediationItems({
      node: { installed: true, valid: true },
      java: { installed: true, valid: true, recommended: true },
      salesforceCLI: { installed: false, installMethod: "homebrew" },
      packages: { allInstalled: true },
      sfPlugins: { allInstalled: true },
    });

    expect(
      items.some((item) => item.command === "brew install sf")
    ).toBe(true);
  });

  it("offers set-java-home and extension pack actions", async () => {
    const items = await buildRemediationItems({
      node: { installed: true, valid: true },
      java: { installed: false, valid: false, recommended: false },
      salesforceCLI: { installed: true },
      packages: { allInstalled: true },
      sfPlugins: { allInstalled: true },
      extensions: {
        pack: false,
        core: false,
        apex: true,
        needsJavaApex: true,
      },
    });

    expect(items.some((i) => i.action === "set-java-home")).toBe(true);
    expect(items.some((i) => i.action === "open-extension-pack")).toBe(true);
  });
});
