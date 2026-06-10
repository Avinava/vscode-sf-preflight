import fs from "fs/promises";
import path from "path";

const MANAGERS = {
  npm: {
    name: "npm",
    installGlobal: (packages) => `npm install -g ${packages.join(" ")}`,
    addDev: (packages) => `npm install --save-dev ${packages.join(" ")}`,
  },
  yarn: {
    name: "yarn",
    installGlobal: (packages) => `yarn global add ${packages.join(" ")}`,
    addDev: (packages) => `yarn add --dev ${packages.join(" ")}`,
  },
  pnpm: {
    name: "pnpm",
    installGlobal: (packages) => `pnpm add --global ${packages.join(" ")}`,
    addDev: (packages) => `pnpm add --save-dev ${packages.join(" ")}`,
  },
  bun: {
    name: "bun",
    installGlobal: (packages) => `bun add --global ${packages.join(" ")}`,
    addDev: (packages) => `bun add --dev ${packages.join(" ")}`,
  },
};

function managerFromPackageManagerField(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const manager = value.split("@")[0];
  return MANAGERS[manager] || null;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect the package manager a workspace already uses.
 * @param {string | undefined} workspacePath
 * @returns {Promise<{name: string, installGlobal: Function, addDev: Function}>}
 */
export async function detectPackageManager(workspacePath) {
  if (workspacePath) {
    try {
      const packageJsonPath = path.join(workspacePath, "package.json");
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
      const fromField = managerFromPackageManagerField(
        packageJson.packageManager
      );
      if (fromField) {
        return fromField;
      }
    } catch {
      // No package.json or invalid JSON; fall through to lockfile detection.
    }

    const checks = [
      ["pnpm", "pnpm-lock.yaml"],
      ["yarn", "yarn.lock"],
      ["bun", "bun.lockb"],
      ["bun", "bun.lock"],
      ["npm", "package-lock.json"],
      ["npm", "npm-shrinkwrap.json"],
    ];

    for (const [manager, lockfile] of checks) {
      if (await fileExists(path.join(workspacePath, lockfile))) {
        return MANAGERS[manager];
      }
    }
  }

  return MANAGERS.npm;
}

/**
 * Read package.json dependency declarations.
 * @param {string | undefined} workspacePath
 * @returns {Promise<Record<string, string>>}
 */
export async function readDeclaredPackages(workspacePath) {
  if (!workspacePath) {
    return {};
  }

  try {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(workspacePath, "package.json"), "utf8")
    );
    return {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.optionalDependencies,
    };
  } catch {
    return {};
  }
}

export function getSupportedPackageManagers() {
  return Object.values(MANAGERS);
}
