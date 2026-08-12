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

const workspaceState = {
  values: new Map(),
  get: vi.fn((key) => workspaceState.values.get(key)),
  update: vi.fn(async (key, value) => {
    if (value === undefined) {
      workspaceState.values.delete(key);
    } else {
      workspaceState.values.set(key, value);
    }
  }),
};

const outputChannel = {
  appendLine: vi.fn(),
  show: vi.fn(),
};

const configStore = {
  "sfPreflight.verboseNotifications": false,
  "sfPreflight.checks.extensionPack": "warning",
  "sfPreflight.checks.codeAnalyzer": "recommended",
  "sfPreflight.checks.orgAuth": true,
  "salesforcedx-vscode-apex.java.home": "",
};

vi.mock("vscode", () => ({
  ProgressLocation: {
    Notification: 15,
    Window: 10,
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
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
  commands: {
    executeCommand: vi.fn(),
  },
  extensions: {
    getExtension: vi.fn((id) => {
      // Pretend Extension Pack is installed for baseline healthy runs
      if (
        id === "salesforce.salesforcedx-vscode" ||
        id === "salesforce.salesforcedx-vscode-core" ||
        id === "salesforce.salesforcedx-vscode-apex"
      ) {
        return { id };
      }
      return undefined;
    }),
  },
  window: {
    createTerminal: vi.fn(),
    createOutputChannel: vi.fn(() => outputChannel),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showQuickPick: vi.fn(),
    showWarningMessage: vi.fn(),
    withProgress: vi.fn(async (_opts, task) => task({ report: vi.fn() })),
  },
  workspace: {
    workspaceFolders: undefined,
    getConfiguration: vi.fn((section) => ({
      get: vi.fn((key, defaultValue) => {
        const full = section ? `${section}.${key}` : key;
        if (full in configStore) {
          return configStore[full];
        }
        // section-relative keys for sfPreflight
        if (section === "sfPreflight") {
          const k = `sfPreflight.${key}`;
          if (k in configStore) return configStore[k];
        }
        if (section === "salesforcedx-vscode-apex" && key === "java.home") {
          return configStore["salesforcedx-vscode-apex.java.home"];
        }
        return defaultValue;
      }),
      update: vi.fn(async (key, value) => {
        const full =
          section === "salesforcedx-vscode-apex"
            ? `salesforcedx-vscode-apex.${key}`
            : `sfPreflight.${key}`;
        configStore[full] = value;
      }),
    })),
  },
}));

vi.mock("../src/lib/shell.js", () => ({
  execCommandArgs: vi.fn(async (command, args) => {
    const key = [command, ...args].join(" ");
    if (key === "node --version") {
      return { stdout: "v20.11.1", stderr: "" };
    }
    if (key === "java -version" || key.endsWith("java -version") || key.endsWith("java.exe -version")) {
      return { stdout: "", stderr: 'openjdk version "17.0.10"' };
    }
    if (key === "sf --version") {
      return {
        stdout: "@salesforce/cli/2.34.6 darwin-arm64 node-v20",
        stderr: "",
      };
    }
    if (key === "sf plugins") {
      return { stdout: "code-analyzer 5.0.0", stderr: "" };
    }
    if (key === "sf org list --json") {
      return {
        stdout: JSON.stringify({
          status: 0,
          result: {
            nonScratchOrgs: [
              { username: "dev@example.com", isDefaultUsername: true },
            ],
            scratchOrgs: [],
          },
        }),
        stderr: "",
      };
    }
    if (key.startsWith("npm list -g")) {
      return {
        stdout:
          "prettier@3.0.0\n@prettier/plugin-xml@3.0.0\nprettier-plugin-apex@2.0.0",
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
const {
  parseJavaMajorVersion,
  runStartupCheck,
  isCacheableHealthy,
  checkJava,
} = await import("../src/services/environment.js");
const { STATE_KEYS } = await import("../src/lib/constants.js");

function makeContext() {
  return { globalState, workspaceState };
}

describe("environment checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalState.values.clear();
    workspaceState.values.clear();
    // Suppress one-time first-run notice in most tests
    globalState.values.set(STATE_KEYS.FIRST_RUN_NOTICE_SHOWN, true);
    configStore["salesforcedx-vscode-apex.java.home"] = "";
  });

  it("parses legacy and modern Java versions", () => {
    expect(parseJavaMajorVersion("1.8.0_402")).toBe(8);
    expect(parseJavaMajorVersion("11.0.22")).toBe(11);
    expect(parseJavaMajorVersion("17.0.10")).toBe(17);
  });

  it("does not show progress or prompts during a healthy startup check", async () => {
    await runStartupCheck(makeContext());

    expect(vscode.window.withProgress).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    // first-run already marked shown
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    expect(globalState.update).toHaveBeenCalled();
  });

  it("notifies once for blockers and supports snooze suppression", async () => {
    const shell = await import("../src/lib/shell.js");
    shell.execCommandArgs.mockImplementation(async (command, args) => {
      const key = [command, ...args].join(" ");
      if (key === "node --version") {
        throw new Error("not found");
      }
      if (key === "java -version" || key.includes("java -version")) {
        return { stdout: "", stderr: 'openjdk version "17.0.10"' };
      }
      if (key === "sf --version") {
        throw new Error("not found");
      }
      if (key === "sf plugins") {
        throw new Error("not found");
      }
      if (key === "sf org list --json") {
        throw new Error("not found");
      }
      if (key.startsWith("npm list -g")) {
        return { stdout: "", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    });

    vscode.window.showErrorMessage.mockResolvedValue("Dismiss");

    await runStartupCheck(makeContext());
    expect(vscode.window.showErrorMessage).toHaveBeenCalledTimes(1);
    expect(vscode.window.showErrorMessage.mock.calls[0][0]).toMatch(/block/i);

    globalState.values.set(STATE_KEYS.SNOOZE_UNTIL, Date.now() + 60_000);
    vscode.window.showErrorMessage.mockClear();
    globalState.values.delete(STATE_KEYS.LAST_CHECK_RESULT);

    await runStartupCheck(makeContext());
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });

  it("treats optional package gaps as cacheable healthy when core tools exist", () => {
    expect(
      isCacheableHealthy({
        node: {
          installed: true,
          valid: true,
          version: "20",
          majorVersion: 20,
          recommendedMajor: 20,
        },
        java: {
          installed: true,
          valid: true,
          recommended: true,
          version: "21",
          source: "PATH",
        },
        salesforceCLI: { installed: true, version: "2.0.0" },
        packages: { allInstalled: false, missing: ["prettier"] },
        sfPlugins: { allInstalled: false, missing: ["code-analyzer"] },
        extensions: {
          pack: true,
          core: true,
          apex: true,
          needsJavaApex: true,
          packCheckMode: "warning",
        },
        auth: { checked: true, hasDefault: true, orgCount: 1, defaultUsername: "a@b.c" },
        isSFDXProject: true,
        projectInfo: { name: "x", sourceApiVersion: "61.0" },
      })
    ).toBe(true);
  });

  it("reads java from configured apex java.home when set", async () => {
    configStore["salesforcedx-vscode-apex.java.home"] =
      "/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home";

    const shell = await import("../src/lib/shell.js");
    shell.execCommandArgs.mockImplementation(async (command, args) => {
      const key = [command, ...args].join(" ");
      if (key.includes("temurin-21") && key.includes("-version")) {
        return { stdout: "", stderr: 'openjdk version "21.0.2"' };
      }
      throw new Error(`unexpected: ${key}`);
    });

    const result = await checkJava();
    expect(result.installed).toBe(true);
    expect(result.majorVersion).toBe(21);
    expect(result.source).toBe("vscode-setting");
    expect(result.recommended).toBe(true);
  });
});
