import * as vscode from "vscode";
import { Provisioner } from "../Provisioner.js";
import { SALESFORCE_TERMS } from "./salesforceDictionary.js";

/**
 * Provisions Salesforce spell checker settings and dictionary
 */
export class SpellCheckerProvisioner extends Provisioner {
  getName() {
    return "Spell Checker Provisioner";
  }

  getConfigKey() {
    return "provisioning.spellChecker"; // Maps to sfPreflight.provisioning.spellChecker
  }

  getManagedPaths() {
    return ["cspell.json", ".cspell/salesforce-terms.txt"];
  }

  async execute(force = false, options = {}) {
    const spellCheckerExt = vscode.extensions.getExtension(
      "streetsidesoftware.code-spell-checker"
    );
    if (!spellCheckerExt) {
      console.log(
        "SF Preflight: Spell Checker provisioner skipped — Code Spell Checker extension not installed"
      );
      return [];
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return [];
    }

    const rootUri = workspaceFolders[0].uri;
    const createdFiles = [];

    const configUri = vscode.Uri.joinPath(rootUri, "cspell.json");
    const dictionaryDirUri = vscode.Uri.joinPath(rootUri, ".cspell");
    const dictionaryFileUri = vscode.Uri.joinPath(
      dictionaryDirUri,
      "salesforce-terms.txt"
    );

    const defaultConfig = {
      version: "0.2",
      language: "en",
      dictionaryDefinitions: [
        {
          name: "salesforce-terms",
          path: "./.cspell/salesforce-terms.txt",
          addWords: true,
        },
      ],
      dictionaries: ["salesforce-terms"],
      ignorePaths: [
        ".sf/**",
        ".sfdx/**",
        "**/node_modules/**",
        "**/*.min.js",
        "**/*.map",
      ],
      ignoreRegExpList: [
        "/\\b[a-zA-Z0-9]{15}\\b|\\b[a-zA-Z0-9]{18}\\b/",
        "/@author\\s+.*$/gm",
      ],
    };

    if (this.shouldWritePath("cspell.json", options)) {
      if (force || !(await this.fileExists(configUri))) {
        const writeData = Buffer.from(
          JSON.stringify(defaultConfig, null, 2),
          "utf8"
        );
        await this.writeFileWithBackup(configUri, writeData, force);
        createdFiles.push("cspell.json");
      }
    }

    if (this.shouldWritePath(".cspell/salesforce-terms.txt", options)) {
      if (force || !(await this.fileExists(dictionaryFileUri))) {
        await vscode.workspace.fs.createDirectory(dictionaryDirUri);
        const dictData = Buffer.from(SALESFORCE_TERMS, "utf8");
        await this.writeFileWithBackup(dictionaryFileUri, dictData, force);
        createdFiles.push(".cspell/salesforce-terms.txt");
      }
    }

    return createdFiles;
  }
}
