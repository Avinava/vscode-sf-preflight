import * as vscode from "vscode";
import { EXTERNAL_URLS } from "../lib/constants.js";
import * as ui from "../lib/ui.js";
import { detectPackageManager } from "./package-manager.js";
import { getSalesforceCliCommands } from "./cli-install.js";
import { openExtensionPackInMarketplace } from "./extensions.js";

function terminalCommandItem(label, description, command) {
  return {
    label,
    description,
    command,
    action: "terminal",
  };
}

function copyCommandItem(label, description, command) {
  return {
    label,
    description,
    command,
    action: "copy",
  };
}

function docsItem(label, description, url) {
  return {
    label,
    description,
    url,
    action: "docs",
  };
}

function nodeInstallCommand() {
  if (process.platform === "darwin") {
    return "brew install node";
  }
  if (process.platform === "win32") {
    return "winget install OpenJS.NodeJS.LTS";
  }
  return null;
}

function javaInstallCommand() {
  if (process.platform === "darwin") {
    return "brew install --cask temurin";
  }
  if (process.platform === "win32") {
    return "winget install EclipseAdoptium.Temurin.21.JDK";
  }
  return null;
}

/**
 * Build actionable remediation options for a health check.
 * @param {Object} results
 * @param {{fixId?: string}} [filter]
 * @returns {Promise<Array<Object>>}
 */
export async function buildRemediationItems(results, filter = {}) {
  const items = [];
  const workspacePath = results.projectInfo?.workspacePath;
  const manager = await detectPackageManager(workspacePath);
  const only = filter.fixId;

  const include = (fixId) => !only || only === fixId;

  if (include("node") && (!results.node?.installed || !results.node?.valid)) {
    const command = nodeInstallCommand();
    if (command) {
      items.push(
        copyCommandItem("$(copy) Copy Node.js install command", command, command)
      );
      items.push(
        terminalCommandItem(
          "$(terminal) Open Node.js install command",
          "Inserted only; press Enter to run",
          command
        )
      );
    }
    items.push(
      docsItem(
        "$(link-external) Open Node.js downloads",
        "Install the current LTS release",
        EXTERNAL_URLS.NODE_DOWNLOAD
      )
    );
  }

  if (
    include("java") &&
    results.java &&
    (!results.java.installed || !results.java.valid || !results.java.recommended)
  ) {
    items.push({
      label: "$(settings-gear) Set Apex Java home in VS Code",
      description: "Writes salesforcedx-vscode-apex.java.home",
      action: "set-java-home",
    });
    const command = javaInstallCommand();
    if (command && (!results.java.installed || !results.java.valid)) {
      items.push(
        copyCommandItem("$(copy) Copy Java install command", command, command)
      );
    }
    items.push(
      docsItem(
        "$(link-external) Open Salesforce Java setup guide",
        "Apex Language Server Java requirements (JDK 21 recommended)",
        EXTERNAL_URLS.JAVA_SETUP
      )
    );
  }

  if (include("extension-pack") && results.extensions) {
    if (!results.extensions.pack) {
      items.push({
        label: "$(extensions) Open Extension Pack in Marketplace",
        description: "salesforce.salesforcedx-vscode",
        action: "open-extension-pack",
      });
      items.push(
        docsItem(
          "$(link-external) Extension Pack marketplace page",
          "Install Apex, LWC, and org tools",
          EXTERNAL_URLS.EXTENSION_PACK_MARKETPLACE
        )
      );
    }
  }

  if (include("sf-cli") && !results.salesforceCLI?.installed) {
    const cmds = getSalesforceCliCommands(
      results.salesforceCLI?.installMethod || "unknown"
    );
    if (cmds.install) {
      items.push(
        copyCommandItem(
          `$(copy) Copy CLI install (${cmds.preferredLabel})`,
          cmds.install,
          cmds.install
        )
      );
      items.push(
        terminalCommandItem(
          "$(terminal) Open CLI install command",
          "Inserted only; press Enter to run",
          cmds.install
        )
      );
    }
    // Always offer npm as alternate when brew was preferred
    if (cmds.preferredLabel === "Homebrew") {
      const npmInstall = "npm install -g @salesforce/cli";
      items.push(
        copyCommandItem("$(copy) Copy npm install (alternate)", npmInstall, npmInstall)
      );
    }
    items.push(
      docsItem(
        "$(link-external) Open Salesforce CLI install guide",
        "Official installers and methods",
        EXTERNAL_URLS.SALESFORCE_CLI
      )
    );
  }

  if (
    include("sf-cli") &&
    results.salesforceCLI?.installed &&
    results.salesforceCLI.installMethod
  ) {
    const cmds = getSalesforceCliCommands(results.salesforceCLI.installMethod);
    items.push(
      copyCommandItem(
        `$(copy) Copy CLI update (${cmds.preferredLabel})`,
        cmds.update,
        cmds.update
      )
    );
  }

  if (include("auth") && results.auth && results.auth.checked) {
    if (results.auth.orgCount === 0) {
      items.push(
        terminalCommandItem(
          "$(terminal) Open org login command",
          "sf org login web",
          "sf org login web"
        )
      );
    } else if (!results.auth.hasDefault) {
      items.push(
        terminalCommandItem(
          "$(terminal) List orgs (then set default)",
          "sf org list",
          "sf org list"
        )
      );
      items.push(
        copyCommandItem(
          "$(copy) Copy set-default-org command template",
          "sf config set target-org <alias-or-username>",
          "sf config set target-org <alias-or-username>"
        )
      );
    }
  }

  if (
    include("packages") &&
    results.packages &&
    !results.packages.allInstalled
  ) {
    const command =
      results.packages.installCommand ||
      manager.addDev(results.packages.missing);
    items.push(
      copyCommandItem("$(copy) Copy package install command", command, command)
    );
    items.push(
      terminalCommandItem(
        "$(terminal) Open package install command",
        "Inserted only; press Enter to run",
        command
      )
    );
  }

  if (
    include("sf-plugins") &&
    results.sfPlugins &&
    !results.sfPlugins.allInstalled
  ) {
    const command = `sf plugins install ${results.sfPlugins.missing.join(" ")}`;
    items.push(
      copyCommandItem("$(copy) Copy SF plugin install command", command, command)
    );
    items.push(
      terminalCommandItem(
        "$(terminal) Open SF plugin install command",
        "Inserted only; press Enter to run",
        command
      )
    );
  }

  return items;
}

/**
 * Execute a remediation item.
 * @param {Object} selected
 * @returns {Promise<boolean>}
 */
export async function executeRemediationItem(selected) {
  if (!selected) {
    return false;
  }

  if (selected.action === "copy") {
    await vscode.env.clipboard.writeText(selected.command);
    ui.showInfo("Command copied to clipboard.");
    return true;
  }

  if (selected.action === "terminal") {
    const terminal = vscode.window.createTerminal("SF Preflight Fix");
    terminal.show();
    terminal.sendText(selected.command, false);
    return true;
  }

  if (selected.action === "docs") {
    await vscode.env.openExternal(vscode.Uri.parse(selected.url));
    return true;
  }

  if (selected.action === "open-extension-pack") {
    await openExtensionPackInMarketplace();
    return true;
  }

  if (selected.action === "set-java-home") {
    // Dynamic import avoids circular dependency with environment.js
    const env = await import("./environment.js");
    return env.promptJavaPathUpdate();
  }

  if (selected.action === "command" && selected.vscodeCommand) {
    await vscode.commands.executeCommand(selected.vscodeCommand);
    return true;
  }

  return false;
}

/**
 * Show remediation choices and execute the selected non-destructive action.
 * @param {Object} results
 * @param {{fixId?: string}} [filter]
 * @returns {Promise<boolean>}
 */
export async function showRemediationMenu(results, filter = {}) {
  const items = await buildRemediationItems(results, filter);
  if (items.length === 0) {
    ui.showInfo("No fixes are needed.");
    return true;
  }

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "Choose a fix action. Commands are inserted but not run.",
    ignoreFocusOut: true,
  });

  return executeRemediationItem(selected);
}
