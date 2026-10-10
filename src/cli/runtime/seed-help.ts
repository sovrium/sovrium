/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `--help` text for `sovrium seed`, on this machine and for a hosted app. Kept
 * beside `command-help.ts`, which registers it, so that file stays under its
 * line ceiling.
 */

export const SEED_HELP_TEXT = [
  'Usage: sovrium seed [config] [options]',
  '       sovrium seed --app <slug> | --remote [options]',
  '',
  'Load `seed/<table>.yaml` data files into the configured tables.',
  '',
  'With --app <slug>, or --remote in a project `sovrium deploy` linked to an app,',
  'the app hosted on the signed-in cloud is seeded instead, from the seed/ folder',
  'of the deployment it runs. Without either, this machine is seeded, link or not.',
  '',
  'Arguments:',
  '  config                        Path to config file (.json, .yaml, .yml, .ts)',
  '',
  'Options:',
  '  --dir <path>                  Seed-file directory (default: <config>/seed)',
  '  --mode <mode>                 if-empty | upsert | replace (default: if-empty)',
  '                                if-empty  seed only tables that have no rows',
  '                                upsert    replay idempotently on each file mergeOn',
  '                                replace   delete every row, then insert',
  '  --table <name>                Restrict to one table (repeatable)',
  '  --as <email>                  Write every row as this account (default: system)',
  '  --today <YYYY-MM-DD>          The day {{today}} resolves against',
  '                                (default: SOVRIUM_SEED_TODAY, else the clock)',
  '  --dry-run                     Report the plan and write nothing',
  '  --request <file>              Read mode, tables, today and dryRun from a JSON file',
  '  --report <file>               Also write the result as JSON ({ error } on a refusal)',
  '  --help, -h                    Show this help message',
  '',
  'A hosted app:',
  '  --app <slug>                  The hosted app to seed',
  '  --remote                      The app this project is linked to',
  '  --yes                         Confirm without a question (required in a script)',
  '  --confirm <slug>              The app address, typed back for --mode replace',
  '  --host <url>                  The cloud (default: the one you signed in to)',
  '',
  'Accounts in seed/users.yaml are created first; a password left out of the',
  'file is taken from SOVRIUM_SEED_PASSWORD.',
  '',
  'Examples:',
  '  sovrium seed app.yaml                         # Seed empty tables only',
  '  sovrium seed app.yaml --mode replace          # Deterministic full refresh',
  '  sovrium seed app.yaml --table deals --dry-run # Preview one table',
  '  sovrium seed --app atelier-crm --dry-run      # Preview a seed of a hosted app',
].join('\n')
