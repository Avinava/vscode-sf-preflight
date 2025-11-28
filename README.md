# SF Preflight

![SF Preflight Logo](assets/icon.png)

**Environment health checks and setup verification for Salesforce development in VS Code.**

## Features

- **🔍 Environment Health Check** - Comprehensive check of your Salesforce development environment
- **☕ Java Check** - Verify Java installation and version (11+ required for Apex Language Server)
- **📦 Node.js Check** - Verify Node.js installation and version (18+ recommended)
- **☁️ Salesforce CLI Check** - Verify SF CLI installation and provide update options
- **🔌 SF CLI Plugins Check** - Verify required plugins like sfdx-scanner and code-analyzer
- **✨ npm Packages Check** - Check for Prettier and Salesforce formatting plugins
- **📋 Project Info** - Display Salesforce DX project information
- **📊 Status Bar** - Quick visual indicator of environment health (green ✓, yellow ⚠, red ✗)
- **🔧 Auto-Fix** - One-click installation of missing dependencies

## Status Bar

The extension shows your environment status in the status bar:

- **✓ Green** - All checks passed
- **⚠ Yellow** - Warnings (e.g., Java not found but not critical)
- **✗ Red** - Issues detected that need attention

Click the status bar item to run a full health check.

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

| Setting                               | Default | Description                                      |
| ------------------------------------- | ------- | ------------------------------------------------ |
| `sfPreflight.runHealthCheckOnStartup` | `true`  | Run environment health check when VS Code starts |
| `sfPreflight.showStatusBar`           | `true`  | Show environment status in the status bar        |

## What Gets Checked

### Required npm Packages (Global)

- `@salesforce/cli` - Salesforce CLI
- `prettier` - Code formatter
- `@prettier/plugin-xml` - XML formatting support
- `prettier-plugin-apex` - Apex formatting support

### Required SF CLI Plugins

- `@salesforce/sfdx-scanner` - Code analyzer
- `code-analyzer` - Additional code analysis

### Runtime Requirements

- **Node.js** v18 or higher
- **Java** 11 or higher (for Apex Language Server)

## Smart Startup Behavior

- On first run, performs a full environment check
- If all checks pass, skips the check for 24 hours
- If issues are detected, prompts to fix them
- Status bar always shows current environment health

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=avidev9.sf-preflight) or search for "SF Preflight" in VS Code Extensions.

## License

MIT
