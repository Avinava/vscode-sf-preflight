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

  async execute() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;
    const rootUri = workspaceFolders[0].uri;

    const vscodeDir = vscode.Uri.joinPath(rootUri, ".vscode");

    try {
      // Ensure .vscode directory exists
      try {
         await vscode.workspace.fs.createDirectory(vscodeDir);
      } catch (e) {
         // ignore
      }

      const settingsUri = vscode.Uri.joinPath(rootUri, ".vscode", "settings.json");
      
      let create = force;
      if (!create) {
        try {
          await vscode.workspace.fs.stat(settingsUri);
        } catch {
          create = true;
        }
      }

      // Future: Merge functionality could go here even for force? 
      // For now, force means overwrite.

      if (create) {
        // Create or Overwrite
        const template = this.getConfig(
          "provisioning.templates.vscodeSettings",
          STANDARD_VSCODE_SETTINGS
        );

        const writeData = Buffer.from(
          JSON.stringify(template, null, 2),
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
