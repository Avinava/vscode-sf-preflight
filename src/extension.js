import * as vscode from "vscode";
import { EXTENSION_NAME, EXTENSION_ID } from "./lib/constants.js";
import * as environmentService from "./services/environment.js";
import * as environmentCommands from "./features/environment-commands.js";

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

    // Run environment check on startup if configured
    const config = vscode.workspace.getConfiguration("sfPreflight");
    if (config.get("runHealthCheckOnStartup")) {
      await environmentService.runStartupCheck(this.context);
    }

    // Update status bar with current environment status
    await this.updateStatusBar();

    // Watch for sfdx-project.json changes
    this.watchSfdxProject();
    this.watchWorkspaceChanges();
    this.watchConfigChanges();
  }

  /**
   * Create status bar item
   */
  createStatusBar() {
    const config = vscode.workspace.getConfiguration("sfPreflight");
    if (!config.get("showStatusBar")) {
      return;
    }

    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = `${EXTENSION_ID}.checkEnvironment`;
    this.statusBarItem.text = "$(sync~spin) SF Preflight";
    this.statusBarItem.tooltip = "Checking environment...";
    this.statusBarItem.show();
    this.context.subscriptions.push(this.statusBarItem);
  }

  /**
   * Update status bar with environment status
   */
  async updateStatusBar() {
    if (!this.statusBarItem) {
      return;
    }

    try {
      const results = await environmentService.runHealthCheck(true);

      const hasIssues =
        !results.node.installed ||
        !results.salesforceCLI.installed ||
        (results.packages && !results.packages.allInstalled) ||
        (results.sfPlugins && !results.sfPlugins.allInstalled);

      const hasWarnings =
        !results.node.valid || !results.java.installed || !results.java.valid;

      if (hasIssues) {
        this.statusBarItem.text = "$(error) SF Preflight";
        this.statusBarItem.tooltip =
          "Environment issues detected - Click to fix";
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.errorBackground"
        );
        this.statusBarItem.color = undefined;
      } else if (hasWarnings) {
        this.statusBarItem.text = "$(warning) SF Preflight";
        this.statusBarItem.tooltip = "Environment warnings - Click to view";
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.warningBackground"
        );
        this.statusBarItem.color = undefined;
      } else {
        this.statusBarItem.text = "$(pass-filled) SF Preflight";
        this.statusBarItem.tooltip =
          "Environment OK - Click to run health check";
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = new vscode.ThemeColor(
          "testing.iconPassed"
        );
      }
    } catch (error) {
      this.statusBarItem.text = "$(error) SF Preflight";
      this.statusBarItem.tooltip = `Error checking environment: ${error.message}`;
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
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      const isSfdx = await environmentService.isSalesforceDXProject();
      if (isSfdx !== this.isSfdxProject) {
        await this.handleSfdxProjectChange(isSfdx);
      }
    });
  }

  /**
   * Watch for configuration changes
   */
  watchConfigChanges() {
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("sfPreflight.showStatusBar")) {
        const config = vscode.workspace.getConfiguration("sfPreflight");
        if (config.get("showStatusBar")) {
          if (!this.statusBarItem) {
            this.createStatusBar();
            await this.updateStatusBar();
          }
        } else {
          if (this.statusBarItem) {
            this.statusBarItem.dispose();
            this.statusBarItem = null;
          }
        }
      }
    });
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
      vscode.window.showInformationMessage(
        `${EXTENSION_NAME}: Salesforce DX project detected!`
      );
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
        callback: () => environmentCommands.checkEnvironment(),
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
    ];

    commands.forEach(({ command, callback }) => {
      this.context.subscriptions.push(
        vscode.commands.registerCommand(command, callback)
      );
    });
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
