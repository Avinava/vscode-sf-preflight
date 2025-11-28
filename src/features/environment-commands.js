import * as vscode from 'vscode';
import * as environmentService from '../services/environment.js';
import * as ui from '../lib/ui.js';

/**
 * Environment health command handlers
 */

/**
 * Run full environment health check
 */
export async function checkEnvironment() {
  await environmentService.runHealthCheck(false);
}

/**
 * Check and fix Java configuration
 */
export async function checkJava() {
  const javaCheck = await environmentService.checkJava();

  if (!javaCheck.installed) {
    await environmentService.promptJavaPathUpdate();
  } else if (!javaCheck.valid) {
    const upgrade = await vscode.window.showWarningMessage(
      `Java ${javaCheck.version} is installed. Salesforce requires Java 11+.`,
      'Find Java Installations',
      'Download Java',
      'Dismiss'
    );

    if (upgrade === 'Find Java Installations') {
      await environmentService.promptJavaPathUpdate();
    } else if (upgrade === 'Download Java') {
      vscode.env.openExternal(
        vscode.Uri.parse(
          'https://developer.salesforce.com/docs/platform/sfvscode-extensions/guide/java-setup.html'
        )
      );
    }
  } else {
    ui.showInfo(`Java ${javaCheck.version} is properly configured ✅\nPath: ${javaCheck.path || 'N/A'}`);
  }
}

/**
 * Check and update Salesforce CLI
 */
export async function checkSalesforceCLI() {
  const cliCheck = await environmentService.checkSalesforceCLI();
  await environmentService.promptSalesforceCLIUpdate(cliCheck);
}

/**
 * Check Node.js installation
 */
export async function checkNodeJS() {
  const nodeCheck = await environmentService.checkNodeJS();

  if (!nodeCheck.installed) {
    await environmentService.promptNodeJSUpdate(nodeCheck);
  } else if (!nodeCheck.valid) {
    await environmentService.promptNodeJSUpdate(nodeCheck);
  } else {
    ui.showInfo(`Node.js v${nodeCheck.version} is properly configured ✅`);
  }
}

/**
 * Show Salesforce project information
 */
export async function showProjectInfo() {
  const isSFDXProject = await environmentService.isSalesforceDXProject();

  if (!isSFDXProject) {
    vscode.window.showInformationMessage(
      'This is not a Salesforce DX project. No sfdx-project.json found.'
    );
    return;
  }

  const projectInfo = await environmentService.getSalesforceProjectInfo();

  if (!projectInfo) {
    vscode.window.showErrorMessage('Unable to read sfdx-project.json file.');
    return;
  }

  const packageDirs = projectInfo.packageDirectories
    .map((dir) => `  • ${dir.path} ${dir.default ? '(default)' : ''}`)
    .join('\n');

  const message = `📦 Salesforce DX Project\n\nName: ${projectInfo.name}\nAPI Version: ${projectInfo.sourceApiVersion}\nNamespace: ${projectInfo.namespace || '(none)'}\n\nPackage Directories:\n${packageDirs}`;

  const action = await vscode.window.showInformationMessage(
    message,
    'Open sfdx-project.json',
    'OK'
  );

  if (action === 'Open sfdx-project.json') {
    const doc = await vscode.workspace.openTextDocument(projectInfo.path);
    await vscode.window.showTextDocument(doc);
  }
}
