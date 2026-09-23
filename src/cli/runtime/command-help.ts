/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-command `--help` text for every dispatchable `sovrium` command.
 *
 * ## Why this file exists
 *
 * `--help` used to be opt-in PER COMMAND: `src/cli/index.ts` forwarded a
 * `helpRequested` flag into two handlers (`start`, `update`) and every other
 * command treated the flag as an absent config and simply RAN. That meant
 * `sovrium schema --help` dumped the JSON Schema, `sovrium stop --help` stopped
 * a running server, and — the reason this is a bug fix rather than a polish —
 * `sovrium init --help` scaffolded a project into the working directory and
 * OVERWROTE an existing `CLAUDE.md`. Asking a command what its options are must
 * never be a destructive act.
 *
 * The fix is a single short-circuit in `runCommand()` keyed off this map, ahead
 * of BOTH dispatch tables. The per-command opt-in is exactly how eleven
 * commands were missed; with the lookup central, a new command inherits
 * `--help` by being added here rather than by remembering to thread a flag.
 *
 * Every entry MUST open with a `Usage:` line — `[internal ref]` asserts
 * that contract across the whole command surface.
 *
 * Kept in its OWN module (rather than in `index.ts`) so `commands/start.ts` and
 * `update.ts` can import their own text without a cycle: `index.ts` already
 * imports those handlers.
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
  '  HOSTNAME                      Server hostname (default: localhost)',
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
  'Usage: sovrium update',
  '',
  'Update Sovrium to the latest version. Behaviour depends on how it was installed:',
  '  binary                        Self-replace from GitHub Releases (Unix)',
  '  homebrew                      Delegates to `brew upgrade sovrium/tap/sovrium`',
  '  scoop                         Delegates to `scoop update sovrium`',
  '  docker                        Prints the `docker pull` instruction',
  '',
  'Options:',
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

const DOCS_HELP_TEXT = [
  'Usage: sovrium docs [address] [options]',
  '       sovrium docs <subcommand> <argument> [options]',
  '',
  'Read the platform manual out of this binary — offline, with no config file,',
  'no database and no network. What it prints describes the engine you are',
  'actually running, so it can never document a different version.',
  '',
  'Markdown is the default because the intended reader is an AI agent: point one',
  'at `sovrium docs search <topic>` from your CLAUDE.md instead of at the web.',
  '',
  'Arguments:',
  '  address                       <section> or <section>/<slug>; omit it for the',
  '                                table of contents',
  '',
  'Subcommands:',
  '  search <query>                Find the article covering a topic',
  '  config <path>                 One option: kind, values, default, prose',
  '  env <NAME>                    One environment variable',
  '  cli <verb>                    One command, beside its help text',
  '',
  'Options:',
  '  --full                        The whole manual, for a context window',
  '  --format <md|json|llms>       md (default), json for tooling, llms for an index',
  '  --section <slug>              Restrict to one section, repeatable',
  '  --list-sections               Print the section slugs and exit',
  '  --lang <code>                 Manual locale; `en` only, anything else refused',
  '  --output <path>               Write to a file instead of stdout (creates parent dirs)',
  '  --export <dir>                Write every article plus _nav.json into <dir> (refuses a',
  '                                non-empty dir without --force)',
  '  --force                       With --export, replace the files a previous export owns',
  '  --help, -h                    Show this help message',
  '',
  'Exit codes:',
  '  0                             The manual, or the piece of it you addressed',
  '  1                             Unknown address, option path, variable, verb,',
  '                                format or locale — each refused by name',
  '',
  'Examples:',
  '  sovrium docs                                  # Table of contents',
  '  sovrium docs app-schema/llms-txt              # One article',
  '  sovrium docs search llms                      # Find the article',
  '  sovrium docs config llms.full                 # Look one option up',
  '  sovrium docs env DATABASE_URL                 # One variable',
  '  sovrium docs cli migrate                      # One command',
  '  sovrium docs --full --output MANUAL.md        # The whole manual',
  "  sovrium docs --export content/docs/en         # A docs site's article tree",
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

const SEED_HELP_TEXT = [
  'Usage: sovrium seed [config] [options]',
  '',
  'Load `seed/<table>.yaml` data files into the configured tables.',
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
  '  --dry-run                     Report the plan and write nothing',
  '  --help, -h                    Show this help message',
  '',
  'Examples:',
  '  sovrium seed app.yaml                         # Seed empty tables only',
  '  sovrium seed app.yaml --mode replace          # Deterministic full refresh',
  '  sovrium seed app.yaml --table deals --dry-run # Preview one table',
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
  '  --help, -h                    Show this help message',
  '',
  'Environment variables:',
  '  DATABASE_URL                  Postgres connection (omit → embedded SQLite)',
  '',
  'Exit codes:',
  '  0                             Both migration machines completed, or the',
  '                                read-only mode finished with no blocker found',
  '  1                             Refused, a migration failed, or --check found',
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
  'design-system': DESIGN_SYSTEM_HELP_TEXT,
  docs: DOCS_HELP_TEXT,
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
}

/**
 * Per-command help text, or `undefined` when the command has none (in which
 * case the caller falls through to the global help / normal dispatch).
 */
export const getCommandHelp = (command: string): string | undefined => COMMAND_HELP[command]
