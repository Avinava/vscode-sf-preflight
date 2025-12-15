import * as vscode from "vscode";

/**
 * Base class for all provisioners
 */
export class Provisioner {
  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * Get the display name of the provisioner
   * @returns {string}
   */
  getName() {
    throw new Error("Method 'getName()' must be implemented.");
  }

  /**
   * Get the configuration key for enabling/disabling this provisioner
   * @returns {string}
   */
  getConfigKey() {
    throw new Error("Method 'getConfigKey()' must be implemented.");
  }

  /**
   * Check if the provisioner should run based on configuration
   * @returns {boolean}
   */
  isEnabled() {
    const config = vscode.workspace.getConfiguration("sfPreflight");
    // Check master switch first
    const masterEnabled = config.get("provisioning.runOnStartup");
    if (!masterEnabled) {
      return false;
    }
    // Check specific provisioner switch
    return config.get(this.getConfigKey());
  }

  /**
   * Execute the provisioning logic
   * @returns {Promise<void>}
   */
  async execute() {
    throw new Error("Method 'execute()' must be implemented.");
  }
}
