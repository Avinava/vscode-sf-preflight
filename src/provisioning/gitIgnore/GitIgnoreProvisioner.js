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

  async execute(force = false) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      // If no workspace folders are open, or if the array is empty, we can't determine a root.
      // This scenario should ideally be handled by the calling context or be impossible
      // given how VS Code extensions typically operate within a workspace.
      console.log("SF Preflight: No workspace folders found. Skipping .gitignore provisioning.");
      return [];
    }

    const rootUri = workspaceFolders[0].uri;
    const gitIgnoreUri = vscode.Uri.joinPath(rootUri, ".gitignore");

    let create = force;
    if (!create) {
      try {
        await vscode.workspace.fs.stat(gitIgnoreUri);
        console.log("SF Preflight: .gitignore already exists. Skipping.");
        return [];
      } catch {
        create = true;
      }
    }

    if (create) {
      const writeData = Buffer.from(STANDARD_GITIGNORE_CONTENT.trim(), "utf8");
      await vscode.workspace.fs.writeFile(gitIgnoreUri, writeData);
      return [".gitignore"];
    }
    return [];
  }
}
