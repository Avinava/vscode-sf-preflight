import { describe, expect, it } from "vitest";
import {
  buildHealthReport,
  getStatusLevel,
  formatReportSummaryLine,
} from "../src/services/health-report.js";

function baseResults(overrides = {}) {
  return {
    node: {
      installed: true,
      valid: true,
      version: "20.11.1",
      majorVersion: 20,
      recommendedMajor: 20,
    },
    java: {
      installed: true,
      valid: true,
      recommended: true,
      version: "21.0.2",
      source: "PATH",
    },
    salesforceCLI: { installed: true, version: "2.34.6", installMethod: "npm" },
    packages: { allInstalled: true, missing: [] },
    sfPlugins: { allInstalled: true, missing: [] },
    extensions: {
      pack: true,
      core: true,
      apex: true,
      needsJavaApex: true,
      packCheckMode: "warning",
    },
    auth: {
      checked: true,
      hasDefault: true,
      orgCount: 1,
      defaultUsername: "dev@example.com",
    },
    isSFDXProject: true,
    projectInfo: { name: "demo", sourceApiVersion: "61.0" },
    ...overrides,
  };
}

describe("buildHealthReport", () => {
  it("marks missing CLI and Node as blockers and healthy=false", () => {
    const report = buildHealthReport(
      baseResults({
        node: { installed: false, valid: false },
        salesforceCLI: { installed: false },
      })
    );

    expect(report.summary.blockers).toBe(2);
    expect(report.summary.healthy).toBe(false);
    expect(getStatusLevel(report)).toBe("error");
  });

  it("treats missing prettier packages as info, not status error", () => {
    const report = buildHealthReport(
      baseResults({
        packages: {
          allInstalled: false,
          missing: ["prettier", "prettier-plugin-apex"],
        },
      })
    );

    expect(report.summary.blockers).toBe(0);
    expect(report.summary.warnings).toBe(0);
    expect(report.summary.infos).toBe(1);
    expect(report.summary.healthy).toBe(true);
    expect(report.summary.fullyClean).toBe(false);
    expect(getStatusLevel(report)).toBe("ok");
    expect(formatReportSummaryLine(report)).toMatch(/optional recommendation/i);
  });

  it("treats missing code-analyzer as info recommendation", () => {
    const report = buildHealthReport(
      baseResults({
        sfPlugins: { allInstalled: false, missing: ["code-analyzer"] },
      })
    );

    expect(getStatusLevel(report)).toBe("ok");
    expect(report.summary.infos).toBe(1);
  });

  it("marks missing Java as blocker when Apex extension needs it", () => {
    const report = buildHealthReport(
      baseResults({
        java: { installed: false, valid: false, recommended: false },
        extensions: {
          pack: true,
          core: true,
          apex: true,
          needsJavaApex: true,
          packCheckMode: "warning",
        },
      })
    );

    expect(report.summary.blockers).toBe(1);
    expect(getStatusLevel(report)).toBe("error");
  });

  it("softens Java when Apex Java extension is not present", () => {
    const report = buildHealthReport(
      baseResults({
        java: { installed: false, valid: false, recommended: false },
        extensions: {
          pack: false,
          core: false,
          apex: false,
          needsJavaApex: false,
          packCheckMode: "off",
        },
      })
    );

    const java = report.checks.find((c) => c.id === "java");
    expect(java.ok).toBe(true);
  });

  it("flags missing Extension Pack as warning by default", () => {
    const report = buildHealthReport(
      baseResults({
        extensions: {
          pack: false,
          core: false,
          apex: false,
          needsJavaApex: false,
          packCheckMode: "warning",
        },
      })
    );

    expect(report.summary.warnings).toBeGreaterThanOrEqual(1);
    expect(getStatusLevel(report)).toBe("warning");
  });

  it("flags missing default org as warning", () => {
    const report = buildHealthReport(
      baseResults({
        auth: {
          checked: true,
          hasDefault: false,
          orgCount: 2,
        },
      })
    );

    expect(report.summary.warnings).toBe(1);
    expect(report.checks.find((c) => c.id === "auth")?.ok).toBe(false);
  });

  it("reports fully clean when everything passes", () => {
    const report = buildHealthReport(baseResults());
    expect(report.summary.fullyClean).toBe(true);
    expect(formatReportSummaryLine(report)).toMatch(/ready/i);
  });
});
