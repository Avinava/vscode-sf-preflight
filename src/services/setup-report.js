import * as vscode from "vscode";
import * as logger from "../lib/logger.js";
import {
  buildHealthReport,
  formatReportForOutput,
  formatReportSummaryLine,
  SEVERITY,
} from "./health-report.js";
import { showRemediationMenu } from "./remediation.js";
import {
  getLastResults,
  runHealthCheck,
  updateHealthCheckCache,
} from "./environment.js";

const SEVERITY_ICON = {
  [SEVERITY.BLOCKER]: "$(error)",
  [SEVERITY.WARNING]: "$(warning)",
  [SEVERITY.INFO]: "$(info)",
};

/**
 * Open the setup report QuickPick (grouped by severity).
 * Uses cached results when fresh enough; optional re-run.
 *
 * @param {vscode.ExtensionContext} context
 * @param {{results?: Object, forceRefresh?: boolean}} [options]
 */
export async function openSetupReport(context, options = {}) {
  let results = options.results || null;

  if (!results && !options.forceRefresh) {
    results = getLastResults(context);
  }

  if (!results || options.forceRefresh) {
    results = await runHealthCheck({ silent: true, context });
    await updateHealthCheckCache(context, results);
  }

  const report = buildHealthReport(results);
  logger.info("\n" + formatReportForOutput(report));

  /** @type {Array<vscode.QuickPickItem & {kind?: string, check?: Object, action?: string}>} */
  const items = [];

  items.push({
    label: formatReportSummaryLine(report),
    description: "Summary",
    kind: vscode.QuickPickItemKind?.Default,
    action: "summary",
  });

  items.push({
    label: "$(output) Show full report in Output",
    action: "show-output",
  });
  items.push({
    label: "$(sync) Re-run health check",
    action: "refresh",
  });

  const sections = [
    { severity: SEVERITY.BLOCKER, title: "Blockers" },
    { severity: SEVERITY.WARNING, title: "Warnings" },
    { severity: SEVERITY.INFO, title: "Recommendations" },
  ];

  for (const section of sections) {
    const checks = report.checks.filter(
      (c) => !c.ok && c.severity === section.severity
    );
    if (checks.length === 0) {
      continue;
    }
    if (vscode.QuickPickItemKind) {
      items.push({
        label: section.title,
        kind: vscode.QuickPickItemKind.Separator,
      });
    } else {
      items.push({
        label: `── ${section.title} ──`,
        action: "noop",
      });
    }
    for (const check of checks) {
      items.push({
        label: `${SEVERITY_ICON[check.severity] || "$(circle-outline)"} ${check.title}`,
        description: check.severity,
        detail: check.message,
        check,
        action: "fix-check",
      });
    }
  }

  const passed = report.checks.filter((c) => c.ok);
  if (passed.length > 0 && vscode.QuickPickItemKind) {
    items.push({
      label: "Passed",
      kind: vscode.QuickPickItemKind.Separator,
    });
    for (const check of passed) {
      items.push({
        label: `$(check) ${check.title}`,
        description: "ok",
        detail: check.message,
        action: "noop",
      });
    }
  }

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "SF Preflight setup report — select an issue to fix",
    ignoreFocusOut: true,
    matchOnDetail: true,
  });

  if (!selected || selected.action === "noop" || selected.kind === vscode.QuickPickItemKind?.Separator) {
    return;
  }

  if (selected.action === "show-output" || selected.action === "summary") {
    logger.getOutputChannel().show(true);
    return;
  }

  if (selected.action === "refresh") {
    await openSetupReport(context, { forceRefresh: true });
    return;
  }

  if (selected.action === "fix-check" && selected.check) {
    const fixId = selected.check.fixId;
    if (fixId) {
      await showRemediationMenu(results, { fixId });
    } else {
      uiInfoOnly(selected.check.message);
    }
  }
}

function uiInfoOnly(message) {
  vscode.window.showInformationMessage(`SF Preflight: ${message}`);
}
