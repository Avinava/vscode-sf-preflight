import * as vscode from "vscode";
import { SF_EXTENSIONS } from "../lib/constants.js";

/**
 * Detect installed Salesforce VS Code extensions.
 * @returns {{
 *   pack: boolean,
 *   core: boolean,
 *   apex: boolean,
 *   apexTsLs: boolean,
 *   anySfTooling: boolean,
 *   needsJavaApex: boolean,
 *   installedIds: string[]
 * }}
 */
export function checkSalesforceExtensions() {
  const pack = Boolean(
    vscode.extensions.getExtension(SF_EXTENSIONS.PACK)
  );
  const core = Boolean(
    vscode.extensions.getExtension(SF_EXTENSIONS.CORE)
  );
  const apex = Boolean(
    vscode.extensions.getExtension(SF_EXTENSIONS.APEX)
  );
  const apexTsLs = Boolean(
    vscode.extensions.getExtension(SF_EXTENSIONS.APEX_TS_LS)
  );

  const installedIds = [
    pack && SF_EXTENSIONS.PACK,
    core && SF_EXTENSIONS.CORE,
    apex && SF_EXTENSIONS.APEX,
    apexTsLs && SF_EXTENSIONS.APEX_TS_LS,
  ].filter(Boolean);

  // Java Apex LS is the classic Apex extension; TS LS does not need JDK the same way
  const needsJavaApex = apex || pack;

  return {
    pack,
    core,
    apex,
    apexTsLs,
    anySfTooling: pack || core || apex || apexTsLs,
    needsJavaApex,
    installedIds,
  };
}

/**
 * Open the Extension Pack page in the Marketplace UI.
 */
export async function openExtensionPackInMarketplace() {
  // workbench.extensions.search opens Extensions view filtered to the id
  await vscode.commands.executeCommand(
    "workbench.extensions.search",
    SF_EXTENSIONS.PACK
  );
}

/**
 * Severity for missing Extension Pack from settings.
 * @returns {'blocker'|'warning'|'off'}
 */
export function getExtensionPackCheckMode() {
  const mode = vscode.workspace
    .getConfiguration("sfPreflight")
    .get("checks.extensionPack", "warning");
  if (mode === "blocker" || mode === "off" || mode === "warning") {
    return mode;
  }
  return "warning";
}
