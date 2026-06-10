import * as vscode from "vscode";
import { REQUIRED_SF_PLUGINS, STATE_KEYS } from "../lib/constants.js";
import * as shell from "../lib/shell.js";
import * as ui from "../lib/ui.js";

/**
 * Salesforce CLI plugin management service
 */

/**
 * Check SF CLI plugins status.
 * Uses line-by-line matching instead of substring includes to avoid
 * false positives (e.g. "code-analyzer" matching "code-analyzer-core").
 * @returns {Promise<{installed: string[], missing: string[], allInstalled: boolean}>}
 */
export async function checkPlugins() {
  try {
    const { stdout: output } = await shell.execCommandArgs("sf", ["plugins"], {
      timeout: 30000,
    });
    const lines = output.split("\n").map((line) => line.trim());
    const installed = [];
    const missing = [];

    for (const plugin of REQUIRED_SF_PLUGINS) {
      // Each line of `sf plugins` output looks like:
      //   @salesforce/plugin-deploy-retrieve 3.9.18 (core)
      //   code-analyzer 5.0.0
      // Match the plugin name at the start of a line (possibly with @ prefix)
      const found = lines.some((line) => {
        const pluginName = line.split(/\s+/)[0]; // first token is the package name
        return pluginName === plugin;
      });

      if (found) {
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
      await promptPluginInstall(pluginStatus);
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
    await shell.execCommandArgs("sf", ["--version"]);
  } catch {
    throw new Error(
      "Salesforce CLI (sf) is not available. Please ensure @salesforce/cli is installed first."
    );
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
    "Copy Command",
    "Open Terminal",
    "Later"
  );

  const command = `sf plugins install ${pluginStatus.missing.join(" ")}`;

  if (install === "Copy Command") {
    await vscode.env.clipboard.writeText(command);
    ui.showInfo("SF plugin install command copied to clipboard.");
    return true;
  }

  if (install === "Open Terminal") {
    const terminal = vscode.window.createTerminal("SF Preflight Plugins");
    terminal.show();
    terminal.sendText(command, false);
    return true;
  }

  return false;
}
