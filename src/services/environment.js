import * as vscode from 'vscode';
import * as path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EXTENSION_NAME, MIN_VERSIONS, EXTERNAL_URLS, STATE_KEYS } from '../lib/constants.js';
import * as ui from '../lib/ui.js';

const execAsync = promisify(exec);

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
    const { stdout } = await execAsync('java -version 2>&1');
    const versionMatch = stdout.match(/version "(.+?)"/);
    if (versionMatch) {
      const version = versionMatch[1];
      const majorVersion = parseInt(version.split('.')[0]);
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
  try {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'where java' : 'which java';
    const { stdout } = await execAsync(command);
    return stdout.trim().split('\n')[0];
  } catch {
    return null;
  }
}

/**
 * Find Java installations on the system
 * @returns {Promise<string[]>}
 */
export async function findJavaInstallations() {
  const installations = [];
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      // macOS - check common locations
      const { stdout } = await execAsync('/usr/libexec/java_home -V 2>&1 || true');
      const matches = stdout.matchAll(/^\s+(.+?)\s*$/gm);
      for (const match of matches) {
        if (match[1].includes('Java') || match[1].includes('jdk')) {
          installations.push(match[1].trim());
        }
      }

      try {
        const { stdout: javaHome } = await execAsync('/usr/libexec/java_home');
        if (javaHome.trim()) {
          installations.push(javaHome.trim());
        }
      } catch {
        // Ignore if not found
      }
    } else if (platform === 'win32') {
      // Windows - check Program Files
      const programFiles = [
        process.env['ProgramFiles'],
        process.env['ProgramFiles(x86)'],
      ];

      for (const pf of programFiles) {
        if (!pf) continue;
        try {
          const javaDir = path.join(pf, 'Java');
          const dirs = await fs.readdir(javaDir);
          for (const dir of dirs) {
            if (dir.toLowerCase().includes('jdk') || dir.toLowerCase().includes('jre')) {
              installations.push(path.join(javaDir, dir));
            }
          }
        } catch {
          // Directory doesn't exist
        }
      }
    } else {
      // Linux - check common locations
      const commonPaths = ['/usr/lib/jvm', '/usr/java', '/opt/jdk', '/opt/java'];

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
    console.error('Error finding Java installations:', error);
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
      'Install Java',
      'Remind Me Later'
    );

    if (install === 'Install Java') {
      vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.JAVA_DOWNLOAD));
    }
    return false;
  }

  const options = installations.map((install) => ({
    label: path.basename(install),
    detail: install,
  }));

  const selected = await vscode.window.showQuickPick(options, {
    placeHolder: 'Select Java installation to add to your PATH',
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
  const binPath = path.join(javaPath, 'bin');

  let instructions = '';

  if (platform === 'darwin' || platform === 'linux') {
    const shell = process.env.SHELL || '/bin/bash';
    const configFile = shell.includes('zsh')
      ? '~/.zshrc'
      : shell.includes('fish')
        ? '~/.config/fish/config.fish'
        : shell.includes('nu')
          ? '~/.config/nushell/env.nu'
          : '~/.bashrc';

    if (shell.includes('nu')) {
      instructions = `Add this to your ${configFile}:\n\n$env.JAVA_HOME = "${javaPath}"\n$env.PATH = ($env.PATH | prepend "${binPath}")\n\nThen restart your terminal or run: source ${configFile}`;
    } else {
      instructions = `Add this to your ${configFile}:\n\nexport JAVA_HOME="${javaPath}"\nexport PATH="$JAVA_HOME/bin:$PATH"\n\nThen restart your terminal or run: source ${configFile}`;
    }
  } else {
    instructions = `Add to your System Environment Variables:\n\nJAVA_HOME=${javaPath}\n\nAnd add to PATH:\n%JAVA_HOME%\\bin\n\nThen restart VS Code.`;
  }

  const action = await vscode.window.showInformationMessage(
    'To use Java with Salesforce extensions, update your PATH:',
    'Copy Instructions',
    'Open Guide'
  );

  if (action === 'Copy Instructions') {
    await vscode.env.clipboard.writeText(instructions);
    ui.showInfo('Instructions copied to clipboard!');
  } else if (action === 'Open Guide') {
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
    const { stdout } = await execAsync('sf --version');
    const versionMatch = stdout.match(/@salesforce\/cli\/(\d+\.\d+\.\d+)/);

    if (versionMatch) {
      return {
        installed: true,
        version: versionMatch[1],
        output: stdout.trim(),
      };
    }

    return { installed: true, version: 'unknown', output: stdout.trim() };
  } catch (error) {
    return { installed: false, error: error.message };
  }
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
      'Install via npm',
      'Download Installer',
      'Remind Me Later'
    );

    if (install === 'Install via npm') {
      const terminal = vscode.window.createTerminal('SF CLI Installation');
      terminal.show();
      terminal.sendText('npm install -g @salesforce/cli');
    } else if (install === 'Download Installer') {
      vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.SALESFORCE_CLI));
    }
    return false;
  }

  const update = await vscode.window.showInformationMessage(
    `${EXTENSION_NAME}: Salesforce CLI v${cliCheck.version} is installed. Check for updates?`,
    'Update Now',
    'Check Version',
    'Later'
  );

  if (update === 'Update Now') {
    const terminal = vscode.window.createTerminal('SF CLI Update');
    terminal.show();
    terminal.sendText('npm update -g @salesforce/cli');
    return true;
  } else if (update === 'Check Version') {
    const terminal = vscode.window.createTerminal('SF CLI Version');
    terminal.show();
    terminal.sendText('sf version --verbose');
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
    const { stdout } = await execAsync('node --version');
    const version = stdout.trim().replace('v', '');
    const majorVersion = parseInt(version.split('.')[0]);

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
      'Download Node.js',
      'Remind Me Later'
    );

    if (install === 'Download Node.js') {
      vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.NODE_DOWNLOAD));
    }
    return false;
  }

  if (!nodeCheck.valid) {
    const upgrade = await vscode.window.showWarningMessage(
      `${EXTENSION_NAME}: Node.js v${nodeCheck.version} is installed. Salesforce recommends Node.js v18 or higher.`,
      'Download Latest',
      'Continue Anyway'
    );

    if (upgrade === 'Download Latest') {
      vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.NODE_DOWNLOAD));
      return false;
    }
  }

  return true;
}

// ============================================================================
// Prettier Checks
// ============================================================================

/**
 * Check Prettier and plugins installation
 * @returns {Promise<Object>}
 */
export async function checkPrettier() {
  try {
    const { stdout } = await execAsync(
      'npm list -g prettier prettier-plugin-apex @prettier/plugin-xml 2>&1'
    );
    return parsePrettierOutput(stdout);
  } catch (error) {
    const output = error.stdout || error.message || '';
    return parsePrettierOutput(output);
  }
}

/**
 * Parse Prettier npm list output
 * @param {string} output
 * @returns {Object}
 */
function parsePrettierOutput(output) {
  const hasPrettier = output.includes('prettier@');
  const hasApexPlugin =
    output.includes('prettier-plugin-apex') ||
    output.includes('@ilyamatsuev/prettier-plugin-apex');
  const hasXmlPlugin = output.includes('@prettier/plugin-xml');

  const versionMatch = output.match(/prettier@(\d+\.\d+\.\d+)/);
  const version = versionMatch ? versionMatch[1] : null;

  const missingPlugins = [];
  if (!hasApexPlugin) missingPlugins.push('prettier-plugin-apex');
  if (!hasXmlPlugin) missingPlugins.push('@prettier/plugin-xml');

  return {
    installed: hasPrettier,
    version,
    hasApexPlugin,
    hasXmlPlugin,
    allPlugins: hasPrettier && hasApexPlugin && hasXmlPlugin,
    missingPlugins,
  };
}

/**
 * Prompt to install Prettier and plugins
 * @param {Object} prettierCheck
 * @returns {Promise<boolean>}
 */
export async function promptPrettierInstall(prettierCheck) {
  if (prettierCheck.allPlugins) {
    return true;
  }

  const missing = [];
  if (!prettierCheck.installed) missing.push('prettier');
  missing.push(...prettierCheck.missingPlugins);

  const install = await vscode.window.showWarningMessage(
    `${EXTENSION_NAME}: Missing Prettier packages: ${missing.join(', ')}`,
    'Install Now',
    'Later'
  );

  if (install === 'Install Now') {
    const terminal = vscode.window.createTerminal('Prettier Installation');
    terminal.show();
    terminal.sendText(`npm install -g ${missing.join(' ')}`);
    return true;
  }

  return false;
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
    const sfdxProjectPath = path.join(folder.uri.fsPath, 'sfdx-project.json');
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
    const sfdxProjectPath = path.join(folder.uri.fsPath, 'sfdx-project.json');
    try {
      const content = await fs.readFile(sfdxProjectPath, 'utf8');
      const projectData = JSON.parse(content);
      return {
        path: sfdxProjectPath,
        name: projectData.name || 'Unnamed Project',
        namespace: projectData.namespace || '',
        sourceApiVersion: projectData.sourceApiVersion || 'unknown',
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
    prettier: null,
    isSFDXProject: false,
    projectInfo: null,
  };

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Checking development environment...',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Checking Node.js...' });
      results.node = await checkNodeJS();

      progress.report({ message: 'Checking Java...' });
      results.java = await checkJava();

      progress.report({ message: 'Checking Salesforce CLI...' });
      results.salesforceCLI = await checkSalesforceCLI();

      progress.report({ message: 'Checking Prettier...' });
      results.prettier = await checkPrettier();

      progress.report({ message: 'Checking project type...' });
      results.isSFDXProject = await isSalesforceDXProject();

      if (results.isSFDXProject) {
        results.projectInfo = await getSalesforceProjectInfo();
      }
    }
  );

  if (!silent) {
    await displayHealthCheckResults(results);
  }

  return results;
}

/**
 * Display health check results
 * @param {Object} results
 */
async function displayHealthCheckResults(results) {
  const issues = [];
  const warnings = [];
  const info = [];

  // Node.js check
  if (!results.node.installed) {
    issues.push('❌ Node.js is not installed');
  } else if (!results.node.valid) {
    warnings.push(`⚠️  Node.js v${results.node.version} (recommend v18+)`);
  } else {
    info.push(`✅ Node.js v${results.node.version}`);
  }

  // Java check
  if (!results.java.installed) {
    warnings.push('⚠️  Java is not in PATH (needed for Apex features)');
  } else if (!results.java.valid) {
    warnings.push(`⚠️  Java ${results.java.version} (recommend 11+)`);
  } else {
    info.push(`✅ Java ${results.java.version}`);
  }

  // Salesforce CLI check
  if (!results.salesforceCLI.installed) {
    issues.push('❌ Salesforce CLI is not installed');
  } else {
    info.push(`✅ Salesforce CLI v${results.salesforceCLI.version}`);
  }

  // Prettier check
  if (!results.prettier.installed) {
    warnings.push('⚠️  Prettier is not installed (needed for formatting)');
  } else if (!results.prettier.allPlugins) {
    warnings.push(`⚠️  Prettier missing plugins: ${results.prettier.missingPlugins.join(', ')}`);
  } else {
    info.push(`✅ Prettier v${results.prettier.version} with Apex & XML plugins`);
  }

  // Project info
  if (results.isSFDXProject && results.projectInfo) {
    info.push(`\n📦 SFDX Project: ${results.projectInfo.name}`);
    info.push(`   API Version: ${results.projectInfo.sourceApiVersion}`);
  } else {
    info.push('\nℹ️  Not in a Salesforce DX project');
  }

  const message = [...issues, ...warnings, ...info].join('\n');

  if (issues.length > 0) {
    const action = await vscode.window.showErrorMessage(
      `Environment Check:\n${message}`,
      'Fix Issues',
      'Dismiss'
    );

    if (action === 'Fix Issues') {
      await fixEnvironmentIssues(results);
    }
  } else if (warnings.length > 0) {
    vscode.window.showWarningMessage(`Environment Check:\n${message}`, 'OK');
  } else {
    ui.showInfo(`Environment Check:\n${message}`);
  }
}

/**
 * Guide user to fix environment issues
 * @param {Object} results
 */
async function fixEnvironmentIssues(results) {
  if (!results.node.installed || !results.node.valid) {
    await promptNodeJSUpdate(results.node);
  }

  if (!results.java.installed || !results.java.valid) {
    await promptJavaPathUpdate();
  }

  if (!results.salesforceCLI.installed) {
    await promptSalesforceCLIUpdate(results.salesforceCLI);
  }

  if (!results.prettier.installed || !results.prettier.allPlugins) {
    await promptPrettierInstall(results.prettier);
  }
}

/**
 * Run environment check on startup (non-intrusive)
 * @param {vscode.ExtensionContext} context
 */
export async function runStartupCheck(context) {
  const hasRunCheck = context.globalState.get(STATE_KEYS.ENV_CHECK_COMPLETED);

  if (hasRunCheck) {
    // Quick silent check for critical issues only
    const results = await runHealthCheck(true);

    if (!results.salesforceCLI.installed || !results.node.installed) {
      const action = await vscode.window.showWarningMessage(
        `${EXTENSION_NAME}: Missing critical dependencies. Run environment check?`,
        'Check Now',
        'Dismiss'
      );

      if (action === 'Check Now') {
        await runHealthCheck(false);
      }
    }
  } else {
    // First time - run full check
    await runHealthCheck(false);
    context.globalState.update(STATE_KEYS.ENV_CHECK_COMPLETED, true);
  }
}
