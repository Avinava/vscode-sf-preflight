import { exec, execFile } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 15000;

function getPathDelimiter(platform) {
  return platform === "win32" ? ";" : ":";
}

function uniquePathEntries(entries, platform) {
  const seen = new Set();

  return entries.filter((entry) => {
    if (!entry) {
      return false;
    }

    const normalized = platform === "win32" ? entry.toLowerCase() : entry;
    if (seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function getPosixVersionManagerPaths(env) {
  const home = env.HOME;
  const asdfDataDir = env.ASDF_DATA_DIR || (home ? `${home}/.asdf` : "");

  return [
    asdfDataDir && `${asdfDataDir}/shims`,
    home && `${home}/.local/share/mise/shims`,
    home && `${home}/.mise/shims`,
    home && `${home}/.volta/bin`,
  ];
}

function getPosixFallbackPaths(platform) {
  const commonPaths = ["/usr/local/bin", "/usr/bin", "/bin"];

  return platform === "darwin"
    ? ["/opt/homebrew/bin", ...commonPaths]
    : commonPaths;
}

export function buildCommandEnv(env = process.env, platform = process.platform) {
  const pathKey = Object.keys(env).find(
    (key) => key.toLowerCase() === "path"
  ) || "PATH";
  const currentPath = env[pathKey] || "";
  const delimiter = getPathDelimiter(platform);
  const extraPaths =
    platform === "win32"
      ? []
      : [
          ...getPosixVersionManagerPaths(env),
          ...currentPath.split(delimiter),
          ...getPosixFallbackPaths(platform),
        ];
  const pathEntries =
    platform === "win32"
      ? currentPath.split(delimiter)
      : uniquePathEntries(extraPaths, platform);

  return {
    ...env,
    [pathKey]: pathEntries.filter(Boolean).join(delimiter),
  };
}

function getCommandEnv() {
  return buildCommandEnv();
}

function normalizeExecError(error) {
  const stdout = error.stdout?.toString().trim() || "";
  const stderr = error.stderr?.toString().trim() || "";
  if (stdout || stderr) {
    error.message = [stdout, stderr].filter(Boolean).join("\n");
  }
  return error;
}

/**
 * Shell command utilities
 */

/**
 * Execute a command without interpolating arguments through a shell.
 * @param {string} command
 * @param {string[]} args
 * @param {{timeout?: number, cwd?: string}} options
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export async function execCommandArgs(command, args = [], options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: options.cwd,
      env: getCommandEnv(),
      shell: process.platform === "win32",
      timeout: options.timeout || DEFAULT_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 5,
    });
    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error) {
    throw normalizeExecError(error);
  }
}

/**
 * Resolve a command path using the current platform.
 * @param {string} command
 * @returns {Promise<string | null>}
 */
export async function whichCommand(command) {
  try {
    const lookup = process.platform === "win32" ? "where" : "which";
    const { stdout } = await execCommandArgs(lookup, [command], {
      timeout: 5000,
    });
    return stdout.split(/\r?\n/).find(Boolean) || null;
  } catch {
    return null;
  }
}

/**
 * Check whether a command is available.
 * @param {string} command
 * @returns {Promise<boolean>}
 */
export async function commandExists(command) {
  return Boolean(await whichCommand(command));
}

/**
 * Execute a shell command and return stdout
 * @param {string} command - Command to execute
 * @returns {Promise<string>} - Command output (stdout)
 * @throws {Error} - If command fails
 */
export async function execCommand(command) {
  try {
    const { stdout } = await execAsync(command, {
      env: getCommandEnv(),
      timeout: DEFAULT_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 5,
    });
    return stdout.trim();
  } catch (error) {
    throw normalizeExecError(error);
  }
}

/**
 * Execute a shell command and return both stdout and stderr
 * @param {string} command - Command to execute
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export async function execCommandFull(command) {
  try {
    const { stdout, stderr } = await execAsync(command, {
      env: getCommandEnv(),
      timeout: DEFAULT_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 5,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error) {
    return {
      stdout: error.stdout?.trim() || "",
      stderr: error.stderr?.trim() || error.message,
    };
  }
}
