import * as vscode from "vscode";
import {
  EXTENSION_NAME,
  REQUIRED_PACKAGES,
  STATE_KEYS,
} from "../lib/constants.js";
import * as shell from "../lib/shell.js";
import * as ui from "../lib/ui.js";
import * as pluginService from "./sf-plugins.js";

/**
 * Package management service
 * Handles checking and installing required npm packages
 */

/**
 * Check if a single npm package is installed globally.
 * Uses `npm list -g <pkg> --depth=0` which is reliable regardless
 * of how the package was installed.
 * @param {string} pkg - Package name
 * @returns {Promise<boolean>}
 */
async function isPackageInstalled(pkg) {
  try {
    const stdout = await shell.execCommand(
      `npm list -g ${pkg} --depth=0 2>/dev/null`
    );
    // npm list prints the package name in the tree output when found
    return stdout.includes(pkg);
  } catch {
    return false;
  }
}

/**
 * Check required packages status.
 * Checks each package individually for reliability — `npm list -g` with
 * multiple packages exits non-zero if ANY is missing, making the output
 * unreliable for determining which ones are present.
 * @returns {Promise<{installed: string[], missing: string[], allInstalled: boolean}>}
 */
export async function checkPackages() {
  const installed = [];
  const missing = [];

  for (const pkg of REQUIRED_PACKAGES) {
    const found = await isPackageInstalled(pkg);
    if (found) {
      installed.push(pkg);
    } else {
      missing.push(pkg);
    }
  }

  // Special handling for prettier-plugin-apex (check for community fork)
  const prettierApexIndex = missing.indexOf("prettier-plugin-apex");
  if (prettierApexIndex !== -1) {
    const hasFork = await isPackageInstalled(
      "@ilyamatsuev/prettier-plugin-apex"
    );
    if (hasFork) {
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
