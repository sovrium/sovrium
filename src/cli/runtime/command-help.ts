/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { BACKUP_HELP_TEXT, RESTORE_HELP_TEXT } from './backup-help'
import { CLOUD_COMMAND_HELP } from './cloud-help'
import { REFERENCE_HELP } from './reference-help'
import { RENDER_HELP_TEXT } from './render-help'
import { SEED_HELP_TEXT } from './seed-help'

/**
 * Per-command `--help` text for every dispatchable `sovrium` command.
 *
 * ## Why this file exists
 *
 * If `--help` were opt-in PER COMMAND (a `helpRequested` flag threaded into
 * each handler), every command that forgot it would treat the flag as an
 * absent config and simply RUN: `sovrium schema --help` dumping the JSON
 * Schema, `sovrium stop --help` stopping a running server, and
 * `sovrium init --help` scaffolding a project into the working directory and
 * OVERWRITING an existing `CLAUDE.md`. Asking a command what its options are
 * must never be a destructive act.
 *
 * So there is a single short-circuit in `runCommand()` keyed off this map,
 * ahead of BOTH dispatch tables. With the lookup central, a new command
 * inherits `--help` by being added here rather than by remembering to thread a flag.
 *
 * Every entry MUST open with a `Usage:` line: a CLI help spec asserts it on every command.
 *
 * Kept in its OWN module (not `index.ts`) so `commands/start.ts` and `update.ts` can
 * import their own text without a cycle: `index.ts` already imports those handlers.
 */

export const START_HELP_TEXT = [
  'Usage: sovrium start [config] [options]',
  '',
  'Start a Sovrium server from a YAML/JSON/TS config file.',
  '',
  'Arguments:',
  '  config                        Path to config file (.json, .yaml, .yml, .ts)',
  '',
  'Options:',
  '  --watch, -w                   Watch config file and hot-reload on change',
  '  --publicDir <path>            Directory of static assets to serve at /',
  '                                (default: ./public next to app.yaml, if present)',
  '  --no-publicDir                Disable static-asset serving entirely',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables (all optional — Sovrium runs zero-config):',
  '  APP_SCHEMA                    Inline JSON/YAML or remote URL (alternative to file arg)',
  '  PORT                          Server port (default: 3000)',
  '  SOVRIUM_BIND_HOST             Interface to bind (default: localhost)',
  '  DATABASE_URL                  Postgres connection (omit → embedded SQLite)',
  '  AUTH_SECRET                   Auth signing secret (run: sovrium secret generate)',
  '  SOVRIUM_PUBLIC_DIR            Static-asset directory (or "none" to disable)',
  '',
  'Examples:',
  '  sovrium start app.yaml                   # Boot with app.yaml (serves ./public if present)',
  '  sovrium start app.yaml --watch           # Hot reload on file change',
  '  sovrium start app.yaml --no-publicDir    # Disable static-asset serving',
  '  PORT=8080 sovrium start app.json         # Override port',
].join('\n')

export const UPDATE_HELP_TEXT = [
  'Usage: sovrium update [--insecure-skip-checksum]',
  '',
  'Update Sovrium to the latest version. Behaviour depends on how it was installed:',
  '  binary                        Self-replace from GitHub Releases (Unix)',
  '  homebrew                      Delegates to `brew upgrade sovrium/tap/sovrium`',
  '  scoop                         Delegates to `scoop update sovrium`',
  '  docker                        Prints the `docker pull` instruction',
  '',
  'Options:',
  '  --insecure-skip-checksum      Install without verifying the sha256 or the signature',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables (advanced / test seams):',
  '  SOVRIUM_INSTALL_METHOD        Force the detected install method',
  '  SOVRIUM_DISABLE_NETWORK       Skip all network calls (offline)',
  '  SOVRIUM_UPDATE_API_HOST       Override the GitHub API host',
  '  SOVRIUM_UPDATE_DRY_RUN        Print package-manager command instead of running',
].join('\n')
const BUILD_HELP_TEXT = [
  'Usage: sovrium build [config] [options]',
  '',
  'Build a static site from a config file into an output directory.',
  '',
  'Arguments:',
  '  config                        Path to config file (.json, .yaml, .yml, .ts)',
  '',
  'Options:',
  '  --publicDir <path>            Directory of static assets to copy into the output',
  '  --no-publicDir                Skip static-asset copying entirely',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables:',
  '  SOVRIUM_OUTPUT_DIR            Output directory (default: ./dist)',
  '  SOVRIUM_BASE_URL              Base URL used for sitemap.xml / robots.txt',
  '  SOVRIUM_BASE_PATH             Base path for sub-directory deployments',
  '',
  'Examples:',
  '  sovrium build app.yaml                        # Build into ./dist',
  '  SOVRIUM_OUTPUT_DIR=./out sovrium build        # Build into ./out',
].join('\n')

const SCHEMA_HELP_TEXT = [
  'Usage: sovrium schema [options]',
  '',
  'Print the full JSON Schema (Draft 2020-12) for a Sovrium config file.',
  '',
  'Options:',
  '  --output <path>               Write the schema to a file instead of stdout',
  '  --help, -h                    Show this help message',
  '',
  'Examples:',
  '  sovrium schema                                # Print to stdout',
  '  sovrium schema --output app.schema.json       # Write to a file',
].join('\n')

const TYPES_HELP_TEXT = [
  'Usage: sovrium types [options]',
  '',
  'Emit the TypeScript authoring surface for a `.ts` config: `sovrium.d.ts` (an',
  'ambient declaration for the bare `sovrium` specifier) and a minimal',
  '`tsconfig.json` that puts it in the TypeScript program.',
  '',
  'Zero npm: no package.json, no node_modules, no install step. The types come',
  'out of the binary, so they always describe the schema THIS binary accepts.',
  '',
  'Author your config with a TYPE-ONLY import — the declaration exports no',
  'runtime value, because the binary does not resolve bare-package specifiers:',
  '',
  "  import type { AppConfig } from 'sovrium'",
  '',
  "  export default { name: 'my-app' } satisfies AppConfig",
  '',
  'Options:',
  '  --output <dir>                Target directory (default: current directory)',
  '  --help, -h                    Show this help message',
  '',
  'Notes:',
  '  sovrium.d.ts is regenerated on every run — re-run after upgrading the binary.',
  '  An existing tsconfig.json is never overwritten; keep sovrium.d.ts in its program.',
  '',
  'Examples:',
  '  sovrium types                                 # Write both files into the cwd',
  '  sovrium types --output ./config               # Write them elsewhere',
].join('\n')

const DESIGN_SYSTEM_HELP_TEXT = [
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
  '  --format <md|json>            md (default): an agent brief. json: a W3C DTCG document',
  '  --output <path>               Write to a file instead of stdout (creates parent dirs)',
  '  --help, -h                    Show this help message',
  '',
  'Examples:',
  '  sovrium design-system app.ts                       # Print the brief',
  '  sovrium design-system app.ts --output DESIGN.md    # Commit it beside the config',
  '  sovrium design-system app.ts --format json         # DTCG tokens, for tooling',
].join('\n')

const VALIDATE_HELP_TEXT = [
  'Usage: sovrium validate <config>',
  '',
  'Validate a config file against AppSchema and report errors with their paths.',
  'Exits 0 when the config is valid, non-zero otherwise.',
  '',
  'Arguments:',
  '  config                        Path to config file (.json, .yaml, .yml, .ts)',
  '',
  'Options:',
  '  --help, -h                    Show this help message',
  '',
  'Examples:',
  '  sovrium validate app.yaml',
].join('\n')

const MCP_HELP_TEXT = [
  'Usage: sovrium mcp [--project <dir>]',
  '',
  "Serve this project's configuration to an AI client over stdio, read-only.",
  'Speaks newline-delimited JSON-RPC on stdin/stdout; every diagnostic goes to',
  'stderr, because stdout carries MCP messages and nothing else.',
  '',
  'It starts no server, opens no database and binds no port, and it needs no',
  '`auth:` block: the process runs as you and reads a directory you named.',
  '',
  'Tools (namespaced by your app name):',
  '  <app>_config_read             The configuration, with declared secrets redacted',
  '  <app>_config_validate         Findings for the config on disk, as `validate --json`',
  '  <app>_config_schema           The JSON Schema, whole or at a dotted config path',
  '  <app>_config_status           What a running instance is doing, from status.json',
  '',
  'Options:',
  '  --project <dir>               Directory to read the config from (default: cwd)',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables:',
  '  SOVRIUM_PROJECT_DIR           Same as --project, for a launcher that cannot set argv',
  '  SOVRIUM_LOCK_DIR              Where <app>_config_status looks for status.json',
  '',
  'Client configuration:',
  '  { "mcpServers": { "sovrium": {',
  '      "command": "sovrium", "args": ["mcp", "--project", "/path/to/my-app"] } } }',
  '',
  'Examples:',
  '  sovrium mcp --project .',
  '  sovrium mcp --project ~/apps/crm',
].join('\n')

const MIGRATE_HELP_TEXT = [
  'Usage: sovrium migrate [config] [options]',
  '',
  'Bring the database schema forward without booting the application.',
  '',
  'Runs both migration machines, in the only order that works: the baked Drizzle',
  'journal first, then the dynamic tables declared in the config. It starts no',
  'server and binds no port, so it stays available on a database where',
  '`sovrium start` cannot complete.',
  '',
  'Arguments:',
  '  config                        Path to config file (.json, .yaml, .yml, .ts)',
  '                                (auto-discovered when omitted)',
  '',
  'Options:',
  '  --dry-run                     Name what would change, and write nothing',
  '  --check                       Report whether the upgrade is safe to attempt,',
  '                                and write nothing',
  '  --allow-destructive           Apply a plan that drops a table still holding',
  '                                rows (one-shot consent; boot always refuses)',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables:',
  '  DATABASE_URL                  Postgres connection (omit → embedded SQLite)',
  '',
  'Exit codes:',
  '  0                             Both migration machines completed, or the',
  '                                read-only mode finished with no blocker found',
  '  1                             Refused, a migration failed, a destructive plan',
  '                                ran without --allow-destructive, or --check found',
  '                                a condition that would abort the upgrade',
  '',
  '--check is a pre-flight, not a guarantee. It names the conditions it can prove',
  'would block the upgrade: duplicate account identities, duplicate OAuth client',
  'ids, and a released migration whose stored hash no longer matches its file.',
  '',
  'Examples:',
  '  sovrium migrate app.yaml --check              # Is it safe to upgrade?',
  '  sovrium migrate app.yaml --dry-run            # What would change?',
  '  sovrium migrate app.yaml                      # Migrate, then exit',
  '  DATABASE_URL=postgres://… sovrium migrate     # Migrate a remote database',
].join('\n')

const INIT_HELP_TEXT = [
  'Usage: sovrium init [dir] [options]',
  '',
  'Scaffold a new Sovrium project (app.yaml, .gitignore, .env.example, public/).',
  'Writes into [dir] when given, otherwise the current directory.',
  '',
  'Arguments:',
  '  dir                           Target directory (default: current directory)',
  '',
  'Options:',
  '  --template <name>             Bundled template, or <owner>/<repo>[#ref] from GitHub',
  '  --name <name>                 App name written into the generated config',
  '  --typescript                  Scaffold a typed app.ts (plus sovrium.d.ts + tsconfig.json)',
  '                                instead of app.yaml — see `sovrium types`',
  '  --force                       Overwrite existing files',
  '  --help, -h                    Show this help message',
  '',
  'Examples:',
  '  sovrium init                                       # Scaffold into the current directory',
  '  sovrium init ./my-app --typescript                 # Scaffold a typed app.ts',
  '  sovrium init ./my-app --template blog              # Scaffold from a bundled template',
  '  sovrium init ./my-app --template sovrium/crm-template  # Scaffold from a GitHub repo',
].join('\n')

const ADMIN_HELP_TEXT = [
  'Usage: sovrium admin create <email> [config] [options]',
  '',
  'Create an admin user in the configured database.',
  'The password is prompted for unless --password is supplied.',
  '',
  'Arguments:',
  '  email                         Email address of the admin to create',
  '  config                        Path to config file (.json, .yaml, .yml, .ts)',
  '',
  'Options:',
  '  --password <value>            Admin password (for scripting / CI; else prompted)',
  '  --help, -h                    Show this help message',
  '',
  'Examples:',
  '  sovrium admin create me@example.com app.yaml',
].join('\n')

const SECRET_HELP_TEXT = [
  'Usage: sovrium secret generate [scope]',
  '',
  'Print freshly generated secrets as .env lines, ready to paste or redirect.',
  '',
  'Arguments:',
  '  scope                         auth | encryption | all (default: all)',
  '',
  'Options:',
  '  --help, -h                    Show this help message',
  '',
  'Examples:',
  '  sovrium secret generate                       # AUTH_SECRET + encryption key',
  '  sovrium secret generate auth >> .env          # Append just AUTH_SECRET',
].join('\n')

const STOP_HELP_TEXT = [
  'Usage: sovrium stop',
  '',
  'Stop the Sovrium server running from this project (resolved via its lock file).',
  '',
  'Options:',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables:',
  '  SOVRIUM_LOCK_DIR              Directory holding the server lock file',
].join('\n')

const RESTART_HELP_TEXT = [
  'Usage: sovrium restart [config]',
  '',
  'Stop the running server and start it again. Use `reload` instead when you only',
  'changed config and want zero downtime.',
  '',
  'Arguments:',
  '  config                        Path to config file (.json, .yaml, .yml, .ts)',
  '',
  'Options:',
  '  --help, -h                    Show this help message',
].join('\n')

const RELOAD_HELP_TEXT = [
  'Usage: sovrium reload [options]',
  '',
  'Hot-reload the running server config without downtime.',
  '',
  'Options:',
  '  --message <text>              Commit message recorded on the new version row',
  '  --help, -h                    Show this help message',
  '',
  'Examples:',
  '  sovrium reload --message "Add pricing page"',
].join('\n')

const SKILLS_HELP_TEXT = [
  'Usage: sovrium skills [--output <dir>] [--target claude|agents|all] [--check] [--force]',
  '',
  "Write this binary's agent skills into the project: one folder per skill, each a",
  'SKILL.md your AI reads when a task matches it plus its references/, and a',
  '.sovrium-skills.json recording a SHA-256 for every file written.',
  '',
  'Run it again after upgrading: files Sovrium wrote and you did not change are',
  'replaced, a skill this version dropped is removed, and a file you edited is',
  'refused (exit 1) until you pass --force. Skills with other names are never touched.',
  '',
  'Options:',
  '  --output <dir>                Project root (default: current directory)',
  '  --target <name>               claude  .claude/skills/ (default)',
  '                                agents  .agents/skills/',
  '                                all     both',
  '  --check                       Write nothing; exit 1 listing missing, stale or edited files',
  '  --force                       Replace files Sovrium wrote even if you edited them',
  '  --help, -h                    Show this help message',
  '',
  'Examples:',
  '  sovrium skills                                  # .claude/skills/',
  '  sovrium skills --target all                     # .claude/skills/ and .agents/skills/',
  '  sovrium skills --check                          # In CI: fail when the skills fell behind',
].join('\n')

/**
 * Every command whose `--help` is answered instead of executed.
 *
 * `help` and `version` are deliberately ABSENT: they have no options of their
 * own, so `sovrium help --help` falls through to the global help — which is the
 * only sensible answer to that question.
 */
const COMMAND_HELP: Readonly<Record<string, string>> = {
  start: START_HELP_TEXT,
  build: BUILD_HELP_TEXT,
  schema: SCHEMA_HELP_TEXT,
  types: TYPES_HELP_TEXT,
  skills: SKILLS_HELP_TEXT,
  'design-system': DESIGN_SYSTEM_HELP_TEXT,
  ...REFERENCE_HELP,
  validate: VALIDATE_HELP_TEXT,
  mcp: MCP_HELP_TEXT,
  seed: SEED_HELP_TEXT,
  migrate: MIGRATE_HELP_TEXT,
  init: INIT_HELP_TEXT,
  admin: ADMIN_HELP_TEXT,
  secret: SECRET_HELP_TEXT,
  update: UPDATE_HELP_TEXT,
  stop: STOP_HELP_TEXT,
  restart: RESTART_HELP_TEXT,
  reload: RELOAD_HELP_TEXT,
  backup: BACKUP_HELP_TEXT,
  ...CLOUD_COMMAND_HELP,
  restore: RESTORE_HELP_TEXT,
  render: RENDER_HELP_TEXT,
}

/**
 * Per-command help text, or `undefined` when the command has none (in which
 * case the caller falls through to the global help / normal dispatch).
 */
export const getCommandHelp = (command: string): string | undefined => COMMAND_HELP[command]
