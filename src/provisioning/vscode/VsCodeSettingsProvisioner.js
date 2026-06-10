import * as vscode from "vscode";
import { Provisioner } from "../Provisioner.js";
import { STANDARD_VSCODE_SETTINGS } from "./standardVsCodeSettings.js";

export class VsCodeSettingsProvisioner extends Provisioner {
  getName() {
    return "VS Code Settings Provisioner";
  }

  getConfigKey() {
    return "provisioning.vscodeSettings";
  }

  async execute(force = false) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return [];
    const rootUri = workspaceFolders[0].uri;

    const vscodeDir = vscode.Uri.joinPath(rootUri, ".vscode");

    try {
      // Ensure .vscode directory exists
      try {
         await vscode.workspace.fs.createDirectory(vscodeDir);
      } catch (e) {
         // ignore
      }

      const settingsUri = vscode.Uri.joinPath(
        rootUri,
        ".vscode",
        "settings.json"
      );

      const template = this.getConfig(
        "provisioning.templates.vscodeSettings",
        STANDARD_VSCODE_SETTINGS
      );

      if (force || !(await this.fileExists(settingsUri))) {
        const writeData = Buffer.from(JSON.stringify(template, null, 2), "utf8");
        await this.writeFileWithBackup(settingsUri, writeData, force);
        return [".vscode/settings.json"];
      }

      const currentContent = Buffer.from(
        await vscode.workspace.fs.readFile(settingsUri)
      ).toString("utf8");
      let currentSettings;
      try {
        currentSettings = JSON.parse(currentContent);
      } catch (error) {
        console.error("Error parsing VS Code settings:", error);
        return [];
      }

      const mergedSettings = mergeDefaults(template, currentSettings);
      if (
        JSON.stringify(mergedSettings) !== JSON.stringify(currentSettings)
      ) {
        const writeData = Buffer.from(
          JSON.stringify(mergedSettings, null, 2),
          "utf8"
        );
        await vscode.workspace.fs.writeFile(settingsUri, writeData);
        return [".vscode/settings.json"];
      }
    } catch (error) {
      console.error("Error creating VS Code settings:", error);
    }
    return [];
  }
}

function mergeDefaults(defaults, current) {
  const merged = { ...defaults, ...current };
  for (const [key, value] of Object.entries(defaults)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      current[key] &&
      typeof current[key] === "object" &&
      !Array.isArray(current[key])
    ) {
      merged[key] = mergeDefaults(value, current[key]);
    }
  }
  return merged;
}
