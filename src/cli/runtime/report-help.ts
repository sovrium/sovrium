/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `--help` text for `sovrium report`. Kept beside `command-help.ts`, which
 * registers it, so that file stays under its line ceiling.
 */

export const REPORT_HELP_TEXT = [
  'Usage: sovrium report [--config <path>] [--feature <kind>] [--security] [--last-error] [--request-id <id>] [--open]',
  '',
  'Print the address of a new issue on the Sovrium repository, with the facts',
  'maintainers need already filled in. Nothing is submitted and nothing is sent:',
  'you read the form in your browser and submit it yourself. Only the address goes',
  'to stdout; a configuration that does not validate prints no address at all.',
  '',
  'Options:',
  '  --config <path>               Attach this configuration, its secrets redacted',
  '  --feature <kind>              Suggest an idea: config-option, engine-primitive or recipe',
  '  --security                    Print the private advisory form for a vulnerability;',
  '                                attaches nothing, whatever else is given',
  '  --last-error                  Print the report the last failed command offered',
  '  --request-id <id>             Report the server error answered under this id',
  '  --open                        Also open the address in your browser',
  '  --help, -h                    Show this help message',
  '',
  'Exit codes:',
  '  0                             An address was printed',
  '  1                             No address: the configuration does not validate,',
  '                                or nothing was kept for --last-error or --request-id',
].join('\n')
