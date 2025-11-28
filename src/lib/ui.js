import * as vscode from "vscode";
import { EXTENSION_NAME } from "./constants.js";
import * as logger from "./logger.js";

/**
 * UI utilities for showing messages and prompts
 */

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
 * Show progress notification while executing a task
 * @param {string} title - Progress title
 * @param {function} task - Async task to execute
 * @returns {Promise<T>}
 */
export async function withProgress(title, task) {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false,
    },
    task
  );
}
