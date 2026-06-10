import { readFile } from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("command manifest", () => {
  it("registers every contributed command except internal menu command", async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8")
    );
    const extensionSource = await readFile(
      path.join(root, "src", "extension.js"),
      "utf8"
    );

    const commands = packageJson.contributes.commands.map(
      (entry) => entry.command
    );

    for (const command of commands) {
      expect(extensionSource, `${command} should be registered`).toContain(
        command.replace("sf-preflight.", "${EXTENSION_ID}.")
      );
    }
  });
});
