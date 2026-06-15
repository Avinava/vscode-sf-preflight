import { describe, expect, it } from "vitest";
import { buildCommandEnv } from "../src/lib/shell.js";

function pathEntries(env, key = "PATH", delimiter = ":") {
  return env[key].split(delimiter);
}

describe("buildCommandEnv", () => {
  it("prefers asdf shims before Homebrew fallbacks on POSIX", () => {
    const env = buildCommandEnv(
      {
        HOME: "/Users/developer",
        PATH: "/opt/homebrew/bin:/usr/bin",
      },
      "darwin"
    );
    const entries = pathEntries(env);

    expect(entries.indexOf("/Users/developer/.asdf/shims")).toBeLessThan(
      entries.indexOf("/opt/homebrew/bin")
    );
  });

  it("deduplicates PATH entries while preserving first occurrence", () => {
    const env = buildCommandEnv(
      {
        HOME: "/Users/developer",
        PATH: "/Users/developer/.asdf/shims:/opt/homebrew/bin:/usr/bin:/opt/homebrew/bin",
      },
      "darwin"
    );
    const entries = pathEntries(env);

    expect(
      entries.filter((entry) => entry === "/Users/developer/.asdf/shims")
    ).toHaveLength(1);
    expect(entries.filter((entry) => entry === "/opt/homebrew/bin")).toHaveLength(
      1
    );
  });

  it("preserves existing PATH key casing", () => {
    const env = buildCommandEnv(
      {
        HOME: "/Users/developer",
        Path: "/usr/bin",
      },
      "darwin"
    );

    expect(env).toHaveProperty("Path");
    expect(env).not.toHaveProperty("PATH");
    expect(pathEntries(env, "Path")).toContain("/Users/developer/.asdf/shims");
  });

  it("does not add macOS Homebrew fallback paths on Linux", () => {
    const env = buildCommandEnv(
      {
        HOME: "/home/developer",
        PATH: "/usr/bin",
      },
      "linux"
    );

    expect(pathEntries(env)).not.toContain("/opt/homebrew/bin");
  });

  it("does not add POSIX fallback paths on Windows", () => {
    const env = buildCommandEnv(
      {
        Path: "C:\\Windows\\System32;C:\\Program Files\\nodejs",
      },
      "win32"
    );

    expect(env.Path).toBe("C:\\Windows\\System32;C:\\Program Files\\nodejs");
  });
});
