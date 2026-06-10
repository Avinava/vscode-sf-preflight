import { beforeEach, describe, expect, it, vi } from "vitest";

const globalState = {
  values: new Map(),
  get: vi.fn((key) => globalState.values.get(key)),
  update: vi.fn(async (key, value) => {
    if (value === undefined) {
      globalState.values.delete(key);
    } else {
      globalState.values.set(key, value);
    }
  }),
};

vi.mock("vscode", () => ({
  ProgressLocation: {
    Notification: 15,
  },
  Uri: {
    parse: (value) => ({ value }),
  },
  env: {
    clipboard: {
      writeText: vi.fn(),
    },
    openExternal: vi.fn(),
  },
  window: {
    createTerminal: vi.fn(),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showQuickPick: vi.fn(),
    showWarningMessage: vi.fn(),
    withProgress: vi.fn(),
  },
  workspace: {
    workspaceFolders: undefined,
  },
}));

vi.mock("../src/lib/shell.js", () => ({
  execCommandArgs: vi.fn(async (command, args) => {
    const key = [command, ...args].join(" ");
    if (key === "node --version") {
      return { stdout: "v20.11.1", stderr: "" };
    }
    if (key === "java -version") {
      return { stdout: "", stderr: 'openjdk version "17.0.10"' };
    }
    if (key === "sf --version") {
      return { stdout: "@salesforce/cli/2.34.6 darwin-arm64 node-v20", stderr: "" };
    }
    if (key === "sf plugins") {
      return { stdout: "code-analyzer 5.0.0", stderr: "" };
    }
    if (key.startsWith("npm list -g")) {
      return {
        stdout: "prettier@3.0.0\n@prettier/plugin-xml@3.0.0\nprettier-plugin-apex@2.0.0",
        stderr: "",
      };
    }
    if (key === "which java") {
      return { stdout: "/usr/bin/java", stderr: "" };
    }
    if (key === "which sf") {
      return { stdout: "/usr/local/bin/sf", stderr: "" };
    }
    return { stdout: "", stderr: "" };
  }),
  whichCommand: vi.fn(async (command) => `/usr/local/bin/${command}`),
}));

const vscode = await import("vscode");
const { parseJavaMajorVersion, runStartupCheck } = await import(
  "../src/services/environment.js"
);

describe("environment checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalState.values.clear();
  });

  it("parses legacy and modern Java versions", () => {
    expect(parseJavaMajorVersion("1.8.0_402")).toBe(8);
    expect(parseJavaMajorVersion("11.0.22")).toBe(11);
    expect(parseJavaMajorVersion("17.0.10")).toBe(17);
  });

  it("does not show progress or prompts during startup checks", async () => {
    await runStartupCheck({ globalState });

    expect(vscode.window.withProgress).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    expect(globalState.update).toHaveBeenCalled();
  });
});
