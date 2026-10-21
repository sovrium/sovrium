/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `--help` text for `sovrium import`. Kept beside `command-help.ts`, which
 * registers it, so that file stays under its line ceiling.
 */
export const IMPORT_HELP_TEXT = [
  'Usage: sovrium import fetch <source-uri> [options]',
  '       sovrium import <snapshot|file> [options]',
  '',
  'Migrate an app out of another tool: its tables, records, automations and forms.',
  'Two stages. `fetch` reads the tool’s API, read-only, into a snapshot folder; it is',
  'the only step that touches the network. The conversion then reads the snapshot',
  '(or an export file you already have) offline, and writes config entries and seed',
  'files. A dry run is the default; every imported automation is written disabled.',
  '',
  'Fetch options:',
  '  --out <dir>                   Snapshot folder (default: .sovrium-imports/<tool>-<timestamp>/)',
  '  --token-env <VAR>             The variable holding the token (default: the tool’s, e.g.',
  '                                AIRTABLE_TOKEN). There is no flag that takes the token itself',
  '  --skip-attachments            Download no attachment; each is recorded as skipped',
  '  --only <parts>                tables, data, automations, forms, pages (comma-separated)',
  '',
  'Conversion options:',
  '  --config <file>               The app config to import into (default: discovered)',
  '  --from <tool>                 Name the tool when detection cannot (csv, xlsx, airtable, n8n, …)',
  '  --dry-run                     Print the report and write nothing (the default)',
  '  --write                       Write: entries into a YAML/JSON config, sidecars beside a .ts one,',
  '                                records into the gitignored seed/import/',
  '  --apply                       --write, then seed: sovrium seed --dir seed/import --mode upsert',
  '  --prefix <p>                  Import under prefixed names instead of refusing a name clash',
  '  --only <parts>                Convert only these parts',
  '  --json                        Print the report as JSON',
  '  --report <file>               Save the JSON report to a file',
  '  --help, -h                    Show this help message',
  '',
  'Examples:',
  '  sovrium import fetch airtable:appX9kQ2vLmN7          # Snapshot a base (AIRTABLE_TOKEN set)',
  '  sovrium import .sovrium-imports/airtable-…            # Preview the migration',
  '  sovrium import ./contacts.csv --write --apply         # Write a CSV, then seed it',
  '  sovrium import ./workflows.json --from n8n --write    # n8n workflows, disabled',
].join('\n')
