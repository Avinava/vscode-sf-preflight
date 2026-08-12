import { describe, expect, it } from "vitest";
import {
  getSalesforceCliCommands,
  inferSalesforceCliInstallMethod,
} from "../src/services/cli-install.js";

describe("inferSalesforceCliInstallMethod", () => {
  it("detects homebrew paths", () => {
    expect(
      inferSalesforceCliInstallMethod("/opt/homebrew/bin/sf", "darwin")
    ).toBe("homebrew");
    expect(
      inferSalesforceCliInstallMethod(
        "/usr/local/Cellar/sf/2.0.0/bin/sf",
        "darwin"
      )
    ).toBe("homebrew");
  });

  it("detects npm / version-manager paths", () => {
    expect(
      inferSalesforceCliInstallMethod(
        "/Users/me/.nvm/versions/node/v20.0.0/bin/sf",
        "darwin"
      )
    ).toBe("npm");
    expect(
      inferSalesforceCliInstallMethod(
        "/Users/me/.volta/bin/sf",
        "darwin"
      )
    ).toBe("npm");
  });

  it("detects windows installer paths", () => {
    expect(
      inferSalesforceCliInstallMethod(
        "C:\\Program Files\\Salesforce CLI\\bin\\sf.cmd",
        "win32"
      )
    ).toBe("installer");
  });
});

describe("getSalesforceCliCommands", () => {
  it("returns brew commands for homebrew installs", () => {
    const cmds = getSalesforceCliCommands("homebrew");
    expect(cmds.install).toBe("brew install sf");
    expect(cmds.update).toBe("brew upgrade sf");
  });

  it("returns npm commands for npm installs", () => {
    const cmds = getSalesforceCliCommands("npm");
    expect(cmds.install).toContain("npm install -g @salesforce/cli");
    expect(cmds.update).toContain("npm update -g");
  });

  it("returns sf update for installer installs", () => {
    const cmds = getSalesforceCliCommands("installer");
    expect(cmds.install).toBeNull();
    expect(cmds.update).toBe("sf update");
  });
});
