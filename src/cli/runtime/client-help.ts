/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** `--help` text for `sovrium client`, kept beside `command-help.ts`, which registers it. */
export const CLIENT_HELP_TEXT = [
  'Usage: sovrium client [config] [--output <file>] [--audience <role|all>] [--check]',
  '',
  "Write sovrium-client.ts: a typed client for the app's records API, typed from",
  'its own tables, fields and views. The file imports nothing and needs nothing',
  'installed; copy it into a React, mobile or server project and import it.',
  '',
  'The config is checked exactly as `sovrium validate` checks it, and an invalid',
  'one writes nothing. The file is generated and replaced on every run.',
  '',
  "A front-end's source is public, so the file names only the tables, fields and",
  "views its audience may read: by default a person holding the app's default",
  'role (a visitor on an app with no auth).',
  '',
  'Arguments:',
  '  config                        Path to config file (.json, .yaml, .yml, .ts)',
  '                                (auto-discovered when omitted)',
  '',
  'Options:',
  '  --output <file>               Write this file instead of ./sovrium-client.ts,',
  '                                creating its directory when missing',
  '  --audience <role|all>         Name only what that role may read, or with all,',
  '                                what a visitor who is not signed in may read',
  '  --check                       Write nothing; exit 1 when the file is missing or',
  '                                stale',
  '  --help, -h                    Show this help message',
  '',
  'Exit codes:',
  '  0                             The file was written, or is current (--check)',
  '  1                             The config is invalid, the role is not declared,',
  '                                or the file is missing or stale (--check)',
  '',
  'Examples:',
  '  sovrium client                                  # ./sovrium-client.ts',
  '  sovrium client --output web/src/lib/sovrium.ts  # Into a front-end project',
  '  sovrium client --audience all                   # For a public site',
  '  sovrium client --check                          # In CI: fail when it fell behind',
].join('\n')
