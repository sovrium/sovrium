/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `--help` text for `sovrium bundle`. Kept beside `command-help.ts`, which
 * registers it, so that file stays under its line ceiling.
 */

export const BUNDLE_HELP_TEXT = [
  'Usage: sovrium bundle [config] [options]',
  '',
  'Package an app into one archive a host can verify and deploy.',
  '',
  'The config is validated exactly as `sovrium validate` does; a config that does',
  'not validate prints the same report and nothing is written. The archive',
  '(.tar.gz) holds project/app.json — the config resolved, every $ref inlined and',
  'a TypeScript config evaluated, written as JSON — the static files as public/',
  'and the seed files as seed/, each listed in manifest.json with its sha256.',
  '$env references stay references; the .env file is never included.',
  '',
  'Arguments:',
  '  config                        Path to config file (.json, .yaml, .yml, .ts)',
  '                                (auto-discovered when omitted)',
  '',
  'Options:',
  '  --output <file>               Where to write the archive (default:',
  '                                sovrium-bundle-<app>-<date>-<time>.tar.gz here)',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables:',
  '  SOVRIUM_PUBLIC_DIR            Static files to bundle (default: public/ beside',
  '                                the config; none leaves them out)',
  '',
  'Exit codes:',
  '  0                             The archive was written',
  '  1                             Refused; no archive was written',
].join('\n')
