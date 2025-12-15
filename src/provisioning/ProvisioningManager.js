

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
  async runOnStartup() {
    console.log("SF Preflight: Running provisioning checks...");
    
    for (const provisioner of this.provisioners) {
      try {
        if (provisioner.isEnabled()) {
          console.log(`SF Preflight: Running ${provisioner.getName()}...`);
          await provisioner.execute();
        }
      } catch (error) {
        console.error(
          `SF Preflight: Error running ${provisioner.getName()}:`,
          error
        );
      }
    }
  }
}
