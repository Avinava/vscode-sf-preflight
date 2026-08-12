import * as vscode from "vscode";
import * as path from "path";
import fs from "fs/promises";
import {
  EXTENSION_NAME,
  EXTENSION_ID,
  MIN_VERSIONS,
  EXTERNAL_URLS,
  STATE_KEYS,
  TIME_INTERVALS,
  APEX_JAVA_HOME_SETTING,
} from "../lib/constants.js";
import * as shell from "../lib/shell.js";
import * as ui from "../lib/ui.js";
import * as logger from "../lib/logger.js";
import * as packagesService from "./packages.js";
import * as sfPluginsService from "./sf-plugins.js";
import * as remediationService from "./remediation.js";
import {
  checkSalesforceExtensions,
  getExtensionPackCheckMode,
} from "./extensions.js";
import { checkOrgAuth } from "./auth.js";
import {
  getSalesforceCliCommands,
  inferSalesforceCliInstallMethod,
} from "./cli-install.js";
import {
  buildHealthReport,
  formatReportForOutput,
  formatReportSummaryLine,
} from "./health-report.js";

// ============================================================================
// Java Checks
// ============================================================================

/**
 * Resolve Java home candidates: VS Code Apex setting, JAVA_HOME/JDK_HOME, then PATH.
 * Salesforce docs: set salesforcedx-vscode-apex.java.home to the JDK home directory
 * (not the java binary).
 */
function getConfiguredJavaHome() {
  const fromSetting = vscode.workspace
    .getConfiguration("salesforcedx-vscode-apex")
    .get("java.home");
  if (fromSetting && String(fromSetting).trim()) {
    return { home: String(fromSetting).trim(), source: "vscode-setting" };
  }
  if (process.env.JAVA_HOME) {
    return { home: process.env.JAVA_HOME, source: "JAVA_HOME" };
  }
  if (process.env.JDK_HOME) {
    return { home: process.env.JDK_HOME, source: "JDK_HOME" };
  }
  return { home: null, source: null };
}

/**
 * Run java -version from a home directory or bare "java" on PATH.
 * @param {string|null} javaHome
 */
async function probeJavaVersion(javaHome) {
  const javaBin = javaHome
    ? path.join(javaHome, "bin", process.platform === "win32" ? "java.exe" : "java")
    : "java";

  try {
    const { stdout, stderr } = await shell.execCommandArgs(javaBin, [
      "-version",
    ]);
    const output = [stdout, stderr].filter(Boolean).join("\n");
    const versionMatch = output.match(/version "(.+?)"/);
    if (!versionMatch) {
      return null;
    }
    const version = versionMatch[1];
    const majorVersion = parseJavaMajorVersion(version);
    return {
      installed: true,
      version,
      majorVersion,
      valid: majorVersion >= MIN_VERSIONS.JAVA,
      recommended: majorVersion >= MIN_VERSIONS.JAVA_RECOMMENDED,
      home: javaHome,
      path: javaHome ? javaBin : await shell.whichCommand("java"),
    };
  } catch {
    return null;
  }
}

/**
 * Check Java using Apex setting / env home first, then PATH.
 * @returns {Promise<Object>}
 */
export async function checkJava() {
  const configured = getConfiguredJavaHome();

  if (configured.home) {
    const probed = await probeJavaVersion(configured.home);
    if (probed) {
      return { ...probed, source: configured.source };
    }
    // Configured home is invalid — still report as not working
    return {
      installed: false,
      valid: false,
      recommended: false,
      home: configured.home,
      source: configured.source,
      error: `Configured Java home is not usable: ${configured.home}`,
    };
  }

  const fromPath = await probeJavaVersion(null);
  if (fromPath) {
    return { ...fromPath, source: "PATH" };
  }

  return { installed: false, valid: false, recommended: false };
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
 * Find Java installations on the system (home directories).
 * @returns {Promise<string[]>}
 */
export async function findJavaInstallations() {
  const installations = [];
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      const { stdout, stderr } = await shell
        .execCommandArgs("/usr/libexec/java_home", ["-V"])
        .catch((error) => ({
          stdout: "",
          stderr: error.stderr || error.message || "",
        }));
      const output = [stdout, stderr].filter(Boolean).join("\n");
      // Lines look like: "    21.0.2 (arm64) "Java SE 21.0.2" - "/Library/Java/..."
      for (const line of output.split("\n")) {
        const match = line.match(/"\s*-\s*"([^"]+)"\s*$/) || line.match(/(\/Library\/Java\/[^\s"]+)/);
        if (match?.[1]) {
          installations.push(match[1].trim());
        }
      }

      try {
        const { stdout: javaHome } = await shell.execCommandArgs(
          "/usr/libexec/java_home",
          []
        );
        if (javaHome) {
          installations.push(javaHome.trim());
        }
      } catch {
        // ignore
      }
    } else if (platform === "win32") {
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
              dir.toLowerCase().includes("jre") ||
              dir.toLowerCase().includes("temurin")
            ) {
              installations.push(path.join(javaDir, dir));
            }
          }
        } catch {
          // Directory doesn't exist
        }
        // Eclipse Adoptium default
        try {
          const adoptium = path.join(pf, "Eclipse Adoptium");
          const dirs = await fs.readdir(adoptium);
          for (const dir of dirs) {
            installations.push(path.join(adoptium, dir));
          }
        } catch {
          // ignore
        }
      }
    } else {
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
          // ignore
        }
      }
    }
  } catch (error) {
    logger.error(`Error finding Java installations: ${error.message}`);
  }

  return [...new Set(installations.filter(Boolean))];
}

/**
 * Set salesforcedx-vscode-apex.java.home to a JDK home directory.
 * @param {string} javaHome
 * @param {vscode.ConfigurationTarget} [target]
 */
export async function setApexJavaHome(
  javaHome,
  target = vscode.ConfigurationTarget.Global
) {
  await vscode.workspace
    .getConfiguration("salesforcedx-vscode-apex")
    .update("java.home", javaHome, target);
  logger.info(`Set ${APEX_JAVA_HOME_SETTING} = ${javaHome}`);
}

/**
 * Prompt user to configure Java for Salesforce Apex (prefers VS Code setting).
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
      `${EXTENSION_NAME}: Java 11+ is not installed. Apex Language Server needs JDK 11+ (21 recommended).`,
      "Install Java",
      "Open Setup Guide",
      "Dismiss"
    );

    if (install === "Install Java") {
      vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.JAVA_DOWNLOAD));
    } else if (install === "Open Setup Guide") {
      vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.JAVA_SETUP));
    }
    return false;
  }

  const options = installations.map((install) => ({
    label: path.basename(install),
    description: install,
    detail: install,
  }));

  const selected = await vscode.window.showQuickPick(options, {
    placeHolder: "Select JDK home for salesforcedx-vscode-apex.java.home",
    ignoreFocusOut: true,
  });

  if (!selected) {
    return false;
  }

  const scope = await vscode.window.showQuickPick(
    [
      {
        label: "User settings (Global)",
        target: vscode.ConfigurationTarget.Global,
      },
      {
        label: "Workspace settings",
        target: vscode.ConfigurationTarget.Workspace,
      },
    ],
    { placeHolder: "Where should Java home be saved?" }
  );

  if (!scope) {
    return false;
  }

  await setApexJavaHome(selected.detail, scope.target);
  ui.showInfo(
    `Set Apex Java home to ${selected.detail}. Reload the window if Apex LS does not pick it up.`
  );
  return true;
}

// ============================================================================
// Salesforce CLI Checks
// ============================================================================

/**
 * Check Salesforce CLI installation and version
 * @returns {Promise<Object>}
 */
export async function checkSalesforceCLI() {
  try {
    const { stdout } = await shell.execCommandArgs("sf", ["--version"]);
    const versionMatch = stdout.match(
      /(?:@salesforce\/cli\/|sf\/)(\d+\.\d+\.\d+)/
    );
    const cliPath = await shell.whichCommand("sf");
    const installMethod = inferSalesforceCliInstallMethod(cliPath);

    return {
      installed: true,
      version: versionMatch ? versionMatch[1] : "unknown",
      output: stdout,
      path: cliPath,
      installMethod,
    };
  } catch (error) {
    return { installed: false, error: error.message };
  }
}

/**
 * Install / update guidance for Salesforce CLI (method-aware).
 * @param {Object} cliCheck
 * @param {{offerUpdate?: boolean}} [options]
 * @returns {Promise<boolean>}
 */
export async function promptSalesforceCLIUpdate(cliCheck, options = {}) {
  const offerUpdate = options.offerUpdate === true;
  const cmds = getSalesforceCliCommands(cliCheck.installMethod);

  if (!cliCheck.installed) {
    const actions = [];
    if (cmds.install) {
      actions.push("Copy Install Command", "Open Terminal");
    }
    actions.push("Download Installer", "Dismiss");

    const install = await vscode.window.showWarningMessage(
      `${EXTENSION_NAME}: Salesforce CLI (sf) is not installed.`,
      ...actions
    );

    if (install === "Copy Install Command" && cmds.install) {
      await vscode.env.clipboard.writeText(cmds.install);
      ui.showInfo(`Install command copied (${cmds.preferredLabel}).`);
    } else if (install === "Open Terminal" && cmds.install) {
      const terminal = vscode.window.createTerminal("SF CLI Installation");
      terminal.show();
      terminal.sendText(cmds.install, false);
    } else if (install === "Download Installer") {
      vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.SALESFORCE_CLI));
    }
    return false;
  }

  const versionLine = `Salesforce CLI v${cliCheck.version} is installed${
    cliCheck.path ? ` (${cliCheck.path})` : ""
  } [${cliCheck.installMethod || "unknown"}]`;
  logger.info(versionLine);

  if (!offerUpdate) {
    ui.showInfoVerbose(versionLine);
    return true;
  }

  const update = await vscode.window.showInformationMessage(
    `${EXTENSION_NAME}: ${versionLine}`,
    "Copy Update Command",
    "Open Update Command",
    "Check Version",
    "Dismiss"
  );

  if (update === "Copy Update Command") {
    await vscode.env.clipboard.writeText(cmds.update);
    ui.showInfo(`Update command copied (${cmds.preferredLabel}).`);
    return true;
  }
  if (update === "Open Update Command") {
    const terminal = vscode.window.createTerminal("SF CLI Update");
    terminal.show();
    terminal.sendText(cmds.update, false);
    return true;
  }
  if (update === "Check Version") {
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
 * @returns {Promise<Object>}
 */
export async function checkNodeJS() {
  try {
    const { stdout } = await shell.execCommandArgs("node", ["--version"]);
    const version = stdout.replace(/^v/i, "").trim();
    const majorVersion = parseInt(version.split(".")[0], 10);

    return {
      installed: true,
      version,
      majorVersion,
      valid: majorVersion >= MIN_VERSIONS.NODE,
      recommendedMajor: MIN_VERSIONS.NODE_RECOMMENDED,
    };
  } catch (error) {
    return { installed: false, valid: false, error: error.message };
  }
}

/**
 * Prompt for Node.js installation or update
 * @param {Object} nodeCheck
 * @returns {Promise<boolean>}
 */
export async function promptNodeJSUpdate(nodeCheck) {
  if (!nodeCheck.installed) {
    const install = await vscode.window.showWarningMessage(
      `${EXTENSION_NAME}: Node.js is not installed.`,
      "Download Node.js",
      "Dismiss"
    );

    if (install === "Download Node.js") {
      vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.NODE_DOWNLOAD));
    }
    return false;
  }

  if (!nodeCheck.valid) {
    const upgrade = await vscode.window.showWarningMessage(
      `${EXTENSION_NAME}: Node.js v${nodeCheck.version} is installed. Salesforce tooling needs Node.js v18 or higher.`,
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
      // continue
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
      // continue
    }
  }

  return null;
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Run comprehensive environment health check
 * @param {boolean|Object} silentOrOptions
 * @returns {Promise<Object>}
 */
export async function runHealthCheck(silentOrOptions = false) {
  const options =
    typeof silentOrOptions === "object" && silentOrOptions !== null
      ? silentOrOptions
      : { silent: Boolean(silentOrOptions) };
  const silent = Boolean(options.silent);
  const context = options.context;

  const results = {
    java: null,
    node: null,
    salesforceCLI: null,
    packages: null,
    sfPlugins: null,
    extensions: null,
    auth: null,
    sfPluginsMode: "recommended",
    isSFDXProject: false,
    projectInfo: null,
  };

  const runChecks = async (progress = null) => {
    const config = vscode.workspace.getConfiguration("sfPreflight");
    results.sfPluginsMode = config.get("checks.codeAnalyzer", "recommended");

    progress?.report({ message: "Checking extensions..." });
    const ext = checkSalesforceExtensions();
    results.extensions = {
      ...ext,
      packCheckMode: getExtensionPackCheckMode(),
    };

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

    if (results.sfPluginsMode !== "off" && results.salesforceCLI?.installed) {
      progress?.report({ message: "Checking SF CLI plugins..." });
      results.sfPlugins = await sfPluginsService.checkPlugins();
    } else {
      results.sfPlugins = null;
    }

    if (
      config.get("checks.orgAuth", true) &&
      results.salesforceCLI?.installed
    ) {
      progress?.report({ message: "Checking org authentication..." });
      results.auth = await checkOrgAuth();
    }
  };

  if (silent) {
    await runChecks();
  } else {
    await ui.withProgress("SF Preflight: checking environment...", runChecks);
  }

  if (context) {
    await persistLastResults(context, results);
  }

  if (!silent) {
    await displayHealthCheckResults(results, { context });
  }

  return results;
}

/**
 * Build report, write full details to Output, show a short toast when needed.
 * @param {Object} results
 * @param {{context?: vscode.ExtensionContext, interactive?: boolean}} [options]
 * @returns {Promise<import('./health-report.js').HealthReport>}
 */
export async function displayHealthCheckResults(results, options = {}) {
  const report = buildHealthReport(results);
  const fullText = formatReportForOutput(report);
  logger.info("\n" + fullText);

  if (options.context) {
    await persistLastReport(options.context, report);
    await persistLastResults(options.context, results);
  }

  if (options.interactive === false) {
    return report;
  }

  const summary = formatReportSummaryLine(report);

  if (report.summary.blockers > 0) {
    const action = await vscode.window.showErrorMessage(
      `${EXTENSION_NAME}: ${summary}`,
      "View Report",
      "Fix Issues",
      "Dismiss"
    );
    if (action === "View Report") {
      await vscode.commands.executeCommand(`${EXTENSION_ID}.openReport`);
    } else if (action === "Fix Issues") {
      await fixEnvironmentIssues(results);
    }
  } else if (report.summary.warnings > 0) {
    const action = await vscode.window.showWarningMessage(
      `${EXTENSION_NAME}: ${summary}`,
      "View Report",
      "Fix Issues",
      "Dismiss"
    );
    if (action === "View Report") {
      await vscode.commands.executeCommand(`${EXTENSION_ID}.openReport`);
    } else if (action === "Fix Issues") {
      await fixEnvironmentIssues(results);
    }
  } else {
    ui.showInfoVerbose(summary + " · full report in Output");
  }

  return report;
}

/**
 * Guide user to fix environment issues
 * @param {Object} results
 */
export async function fixEnvironmentIssues(results) {
  return remediationService.showRemediationMenu(results);
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {import('./health-report.js').HealthReport} report
 */
async function persistLastReport(context, report) {
  const snapshot = {
    timestamp: Date.now(),
    summary: report.summary,
    checks: report.checks,
    cached: report.cached,
  };
  await context.workspaceState.update(STATE_KEYS.LAST_REPORT, snapshot);
}

/**
 * Store raw results (for Fix / Report without re-running when possible).
 * @param {vscode.ExtensionContext} context
 * @param {Object} results
 */
async function persistLastResults(context, results) {
  // Drop cache flag; store plain JSON-serializable results
  const rest = { ...results };
  delete rest.cached;
  await context.workspaceState.update(STATE_KEYS.LAST_RESULTS, {
    timestamp: Date.now(),
    results: rest,
  });
}

/**
 * Load last raw results from workspace state.
 * @param {vscode.ExtensionContext} context
 * @returns {Object|null}
 */
export function getLastResults(context) {
  const stored = context.workspaceState.get(STATE_KEYS.LAST_RESULTS);
  return stored?.results || null;
}

/**
 * Whether results are cacheable: no blockers and no warnings.
 * @param {Object} results
 * @returns {boolean}
 */
export function isCacheableHealthy(results) {
  return buildHealthReport(results).summary.healthy;
}

/**
 * Run environment check on startup (non-intrusive).
 * @param {vscode.ExtensionContext} context
 * @returns {Promise<Object>}
 */
export async function runStartupCheck(context) {
  const CACHE_KEY = STATE_KEYS.LAST_CHECK_RESULT;
  const CACHE_VALIDITY_MS = TIME_INTERVALS.RECHECK_AFTER_SUCCESS;

  const cached = context.globalState.get(CACHE_KEY);
  if (cached && cached.timestamp) {
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_VALIDITY_MS) {
      logger.info(
        `Startup check skipped (cached ${Math.round(age / 60000)}m ago)`
      );
      const results = {
        ...cached.results,
        cached: true,
      };
      // Refresh extension detection (cheap, not cached well across installs)
      const ext = checkSalesforceExtensions();
      results.extensions = {
        ...ext,
        packCheckMode: getExtensionPackCheckMode(),
      };
      const report = buildHealthReport(results);
      await persistLastReport(context, report);
      await persistLastResults(context, results);
      return results;
    }
  }

  const results = await runHealthCheck({ silent: true, context });
  const report = buildHealthReport(results);
  logger.info("\n" + formatReportForOutput(report));
  await persistLastReport(context, report);

  if (report.summary.healthy) {
    await context.globalState.update(CACHE_KEY, {
      timestamp: Date.now(),
      results,
    });
    await ui.clearSnooze(context);
  } else {
    await context.globalState.update(CACHE_KEY, undefined);

    if (report.summary.blockers > 0) {
      logger.warn(
        `Startup check found ${report.summary.blockers} blocker(s)`
      );
      const action = await ui.notifyBlockers(
        context,
        formatReportSummaryLine(report),
        ["View Issues", "Snooze", "Dismiss"]
      );
      if (action === "View Issues") {
        await vscode.commands.executeCommand(`${EXTENSION_ID}.openReport`);
      } else if (action === "Snooze") {
        await ui.promptSnooze(context);
      }
    }
  }

  await maybeShowFirstRunNotice(context);
  return results;
}

/**
 * One-time quiet intro so users know the extension will not spam them.
 * @param {vscode.ExtensionContext} context
 */
async function maybeShowFirstRunNotice(context) {
  if (context.globalState.get(STATE_KEYS.FIRST_RUN_NOTICE_SHOWN)) {
    return;
  }
  await context.globalState.update(STATE_KEYS.FIRST_RUN_NOTICE_SHOWN, true);
  const action = await vscode.window.showInformationMessage(
    `${EXTENSION_NAME}: Quiet setup checks for Salesforce DX. You will only be notified for real blockers. Open the report anytime from the SF status bar item.`,
    "Got it",
    "Open Report"
  );
  if (action === "Open Report") {
    await vscode.commands.executeCommand(`${EXTENSION_ID}.openReport`);
  }
}

/**
 * Update the health check cache manually
 * @param {vscode.ExtensionContext} context
 * @param {Object} results
 */
export async function updateHealthCheckCache(context, results) {
  const report = buildHealthReport(results);
  await persistLastReport(context, report);
  await persistLastResults(context, results);

  if (report.summary.healthy) {
    await context.globalState.update(STATE_KEYS.LAST_CHECK_RESULT, {
      timestamp: Date.now(),
      results,
    });
    await ui.clearSnooze(context);
  } else {
    await context.globalState.update(STATE_KEYS.LAST_CHECK_RESULT, undefined);
  }
}
