/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `--help` text for the two operations verbs that move a whole install:
 * `sovrium backup` and `sovrium restore`. Kept beside `command-help.ts`, which
 * registers them, so that file stays under its line ceiling.
 */

export const BACKUP_HELP_TEXT = [
  'Usage: sovrium backup [config] [options]',
  '',
  'Write one archive holding everything this install needs to come back.',
  '',
  'The archive (.tar.gz) holds the database, the encryption key when it lives in',
  'the data directory, the config file and every $ref target, and the local',
  'uploads, each listed in manifest.json with its sha256. A SQLite database is',
  'copied online, so the server can keep running. The .env file is never included.',
  '',
  'Arguments:',
  '  config                        Path to config file (.json, .yaml, .yml, .ts)',
  '                                (auto-discovered when omitted)',
  '',
  'Options:',
  '  --output <file>               Where to write the archive (default:',
  '                                sovrium-backup-<app>-<date>-<time>.tar.gz here)',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables:',
  '  DATABASE_URL                  Postgres connection (needs pg_dump on PATH)',
  '  SOVRIUM_DATA_DIR              Data directory to read (default: ./.sovrium)',
  '',
  'Exit codes:',
  '  0                             The archive was written',
  '  1                             Refused; no archive was written',
].join('\n')

export const RESTORE_HELP_TEXT = [
  'Usage: sovrium restore <file> [options]',
  '',
  'Put a backup written by `sovrium backup` back on this machine.',
  '',
  'The config tree goes into the current directory, the database, key and uploads',
  'into the data directory. Every entry is checked against its sha256 before',
  'anything is written. A running server, an archive from a newer Sovrium, or a',
  'damaged entry stops the restore with nothing written.',
  '',
  'Arguments:',
  '  file                          The archive to restore (.tar.gz)',
  '',
  'Options:',
  '  --data-dir <dir>              Data directory to restore into (default:',
  '                                SOVRIUM_DATA_DIR, else ./.sovrium)',
  '  --force                       Replace a data directory or config files that',
  '                                already exist (never a running server)',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables:',
  '  DATABASE_URL                  Postgres to replay a dump into (needs psql)',
  '',
  'Exit codes:',
  '  0                             The backup was restored',
  '  1                             Refused; nothing was restored',
].join('\n')
