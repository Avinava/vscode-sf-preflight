import * as vscode from "vscode";
import { PROVISIONED_FILES } from "../lib/constants.js";
import * as logger from "../lib/logger.js";

/**
 * Manages the lifecycle and execution of all provisioners
 */
export class ProvisioningManager {
  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    this.context = context;
    this.provisioners = [];
  }

  /**
   * @param {import('./Provisioner.js').Provisioner} provisioner
   */
  registerProvisioner(provisioner) {
    this.provisioners.push(provisioner);
  }

  /**
   * Map provisioner config key suffix → instance
   */
  getProvisionerByKey(key) {
    return this.provisioners.find((p) => {
      const configKey = p.getConfigKey(); // e.g. provisioning.prettier
      return configKey === `provisioning.${key}` || configKey.endsWith(`.${key}`);
    });
  }

  /**
   * Scan workspace for provisionable files.
   * @returns {Promise<Array<{path: string, label: string, provisioner: string, exists: boolean, enabled: boolean}>>}
   */
  async scanTargets() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return [];
    }
    const rootUri = folders[0].uri;
    const config = vscode.workspace.getConfiguration("sfPreflight");

    const results = [];
    for (const file of PROVISIONED_FILES) {
      const uri = vscode.Uri.joinPath(rootUri, ...file.path.split("/"));
      let exists = false;
      try {
        await vscode.workspace.fs.stat(uri);
        exists = true;
      } catch {
        exists = false;
      }
      const enabled = config.get(`provisioning.${file.provisioner}`, true);
      results.push({
        path: file.path,
        label: file.label,
        provisioner: file.provisioner,
        exists,
        enabled,
      });
    }
    return results;
  }

  /**
   * Force re-provision with confirmation and optional multi-select.
   */
  async runForce() {
    const targets = await this.scanTargets();
    const enabled = targets.filter((t) => t.enabled);
    if (enabled.length === 0) {
      vscode.window.showInformationMessage(
        "SF Preflight: No provisioners are enabled in settings."
      );
      return;
    }

    const picked = await vscode.window.showQuickPick(
      enabled.map((t) => ({
        label: t.path,
        description: t.exists ? "exists (will backup & overwrite)" : "missing",
        detail: t.label,
        picked: true,
        target: t,
      })),
      {
        canPickMany: true,
        placeHolder: "Select files to force re-provision (timestamped backups)",
        ignoreFocusOut: true,
      }
    );

    if (!picked?.length) {
      return;
    }

    const paths = picked.map((p) => p.target.path);
    const answer = await vscode.window.showWarningMessage(
      `Overwrite ${paths.length} file(s) with templates? Backups will be created first.`,
      "Yes, Overwrite",
      "Cancel"
    );

    if (answer !== "Yes, Overwrite") {
      return;
    }

    await this.runProvisioning({
      force: true,
      ignoreMaster: true,
      onlyFiles: new Set(paths),
    });
  }

  /**
   * Explicitly apply recommended setup — create missing files only, with preview.
   */
  async applyRecommendedSetup() {
    const targets = await this.scanTargets();
    const missing = targets.filter((t) => t.enabled && !t.exists);

    if (missing.length === 0) {
      const present = targets.filter((t) => t.exists).map((t) => t.path);
      vscode.window.showInformationMessage(
        present.length
          ? "SF Preflight: Recommended setup files are already present."
          : "SF Preflight: No enabled setup targets (check provisioning settings)."
      );
      return;
    }

    const picked = await vscode.window.showQuickPick(
      missing.map((t) => ({
        label: t.path,
        description: t.label,
        picked: true,
        target: t,
      })),
      {
        canPickMany: true,
        placeHolder: "Select missing files to create (existing files are never modified)",
        ignoreFocusOut: true,
      }
    );

    if (!picked?.length) {
      return;
    }

    const paths = picked.map((p) => p.target.path);
    const confirm = await vscode.window.showInformationMessage(
      `Create ${paths.length} file(s): ${paths.join(", ")}?`,
      "Create",
      "Cancel"
    );

    if (confirm !== "Create") {
      return;
    }

    await this.runProvisioning({
      force: false,
      ignoreMaster: true,
      onlyFiles: new Set(paths),
    });
  }

  /**
   * Run all enabled provisioners on startup (safe create-missing mode)
   */
  async runOnStartup() {
    logger.info("Running startup provisioning...");
    await this.runProvisioning({ force: false });
  }

  /**
   * Internal execution logic
   * @param {Object} options
   * @param {boolean} options.force
   * @param {boolean} [options.ignoreMaster]
   * @param {Set<string>} [options.onlyFiles]
   */
  async runProvisioning({ force, ignoreMaster = false, onlyFiles = null }) {
    const allCreatedFiles = [];

    for (const provisioner of this.provisioners) {
      try {
        if (!provisioner.isEnabled({ ignoreMaster })) {
          continue;
        }
        logger.info(
          `Running ${provisioner.getName()} (force=${force}, filtered=${Boolean(onlyFiles)})...`
        );
        const created = await provisioner.execute(force, { onlyFiles });
        if (created && Array.isArray(created)) {
          allCreatedFiles.push(...created);
        }
      } catch (error) {
        logger.error(
          `Error running ${provisioner.getName()}: ${error.message}`
        );
      }
    }

    if (allCreatedFiles.length > 0) {
      const action = force ? "Re-provisioned" : "Created";
      const message = `SF Preflight: ${action} ${allCreatedFiles.length} file(s) (${allCreatedFiles.join(", ")})`;
      logger.info(message);
      const pick = await vscode.window.showInformationMessage(
        message,
        "Show Logs"
      );
      if (pick === "Show Logs") {
        logger.getOutputChannel().show(true);
      }
    } else if (force) {
      vscode.window.showInformationMessage(
        "SF Preflight: No files were written (targets may be disabled)."
      );
    } else if (ignoreMaster && onlyFiles) {
      vscode.window.showInformationMessage(
        "SF Preflight: No files were created."
      );
    }
  }
}
