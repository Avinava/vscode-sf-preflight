import * as vscode from "vscode";
import { EXTERNAL_URLS } from "../lib/constants.js";
import * as ui from "../lib/ui.js";
import { detectPackageManager } from "./package-manager.js";

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

  return "Use your OS package manager, nvm, asdf, mise, or the Node.js LTS installer.";
}

function salesforceCliInstallCommand() {
  if (process.platform === "darwin") {
    return "npm install -g @salesforce/cli";
  }

  if (process.platform === "win32") {
    return "npm install -g @salesforce/cli";
  }

  return "npm install -g @salesforce/cli";
}

function javaGuidanceCommand() {
  if (process.platform === "darwin") {
    return "brew install --cask temurin";
  }

  if (process.platform === "win32") {
    return "winget install EclipseAdoptium.Temurin.17.JDK";
  }

  return "Install OpenJDK 17 with your distribution package manager, then restart VS Code.";
}

/**
 * Build actionable remediation options for a health check.
 * @param {Object} results
 * @returns {Promise<Array<Object>>}
 */
export async function buildRemediationItems(results) {
  const items = [];
  const workspacePath = results.projectInfo?.workspacePath;
  const manager = await detectPackageManager(workspacePath);

  if (!results.node?.installed || !results.node?.valid) {
    const command = nodeInstallCommand();
    if (!command.startsWith("Use ")) {
      items.push(
        copyCommandItem(
          "$(copy) Copy Node.js install command",
          command,
          command
        )
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

  if (!results.java?.installed || !results.java?.valid) {
    const command = javaGuidanceCommand();
    items.push(copyCommandItem("$(copy) Copy Java setup command", command, command));
    items.push(
      docsItem(
        "$(link-external) Open Salesforce Java setup guide",
        "Apex Language Server Java requirements",
        EXTERNAL_URLS.JAVA_SETUP
      )
    );
  }

  if (!results.salesforceCLI?.installed) {
    const command = salesforceCliInstallCommand();
    items.push(
      copyCommandItem(
        "$(copy) Copy Salesforce CLI install command",
        command,
        command
      )
    );
    items.push(
      terminalCommandItem(
        "$(terminal) Open Salesforce CLI install command",
        "Inserted only; press Enter to run",
        command
      )
    );
    items.push(
      docsItem(
        "$(link-external) Open Salesforce CLI install guide",
        "Official Salesforce CLI setup",
        EXTERNAL_URLS.SALESFORCE_CLI
      )
    );
  }

  if (results.packages && !results.packages.allInstalled) {
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

  if (results.sfPlugins && !results.sfPlugins.allInstalled) {
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
 * Show remediation choices and execute the selected non-destructive action.
 * @param {Object} results
 * @returns {Promise<boolean>}
 */
export async function showRemediationMenu(results) {
  const items = await buildRemediationItems(results);
  if (items.length === 0) {
    ui.showInfo("No fixes are needed.");
    return true;
  }

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "Choose a fix action. Commands are inserted but not run.",
    ignoreFocusOut: true,
  });

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

  return false;
}
