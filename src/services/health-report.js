/**
 * Normalize raw environment check results into a severity-aware report.
 */

export const SEVERITY = {
  BLOCKER: "blocker",
  WARNING: "warning",
  INFO: "info",
};

/**
 * @typedef {Object} HealthCheckItem
 * @property {string} id
 * @property {string} title
 * @property {'blocker'|'warning'|'info'} severity
 * @property {boolean} ok
 * @property {string} message
 * @property {string} [fixId]
 */

/**
 * @typedef {Object} HealthReport
 * @property {HealthCheckItem[]} checks
 * @property {{blockers: number, warnings: number, infos: number, healthy: boolean, fullyClean: boolean}} summary
 * @property {Object} results
 * @property {boolean} [cached]
 */

/**
 * Build a normalized health report from raw check results.
 * @param {Object} results
 * @returns {HealthReport}
 */
export function buildHealthReport(results) {
  /** @type {HealthCheckItem[]} */
  const checks = [];
  const needsJava = Boolean(results.extensions?.needsJavaApex);
  const packMode = results.extensions?.packCheckMode || "warning";

  // --- Node.js ---
  if (!results.node?.installed) {
    checks.push({
      id: "node",
      title: "Node.js",
      severity: SEVERITY.BLOCKER,
      ok: false,
      message: "Node.js is not installed",
      fixId: "node",
    });
  } else if (!results.node.valid) {
    checks.push({
      id: "node",
      title: "Node.js",
      severity: SEVERITY.WARNING,
      ok: false,
      message: `Node.js v${results.node.version} is below the minimum (v18+)`,
      fixId: "node",
    });
  } else if (
    results.node.majorVersion &&
    results.node.majorVersion < (results.node.recommendedMajor || 20)
  ) {
    checks.push({
      id: "node",
      title: "Node.js",
      severity: SEVERITY.INFO,
      ok: false,
      message: `Node.js v${results.node.version} works; v${results.node.recommendedMajor || 20}+ LTS recommended`,
      fixId: "node",
    });
  } else {
    checks.push({
      id: "node",
      title: "Node.js",
      severity: SEVERITY.INFO,
      ok: true,
      message: `Node.js v${results.node.version}`,
    });
  }

  // --- Salesforce Extension Pack ---
  if (results.extensions && packMode !== "off") {
    if (!results.extensions.pack && !results.extensions.core) {
      const severity =
        packMode === "blocker" ? SEVERITY.BLOCKER : SEVERITY.WARNING;
      checks.push({
        id: "extension-pack",
        title: "Salesforce Extension Pack",
        severity,
        ok: false,
        message:
          "Salesforce Extension Pack is not installed (Apex, LWC, and org tools)",
        fixId: "extension-pack",
      });
    } else if (!results.extensions.pack && results.extensions.core) {
      checks.push({
        id: "extension-pack",
        title: "Salesforce Extension Pack",
        severity: SEVERITY.INFO,
        ok: false,
        message:
          "Core Salesforce extensions found; full Extension Pack recommended",
        fixId: "extension-pack",
      });
    } else {
      checks.push({
        id: "extension-pack",
        title: "Salesforce Extension Pack",
        severity: SEVERITY.INFO,
        ok: true,
        message: "Salesforce Extension Pack installed",
      });
    }
  }

  // --- Java (for classic Apex LS) ---
  if (results.java) {
    const javaSource = results.java.source
      ? ` via ${results.java.source}`
      : "";

    if (!needsJava && !results.java.installed) {
      // No Java Apex extension — soft skip
      checks.push({
        id: "java",
        title: "Java",
        severity: SEVERITY.INFO,
        ok: true,
        message:
          "Java not checked as required (Java Apex extension not active)",
      });
    } else if (!results.java.installed) {
      checks.push({
        id: "java",
        title: "Java",
        severity: needsJava ? SEVERITY.BLOCKER : SEVERITY.WARNING,
        ok: false,
        message:
          "Java is not available (Apex Language Server needs JDK 11+, recommend 21)",
        fixId: "java",
      });
    } else if (!results.java.valid) {
      checks.push({
        id: "java",
        title: "Java",
        severity: needsJava ? SEVERITY.BLOCKER : SEVERITY.WARNING,
        ok: false,
        message: `Java ${results.java.version} is below the minimum (11+)`,
        fixId: "java",
      });
    } else if (!results.java.recommended) {
      checks.push({
        id: "java",
        title: "Java",
        severity: SEVERITY.INFO,
        ok: false,
        message: `Java ${results.java.version}${javaSource} works; JDK 21 recommended`,
        fixId: "java",
      });
    } else {
      checks.push({
        id: "java",
        title: "Java",
        severity: SEVERITY.INFO,
        ok: true,
        message: `Java ${results.java.version}${javaSource}`,
      });
    }
  }

  // --- Salesforce CLI ---
  if (!results.salesforceCLI?.installed) {
    checks.push({
      id: "sf-cli",
      title: "Salesforce CLI",
      severity: SEVERITY.BLOCKER,
      ok: false,
      message: "Salesforce CLI (sf) is not installed",
      fixId: "sf-cli",
    });
  } else {
    const method = results.salesforceCLI.installMethod
      ? ` · ${results.salesforceCLI.installMethod}`
      : "";
    checks.push({
      id: "sf-cli",
      title: "Salesforce CLI",
      severity: SEVERITY.INFO,
      ok: true,
      message: `Salesforce CLI v${results.salesforceCLI.version}${method}`,
    });
  }

  // --- Auth / default org (soft) ---
  if (results.auth) {
    if (!results.auth.checked) {
      checks.push({
        id: "auth",
        title: "Org authentication",
        severity: SEVERITY.INFO,
        ok: true,
        message: "Could not verify orgs (CLI busy or not ready)",
      });
    } else if (results.auth.orgCount === 0) {
      checks.push({
        id: "auth",
        title: "Org authentication",
        severity: SEVERITY.INFO,
        ok: false,
        message: "No authenticated orgs found",
        fixId: "auth",
      });
    } else if (!results.auth.hasDefault) {
      checks.push({
        id: "auth",
        title: "Org authentication",
        severity: SEVERITY.WARNING,
        ok: false,
        message: `${results.auth.orgCount} org(s) authenticated, but no default org is set`,
        fixId: "auth",
      });
    } else {
      checks.push({
        id: "auth",
        title: "Org authentication",
        severity: SEVERITY.INFO,
        ok: true,
        message: `Default org: ${results.auth.defaultUsername || "set"} (${results.auth.orgCount} total)`,
      });
    }
  }

  // --- npm packages (optional) ---
  if (results.packages) {
    if (!results.packages.allInstalled) {
      checks.push({
        id: "packages",
        title: "npm packages",
        severity: SEVERITY.INFO,
        ok: false,
        message: `Recommended packages missing: ${results.packages.missing.join(", ")}`,
        fixId: "packages",
      });
    } else {
      checks.push({
        id: "packages",
        title: "npm packages",
        severity: SEVERITY.INFO,
        ok: true,
        message: "Recommended npm packages installed",
      });
    }
  }

  // --- SF CLI plugins (optional; can be disabled) ---
  const pluginsMode = results.sfPluginsMode || "recommended";
  if (results.sfPlugins && pluginsMode !== "off") {
    if (!results.sfPlugins.allInstalled) {
      checks.push({
        id: "sf-plugins",
        title: "SF CLI plugins",
        severity: SEVERITY.INFO,
        ok: false,
        message: `Recommended plugins missing: ${results.sfPlugins.missing.join(", ")}`,
        fixId: "sf-plugins",
      });
    } else {
      checks.push({
        id: "sf-plugins",
        title: "SF CLI plugins",
        severity: SEVERITY.INFO,
        ok: true,
        message: "Recommended SF CLI plugins installed",
      });
    }
  }

  // --- Project ---
  if (results.isSFDXProject && results.projectInfo) {
    checks.push({
      id: "project",
      title: "SFDX project",
      severity: SEVERITY.INFO,
      ok: true,
      message: `${results.projectInfo.name} (API ${results.projectInfo.sourceApiVersion})`,
    });
  } else if (results.isSFDXProject === false) {
    checks.push({
      id: "project",
      title: "SFDX project",
      severity: SEVERITY.INFO,
      ok: true,
      message: "Not in a Salesforce DX project",
    });
  }

  const blockers = checks.filter((c) => !c.ok && c.severity === SEVERITY.BLOCKER);
  const warnings = checks.filter((c) => !c.ok && c.severity === SEVERITY.WARNING);
  const infos = checks.filter((c) => !c.ok && c.severity === SEVERITY.INFO);

  return {
    checks,
    summary: {
      blockers: blockers.length,
      warnings: warnings.length,
      infos: infos.length,
      healthy: blockers.length === 0 && warnings.length === 0,
      fullyClean:
        blockers.length === 0 && warnings.length === 0 && infos.length === 0,
    },
    results,
    cached: Boolean(results.cached),
  };
}

/**
 * @param {HealthReport} report
 * @returns {'error'|'warning'|'ok'}
 */
export function getStatusLevel(report) {
  if (report.summary.blockers > 0) {
    return "error";
  }
  if (report.summary.warnings > 0) {
    return "warning";
  }
  return "ok";
}

/**
 * @param {HealthReport} report
 * @returns {string}
 */
export function formatReportForOutput(report) {
  const lines = ["Environment health report", "─".repeat(40)];

  if (report.cached) {
    lines.push("(from cache)");
  }

  const order = [SEVERITY.BLOCKER, SEVERITY.WARNING, SEVERITY.INFO];
  for (const severity of order) {
    const items = report.checks.filter(
      (c) => !c.ok && c.severity === severity
    );
    if (items.length === 0) {
      continue;
    }
    lines.push("");
    lines.push(severity.toUpperCase() + "S");
    for (const item of items) {
      lines.push(`  • [${item.title}] ${item.message}`);
    }
  }

  const passed = report.checks.filter((c) => c.ok);
  if (passed.length > 0) {
    lines.push("");
    lines.push("PASSED");
    for (const item of passed) {
      lines.push(`  • [${item.title}] ${item.message}`);
    }
  }

  lines.push("");
  lines.push(
    `Summary: ${report.summary.blockers} blocker(s), ${report.summary.warnings} warning(s), ${report.summary.infos} recommendation(s)`
  );

  return lines.join("\n");
}

/**
 * @param {HealthReport} report
 * @returns {string}
 */
export function formatReportSummaryLine(report) {
  if (report.summary.healthy && report.summary.fullyClean) {
    return "Environment is ready";
  }
  if (report.summary.healthy) {
    const n = report.summary.infos;
    return n === 1
      ? "Environment OK · 1 optional recommendation"
      : `Environment OK · ${n} optional recommendations`;
  }
  if (report.summary.blockers > 0) {
    const n = report.summary.blockers;
    return n === 1
      ? "1 setup issue blocks Salesforce development"
      : `${n} setup issues block Salesforce development`;
  }
  const n = report.summary.warnings;
  return n === 1
    ? "1 environment warning"
    : `${n} environment warnings`;
}
