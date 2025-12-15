

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
    const answer = await vscode.window.showWarningMessage(
      "Are you sure you want to force re-provisioning? This will overwrite your configuration files (.prettierrc, .editorconfig, etc.) with the standard templates. Any custom changes in these files will be lost.",
      "Yes, Overwrite",
      "Cancel"
    );

    if (answer === "Yes, Overwrite") {
      await this.runProvisioning({ force: true });
    }
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
   */
  async runProvisioning({ force }) {
    const allCreatedFiles = [];

    for (const provisioner of this.provisioners) {
      try {
        if (provisioner.isEnabled()) {
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
