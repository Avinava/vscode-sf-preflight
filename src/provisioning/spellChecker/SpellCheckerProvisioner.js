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

  async execute(force = false) {
    // Soft-check: skip if Code Spell Checker extension is not installed
    // (we no longer force it via extensionDependencies)
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

    // 1. Define paths
    const configUri = vscode.Uri.joinPath(rootUri, "cspell.json");
    const dictionaryDirUri = vscode.Uri.joinPath(rootUri, ".cspell");
    const dictionaryFileUri = vscode.Uri.joinPath(
      dictionaryDirUri,
      "salesforce-terms.txt"
    );

    // Default config to enforce
    const defaultConfig = {
      version: "0.2",
      language: "en",
      dictionaryDefinitions: [
        {
          name: "salesforce-terms",
          path: "./.cspell/salesforce-terms.txt",
          addWords: true, // Allows user to add words to this dictionary (optional, but good for local overrides if they edit it)
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
        "/\\b[a-zA-Z0-9]{15}\\b|\\b[a-zA-Z0-9]{18}\\b/", // Ignore Salesforce IDs
        "/@author\\s+.*$/gm", // Ignore @author tags in ApexDocs
      ],
    };

    // 2. Check and Create cspell.json
    let createConfig = force;
    if (!createConfig) {
      createConfig = !(await this.fileExists(configUri));
    }



    if (createConfig) {
      // Create cspell.json (or overwrite if force is true)
      const writeData = Buffer.from(
        JSON.stringify(defaultConfig, null, 2),
        "utf8"
      );
      await this.writeFileWithBackup(configUri, writeData, force);
      createdFiles.push("cspell.json");
    }

    // 3. Check and Create Dictionary
    let createDict = force;
    if (!createDict) {
      createDict = !(await this.fileExists(dictionaryFileUri));
    }

    if (createDict) {
      // Ensure directory exists first
      await vscode.workspace.fs.createDirectory(dictionaryDirUri);

      // Write the dictionary file
      const dictData = Buffer.from(SALESFORCE_TERMS, "utf8");
      await this.writeFileWithBackup(dictionaryFileUri, dictData, force);
      createdFiles.push(".cspell/salesforce-terms.txt");
    }

    return createdFiles;
  }
}
