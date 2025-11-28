import * as vscode from 'vscode';
import { EXTENSION_NAME } from './constants.js';

/**
 * Logger service for the extension
 * Provides centralized logging to VS Code output channel
 */

let outputChannel = null;

/**
 * Get or create the output channel for extension logs
 * @returns {vscode.OutputChannel}
 */
export function getOutputChannel() {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(EXTENSION_NAME);
  }
  return outputChannel;
}

/**
 * Log a message to the output channel
 * @param {string} message - Message to log
 * @param {'INFO' | 'WARN' | 'ERROR' | 'DEBUG'} level - Log level
 */
export function log(message, level = 'INFO') {
  const channel = getOutputChannel();
  const timestamp = new Date().toISOString();
  channel.appendLine(`[${timestamp}] [${level}] ${message}`);
}

/**
 * Log a message and show the output channel
 * @param {string} message - Message to log
 * @param {'INFO' | 'WARN' | 'ERROR' | 'DEBUG'} level - Log level
 */
export function logAndShow(message, level = 'INFO') {
  log(message, level);
  getOutputChannel().show(true);
}

/**
 * Log an info message
 * @param {string} message 
 */
export function info(message) {
  log(message, 'INFO');
}

/**
 * Log a warning message
 * @param {string} message 
 */
export function warn(message) {
  log(message, 'WARN');
}

/**
 * Log an error message
 * @param {string} message 
 */
export function error(message) {
  log(message, 'ERROR');
}

/**
 * Log a debug message
 * @param {string} message 
 */
export function debug(message) {
  log(message, 'DEBUG');
}
