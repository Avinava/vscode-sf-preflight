# SF Preflight

![SF Preflight Logo](assets/icon.png)

**Environment health checks and setup verification for Salesforce development in VS Code.**

## Features

- **🔍 Environment Health Check** - Comprehensive check of your Salesforce development environment
- **⚙️ Automatic Provisioning** - Automatically sets up standard configuration files (Prettier, EditorConfig, VS Code settings)
- **📝 Spell Checker** - Configures Code Spell Checker with Salesforce-specific dictionary
- **⚡ Smart Caching** - Caches successful health checks for 24 hours to speed up startup
- **☕ Java Check** - Verify Java installation and version (11+ required for Apex Language Server)
- **📦 Node.js Check** - Verify Node.js installation and version (18+ recommended)
- **☁️ Salesforce CLI Check** - Verify SF CLI installation and provide update options
- **🔌 SF CLI Plugins Check** - Verify required plugins like sfdx-scanner and code-analyzer
- **📊 Status Bar** - Quick visual indicator of environment health (green ✓, yellow ⚠, red ✗)

## Automatic Provisioning

When you open a Salesforce DX project, SF Preflight optionally checks for and creates ensuring standard configuration files:

- **.prettierrc** (Optimized for Apex/LWC)
- **.prettierignore**
- **.editorconfig** (Apex tab size: 2 spaces)
- **.gitignore** (Standard Salesforce ignore rules)
- **.vscode/settings.json** (Standard file exclusions)
- **cspell.json** (Salesforce dictionary configuration)

*This behavior can be disabled or customized in Settings.*

## Configuration Templates

You can override the standard templates used for provisioning by editing these settings in your `settings.json`:

- `sfPreflight.provisioning.templates.prettierrc` (Object)
- `sfPreflight.provisioning.templates.prettierignore` (String)
- `sfPreflight.provisioning.templates.editorConfig` (String)
- `sfPreflight.provisioning.templates.vscodeSettings` (Object)

## Status Bar

The extension shows your environment status in the status bar:

- **✓ Green** - All checks passed
- **✓ Green (Cached)** - Environment confirmed healthy (check skipped for performance)
- **⚠ Yellow** - Warnings (e.g., non-critical missing plugins)
- **✗ Red** - Issues detected that need attention

Click the status bar item to run a full manual health check.

## Commands

All commands are available via the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

| Command                                    | Description                       |
| ------------------------------------------ | --------------------------------- |
| `SF Preflight: Check Environment Health`   | Run full environment health check |
| `SF Preflight: Check Java Installation`    | Check and configure Java          |
| `SF Preflight: Check Salesforce CLI`       | Check and update Salesforce CLI   |
| `SF Preflight: Check Node.js Installation` | Check Node.js version             |
| `SF Preflight: Show Project Info`          | Display SFDX project details      |

## Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `sfPreflight.runHealthCheckOnStartup` | `true` | Run environment health check on startup |
| `sfPreflight.provisioning.runOnStartup` | `true` | Enable automatic provisioning system |
| `sfPreflight.provisioning.spellChecker` | `true` | Auto-configure Spell Checker |
| `sfPreflight.provisioning.prettier` | `true` | Auto-create Prettier config |
| `sfPreflight.provisioning.editorConfig` | `true` | Auto-create EditorConfig |
| `sfPreflight.provisioning.vscodeSettings` | `true` | Auto-create VS Code workspace settings |

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=avidev9.sf-preflight) or search for "SF Preflight" in VS Code Extensions.

## License

MIT
