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

  getManagedPaths() {
    return [".editorconfig"];
  }

  async execute(force = false, options = {}) {
    if (!this.shouldWritePath(".editorconfig", options)) {
      return [];
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return [];
    const rootUri = workspaceFolders[0].uri;

    const uri = vscode.Uri.joinPath(rootUri, ".editorconfig");
    if (!force && (await this.fileExists(uri))) {
      return [];
    }

    const template = this.getConfig(
      "provisioning.templates.editorConfig",
      STANDARD_EDITOR_CONFIG
    );
    const writeData = Buffer.from(template.trim(), "utf8");
    await this.writeFileWithBackup(uri, writeData, force);
    return [".editorconfig"];
  }
}
