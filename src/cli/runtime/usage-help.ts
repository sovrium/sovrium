/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** `--help` text for `sovrium usage`, kept beside `command-help.ts`, which registers it. */
export const USAGE_HELP_TEXT = [
  'Usage: sovrium usage [config] [options]',
  '',
  'Print how many bytes this install holds: its database and its stored files.',
  '',
  'Reads the install `sovrium start` would boot and changes nothing. SQLite counts',
  'the database file and its write-ahead log; PostgreSQL its database size. Local',
  'files are summed on disk, no link followed; files in S3 or in the database are',
  'summed from the sizes Sovrium recorded, without a request to the bucket. A',
  'figure that cannot be measured is reported as not measured, never as zero.',
  '',
  'Arguments:',
  '  config                        Path to config file (.json, .yaml, .yml, .ts)',
  '                                (auto-discovered when omitted)',
  '',
  'Options:',
  '  --json                        Print the figures as JSON',
  '  --report <file>               Write the figures as JSON to a file instead',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables:',
  '  DATABASE_URL                  Postgres connection (default: SQLite in the data dir)',
  '  SOVRIUM_DATA_DIR              Data directory to read (default: ./.sovrium)',
  '',
  'Exit codes:',
  '  0                             The figures were reported',
  '  1                             The install could not be resolved',
].join('\n')
