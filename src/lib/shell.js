import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Shell command utilities
 */

/**
 * Execute a shell command and return stdout
 * @param {string} command - Command to execute
 * @returns {Promise<string>} - Command output (stdout)
 * @throws {Error} - If command fails
 */
export async function execCommand(command) {
  try {
    const { stdout } = await execAsync(command);
    return stdout.trim();
  } catch (error) {
    // Include stdout in error for npm list parsing
    if (error.stdout) {
      error.message = error.stdout;
    }
    throw error;
  }
}

/**
 * Execute a shell command and return both stdout and stderr
 * @param {string} command - Command to execute
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export async function execCommandFull(command) {
  try {
    const { stdout, stderr } = await execAsync(command);
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error) {
    return {
      stdout: error.stdout?.trim() || "",
      stderr: error.stderr?.trim() || error.message,
    };
  }
}
