/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `--help` text for `sovrium dev`. Kept beside `command-help.ts`, which
 * registers it, so that file stays under its line ceiling.
 */

export const DEV_HELP_TEXT = [
  'Usage: sovrium dev [config] [options]',
  '',
  'Boot the app for development: on fresh seed data in .sovrium/dev/, with an',
  'admin account to sign in with, dev mode on, and the server reloading on save.',
  'Run again while it serves, it prints the running session and exits.',
  '',
  'Arguments:',
  '  config                        Path to config file (default: app.yaml, app.yml, app.ts)',
  '',
  'Options:',
  '  --no-open                     Do not open the sign-in page in the browser',
  '  --publicDir <path>            Directory of static assets to serve at /',
  '  --no-publicDir                Disable static-asset serving entirely',
  '  --help, -h                    Show this help message',
  '',
  'Each run deletes and recreates .sovrium/dev/ (never .sovrium/ itself), creates',
  'admin@<app>.local when the app declares auth, loads seed/ beside the config,',
  'and gives every account the same password. With DATABASE_URL set nothing is',
  'deleted: only empty tables are seeded.',
  '',
  'Environment variables (all optional):',
  '  SOVRIUM_DEV_PASSWORD          Password of the dev accounts (default: sovrium-dev-password)',
  '  SOVRIUM_DEV_NAME              Name the dev-mode panel shows (default: the app name)',
  '  SOVRIUM_DEV_URL               Where the panel links to',
  '  PORT                          Server port (default: 3000, else a free one)',
  '',
  'Examples:',
  '  sovrium dev                              # Fresh data, the sign-in page opens',
  '  sovrium dev --no-open                    # The same, opening nothing',
  '  SOVRIUM_DATA_DIR=.sovrium/dev sovrium stop   # Stop it from another terminal',
].join('\n')
