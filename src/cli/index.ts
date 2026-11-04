#!/usr/bin/env bun
/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sovrium CLI - Command-line interface for Sovrium operations
 *
 * This script provides commands for running a Sovrium server or building static sites.
 *
 * ## Commands
 *
 * ### sovrium start [config]
 * Start a development server
 * ```bash
 * sovrium start app.json                              # Load from JSON file
 * sovrium start app.yaml                              # Load from YAML file
 * APP_SCHEMA='{"name":"My App"}' sovrium              # Inline JSON
 * APP_SCHEMA='name: My App' sovrium                   # Inline YAML
 * APP_SCHEMA='https://example.com/app.yaml'           # Remote URL
 * ```
 *
 * ### sovrium build [config]
 * Build static site files
 * ```bash
 * sovrium build app.json                           # Load from JSON file
 * SOVRIUM_OUTPUT_DIR=./dist sovrium build          # Or use env variable
 * ```
 *
 * ## Arguments
 * - `config` (optional) - Path to config file (JSON or YAML)
 *
 * ## Environment Variables (start command)
 * - `APP_SCHEMA` (optional if file provided) - App schema (inline JSON, YAML, or remote URL)
 * - `PORT` (optional) - Server port (default: 3000)
 * - `SOVRIUM_BIND_HOST` (optional) - Interface to bind (default: localhost)
 *
 * ## Environment Variables (build command)
 * - `APP_SCHEMA` (optional if file provided) - App schema (inline JSON, YAML, or remote URL)
 * - `SOVRIUM_OUTPUT_DIR` (optional) - Output directory (default: ./dist)
 * - `SOVRIUM_BASE_URL` (optional) - Base URL for sitemap
 * - `SOVRIUM_BASE_PATH` (optional) - Base path for deployments
 * - `SOVRIUM_DEPLOYMENT` (optional) - Deployment type (github-pages | generic)
 * - `SOVRIUM_LANGUAGES` (optional) - Comma-separated language codes
 * - `SOVRIUM_DEFAULT_LANGUAGE` (optional) - Default language
 * - `SOVRIUM_GENERATE_SITEMAP` (optional) - Generate sitemap.xml (true/false)
 * - `SOVRIUM_GENERATE_ROBOTS` (optional) - Generate robots.txt (true/false)
 * - `SOVRIUM_BUNDLE_OPTIMIZATION` (optional) - Bundle optimization strategy
 */

import { parseArgs } from '@/cli/runtime/dispatch'
import { resolveInvocation } from '@/cli/runtime/invocation'
import {
  asyncCommand as lazy,
  lazyProgram,
  runCommandProgram,
  type CommandHandler,
} from '@/cli/runtime/run-command'
import { printLine } from '@/infrastructure/logging/cli-output'

/**
 * Show CLI version (delegates to getCurrentVersion from cli-update module).
 */
const showVersion = async (): Promise<void> => {
  printLine(await (await import('@/cli/commands/update')).getCurrentVersion())
}

/**
 * CLI help text lines (extracted to reduce function body size)
 */
const HELP_TEXT = [
  'Sovrium CLI — configuration-driven application platform',
  '',
  'Usage:',
  '  sovrium <command> [config] [options]',
  '  sovrium [config]              Implicit `start` when the first argument is a config',
  '',
  'Run:',
  '  sovrium start [config]        Start the server (default command)',
  '  sovrium dev [config]          Boot on fresh seed data with a dev account, reload on save',
  '  sovrium stop                  Stop the running server',
  '  sovrium restart [config]      Restart the running server',
  '  sovrium reload                Apply the edited config to the running server',
  '  sovrium build [config]        Build static site files',
  '',
  'Project:',
  '  sovrium init [dir]            Scaffold a new project (in [dir], or cwd)',
  '  sovrium templates             List the templates init can scaffold (--json for tooling)',
  '  sovrium schema                Print JSON Schema to stdout',
  '  sovrium types                 Emit sovrium.d.ts + tsconfig.json for a .ts config',
  '  sovrium client [config]       Write sovrium-client.ts, a typed client for the records API',
  "  sovrium skills                Write this version's agent skills into .claude/skills/",
  '  sovrium validate <config>     Validate a config file against AppSchema',
  '  sovrium render <asset>        Render a template asset offline, with its sample data or yours',
  '  sovrium design-system         Export the design system as a brief, DTCG JSON, a DESIGN.md or a bundle',
  '  sovrium import <file|dir>     Migrate tables, records and automations from another tool',
  '  sovrium docs [address]        Read the platform manual out of this binary',
  '  sovrium changelog [version]   Read the release notes this binary carries',
  '  sovrium licenses              Print the third-party license notices this binary carries',
  '  sovrium report                Print a prefilled issue address to report a problem',
  '  sovrium library <verb>        Browse and install ready-made blocks, connections, recipes',
  '  sovrium seed [config]         Load seed/<table>.yaml data into the tables',
  '  sovrium migrate [config]      Bring the database schema forward, without booting',
  '  sovrium reindex [config]      Rebuild the AI knowledge index from documents and tables',
  '  sovrium bundle [config]       Package the validated config, public/ and seed/ for deployment',
  '  sovrium mcp [--project <dir>] Serve the config read tools to an AI client over stdio',
  '',
  'Operate:',
  '  sovrium admin create <email>  Create an admin user',
  '  sovrium secret generate       Print fresh secrets as .env lines',
  '  sovrium secret adopt          Persist $SOVRIUM_ENCRYPTION_KEY to the data dir',
  '  sovrium signature <verb>      Check a signing evidence export offline (verify)',
  '  sovrium backup [config]       Write database, key, config and uploads to one archive',
  '  sovrium restore <file>        Put a backup back (never over a running server)',
  '  sovrium usage [config]        Print how many bytes the database and stored files hold',
  '  sovrium update                Update to the latest version',
  '  sovrium login                 Sign the CLI in to a Sovrium cloud',
  '  sovrium deploy [config]       Ship the app to your Sovrium cloud, follow it until live',
  '  sovrium preview [config]      Share a preview of the app on your Sovrium cloud',
  '  sovrium env <verb>            Set, list or remove the variables of a hosted app',
  '',
  'Options:',
  '  --help, -h                    Show this help message',
  '  --version, -v                 Show version number',
  '  --watch, -w                   Watch config file and hot reload (start)',
  '  --output <path>               Write to a file (schema, design-system, backup, bundle, client) or dir (types, skills)',
  '  --typescript                  Scaffold a typed app.ts instead of app.yaml (init)',
  '  --format <format>             md (default), json, design-md, llms or bundle (design-system, docs, changelog, licenses)',
  '  --full                        Print the whole manual (docs)',
  '  --list-sections               Print the section slugs and exit (docs)',
  '  --lang <code>                 Manual locale — `en` only (docs)',
  '  --section <slug>              Restrict to one section, repeatable (docs)',
  '  --list                        List every release, newest first (changelog)',
  '  --since <version>             Every release after <version>, breaking first (changelog)',
  '  --template <name>             Bundled template, or <owner>/<repo>[#ref] from GitHub (init)',
  '  --allow-code                  Create a GitHub template that contains code (init)',
  '  --name <name>                 App name (init), display name (admin create)',
  '  --password-stdin | --password <value>   Admin password from stdin, or given (admin create)',
  '  --force                       Overwrite existing files (init, restore), edited skill files (skills)',
  '  --data-dir <dir>              Data directory to restore into (restore)',
  '  --target <name>               claude | agents | all (skills; default: claude)',
  '  --dir <path>                  Seed-file directory (seed; default: <config>/seed)',
  '  --mode <mode>                 if-empty | upsert | replace (seed; default: if-empty)',
  '  --table <name>                Restrict to one table, repeatable (seed)',
  '  --today <YYYY-MM-DD>          The day {{today}} resolves against (seed)',
  '  --dry-run                     Report the plan and write nothing (seed, migrate)',
  '  --check                       Report and write nothing (migrate, skills, client)',
  '  --allow-destructive           Let migrate drop a table still holding rows',
  '  --project <dir>               Directory to read the config from (mcp)',
  '  --kind <kind>                 block | connection | recipe (library list)',
  '  --set <key=value>             Fill an entry parameter, repeatable (library add)',
  '  --as <name>                   Install an entry under another name (library add)',
  '  --as <email>                  Write every seeded row as this account (seed)',
  '  --into <config>               The config to install into (library add)',
  '  --no-wire                     Write the fragment, print the wiring line (library add)',
  '  --tag <group>                 Install one operation group of a provider (library add)',
  '  --all                         Install every operation of a provider (library add)',
  '  --yes                         Confirm without a question (library add --all, deploy, env, seed)',
  '  --limit <n>                   The most results to print (library search)',
  '  --host <url>                  The Sovrium cloud (login, deploy, seed)',
  '  --api-key <key>               Sign in with a key you already have (login)',
  '  --open | --no-open            Open the page in your browser (login, report); skip it (dev)',
  '  --external-database           Let dev use the DATABASE_URL database (dev)',
  '  --status | --logout           Print or end the stored sign-in (login)',
  '  --app <slug>                  The hosted app (deploy, preview, env, seed)',
  '  --remote                      Seed the app this project is linked to (seed)',
  '  --no-wait                     Return once the deployment is recorded (deploy, preview)',
  '  --feature <kind>              config-option | engine-primitive | recipe (report)',
  '  --security                    The private form for a vulnerability (report)',
  '  --last-error                  Report the last failed command again (report)',
  '  --request-id <id>             Report a server error by its request id (report)',
  '  --write | --apply             Write the migration; --apply then seeds it (import)',
  '  --from <tool> | --only <parts> | --prefix <p> | --config <file>   (import; see import --help)',
  '',
  'Environment variables (all optional — Sovrium runs zero-config):',
  '  DATABASE_URL                  Postgres connection (omit → embedded SQLite)',
  '  PORT                          Server port (default: 3000)',
  '  BASE_URL                      Public base URL (default: http://localhost:PORT)',
  '  AUTH_SECRET                   Auth signing secret (default: derived from the root key)',
  '  SOVRIUM_ENCRYPTION_KEY        Root secret (default: generated into <data dir>)',
  '  AI_PROVIDER                   Enable AI: ollama|openai|anthropic|… (default: off)',
  '  STORAGE_PROVIDER              s3|local (default: auto — local files / Postgres)',
  '  ECO_*                         Eco levers (default: performance-first; opt in)',
  '  Full reference: see .env.example or https://sovrium.com/docs/configuration',
  '',
  'Supported config formats: .json, .yaml, .yml, .ts',
  '',
  'Examples:',
  '  sovrium start app.yaml --watch                     # Hot reload on changes',
  '  sovrium build app.json                             # Build static site',
  '  sovrium schema --output app.schema.json            # Write JSON Schema',
  '  sovrium design-system app.ts --format design-md --output DESIGN.md  # For design agents',
  '  sovrium docs search llms                           # Find the article for a topic',
  '  sovrium docs config tables[].fields[].type         # Look one option up',
  '  sovrium changelog --since 0.26.0                   # What changed since an upgrade',
  '  sovrium library add connection/qonto               # Install a ready-made connection',
  '  sovrium types                                      # Types for a .ts config, zero npm',
  '  sovrium skills --target all                        # Skills for Claude Code and other agents',
  '  sovrium init ./my-app --typescript                 # Scaffold a typed app.ts',
  '  sovrium init ./my-app --template blog              # Scaffold from template',
  '  sovrium init ./my-app --template sovrium/crm-template  # Scaffold from a GitHub repo',
  '  sovrium seed app.yaml --mode replace               # Deterministic full refresh',
  '  sovrium import ./contacts.csv --write              # Migrate a CSV export into app.yaml',
  '  sovrium migrate app.yaml                           # Migrate without starting the app',
  '  sovrium admin create me@example.com                # Create an admin (prompts)',
  '  sovrium secret generate                            # Print AUTH_SECRET + key',
  '',
  'For more information, see the documentation at https://sovrium.com/docs/cli',
].join('\n')

/**
 * Show CLI help text
 */
const showHelp = (): void => printLine(HELP_TEXT)

/**
 * Commands that exit after completion (no persistent server)
 *
 * Every handler is imported by the entry that runs it, never at the top of this
 * file: a static import of all of them made every invocation — `--version`, a
 * server start — evaluate every command's graph (the MCP server, backup, the
 * template scaffolder). Literal specifiers keep each one in the compiled binary.
 */
const exitCommands: Readonly<Record<string, CommandHandler>> = {
  stop: lazy(async () => (await import('@/cli/commands/stop')).handleStopCommand()),
  restart: lazy(async (args) =>
    (await import('@/cli/commands/restart')).handleRestartCommand(args.configFile)
  ),
  reload: lazy(async () => (await import('@/cli/commands/reload')).handleReloadCommand()),
  init: lazyProgram(
    () => import('@/cli/commands/init'),
    (module, args) => module.initCommand(args)
  ),
  admin: lazyProgram(
    () => import('@/cli/commands/admin'),
    (module, args) => module.handleAdminCommand(args)
  ),
  // An EXIT command: it reads one export file, prints the report and stops —
  // no server, no database.
  signature: lazyProgram(
    () => import('@/cli/commands/signature'),
    (module, args) => module.handleSignatureCommand(args)
  ),
  secret: lazy(async (args) =>
    (await import('@/cli/commands/secret')).handleSecretCommand(args.subcommand, args.positionalArg)
  ),
  backup: lazyProgram(
    () => import('@/cli/commands/backup'),
    (module, args) =>
      module.handleBackupCommand({ configFile: args.configFile, outputPath: args.outputPath })
  ),
  usage: lazyProgram(
    () => import('@/cli/commands/usage'),
    (module, args) => module.handleUsageCommand(args)
  ),
  bundle: lazy(async (args) =>
    (await import('@/cli/commands/bundle')).handleBundleCommand({
      configFile: args.configFile,
      outputPath: args.outputPath,
    })
  ),
  login: lazyProgram(
    () => import('@/cli/commands/login'),
    (module, args) => module.handleLoginCommand(args)
  ),
  deploy: lazyProgram(
    () => import('@/cli/commands/deploy'),
    (module, args) => module.handleDeployCommand(args)
  ),
  preview: lazyProgram(
    () => import('@/cli/commands/preview'),
    (module, args) => module.handlePreviewCommand(args)
  ),
  env: lazyProgram(
    () => import('@/cli/commands/env'),
    (module, args) => module.handleEnvCommand(args)
  ),
  restore: lazyProgram(
    () => import('@/cli/commands/restore'),
    (module, args) => module.restoreCommand(args)
  ),
  update: lazyProgram(
    () => import('@/cli/commands/update'),
    (module, args) => module.handleUpdateCommand(args)
  ),
  // An EXIT command, not a persistent one: it brings the schema forward and
  // stops. A platform release phase waits on the exit code.
  migrate: lazyProgram(
    () => import('@/cli/commands/migrate'),
    (module, args) => module.migrateCommand(args)
  ),
  // An EXIT command: it rebuilds the AI knowledge index and stops.
  reindex: lazyProgram(
    () => import('@/cli/commands/reindex'),
    (module, args) => module.handleReindexCommand(args)
  ),
  // An EXIT command, not a persistent one. It looks like a server and is not:
  // it binds no port and owns no lifetime of its own — the CLIENT owns the
  // lifetime, and the verb ends when that client closes the pipe. Exiting 0 on
  // EOF is what makes "the client quit" a success rather than a crash.
  mcp: lazyProgram(
    () => import('@/cli/commands/mcp'),
    (module, args) => module.mcpCommand(args)
  ),
  changelog: lazyProgram(
    () => import('@/cli/commands/changelog'),
    (module, args) => module.changelogCommand(args)
  ),
  // An EXIT command: a migration converts files once and stops; only `--apply`
  // opens the database, through the seed path, and it closes with the run.
  import: lazyProgram(
    () => import('@/cli/commands/import'),
    (module, args) => module.handleImportCommand(args)
  ),
  // An EXIT command: it renders one template and stops — no server, no database.
  render: lazyProgram(
    () => import('@/cli/commands/render'),
    (module, args) => module.handleRenderCommand(args)
  ),
  report: lazyProgram(
    () => import('@/cli/commands/report'),
    (module, args) => module.handleReportCommand(args)
  ),
  // An EXIT command: it prints the embedded template catalogue and stops.
  templates: lazyProgram(
    () => import('@/cli/commands/templates'),
    (module, args) => module.handleTemplatesCommand(args)
  ),
  licenses: lazy(async (args) =>
    (await import('@/cli/commands/licenses')).handleLicensesCommand({
      format: args.format,
      outputPath: args.outputPath,
    })
  ),
  // An EXIT command: the exit is explicit because a database connection can
  // outlive the last write and keep the process alive.
  seed: lazyProgram(
    () => import('@/cli/commands/seed'),
    (module, args) => module.handleSeedCommand(args)
  ),
  '--version': lazy(async () => showVersion()),
  version: lazy(async () => showVersion()),
  '--help': lazy(async () => showHelp()),
  help: lazy(async () => showHelp()),
}

/**
 * Commands that may keep the process alive (server mode)
 */
const persistentCommands: Readonly<Record<string, CommandHandler>> = {
  start: lazy(async (args) =>
    (await import('@/cli/commands/start')).handleStartCommand(
      args.configFile,
      args.watchMode,
      args.publicDir,
      args.helpRequested ?? false
    )
  ),
  dev: lazyProgram(
    () => import('@/cli/commands/dev'),
    (module, args) => module.handleDevCommand(args)
  ),
  build: lazy(async (args) =>
    (await import('@/cli/commands/build')).handleBuildCommand(args.configFile, args.publicDir)
  ),
  schema: lazy(async (args) =>
    (await import('@/cli/commands/schema')).handleSchemaCommand(args.outputPath)
  ),
  client: lazyProgram(
    () => import('@/cli/commands/client'),
    (module, args) => module.clientCommand(args)
  ),
  types: lazy(async (args) =>
    (await import('@/cli/commands/types')).handleTypesCommand({ outputDir: args.outputPath })
  ),
  skills: lazyProgram(
    () => import('@/cli/commands/skills'),
    (module, args) => module.skillsCommand(args)
  ),
  validate: lazy(async (args) =>
    (await import('@/cli/commands/validate')).handleValidateCommand(args.configFile, args.json)
  ),
  'design-system': (args) =>
    args.positionalArgs?.[0] === 'import'
      ? lazyProgram(
          () => import('@/cli/commands/design-system/import'),
          (module, importArgs) => module.handleDesignSystemImportCommand(importArgs)
        )(args)
      : lazyProgram(
          () => import('@/cli/commands/design-system'),
          (module, exportArgs) => module.handleDesignSystemCommand(exportArgs)
        )(args),
  docs: lazyProgram(
    () => import('@/cli/commands/docs'),
    (module, args) => module.docsCommand(args)
  ),
  library: lazyProgram(
    () => import('@/cli/commands/library/command'),
    (module, args) => module.libraryCommand(args)
  ),
}

// Main CLI entry point. The one place a command's outcome becomes an exit
// code is `cli/runtime/run-command.ts`; what this invocation runs is decided
// by `cli/runtime/invocation.ts`, from the two tables above.
const rawArgs = Bun.argv.slice(2)
const parsed = parseArgs(rawArgs)
const invocation = resolveInvocation({ parsed, argv: rawArgs, exitCommands, persistentCommands })
void runCommandProgram(invocation.program, {
  command: parsed.command,
  exitOnSuccess: invocation.exitOnSuccess,
})
