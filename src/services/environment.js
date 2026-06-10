import * as vscode from "vscode";
import * as path from "path";
import fs from "fs/promises";
import {
  EXTENSION_NAME,
  MIN_VERSIONS,
  EXTERNAL_URLS,
} from "../lib/constants.js";
import * as shell from "../lib/shell.js";
import * as ui from "../lib/ui.js";
import * as packagesService from "./packages.js";
import * as sfPluginsService from "./sf-plugins.js";
import * as remediationService from "./remediation.js";

/**
 * Environment checking service
 * Handles verification of Java, Node.js, Salesforce CLI, and Prettier installations
 */

// ============================================================================
// Java Checks
// ============================================================================

/**
 * Check if Java is installed and get version
 * @returns {Promise<{installed: boolean, version?: string, majorVersion?: number, valid: boolean, path?: string, error?: string}>}
 */
export async function checkJava() {
  try {
    const { stdout, stderr } = await shell.execCommandArgs("java", [
      "-version",
    ]);
    const output = [stdout, stderr].filter(Boolean).join("\n");
    const versionMatch = output.match(/version "(.+?)"/);
    if (versionMatch) {
      const version = versionMatch[1];
      const majorVersion = parseJavaMajorVersion(version);
      return {
        installed: true,
        version,
        majorVersion,
        valid: majorVersion >= MIN_VERSIONS.JAVA,
        path: await getJavaPath(),
      };
    }
    return { installed: false, valid: false };
  } catch (error) {
    return { installed: false, valid: false, error: error.message };
  }
}

/**
 * Get Java installation path
 * @returns {Promise<string | null>}
 */
async function getJavaPath() {
  return shell.whichCommand("java");
}

/**
 * Parse Java major versions including legacy 1.8 format.
 * @param {string} version
 * @returns {number}
 */
export function parseJavaMajorVersion(version) {
  const parts = version.split(".");
  if (parts[0] === "1" && parts[1]) {
    return parseInt(parts[1], 10);
  }
  return parseInt(parts[0], 10);
}

/**
 * Find Java installations on the system
 * @returns {Promise<string[]>}
 */
export async function findJavaInstallations() {
  const installations = [];
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      // macOS - check common locations
      const { stdout, stderr } = await shell.execCommandArgs(
        "/usr/libexec/java_home",
        ["-V"]
      ).catch((error) => ({
        stdout: "",
        stderr: error.message,
      }));
      const output = [stdout, stderr].filter(Boolean).join("\n");
      const matches = output.matchAll(/^\s+(.+?)\s*$/gm);
      for (const match of matches) {
        if (match[1].includes("Java") || match[1].includes("jdk")) {
          installations.push(match[1].trim());
        }
      }

      try {
        const { stdout: javaHome } = await shell.execCommandArgs(
          "/usr/libexec/java_home",
          []
        );
        if (javaHome) {
          installations.push(javaHome);
        }
      } catch {
        // Ignore if not found
      }
    } else if (platform === "win32") {
      // Windows - check Program Files
      const programFiles = [
        process.env["ProgramFiles"],
        process.env["ProgramFiles(x86)"],
      ];

      for (const pf of programFiles) {
        if (!pf) continue;
        try {
          const javaDir = path.join(pf, "Java");
          const dirs = await fs.readdir(javaDir);
          for (const dir of dirs) {
            if (
              dir.toLowerCase().includes("jdk") ||
              dir.toLowerCase().includes("jre")
            ) {
              installations.push(path.join(javaDir, dir));
            }
          }
        } catch {
          // Directory doesn't exist
        }
      }
    } else {
      // Linux - check common locations
      const commonPaths = [
        "/usr/lib/jvm",
        "/usr/java",
        "/opt/jdk",
        "/opt/java",
      ];

      for (const javaPath of commonPaths) {
        try {
          const dirs = await fs.readdir(javaPath);
          for (const dir of dirs) {
            installations.push(path.join(javaPath, dir));
          }
        } catch {
          // Directory doesn't exist
        }
      }
    }
  } catch (error) {
    console.error("Error finding Java installations:", error);
  }

  return [...new Set(installations)]; // Remove duplicates
}

/**
 * Prompt user to update Java PATH
 * @returns {Promise<boolean>}
 */
export async function promptJavaPathUpdate() {
  const javaCheck = await checkJava();

  if (javaCheck.installed && javaCheck.valid) {
    return true;
  }

  const installations = await findJavaInstallations();

  if (installations.length === 0) {
    const install = await vscode.window.showWarningMessage(
      `${EXTENSION_NAME}: Java 11+ is not installed. Salesforce Apex Language Server requires Java 11 or higher.`,
      "Install Java",
      "Remind Me Later"
    );

    if (install === "Install Java") {
      vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.JAVA_DOWNLOAD));
    }
    return false;
  }

  const options = installations.map((install) => ({
    label: path.basename(install),
    detail: install,
  }));

  const selected = await vscode.window.showQuickPick(options, {
    placeHolder: "Select Java installation to add to your PATH",
    ignoreFocusOut: true,
  });

  if (selected) {
    await showPathUpdateInstructions(selected.detail);
  }

  return false;
}

/**
 * Show instructions to update PATH for Java
 * @param {string} javaPath
 */
async function showPathUpdateInstructions(javaPath) {
  const platform = process.platform;
  const binPath = path.join(javaPath, "bin");

  let instructions = "";

  if (platform === "darwin" || platform === "linux") {
    const shell = process.env.SHELL || "/bin/bash";
    const configFile = shell.includes("zsh")
      ? "~/.zshrc"
      : shell.includes("fish")
        ? "~/.config/fish/config.fish"
        : shell.includes("nu")
          ? "~/.config/nushell/env.nu"
          : "~/.bashrc";

    if (shell.includes("nu")) {
      instructions = `Add this to your ${configFile}:\n\n$env.JAVA_HOME = "${javaPath}"\n$env.PATH = ($env.PATH | prepend "${binPath}")\n\nThen restart your terminal or run: source ${configFile}`;
    } else {
      instructions = `Add this to your ${configFile}:\n\nexport JAVA_HOME="${javaPath}"\nexport PATH="$JAVA_HOME/bin:$PATH"\n\nThen restart your terminal or run: source ${configFile}`;
    }
  } else {
    instructions = `Add to your System Environment Variables:\n\nJAVA_HOME=${javaPath}\n\nAnd add to PATH:\n%JAVA_HOME%\\bin\n\nThen restart VS Code.`;
  }

  const action = await vscode.window.showInformationMessage(
    "To use Java with Salesforce extensions, update your PATH:",
    "Copy Instructions",
    "Open Guide"
  );

  if (action === "Copy Instructions") {
    await vscode.env.clipboard.writeText(instructions);
    ui.showInfo("Instructions copied to clipboard!");
  } else if (action === "Open Guide") {
    vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.JAVA_SETUP));
  }
}

// ============================================================================
// Salesforce CLI Checks
// ============================================================================

/**
 * Check Salesforce CLI installation and version
 * @returns {Promise<{installed: boolean, version?: string, output?: string, error?: string}>}
 */
export async function checkSalesforceCLI() {
  try {
    const { stdout } = await shell.execCommandArgs("sf", ["--version"]);
    const versionMatch = stdout.match(
      /(?:@salesforce\/cli\/|sf\/)(\d+\.\d+\.\d+)/
    );
    const cliPath = await shell.whichCommand("sf");

    if (versionMatch) {
      return {
        installed: true,
        version: versionMatch[1],
        output: stdout,
        path: cliPath,
        installMethod: inferSalesforceCliInstallMethod(cliPath),
      };
    }

    return {
      installed: true,
      version: "unknown",
      output: stdout,
      path: cliPath,
      installMethod: inferSalesforceCliInstallMethod(cliPath),
    };
  } catch (error) {
    return { installed: false, error: error.message };
  }
}

function inferSalesforceCliInstallMethod(cliPath) {
  if (!cliPath) {
    return "unknown";
  }

  const normalized = cliPath.toLowerCase();
  if (normalized.includes("homebrew") || normalized.includes("/opt/homebrew")) {
    return "homebrew";
  }
  if (normalized.includes("npm") || normalized.includes("node")) {
    return "npm";
  }
  if (process.platform === "win32" && normalized.includes("program files")) {
    return "installer";
  }
  return "unknown";
}

/**
 * Prompt to install or update Salesforce CLI
 * @param {Object} cliCheck - CLI check result
 * @returns {Promise<boolean>}
 */
export async function promptSalesforceCLIUpdate(cliCheck) {
  if (!cliCheck.installed) {
    const install = await vscode.window.showWarningMessage(
      `${EXTENSION_NAME}: Salesforce CLI (sf) is not installed.`,
      "Copy npm Command",
      "Open npm Command",
      "Download Installer",
      "Remind Me Later"
    );

    if (install === "Copy npm Command") {
      await vscode.env.clipboard.writeText("npm install -g @salesforce/cli");
      ui.showInfo("Salesforce CLI install command copied to clipboard.");
    } else if (install === "Open npm Command") {
      const terminal = vscode.window.createTerminal("SF CLI Installation");
      terminal.show();
      terminal.sendText("npm install -g @salesforce/cli", false);
    } else if (install === "Download Installer") {
      vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.SALESFORCE_CLI));
    }
    return false;
  }

  const update = await vscode.window.showInformationMessage(
    `${EXTENSION_NAME}: Salesforce CLI v${cliCheck.version} is installed.`,
    "Copy Update Command",
    "Open Update Command",
    "Check Version",
    "Later"
  );

  if (update === "Copy Update Command") {
    await vscode.env.clipboard.writeText("npm update -g @salesforce/cli");
    ui.showInfo("Salesforce CLI update command copied to clipboard.");
    return true;
  } else if (update === "Open Update Command") {
    const terminal = vscode.window.createTerminal("SF CLI Update");
    terminal.show();
    terminal.sendText("npm update -g @salesforce/cli", false);
    return true;
  } else if (update === "Check Version") {
    const terminal = vscode.window.createTerminal("SF CLI Version");
    terminal.show();
    terminal.sendText("sf version --verbose", false);
    return true;
  }

  return true;
}

// ============================================================================
// Node.js Checks
// ============================================================================

/**
 * Check Node.js version
 * @returns {Promise<{installed: boolean, version?: string, majorVersion?: number, valid: boolean, error?: string}>}
 */
export async function checkNodeJS() {
  try {
    const { stdout } = await shell.execCommandArgs("node", ["--version"]);
    const version = stdout.replace("v", "");
    const majorVersion = parseInt(version.split(".")[0]);

    return {
      installed: true,
      version,
      majorVersion,
      valid: majorVersion >= MIN_VERSIONS.NODE,
    };
  } catch (error) {
    return { installed: false, valid: false, error: error.message };
  }
}

/**
 * Prompt for Node.js installation or update
 * @param {Object} nodeCheck - Node check result
 * @returns {Promise<boolean>}
 */
export async function promptNodeJSUpdate(nodeCheck) {
  if (!nodeCheck.installed) {
    const install = await vscode.window.showWarningMessage(
      `${EXTENSION_NAME}: Node.js is not installed.`,
      "Download Node.js",
      "Remind Me Later"
    );

    if (install === "Download Node.js") {
      vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.NODE_DOWNLOAD));
    }
    return false;
  }

  if (!nodeCheck.valid) {
    const upgrade = await vscode.window.showWarningMessage(
      `${EXTENSION_NAME}: Node.js v${nodeCheck.version} is installed. Salesforce recommends Node.js v18 or higher.`,
      "Download Latest",
      "Continue Anyway"
    );

    if (upgrade === "Download Latest") {
      vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.NODE_DOWNLOAD));
      return false;
    }
  }

  return true;
}

// ============================================================================
// Project Checks
// ============================================================================

/**
 * Check if current workspace is a Salesforce DX project
 * @returns {Promise<boolean>}
 */
export async function isSalesforceDXProject() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return false;
  }

  for (const folder of workspaceFolders) {
    const sfdxProjectPath = path.join(folder.uri.fsPath, "sfdx-project.json");
    try {
      await fs.access(sfdxProjectPath);
      return true;
    } catch {
      // File doesn't exist, continue checking
    }
  }

  return false;
}

/**
 * Get Salesforce project information
 * @returns {Promise<Object | null>}
 */
export async function getSalesforceProjectInfo() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return null;
  }

  for (const folder of workspaceFolders) {
    const sfdxProjectPath = path.join(folder.uri.fsPath, "sfdx-project.json");
    try {
      const content = await fs.readFile(sfdxProjectPath, "utf8");
      const projectData = JSON.parse(content);
      return {
        path: sfdxProjectPath,
        workspacePath: folder.uri.fsPath,
        workspaceName: folder.name,
        name: projectData.name || "Unnamed Project",
        namespace: projectData.namespace || "",
        sourceApiVersion: projectData.sourceApiVersion || "unknown",
        packageDirectories: projectData.packageDirectories || [],
      };
    } catch {
      // File doesn't exist or is invalid, continue checking
    }
  }

  return null;
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Run comprehensive environment health check
 * @param {boolean} silent - If true, don't show UI
 * @returns {Promise<Object>}
 */
export async function runHealthCheck(silent = false) {
  const results = {
    java: null,
    node: null,
    salesforceCLI: null,
    packages: null,
    sfPlugins: null,
    isSFDXProject: false,
    projectInfo: null,
  };

  const runChecks = async (progress = null) => {
    progress?.report({ message: "Checking Node.js..." });
    results.node = await checkNodeJS();

    progress?.report({ message: "Checking Java..." });
    results.java = await checkJava();

    progress?.report({ message: "Checking Salesforce CLI..." });
    results.salesforceCLI = await checkSalesforceCLI();

    progress?.report({ message: "Checking project type..." });
    results.isSFDXProject = await isSalesforceDXProject();

    if (results.isSFDXProject) {
      results.projectInfo = await getSalesforceProjectInfo();
    }

    const workspacePath = results.projectInfo?.workspacePath;

    progress?.report({ message: "Checking project packages..." });
    results.packages = await packagesService.checkPackages(workspacePath);

    progress?.report({ message: "Checking SF CLI plugins..." });
    results.sfPlugins = await sfPluginsService.checkPlugins();
  };

  if (silent) {
    await runChecks();
  } else {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Checking development environment...",
        cancellable: false,
      },
      runChecks
    );
  }

  if (!silent) {
    await displayHealthCheckResults(results);
  }

  return results;
}

/**
 * Display health check results
 * @param {Object} results
 */
export async function displayHealthCheckResults(results) {
  const issues = [];
  const warnings = [];
  const info = [];

  // Node.js check
  if (!results.node.installed) {
    issues.push("❌ Node.js is not installed");
  } else if (!results.node.valid) {
    warnings.push(`⚠️  Node.js v${results.node.version} (recommend v18+)`);
  } else {
    info.push(`✅ Node.js v${results.node.version}`);
  }

  // Java check
  if (!results.java.installed) {
    warnings.push("⚠️  Java is not in PATH (needed for Apex features)");
  } else if (!results.java.valid) {
    warnings.push(`⚠️  Java ${results.java.version} (recommend 11+)`);
  } else {
    info.push(`✅ Java ${results.java.version}`);
  }

  // Salesforce CLI check
  if (!results.salesforceCLI.installed) {
    issues.push("❌ Salesforce CLI is not installed");
  } else {
    info.push(`✅ Salesforce CLI v${results.salesforceCLI.version}`);
  }

  // npm packages check (includes Prettier and plugins)
  if (results.packages) {
    if (!results.packages.allInstalled) {
      warnings.push(
        `⚠️  Missing npm packages: ${results.packages.missing.join(", ")}`
      );
    } else {
      info.push(`✅ All required npm packages installed`);
    }
  }

  // SF CLI plugins check
  if (results.sfPlugins) {
    if (!results.sfPlugins.allInstalled) {
      warnings.push(
        `⚠️  Missing SF plugins: ${results.sfPlugins.missing.join(", ")}`
      );
    } else {
      info.push(`✅ All required SF CLI plugins installed`);
    }
  }

  // Project info
  if (results.isSFDXProject && results.projectInfo) {
    info.push(`\n📦 SFDX Project: ${results.projectInfo.name}`);
    info.push(`   API Version: ${results.projectInfo.sourceApiVersion}`);
  } else {
    info.push("\nℹ️  Not in a Salesforce DX project");
  }

  const message = [...issues, ...warnings, ...info].join("\n");

  if (issues.length > 0 || warnings.length > 0) {
    const messageType = issues.length > 0 ? "error" : "warning";
    const showMessage =
      messageType === "error"
        ? vscode.window.showErrorMessage
        : vscode.window.showWarningMessage;

    const action = await showMessage(
      `Environment Check:\n${message}`,
      "Fix Issues",
      "Dismiss"
    );

    if (action === "Fix Issues") {
      await fixEnvironmentIssues(results);
    }
  } else {
    ui.showInfo(`Environment Check:\n${message}`);
  }
}

/**
 * Guide user to fix environment issues
 * @param {Object} results
 */
export async function fixEnvironmentIssues(results) {
  return remediationService.showRemediationMenu(results);
}

/**
 * Run environment check on startup (non-intrusive).
 * Uses globalState so the cache persists across workspace switches.
 * Only shows notifications for CRITICAL issues (node/sf CLI missing).
 * Warnings (Java version, optional packages) are only surfaced via status bar.
 * @param {vscode.ExtensionContext} context
 * @returns {Promise<Object|null>} Health check results or null if skipped
 */
export async function runStartupCheck(context) {
  const CACHE_KEY = "sfPreflight.lastCheckResult";
  const CACHE_VALIDITY_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Check cache first
  const cached = context.globalState.get(CACHE_KEY);
  if (cached && cached.timestamp) {
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_VALIDITY_MS) {
      console.log(`${EXTENSION_NAME}: Startup check skipped (cached ${Math.round(age / 60000)}m ago)`);
      return {
        ...cached.results,
        cached: true,
      };
    }
  }

  // Run silent check — never show the full results dialog on startup
  const results = await runHealthCheck(true);

  const hasIssues =
    !results.salesforceCLI.installed ||
    !results.node.installed;

  const hasWarnings =
    !results.node.valid ||
    !results.java.installed ||
    !results.java.valid ||
    (results.packages && !results.packages.allInstalled) ||
    (results.sfPlugins && !results.sfPlugins.allInstalled);

  if (!hasIssues && !hasWarnings) {
    // All good — cache the full result set
    await context.globalState.update(CACHE_KEY, {
      timestamp: Date.now(),
      results,
    });
  } else {
    // Issues found — clear cache so we re-check next startup
    await context.globalState.update(CACHE_KEY, undefined);

    if (hasIssues) {
      console.log(`${EXTENSION_NAME}: Startup check found critical issues.`);
    }
  }

  return results;
}

/**
 * Update the health check cache manually (e.g. after manual run)
 * @param {vscode.ExtensionContext} context
 * @param {Object} results
 */
export async function updateHealthCheckCache(context, results) {
  const CACHE_KEY = "sfPreflight.lastCheckResult";
  const hasIssues =
    !results.salesforceCLI.installed ||
    !results.node.installed;
  const hasWarnings =
    !results.node.valid ||
    !results.java.installed ||
    !results.java.valid ||
    (results.packages && !results.packages.allInstalled) ||
    (results.sfPlugins && !results.sfPlugins.allInstalled);

  if (!hasIssues && !hasWarnings) {
    await context.globalState.update(CACHE_KEY, {
      timestamp: Date.now(),
      results,
    });
  } else {
    await context.globalState.update(CACHE_KEY, undefined);
  }
}
