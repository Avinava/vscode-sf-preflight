import * as vscode from "vscode";
import {
  EXTENSION_NAME,
  REQUIRED_PACKAGES,
  STATE_KEYS,
} from "../lib/constants.js";
import * as shell from "../lib/shell.js";
import * as ui from "../lib/ui.js";
import * as environmentService from "./environment.js";
import * as pluginService from "./sf-plugins.js";

/**
 * Package management service
 * Handles checking and installing required npm packages
 */

/**
 * Check required packages status
 * @returns {Promise<{installed: string[], missing: string[], allInstalled: boolean}>}
 */
export async function checkPackages() {
  try {
    const stdout = await shell.execCommand(
      `npm list -g ${REQUIRED_PACKAGES.join(" ")} 2>&1`
    );
    return parsePackageOutput(stdout);
  } catch (error) {
    const output = error.message || "";
    return parsePackageOutput(output);
  }
}

/**
 * Parse npm list output to determine package status
 * @param {string} stdout
 * @returns {{installed: string[], missing: string[], allInstalled: boolean}}
 */
function parsePackageOutput(stdout) {
  const installed = [];
  const missing = [];

  for (const pkg of REQUIRED_PACKAGES) {
    if (stdout.includes(pkg)) {
      installed.push(pkg);
    } else {
      missing.push(pkg);
    }
  }

  // Special handling for prettier-plugin-apex (check for alternative package)
  const prettierApexIndex = missing.indexOf("prettier-plugin-apex");
  if (prettierApexIndex !== -1) {
    if (stdout.includes("@ilyamatsuev/prettier-plugin-apex")) {
      missing.splice(prettierApexIndex, 1);
      installed.push("prettier-plugin-apex (alternative)");
    }
  }

  return {
    installed,
    missing,
    allInstalled: missing.length === 0,
  };
}

/**
 * Manage required packages - check and install if needed
 * @param {vscode.ExtensionContext} context
 */
export async function managePackages(context) {
  try {
    await checkNodeInstallation();
    const packageStatus = await checkPackages();

    if (packageStatus.missing.length > 0) {
      const userConfirmed = await ui.confirm(
        `The following node packages will be installed globally: ${packageStatus.missing.join(", ")}. Do you want to proceed?`
      );

      if (userConfirmed) {
        await installMissingPackages(packageStatus.missing);
      } else {
        return;
      }
    } else {
      if (!context.globalState.get(STATE_KEYS.PACKAGES_CHECKED)) {
        ui.showInfo("Required packages are already installed.");
        context.globalState.update(STATE_KEYS.PACKAGES_CHECKED, true);
      }
    }

    // Only install SF plugins after ensuring @salesforce/cli is installed
    await pluginService.install(context);
  } catch (error) {
    vscode.window.showErrorMessage(String(error));
  }
}

/**
 * Check if Node.js is installed
 * @throws {Error} If Node.js is not installed
 */
async function checkNodeInstallation() {
  const nodeCheck = await environmentService.checkNodeJS();
  if (!nodeCheck.installed) {
    throw new Error(
      `${EXTENSION_NAME}: Node.js is not installed. Please install Node.js to use this extension.`
    );
  }
}

/**
 * Install missing npm packages globally
 * @param {string[]} missingPackages
 */
async function installMissingPackages(missingPackages) {
  try {
    const installCommand = `npm install -g ${missingPackages.join(" ")}`;
    await shell.execCommand(installCommand);
    ui.showInfo(
      `Successfully installed npm packages: ${missingPackages.join(", ")}`
    );
  } catch (error) {
    throw new Error(
      `${EXTENSION_NAME}: Failed to install npm packages: ${error.message}`
    );
  }
}

/**
 * Prompt to install missing packages
 * @param {Object} packageStatus - Package check result
 * @returns {Promise<boolean>}
 */
export async function promptPackageInstall(packageStatus) {
  if (packageStatus.allInstalled) {
    return true;
  }

  const install = await vscode.window.showWarningMessage(
    `Missing npm packages: ${packageStatus.missing.join(", ")}`,
    "Install Now",
    "Later"
  );

  if (install === "Install Now") {
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Installing npm packages: ${packageStatus.missing.join(", ")}`,
          cancellable: false,
        },
        async () => {
          await shell.execCommand(
            `npm install -g ${packageStatus.missing.join(" ")}`
          );
        }
      );
      ui.showInfo(
        `Successfully installed: ${packageStatus.missing.join(", ")}`
      );
      return true;
    } catch (error) {
      ui.showError(`Failed to install packages: ${error.message}`);
      return false;
    }
  }

  return false;
}

/**
 * Force check and install packages (ignores cached state)
 * @param {vscode.ExtensionContext} context
 */
export async function forceCheckPackages(context) {
  ui.showInfo("Checking and installing required packages and plugins...");
  context.globalState.update(STATE_KEYS.PACKAGES_CHECKED, false);
  context.globalState.update(STATE_KEYS.SF_PLUGINS_CHECKED, false);
  await managePackages(context);
}
