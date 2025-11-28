# SF Preflight

Environment health checks and setup verification for Salesforce development in VS Code.

## Features

- **Environment Health Check** - Comprehensive check of your Salesforce development environment
- **Java Check** - Verify Java installation and version (11+ required for Apex)
- **Node.js Check** - Verify Node.js installation and version (18+ recommended)
- **Salesforce CLI Check** - Verify SF CLI installation and provide update options
- **Prettier Check** - Check for Prettier and Salesforce plugins
- **Project Info** - Display Salesforce DX project information

## Commands

All commands are available via the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

- `SF Preflight: Check Environment Health` - Run full environment health check
- `SF Preflight: Check Java Installation` - Check and configure Java
- `SF Preflight: Check Salesforce CLI` - Check and update Salesforce CLI
- `SF Preflight: Check Node.js Installation` - Check Node.js version
- `SF Preflight: Show Project Info` - Display SFDX project details

## Settings

| Setting                               | Default | Description                                      |
| ------------------------------------- | ------- | ------------------------------------------------ |
| `sfPreflight.runHealthCheckOnStartup` | `true`  | Run environment health check when VS Code starts |
| `sfPreflight.showStatusBar`           | `true`  | Show environment status in the status bar        |

## Requirements

For full Salesforce development capabilities, you'll need:

- **Node.js** v18 or higher
- **Java** 11 or higher (for Apex Language Server)
- **Salesforce CLI** (`sf` command)
- **Prettier** with Apex and XML plugins (for code formatting)

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=avidev9.sf-preflight) or search for "SF Preflight" in VS Code Extensions.

## License

MIT
