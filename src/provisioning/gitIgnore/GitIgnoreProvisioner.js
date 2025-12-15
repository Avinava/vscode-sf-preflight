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

  async execute() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    const rootUri = workspaceFolders[0].uri;
    const gitIgnoreUri = vscode.Uri.joinPath(rootUri, ".gitignore");

    try {
      await vscode.workspace.fs.stat(gitIgnoreUri);
      // File exists, we do not overwrite in V1
      // Future enhancement: Parse and append missing entries
      console.log("SF Preflight: .gitignore already exists. Skipping.");
    } catch {
      // File does not exist, create it
      const writeData = Buffer.from(STANDARD_GITIGNORE_CONTENT.trim(), "utf8");
      await vscode.workspace.fs.writeFile(gitIgnoreUri, writeData);
      vscode.window.showInformationMessage(
        "SF Preflight: Created standard .gitignore."
      );
    }
  }
}
