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
    const settingsUri = vscode.Uri.joinPath(vscodeDir, "settings.json");

    try {
      // Ensure .vscode directory exists
      try {
         await vscode.workspace.fs.createDirectory(vscodeDir);
      } catch (e) {
         // ignore
      }

      // Check settings.json
      try {
        await vscode.workspace.fs.stat(settingsUri);
        // Exists: In V1 we do not merge to avoid overwriting user prefs
        // Future: Merge functionality
      } catch {
        // Create if missing
        const template = this.getConfig(
          "provisioning.templates.vscodeSettings",
          STANDARD_VSCODE_SETTINGS
        );

        const writeData = Buffer.from(
          JSON.stringify(template, null, 2),
          "utf8"
        );
        await vscode.workspace.fs.writeFile(settingsUri, writeData);
        vscode.window.showInformationMessage(
          "SF Preflight: Created .vscode/settings.json."
        );
      }
    } catch (err) {
      console.error("Error provisioning VS Code settings: ", err);
    }
  }
}
