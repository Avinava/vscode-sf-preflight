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

  async execute() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    const rootUri = workspaceFolders[0].uri;

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
        "/\\b[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18}\\b/", // Ignore Salesforce IDs
      ],
    };

    // 2. Check and Create cspell.json
    try {
      await vscode.workspace.fs.stat(configUri);
      // File exists, we respect user config for now and do not overwrite
      // In a strict mode, we might merge or overwrite, but for now we skip.
    } catch {
      // File does not exist, create it
      const writeData = Buffer.from(
        JSON.stringify(defaultConfig, null, 2),
        "utf8"
      );
      await vscode.workspace.fs.writeFile(configUri, writeData);
      vscode.window.showInformationMessage(
        "SF Preflight: Created cspell.json for Salesforce."
      );
    }

    // 3. Check and Create Dictionary
    try {
      await vscode.workspace.fs.stat(dictionaryFileUri);
    } catch {
      // Ensure directory exists first
      try {
        await vscode.workspace.fs.createDirectory(dictionaryDirUri);
      } catch (err) {
        // Ignore if already exists
      }

      // Write the dictionary file
      const dictData = Buffer.from(SALESFORCE_TERMS, "utf8");
      await vscode.workspace.fs.writeFile(dictionaryFileUri, dictData);
      vscode.window.showInformationMessage(
        "SF Preflight: Created Salesforce specific dictionary."
      );
    }
  }
}
