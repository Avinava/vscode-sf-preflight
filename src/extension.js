import * as vscode from "vscode";
import { EXTENSION_NAME, EXTENSION_ID } from "./lib/constants.js";
import * as environmentService from "./services/environment.js";
import * as environmentCommands from "./features/environment-commands.js";
import {
  buildHealthReport,
  getStatusLevel,
  formatReportSummaryLine,
} from "./services/health-report.js";
import { openSetupReport } from "./services/setup-report.js";
import { ProvisioningManager } from "./provisioning/ProvisioningManager.js";
import { SpellCheckerProvisioner } from "./provisioning/spellChecker/SpellCheckerProvisioner.js";
import { GitIgnoreProvisioner } from "./provisioning/gitIgnore/GitIgnoreProvisioner.js";
import { PrettierProvisioner } from "./provisioning/prettier/PrettierProvisioner.js";
import { EditorConfigProvisioner } from "./provisioning/editorConfig/EditorConfigProvisioner.js";
import { VsCodeSettingsProvisioner } from "./provisioning/vscode/VsCodeSettingsProvisioner.js";

/**
 * SF Preflight Extension
 * Environment health checks for Salesforce development
 */
class Extension {
  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    this.context = context;
    this.isSfdxProject = false;
    this.statusBarItem = null;
    this.provisioningManager = new ProvisioningManager(context);
  }

  /**
   * Activate the extension
   */
  async activate() {
    console.log(`${EXTENSION_NAME} is now active!`);

    // Check if we're in an SFDX project and set context
    this.isSfdxProject = await environmentService.isSalesforceDXProject();
    await vscode.commands.executeCommand(
      "setContext",
      "sfdx:project_opened",
      this.isSfdxProject
    );

    // Register all commands
    this.registerCommands();

    // Create status bar item
    this.createStatusBar();

    // Setup and run provisioning
    this.setupProvisioning();
    const config = vscode.workspace.getConfiguration("sfPreflight");
    if (this.isSfdxProject && config.get("provisioning.runOnStartup")) {
      await this.provisioningManager.runOnStartup();
    }

    // Run environment check on startup and update status bar
    if (config.get("runHealthCheckOnStartup")) {
      const results = await environmentService.runStartupCheck(this.context);
      // Use the results from startup check to update status bar
      if (results) {
        this.updateStatusBarWithResults(results);
      }
    } else {
      // Just update status bar silently
      await this.updateStatusBar();
    }

    // Watch for sfdx-project.json changes
    this.watchSfdxProject();
    this.watchWorkspaceChanges();
    this.watchConfigChanges();
  }

  /**
   * Setup provisioners
   */
  setupProvisioning() {
    this.provisioningManager.registerProvisioner(
      new SpellCheckerProvisioner(this.context)
    );
    this.provisioningManager.registerProvisioner(
      new GitIgnoreProvisioner(this.context)
    );
    this.provisioningManager.registerProvisioner(
      new PrettierProvisioner(this.context)
    );
    this.provisioningManager.registerProvisioner(
      new EditorConfigProvisioner(this.context)
    );
    this.provisioningManager.registerProvisioner(
      new VsCodeSettingsProvisioner(this.context)
    );
  }

  /**
   * Create status bar item
   */
  createStatusBar() {
    const config = vscode.workspace.getConfiguration("sfPreflight");
    if (!config.get("showStatusBar")) {
      return;
    }

    // Right side, low priority — less competition with primary language tooling
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      50
    );
    this.statusBarItem.name = "SF Preflight";
    this.statusBarItem.command = `${EXTENSION_ID}.openReport`;
    this.statusBarItem.text = "$(sync~spin) SF";
    this.statusBarItem.tooltip = "Checking environment… (click for setup report)";
    this.statusBarItem.show();
    this.context.subscriptions.push(this.statusBarItem);
  }

  /**
   * Update status bar with environment status
   * @param {Object} [results] - Optional pre-fetched results
   */
  async updateStatusBar(results = null) {
    if (!this.statusBarItem) {
      return;
    }

    try {
      const checkResults =
        results || (await environmentService.runHealthCheck(true));
      this.updateStatusBarWithResults(checkResults);
    } catch (error) {
      this.statusBarItem.text = "$(error) SF Preflight";
      this.statusBarItem.tooltip = `Error checking environment: ${error.message}`;
    }
  }

  /**
   * Update status bar UI with given results (no fetch)
   * @param {Object} results
   */
  updateStatusBarWithResults(results) {
    if (!this.statusBarItem) {
      return;
    }

    const report = buildHealthReport(results);
    const level = getStatusLevel(report);
    const summary = formatReportSummaryLine(report);
    const cacheNote = results.cached ? " · cached" : "";
    const topIssue = report.checks.find((c) => !c.ok);
    const detail = topIssue
      ? `\n${topIssue.title}: ${topIssue.message}`
      : "";

    if (level === "error") {
      this.statusBarItem.text = "$(error) SF";
      this.statusBarItem.tooltip = `${summary}${detail}\nClick for actions`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground"
      );
      this.statusBarItem.color = undefined;
    } else if (level === "warning") {
      this.statusBarItem.text = "$(warning) SF";
      this.statusBarItem.tooltip = `${summary}${detail}\nClick for actions`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
      this.statusBarItem.color = undefined;
    } else {
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.color = new vscode.ThemeColor("testing.iconPassed");
      this.statusBarItem.text = "$(pass-filled) SF";
      const rec =
        report.summary.infos > 0
          ? `\n${report.summary.infos} optional recommendation(s)`
          : "";
      this.statusBarItem.tooltip = `${summary}${cacheNote}${rec}\nClick for actions`;
    }
  }

  /**
   * Watch for changes to sfdx-project.json
   */
  watchSfdxProject() {
    const watcher = vscode.workspace.createFileSystemWatcher(
      "**/sfdx-project.json"
    );

    watcher.onDidCreate(async () => {
      console.log(`${EXTENSION_NAME}: sfdx-project.json created`);
      await this.handleSfdxProjectChange(true);
    });

    watcher.onDidDelete(async () => {
      console.log(`${EXTENSION_NAME}: sfdx-project.json deleted`);
      await this.handleSfdxProjectChange(false);
    });

    this.context.subscriptions.push(watcher);
  }

  /**
   * Watch for workspace folder changes
   */
  watchWorkspaceChanges() {
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        const isSfdx = await environmentService.isSalesforceDXProject();
        if (isSfdx !== this.isSfdxProject) {
          await this.handleSfdxProjectChange(isSfdx);
        }
      })
    );
  }

  /**
   * Watch for configuration changes
   */
  watchConfigChanges() {
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration("sfPreflight.showStatusBar")) {
          const config = vscode.workspace.getConfiguration("sfPreflight");
          if (config.get("showStatusBar")) {
            if (!this.statusBarItem) {
              this.createStatusBar();
              await this.updateStatusBar();
            }
          } else if (this.statusBarItem) {
            this.statusBarItem.dispose();
            this.statusBarItem = null;
          }
        }
      })
    );
  }

  /**
   * Handle SFDX project status change
   * @param {boolean} isSfdxProject
   */
  async handleSfdxProjectChange(isSfdxProject) {
    this.isSfdxProject = isSfdxProject;
    await vscode.commands.executeCommand(
      "setContext",
      "sfdx:project_opened",
      this.isSfdxProject
    );

    if (this.isSfdxProject) {
      const config = vscode.workspace.getConfiguration("sfPreflight");
      if (config.get("provisioning.runOnStartup")) {
        await this.provisioningManager.runOnStartup();
      }
    }

    // Update status bar when project status changes
    await this.updateStatusBar();
  }

  /**
   * Register all extension commands
   */
  registerCommands() {
    const commands = [
      {
        command: `${EXTENSION_ID}.checkEnvironment`,
        callback: () => environmentCommands.checkEnvironment(this.context),
      },
      {
        command: `${EXTENSION_ID}.checkJava`,
        callback: () => environmentCommands.checkJava(),
      },
      {
        command: `${EXTENSION_ID}.checkSalesforceCLI`,
        callback: () => environmentCommands.checkSalesforceCLI(),
      },
      {
        command: `${EXTENSION_ID}.checkNodeJS`,
        callback: () => environmentCommands.checkNodeJS(),
      },
      {
        command: `${EXTENSION_ID}.showProjectInfo`,
        callback: () => environmentCommands.showProjectInfo(),
      },
      {
        command: `${EXTENSION_ID}.fixEnvironment`,
        callback: () => environmentCommands.fixEnvironment(this.context),
      },
      {
        command: `${EXTENSION_ID}.applyRecommendedSetup`,
        callback: () => this.provisioningManager.applyRecommendedSetup(),
      },
      {
        command: `${EXTENSION_ID}.provisionForce`,
        callback: () => this.provisioningManager.runForce(),
      },
      {
        command: `${EXTENSION_ID}.showLogs`,
        callback: () => environmentCommands.showLogs(),
      },
      {
        command: `${EXTENSION_ID}.openReport`,
        callback: () => openSetupReport(this.context),
      },
      {
        command: `${EXTENSION_ID}.openMenu`,
        callback: () => this.openActionMenu(),
      },
    ];

    commands.forEach(({ command, callback }) => {
      this.context.subscriptions.push(
        vscode.commands.registerCommand(command, callback)
      );
    });
  }

  /**
   * Open the action menu from status bar
   */
  async openActionMenu() {
    const items = [
      {
        label: "$(checklist) Open Setup Report",
        description: "Issues grouped by severity with fix actions",
        command: `${EXTENSION_ID}.openReport`,
      },
      {
        label: "$(sync) Run Health Check",
        description: "Re-check environment requirements",
        command: `${EXTENSION_ID}.checkEnvironment`,
      },
      {
        label: "$(wrench) Fix Environment Issues",
        description: "Copyable setup commands and docs",
        command: `${EXTENSION_ID}.fixEnvironment`,
      },
      {
        label: "$(file-add) Apply Recommended Setup",
        description: "Preview and create missing project config files",
        command: `${EXTENSION_ID}.applyRecommendedSetup`,
      },
      {
        label: "$(info) Show Project Info",
        description: "Display detected project details",
        command: `${EXTENSION_ID}.showProjectInfo`,
      },
      {
        label: "$(output) Show Logs",
        description: "Open SF Preflight Output channel",
        command: `${EXTENSION_ID}.showLogs`,
      },
      {
        label: "$(refresh) Advanced: Force Re-provision…",
        description: "Overwrite config files (creates backups)",
        command: `${EXTENSION_ID}.provisionForce`,
      },
    ];

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: "SF Preflight",
    });

    if (selection) {
      await vscode.commands.executeCommand(selection.command);
    }
  }

  /**
   * Deactivate the extension
   */
  deactivate() {
    // Cleanup if needed
  }
}

/**
 * Extension activation entry point
 * @param {vscode.ExtensionContext} context
 */
export function activate(context) {
  const extension = new Extension(context);
  extension.activate();
}

/**
 * Extension deactivation entry point
 */
export function deactivate() {
  // Cleanup if needed
}
