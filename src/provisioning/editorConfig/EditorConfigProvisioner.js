import * as vscode from "vscode";
import { Provisioner } from "../Provisioner.js";
import { STANDARD_EDITOR_CONFIG } from "./standardEditorConfig.js";

export class EditorConfigProvisioner extends Provisioner {
  getName() {
    return "EditorConfig Provisioner";
  }

  getConfigKey() {
    return "provisioning.editorConfig";
  }

  async execute(force = false) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return [];
    const rootUri = workspaceFolders[0].uri;

    const uri = vscode.Uri.joinPath(rootUri, ".editorconfig");

    let create = force;
    if (!create) {
      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        create = true;
      }
    }

    if (create) {
      // Create or Overwrite
      const template = this.getConfig(
        "provisioning.templates.editorConfig",
        STANDARD_EDITOR_CONFIG
      );

      const writeData = Buffer.from(template.trim(), "utf8");
      await vscode.workspace.fs.writeFile(uri, writeData);
      return [".editorconfig"];
    }
    return [];
  }
}
