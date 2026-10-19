/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `--help` text for `sovrium design-system`. Kept beside `command-help.ts`,
 * which registers it, so that file stays under its line ceiling.
 */
export const DESIGN_SYSTEM_HELP_TEXT = [
  'Usage: sovrium design-system [config] [options]',
  '',
  "Export the app's design system: its tokens, principles, voice and usage rules.",
  '',
  'Markdown is the default because the intended reader is an AI agent — write it',
  'beside your config and reference it from CLAUDE.md so a generated page comes',
  'out on-brand the first time. Runs offline: no server, no database.',
  '',
  'Arguments:',
  '  config                        Path to config file (.json, .yaml, .yml, .ts)',
  '',
  'Options:',
  '  --format <md|json|bundle>     md (default): an agent brief. json: a W3C DTCG document.',
  '                                bundle: a directory with both, the theme CSS and a',
  '                                rendered component kit (needs --output <dir>)',
  '  --mode <light|dark>           The colour mode the tokens describe (default: light)',
  '  --output <path>               Write to a file instead of stdout (creates parent dirs);',
  '                                the directory to write, for --format bundle',
  '  --force                       Overwrite a bundle in a non-empty directory (other files stay)',
  '  --help, -h                    Show this help message',
  '',
  'Examples:',
  '  sovrium design-system app.ts                       # Print the brief',
  '  sovrium design-system app.ts --output DESIGN.md    # Commit it beside the config',
  '  sovrium design-system app.ts --format json         # DTCG tokens, for tooling',
  '  sovrium design-system app.ts --format json --mode dark  # The dark palette',
  '  sovrium design-system app.ts --format bundle --output design-system  # The portable bundle',
  '',
  "Import (a design tool's tokens back into the config):",
  '  sovrium design-system import <file|folder> [--config <file>] [options]',
  '',
  '  Reads a token file exported by Claude Design, Figma, Tokens Studio or Penpot,',
  '  Style Dictionary, DTCG, or CSS variables, and maps it onto the `design` key.',
  '  Offline, local paths only. Only tokens map; components are never imported.',
  '',
  '  --config <file>               The app config to import into (default: discovered)',
  '  --from <format>               claude-design | figma | tokens-studio | style-dictionary | dtcg | css',
  '  --dry-run                     Print the change and write nothing (the default)',
  '  --write                       Write it: patch a YAML/JSON config, or a design.json beside a .ts one',
  '  --json                        Print the report as JSON',
].join('\n')
