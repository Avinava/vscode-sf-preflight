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
      ],
    };

    // 2. Check and Create cspell.json
    let createConfig = force;
    if (!createConfig) {
      try {
        await vscode.workspace.fs.stat(configUri);
        // File exists, we respect user config for now and do not overwrite unless forced.
        createConfig = false;
      } catch {
        // File does not exist, so we should create it.
        createConfig = true;
      }
    }

    // 2a. Migration: Check for legacy regex in existing config
    // We want to auto-fix this even if we are not forcing a full re-provision
    if (!createConfig && !force) {
      try {
        const fileContent = await vscode.workspace.fs.readFile(configUri);
        const fileString = new TextDecoder("utf-8").decode(fileContent);
        const badRegex = "/\\\\b[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18}\\\\b/";
        const goodRegex = "/\\\\b[a-zA-Z0-9]{15}\\\\b|\\\\b[a-zA-Z0-9]{18}\\\\b/";
        
        if (fileString.includes(badRegex)) {
          console.log("SF Preflight: Migrating legacy regex in cspell.json");
          const newContent = fileString.replace(badRegex, goodRegex);
          await vscode.workspace.fs.writeFile(configUri, Buffer.from(newContent, "utf8"));
          createdFiles.push("cspell.json (migrated)");
        }
      } catch (err) {
        console.error("SF Preflight: Error migrating cspell.json:", err);
      }
    }

    if (createConfig) {
      // Create cspell.json (or overwrite if force is true)
      const writeData = Buffer.from(
        JSON.stringify(defaultConfig, null, 2),
        "utf8"
      );
      await vscode.workspace.fs.writeFile(configUri, writeData);
      createdFiles.push("cspell.json");
    }

    // 3. Check and Create Dictionary
    let createDict = force;
    if (!createDict) {
      try {
        await vscode.workspace.fs.stat(dictionaryFileUri);
        // File exists, we respect user config for now and do not overwrite unless forced.
        createDict = false;
      } catch {
        // File does not exist, so we should create it.
        createDict = true;
      }
    }

    if (createDict) {
      // Ensure directory exists first
      await vscode.workspace.fs.createDirectory(dictionaryDirUri);

      // Write the dictionary file
      const dictData = Buffer.from(SALESFORCE_TERMS, "utf8");
      await vscode.workspace.fs.writeFile(dictionaryFileUri, dictData);
      vscode.window.showInformationMessage(
        "SF Preflight: Created Salesforce specific dictionary."
      );
    }
  }
}
