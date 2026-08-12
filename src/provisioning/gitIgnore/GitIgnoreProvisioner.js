import * as vscode from "vscode";
import { Provisioner } from "../Provisioner.js";
import { STANDARD_GITIGNORE_CONTENT } from "./standardGitIgnore.js";

/**
 * Provisions a .gitignore file if one is missing
 */
export class GitIgnoreProvisioner extends Provisioner {
  getName() {
    return "GitIgnore Provisioner";
  }

  getConfigKey() {
    return "provisioning.gitIgnore"; // Maps to sfPreflight.provisioning.gitIgnore
  }

  getManagedPaths() {
    return [".gitignore"];
  }

  async execute(force = false, options = {}) {
    if (!this.shouldWritePath(".gitignore", options)) {
      return [];
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const rootUri = workspaceFolders[0].uri;
    const gitIgnoreUri = vscode.Uri.joinPath(rootUri, ".gitignore");

    if (!force && (await this.fileExists(gitIgnoreUri))) {
      return [];
    }

    const writeData = Buffer.from(STANDARD_GITIGNORE_CONTENT.trim(), "utf8");
    await this.writeFileWithBackup(gitIgnoreUri, writeData, force);
    return [".gitignore"];
  }
}
