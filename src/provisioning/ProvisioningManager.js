

import * as vscode from "vscode";

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
   * Register a new provisioner
   * @param {Provisioner} provisioner
   */
  registerProvisioner(provisioner) {
    this.provisioners.push(provisioner);
  }

  /**
   * Run all enabled provisioners
   */
  /**
   * Run all enabled provisioners with force flag
   */
  async runForce() {
    const files = [
      ".prettierrc",
      ".prettierignore",
      ".editorconfig",
      ".gitignore",
      ".vscode/settings.json",
      "cspell.json",
      ".cspell/salesforce-terms.txt",
    ];
    const answer = await vscode.window.showWarningMessage(
      `Force re-provisioning will overwrite enabled setup files and create timestamped backups first: ${files.join(", ")}`,
      "Yes, Overwrite",
      "Cancel"
    );

    if (answer === "Yes, Overwrite") {
      await this.runProvisioning({ force: true, ignoreMaster: true });
    }
  }

  /**
   * Explicitly apply recommended setup without overwriting existing files.
   */
  async applyRecommendedSetup() {
    await this.runProvisioning({ force: false, ignoreMaster: true });
  }

  /**
   * Run all enabled provisioners on startup (safe mode)
   */
  async runOnStartup() {
    console.log("SF Preflight: Running startup provisioning...");
    await this.runProvisioning({ force: false });
  }

  /**
   * Internal execution logic
   * @param {Object} options
   * @param {boolean} options.force
   * @param {boolean} [options.ignoreMaster]
   */
  async runProvisioning({ force, ignoreMaster = false }) {
    const allCreatedFiles = [];

    for (const provisioner of this.provisioners) {
      try {
        if (provisioner.isEnabled({ ignoreMaster })) {
          console.log(`SF Preflight: Running ${provisioner.getName()} (Force: ${force})...`);
          const created = await provisioner.execute(force);
          if (created && Array.isArray(created)) {
            allCreatedFiles.push(...created);
          }
        }
      } catch (error) {
        console.error(
          `SF Preflight: Error running ${provisioner.getName()}:`,
          error
        );
      }
    }

    if (allCreatedFiles.length > 0) {
      const action = force ? "Re-provisioned" : "Provisioned";
      const message = `SF Preflight: ${action} ${allCreatedFiles.length} files (${allCreatedFiles.join(
        ", "
      )})`;
      vscode.window.showInformationMessage(message);
    } else if (force) {
      vscode.window.showInformationMessage("SF Preflight: All files are already up to date.");
    }
  }
}
