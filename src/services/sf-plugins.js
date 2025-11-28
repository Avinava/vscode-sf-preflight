import * as vscode from "vscode";
import { REQUIRED_SF_PLUGINS, STATE_KEYS } from "../lib/constants.js";
import * as shell from "../lib/shell.js";
import * as ui from "../lib/ui.js";

/**
 * Salesforce CLI plugin management service
 */

/**
 * Check SF CLI plugins status
 * @returns {Promise<{installed: string[], missing: string[], allInstalled: boolean}>}
 */
export async function checkPlugins() {
  try {
    const output = await shell.execCommand("sf plugins");
    const installed = [];
    const missing = [];

    for (const plugin of REQUIRED_SF_PLUGINS) {
      if (output.includes(plugin)) {
        installed.push(plugin);
      } else {
        missing.push(plugin);
      }
    }

    return {
      installed,
      missing,
      allInstalled: missing.length === 0,
    };
  } catch (error) {
    return {
      installed: [],
      missing: REQUIRED_SF_PLUGINS,
      allInstalled: false,
      error: error.message,
    };
  }
}

/**
 * Install required SF CLI plugins
 * @param {vscode.ExtensionContext} context
 */
export async function install(context) {
  try {
    await verifySfCliInstalled();

    const pluginStatus = await checkPlugins();

    if (pluginStatus.missing.length > 0) {
      const userConfirmed = await ui.confirm(
        `The following SF plugins will be installed: ${pluginStatus.missing.join(", ")}. Do you want to proceed?`
      );

      if (userConfirmed) {
        await installPlugins(pluginStatus.missing);
      }
    } else {
      if (!context.globalState.get(STATE_KEYS.SF_PLUGINS_CHECKED)) {
        ui.showInfo(
          "All required SF plugins are already installed. SF setup is complete."
        );
        context.globalState.update(STATE_KEYS.SF_PLUGINS_CHECKED, true);
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage(String(error));
  }
}

/**
 * Verify that SF CLI is installed
 * @throws {Error} If SF CLI is not available
 */
async function verifySfCliInstalled() {
  try {
    await shell.execCommand("sf --version");
  } catch {
    throw new Error(
      "Salesforce CLI (sf) is not available. Please ensure @salesforce/cli is installed first."
    );
  }
}

/**
 * Install SF CLI plugins
 * @param {string[]} pluginsToInstall
 */
async function installPlugins(pluginsToInstall) {
  try {
    for (const plugin of pluginsToInstall) {
      await shell.execCommand(`sf plugins install ${plugin}`);
    }
    ui.showInfo(
      `Successfully installed SF plugins: ${pluginsToInstall.join(", ")}`
    );
  } catch (error) {
    throw new Error(`Failed to install SF plugins: ${error.message}`);
  }
}

/**
 * Prompt to install missing SF plugins
 * @param {Object} pluginStatus - Plugin check result
 * @returns {Promise<boolean>}
 */
export async function promptPluginInstall(pluginStatus) {
  if (pluginStatus.allInstalled) {
    return true;
  }

  const install = await vscode.window.showWarningMessage(
    `Missing SF CLI plugins: ${pluginStatus.missing.join(", ")}`,
    "Install Now",
    "Later"
  );

  if (install === "Install Now") {
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Installing SF CLI plugins...",
          cancellable: false,
        },
        async (progress) => {
          for (const plugin of pluginStatus.missing) {
            progress.report({ message: `Installing ${plugin}...` });
            await shell.execCommand(`sf plugins install ${plugin}`);
          }
        }
      );
      ui.showInfo(
        `Successfully installed SF plugins: ${pluginStatus.missing.join(", ")}`
      );
      return true;
    } catch (error) {
      ui.showError(`Failed to install SF plugins: ${error.message}`);
      return false;
    }
  }

  return false;
}
