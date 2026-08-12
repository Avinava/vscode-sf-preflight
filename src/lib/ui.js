import * as vscode from "vscode";
import {
  EXTENSION_NAME,
  STATE_KEYS,
  TIME_INTERVALS,
} from "./constants.js";
import * as logger from "./logger.js";

/**
 * UI utilities for showing messages and prompts
 */

/**
 * Whether verbose success toasts are enabled.
 * @returns {boolean}
 */
export function isVerboseNotifications() {
  return vscode.workspace
    .getConfiguration("sfPreflight")
    .get("verboseNotifications", false);
}

/**
 * Show an information message with extension prefix
 * @param {string} message
 * @param {...string} actions - Optional action buttons
 * @returns {Thenable<string | undefined>}
 */
export function showInfo(message, ...actions) {
  return vscode.window.showInformationMessage(
    `${EXTENSION_NAME}: ${message}`,
    ...actions
  );
}

/**
 * Show info only when verbose notifications are on (still logs).
 * @param {string} message
 * @param {...string} actions
 * @returns {Thenable<string | undefined> | undefined}
 */
export function showInfoVerbose(message, ...actions) {
  logger.info(message);
  if (!isVerboseNotifications()) {
    return undefined;
  }
  return showInfo(message, ...actions);
}

/**
 * Show a warning message with extension prefix
 * @param {string} message
 * @param {...string} actions - Optional action buttons
 * @returns {Thenable<string | undefined>}
 */
export function showWarning(message, ...actions) {
  return vscode.window.showWarningMessage(
    `${EXTENSION_NAME}: ${message}`,
    ...actions
  );
}

/**
 * Show an error message with extension prefix (also logs the error)
 * @param {string} message
 * @param {...string} actions - Optional action buttons
 * @returns {Thenable<string | undefined>}
 */
export function showError(message, ...actions) {
  logger.log(message, "ERROR");
  return vscode.window.showErrorMessage(
    `${EXTENSION_NAME}: ${message}`,
    ...actions
  );
}

/**
 * Show a confirmation dialog
 * @param {string} message - Message to display
 * @returns {Promise<boolean>} - True if user confirmed
 */
export async function confirm(message) {
  const selection = await vscode.window.showInformationMessage(
    `${EXTENSION_NAME}: ${message}`,
    "Yes",
    "No"
  );
  return selection === "Yes";
}

/**
 * Show quick pick with common styling
 * @param {vscode.QuickPickItem[]} items
 * @param {vscode.QuickPickOptions} options
 * @returns {Thenable<vscode.QuickPickItem | undefined>}
 */
export function showQuickPick(items, options = {}) {
  return vscode.window.showQuickPick(items, {
    ignoreFocusOut: true,
    ...options,
  });
}

/**
 * Show progress in the window (status area) — less intrusive than Notification.
 * @param {string} title
 * @param {function} task
 * @returns {Promise<T>}
 */
export async function withProgress(title, task) {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title,
      cancellable: false,
    },
    task
  );
}

/**
 * @param {vscode.ExtensionContext} context
 * @returns {boolean}
 */
export function isSnoozed(context) {
  const until = context.globalState.get(STATE_KEYS.SNOOZE_UNTIL);
  return typeof until === "number" && until > Date.now();
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {number} durationMs
 */
export async function setSnooze(context, durationMs) {
  await context.globalState.update(
    STATE_KEYS.SNOOZE_UNTIL,
    Date.now() + durationMs
  );
  logger.info(
    `Notifications snoozed until ${new Date(Date.now() + durationMs).toISOString()}`
  );
}

/**
 * Clear notification snooze.
 * @param {vscode.ExtensionContext} context
 */
export async function clearSnooze(context) {
  await context.globalState.update(STATE_KEYS.SNOOZE_UNTIL, undefined);
}

/**
 * Prompt user to choose a snooze duration.
 * @param {vscode.ExtensionContext} context
 */
export async function promptSnooze(context) {
  const choice = await vscode.window.showQuickPick(
    [
      { label: "Snooze 1 day", duration: TIME_INTERVALS.SNOOZE_1_DAY },
      { label: "Snooze 7 days", duration: TIME_INTERVALS.SNOOZE_7_DAYS },
    ],
    { placeHolder: "How long should SF Preflight stay quiet?" }
  );
  if (choice) {
    await setSnooze(context, choice.duration);
    showInfo(choice.label + " — blocker alerts paused.");
  }
}

/**
 * Startup / blocker toast: at most one short message with actions.
 * Returns the selected action label, if any.
 * @param {vscode.ExtensionContext} context
 * @param {string} message - Already short, one line
 * @param {string[]} actions
 * @returns {Promise<string | undefined>}
 */
export async function notifyBlockers(context, message, actions = []) {
  if (isSnoozed(context)) {
    logger.info(`Blocker notify suppressed (snoozed): ${message}`);
    return undefined;
  }
  return vscode.window.showErrorMessage(
    `${EXTENSION_NAME}: ${message}`,
    ...actions
  );
}
