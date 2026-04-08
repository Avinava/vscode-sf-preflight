/**
 * Extension constants and configuration values
 */

export const EXTENSION_NAME = "SF Preflight";
export const EXTENSION_ID = "sf-preflight";

/**
 * Recommended npm packages for Salesforce development.
 * These are checked individually for reliability (npm list -g can be flaky).
 * Note: @salesforce/cli is detected via `sf --version` instead of npm list,
 * since many users install it via the standalone installer.
 */
export const REQUIRED_PACKAGES = [
  "prettier",
  "@prettier/plugin-xml",
  "prettier-plugin-apex",
];

/**
 * Required SF CLI plugins.
 * Note: @salesforce/sfdx-scanner is deprecated and bundled inside code-analyzer.
 */
export const REQUIRED_SF_PLUGINS = ["code-analyzer"];

/**
 * Global state keys used by the extension
 */
export const STATE_KEYS = {
  ENV_CHECK_COMPLETED: `${EXTENSION_ID}.env-check-completed`,
  ENV_CHECK_PASSED: `${EXTENSION_ID}.env-check-passed`,
  ENV_CHECK_TIMESTAMP: `${EXTENSION_ID}.env-check-timestamp`,
  PACKAGES_CHECKED: `${EXTENSION_ID}.packages-checked`,
  SF_PLUGINS_CHECKED: `${EXTENSION_ID}.sf-plugins-checked`,
};

/**
 * Time intervals (in milliseconds)
 */
export const TIME_INTERVALS = {
  RECHECK_AFTER_SUCCESS: 24 * 60 * 60 * 1000, // 24 hours
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
