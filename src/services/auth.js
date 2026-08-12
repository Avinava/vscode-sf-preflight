import * as shell from "../lib/shell.js";
import { TIME_INTERVALS } from "../lib/constants.js";
import * as logger from "../lib/logger.js";

/**
 * Best-effort org auth check via `sf org list --json`.
 * Never throws; failures are soft (info-level in the report).
 *
 * @returns {Promise<{
 *   checked: boolean,
 *   hasDefault: boolean,
 *   orgCount: number,
 *   defaultUsername?: string,
 *   error?: string
 * }>}
 */
export async function checkOrgAuth() {
  try {
    const { stdout } = await shell.execCommandArgs(
      "sf",
      ["org", "list", "--json"],
      { timeout: TIME_INTERVALS.AUTH_CHECK_TIMEOUT }
    );

    const parsed = JSON.parse(stdout);
    // sf CLI wraps payload in { status, result } for --json
    const result = parsed?.result ?? parsed;
    const nonScratch = result?.nonScratchOrgs || [];
    const scratch = result?.scratchOrgs || [];
    const other = result?.other || [];
    const all = [...nonScratch, ...scratch, ...other];

    const defaultOrg = all.find(
      (org) =>
        org.isDefaultUsername === true ||
        org.isDefaultDevHubUsername === true
    );

    // Also accept top-level default flags some CLI versions use
    const defaultUsername =
      defaultOrg?.username ||
      result?.defaultUsername ||
      undefined;

    const hasDefault = Boolean(
      defaultUsername || all.some((o) => o.isDefaultUsername)
    );

    return {
      checked: true,
      hasDefault,
      orgCount: all.length,
      defaultUsername: hasDefault
        ? defaultUsername ||
          all.find((o) => o.isDefaultUsername)?.username
        : undefined,
    };
  } catch (error) {
    logger.debug(`Org auth check skipped: ${error.message}`);
    return {
      checked: false,
      hasDefault: false,
      orgCount: 0,
      error: error.message,
    };
  }
}
