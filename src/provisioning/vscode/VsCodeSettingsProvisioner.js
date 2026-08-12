import * as vscode from "vscode";
import { Provisioner } from "../Provisioner.js";
import { STANDARD_VSCODE_SETTINGS } from "./standardVsCodeSettings.js";

/**
 * Creates .vscode/settings.json when missing.
 * Does NOT merge into existing settings (avoids silent workspace rewrites).
 */
export class VsCodeSettingsProvisioner extends Provisioner {
  getName() {
    return "VS Code Settings Provisioner";
  }

  getConfigKey() {
    return "provisioning.vscodeSettings";
  }

  getManagedPaths() {
    return [".vscode/settings.json"];
  }

  async execute(force = false, options = {}) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return [];
    const rootUri = workspaceFolders[0].uri;

    const settingsUri = vscode.Uri.joinPath(
      rootUri,
      ".vscode",
      "settings.json"
    );

    if (
      options.onlyFiles &&
      !options.onlyFiles.has(".vscode/settings.json")
    ) {
      return [];
    }

    const exists = await this.fileExists(settingsUri);
    if (exists && !force) {
      // Create-missing only — never silent-merge existing settings
      return [];
    }

    try {
      const vscodeDir = vscode.Uri.joinPath(rootUri, ".vscode");
      try {
        await vscode.workspace.fs.createDirectory(vscodeDir);
      } catch {
        // exists
      }

      const template = this.getConfig(
        "provisioning.templates.vscodeSettings",
        STANDARD_VSCODE_SETTINGS
      );

      const writeData = Buffer.from(JSON.stringify(template, null, 2), "utf8");
      await this.writeFileWithBackup(settingsUri, writeData, force);
      return [".vscode/settings.json"];
    } catch (error) {
      console.error("Error creating VS Code settings:", error);
      return [];
    }
  }
}
