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

  async execute() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;
    const rootUri = workspaceFolders[0].uri;

    // 1. .prettierrc
    const rcUri = vscode.Uri.joinPath(rootUri, ".prettierrc");
    try {
      await vscode.workspace.fs.stat(rcUri);
    } catch {
      // Create if missing
      const writeData = Buffer.from(
        JSON.stringify(STANDARD_PRETTIER_RC, null, 2),
        "utf8"
      );
      await vscode.workspace.fs.writeFile(rcUri, writeData);
      vscode.window.showInformationMessage(
        "SF Preflight: Created .prettierrc."
      );
    }

    // 2. .prettierignore
    const ignoreUri = vscode.Uri.joinPath(rootUri, ".prettierignore");
    try {
      await vscode.workspace.fs.stat(ignoreUri);
    } catch {
      // Create if missing
      const writeData = Buffer.from(
        STANDARD_PRETTIER_IGNORE.trim(),
        "utf8"
      );
      await vscode.workspace.fs.writeFile(ignoreUri, writeData);
      vscode.window.showInformationMessage(
        "SF Preflight: Created .prettierignore."
      );
    }
  }
}
