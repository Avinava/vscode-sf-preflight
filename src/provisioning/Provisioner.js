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
   * Get configuration value with optional default
   * @param {string} key - Relative config key (e.g. "templates.prettierrc")
   * @param {*} defaultValue
   * @returns {*}
   */
  getConfig(key, defaultValue) {
    const config = vscode.workspace.getConfiguration("sfPreflight");
    const val = config.get(key);
    // VS Code returns the default value if not set, but we might want to check for null/undefined explicitly if we needed strict checking.
    // However, config.get() usually handles this well.
    return val !== undefined ? val : defaultValue;
  }

  /**
   * Execute the provisioning logic
   * @param {boolean} force - If true, overwrite existing files
   * @returns {Promise<string[]>} - List of created/updated files
   */
  async execute(_force = false) {
    throw new Error("Method 'execute()' must be implemented.");
  }
}
