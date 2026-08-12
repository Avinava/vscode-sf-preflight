/**
 * Salesforce CLI install/update command helpers, method-aware.
 *
 * Install methods we detect:
 * - homebrew: brew install sf / brew upgrade sf
 * - npm: npm install -g @salesforce/cli
 * - installer: official pkg/msi; update via `sf update`
 * - unknown: prefer official docs + npm + sf update
 */

/**
 * @param {string} [installMethod]
 * @param {string} [platform]
 * @returns {{install: string|null, update: string, preferredLabel: string}}
 */
export function getSalesforceCliCommands(
  installMethod = "unknown",
  _platform = process.platform
) {
  if (installMethod === "homebrew") {
    return {
      install: "brew install sf",
      update: "brew upgrade sf",
      preferredLabel: "Homebrew",
    };
  }

  if (installMethod === "npm") {
    return {
      install: "npm install -g @salesforce/cli",
      update: "npm update -g @salesforce/cli",
      preferredLabel: "npm",
    };
  }

  if (installMethod === "installer") {
    return {
      install: null, // direct user to official installer
      update: "sf update",
      preferredLabel: "installer",
    };
  }

  // Unknown: npm when Node exists; `sf update` for standalone installs
  return {
    install: "npm install -g @salesforce/cli",
    update: "sf update",
    preferredLabel: "npm / sf update",
  };
}

/**
 * Infer install method from binary path (exported for tests / reuse).
 * @param {string|null|undefined} cliPath
 * @param {string} [platform]
 * @returns {'homebrew'|'npm'|'installer'|'unknown'}
 */
export function inferSalesforceCliInstallMethod(
  cliPath,
  platform = process.platform
) {
  if (!cliPath) {
    return "unknown";
  }

  const normalized = cliPath.toLowerCase().replace(/\\/g, "/");

  if (
    normalized.includes("homebrew") ||
    normalized.includes("/opt/homebrew/") ||
    normalized.includes("/usr/local/cellar/") ||
    normalized.includes("/linuxbrew/")
  ) {
    return "homebrew";
  }

  // nvm / fnm / volta / asdf node shims
  if (
    normalized.includes("/.nvm/") ||
    normalized.includes("/.fnm/") ||
    normalized.includes("/.volta/") ||
    normalized.includes("/.asdf/") ||
    normalized.includes("/.local/share/mise/") ||
    normalized.includes("/node_modules/") ||
    normalized.includes("/npm/") ||
    (normalized.includes("node") && normalized.includes("bin/sf"))
  ) {
    return "npm";
  }

  if (
    platform === "win32" &&
    (normalized.includes("program files") ||
      normalized.includes("salesforce cli"))
  ) {
    return "installer";
  }

  // macOS/Linux standalone installer often under /usr/local/bin/sf without homebrew
  if (
    normalized === "/usr/local/bin/sf" ||
    normalized.endsWith("/sf/bin/sf") ||
    normalized.includes("/salesforce")
  ) {
    return "installer";
  }

  return "unknown";
}
