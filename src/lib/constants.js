/**
 * Extension constants and configuration values
 */

export const EXTENSION_NAME = "SF Preflight";
export const EXTENSION_ID = "sf-preflight";

/**
 * Recommended npm packages for Salesforce development.
 * Checked as local package.json deps first, then global install.
 */
export const REQUIRED_PACKAGES = [
  "prettier",
  "@prettier/plugin-xml",
  "prettier-plugin-apex",
];

/**
 * Optional SF CLI plugins (recommendations, not blockers).
 * @salesforce/sfdx-scanner is deprecated; use code-analyzer.
 */
export const REQUIRED_SF_PLUGINS = ["code-analyzer"];

/**
 * Official Salesforce VS Code extension IDs.
 * Pack: https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode
 */
export const SF_EXTENSIONS = {
  PACK: "salesforce.salesforcedx-vscode",
  CORE: "salesforce.salesforcedx-vscode-core",
  APEX: "salesforce.salesforcedx-vscode-apex",
  /** Newer TypeScript Apex LS — does not require Java the same way */
  APEX_TS_LS: "salesforce.apex-language-server-extension",
  CODE_ANALYZER: "salesforce.sfdx-code-analyzer-vscode",
};

/** VS Code setting used by the Java-based Apex extension */
export const APEX_JAVA_HOME_SETTING = "salesforcedx-vscode-apex.java.home";

/**
 * Global / workspace state keys used by the extension
 */
export const STATE_KEYS = {
  ENV_CHECK_COMPLETED: `${EXTENSION_ID}.env-check-completed`,
  ENV_CHECK_PASSED: `${EXTENSION_ID}.env-check-passed`,
  ENV_CHECK_TIMESTAMP: `${EXTENSION_ID}.env-check-timestamp`,
  PACKAGES_CHECKED: `${EXTENSION_ID}.packages-checked`,
  SF_PLUGINS_CHECKED: `${EXTENSION_ID}.sf-plugins-checked`,
  LAST_CHECK_RESULT: "sfPreflight.lastCheckResult",
  SNOOZE_UNTIL: "sfPreflight.snoozeUntil",
  FIRST_RUN_NOTICE_SHOWN: "sfPreflight.firstRunNoticeShown",
  LAST_REPORT: "sfPreflight.lastReport",
  /** workspaceState: last raw health results for report reopen / fix */
  LAST_RESULTS: "sfPreflight.lastResults",
};

/**
 * Time intervals (in milliseconds)
 */
export const TIME_INTERVALS = {
  RECHECK_AFTER_SUCCESS: 24 * 60 * 60 * 1000,
  SNOOZE_1_DAY: 24 * 60 * 60 * 1000,
  SNOOZE_7_DAYS: 7 * 24 * 60 * 60 * 1000,
  AUTH_CHECK_TIMEOUT: 12_000,
};

/**
 * Minimum / recommended versions (aligned with Salesforce docs, 2026)
 * Java: 11+ required, 21 recommended for Apex LS
 * Node: 18+ minimum for tooling; 20+ recommended LTS
 */
export const MIN_VERSIONS = {
  NODE: 18,
  JAVA: 11,
  JAVA_RECOMMENDED: 21,
  NODE_RECOMMENDED: 20,
};

/**
 * External URLs for documentation and downloads
 */
export const EXTERNAL_URLS = {
  JAVA_SETUP:
    "https://developer.salesforce.com/docs/platform/sfvscode-extensions/guide/java-setup.html",
  JAVA_DOWNLOAD: "https://adoptium.net/temurin/releases/?version=21",
  NODE_DOWNLOAD: "https://nodejs.org/",
  SALESFORCE_CLI: "https://developer.salesforce.com/tools/salesforcecli",
  SALESFORCE_CLI_INSTALL:
    "https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm",
  EXTENSION_PACK_MARKETPLACE:
    "https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode",
};

/**
 * Files managed by recommended setup (create-missing / force re-provision)
 */
export const PROVISIONED_FILES = [
  { path: ".prettierrc", provisioner: "prettier", label: "Prettier config" },
  {
    path: ".prettierignore",
    provisioner: "prettier",
    label: "Prettier ignore",
  },
  {
    path: ".editorconfig",
    provisioner: "editorConfig",
    label: "EditorConfig",
  },
  { path: ".gitignore", provisioner: "gitIgnore", label: "Git ignore" },
  {
    path: ".vscode/settings.json",
    provisioner: "vscodeSettings",
    label: "VS Code workspace settings",
  },
  {
    path: "cspell.json",
    provisioner: "spellChecker",
    label: "Spell checker config",
  },
  {
    path: ".cspell/salesforce-terms.txt",
    provisioner: "spellChecker",
    label: "Salesforce dictionary",
  },
];
