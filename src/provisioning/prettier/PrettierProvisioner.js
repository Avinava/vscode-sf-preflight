import * as vscode from "vscode";
import { Provisioner } from "../Provisioner.js";
import {
  STANDARD_PRETTIER_RC,
  STANDARD_PRETTIER_IGNORE,
} from "./standardPrettier.js";

export class PrettierProvisioner extends Provisioner {
  getName() {
    return "Prettier Provisioner";
  }

  getConfigKey() {
    return "provisioning.prettier";
  }

  getManagedPaths() {
    return [".prettierrc", ".prettierignore"];
  }

  async execute(force = false, options = {}) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const rootUri = workspaceFolders[0].uri;
    const createdFiles = [];

    const rcUri = vscode.Uri.joinPath(rootUri, ".prettierrc");
    if (this.shouldWritePath(".prettierrc", options)) {
      let createRc = force || !(await this.fileExists(rcUri));
      if (createRc) {
        const template = this.getConfig(
          "provisioning.templates.prettierrc",
          STANDARD_PRETTIER_RC
        );
        const writeData = Buffer.from(
          JSON.stringify(template, null, 2),
          "utf8"
        );
        await this.writeFileWithBackup(rcUri, writeData, force);
        createdFiles.push(".prettierrc");
      }
    }

    const ignoreUri = vscode.Uri.joinPath(rootUri, ".prettierignore");
    if (this.shouldWritePath(".prettierignore", options)) {
      let createIgnore = force || !(await this.fileExists(ignoreUri));
      if (createIgnore) {
        const template = this.getConfig(
          "provisioning.templates.prettierignore",
          STANDARD_PRETTIER_IGNORE
        );
        const writeData = Buffer.from(template.trim(), "utf8");
        await this.writeFileWithBackup(ignoreUri, writeData, force);
        createdFiles.push(".prettierignore");
      }
    }

    return createdFiles;
  }
}
