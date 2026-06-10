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

  async execute(force = false) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const rootUri = workspaceFolders[0].uri;
    const createdFiles = [];

    // 1. .prettierrc
    const rcUri = vscode.Uri.joinPath(rootUri, ".prettierrc");
    let createRc = force;
    if (!createRc) {
      createRc = !(await this.fileExists(rcUri));
    }

    if (createRc) {
      // Create or Overwrite
      // Get template from config or fall back to standard
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

    // 2. .prettierignore
    const ignoreUri = vscode.Uri.joinPath(rootUri, ".prettierignore");
    let createIgnore = force;
    if (!createIgnore) {
      createIgnore = !(await this.fileExists(ignoreUri));
    }

    if (createIgnore) {
      // Create or Overwrite
      const template = this.getConfig(
        "provisioning.templates.prettierignore",
        STANDARD_PRETTIER_IGNORE
      );

      const writeData = Buffer.from(template.trim(), "utf8");
      await this.writeFileWithBackup(ignoreUri, writeData, force);
      createdFiles.push(".prettierignore");
    }
    
    return createdFiles;
  }
}
