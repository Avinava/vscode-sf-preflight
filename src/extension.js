import * as vscode from 'vscode';
import { EXTENSION_NAME, EXTENSION_ID } from './lib/constants.js';
import * as environmentService from './services/environment.js';
import * as environmentCommands from './features/environment-commands.js';

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
  }

  /**
   * Activate the extension
   */
  async activate() {
    console.log(`${EXTENSION_NAME} is now active!`);

    // Check if we're in an SFDX project and set context
    this.isSfdxProject = await environmentService.isSalesforceDXProject();
    await vscode.commands.executeCommand('setContext', 'sfdx:project_opened', this.isSfdxProject);

    // Register all commands
    this.registerCommands();

    // Run environment check on startup if configured
    const config = vscode.workspace.getConfiguration('sfPreflight');
    if (config.get('runHealthCheckOnStartup')) {
      await environmentService.runStartupCheck(this.context);
    }

    // Watch for sfdx-project.json changes
    this.watchSfdxProject();
    this.watchWorkspaceChanges();
  }

  /**
   * Watch for changes to sfdx-project.json
   */
  watchSfdxProject() {
    const watcher = vscode.workspace.createFileSystemWatcher('**/sfdx-project.json');

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
   * Handle SFDX project status change
   * @param {boolean} isSfdxProject
   */
  async handleSfdxProjectChange(isSfdxProject) {
    this.isSfdxProject = isSfdxProject;
    await vscode.commands.executeCommand('setContext', 'sfdx:project_opened', this.isSfdxProject);

    if (this.isSfdxProject) {
      vscode.window.showInformationMessage(
        `${EXTENSION_NAME}: Salesforce DX project detected!`
      );
    }
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
      this.context.subscriptions.push(vscode.commands.registerCommand(command, callback));
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
