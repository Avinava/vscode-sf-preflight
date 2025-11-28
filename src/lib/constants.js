/**
 * Extension constants and configuration values
 */

export const EXTENSION_NAME = "SF Preflight";
export const EXTENSION_ID = "sf-preflight";

/**
 * Required npm packages for Salesforce development
 */
export const REQUIRED_PACKAGES = [
  "@salesforce/cli",
  "prettier",
  "@prettier/plugin-xml",
  "prettier-plugin-apex",
];

/**
 * Required SF CLI plugins
 */
export const REQUIRED_SF_PLUGINS = [
  "@salesforce/sfdx-scanner",
  "code-analyzer",
];

/**
 * Global state keys used by the extension
 */
export const STATE_KEYS = {
  ENV_CHECK_COMPLETED: `${EXTENSION_ID}.env-check-completed`,
  PACKAGES_CHECKED: `${EXTENSION_ID}.packages-checked`,
  SF_PLUGINS_CHECKED: `${EXTENSION_ID}.sf-plugins-checked`,
};

/**
 * Minimum required versions
 */
export const MIN_VERSIONS = {
  NODE: 18,
  JAVA: 11,
};

/**
 * External URLs for documentation and downloads
 */
export const EXTERNAL_URLS = {
  JAVA_SETUP:
    "https://developer.salesforce.com/docs/platform/sfvscode-extensions/guide/java-setup.html",
  JAVA_DOWNLOAD: "https://www.oracle.com/java/technologies/downloads/",
  NODE_DOWNLOAD: "https://nodejs.org/",
  SALESFORCE_CLI: "https://developer.salesforce.com/tools/salesforcecli",
};
