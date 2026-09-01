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
 * - `HOSTNAME` (optional) - Server hostname (default: localhost)
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
 * - `SOVRIUM_HYDRATION` (optional) - Enable client-side hydration (true/false)
 * - `SOVRIUM_GENERATE_MANIFEST` (optional) - Generate manifest.json (true/false)
 * - `SOVRIUM_BUNDLE_OPTIMIZATION` (optional) - Bundle optimization strategy
 */

import { Effect, Console } from 'effect'
import { handleAdminCommand } from '@/cli/admin'
import { getCommandHelp } from '@/cli/command-help'
import { handleBuildCommand } from '@/cli/commands/build'
import { handleDesignSystemCommand } from '@/cli/commands/design-system'
import { handleInitCommand } from '@/cli/commands/init'
import { handleMigrateCommand } from '@/cli/commands/migrate'
import { handleReloadCommand } from '@/cli/commands/reload'
import { handleRestartCommand } from '@/cli/commands/restart'
import { handleSchemaCommand } from '@/cli/commands/schema'
import { handleSeedCommand } from '@/cli/commands/seed'
import { handleStartCommand } from '@/cli/commands/start'
import { handleStopCommand } from '@/cli/commands/stop'
import { handleTypesCommand } from '@/cli/commands/types'
import { handleValidateCommand } from '@/cli/commands/validate'
import { findUnknownFlag, parseArgs } from '@/cli/dispatch'
import { handleSecretCommand } from '@/cli/secret'
import { getCurrentVersion, handleUpdateCommand } from '@/cli/update'
import { printFailure } from '@/infrastructure/logging/cli-output'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'

/**
 * Show CLI version (delegates to getCurrentVersion from cli-update module).
 */
const showVersion = async (): Promise<void> => {
  const version = await getCurrentVersion()
  Effect.runSync(Console.log(version))
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
  '  sovrium stop                  Stop the running server',
  '  sovrium restart [config]      Restart the running server',
  '  sovrium reload                Hot-reload config without downtime',
  '  sovrium build [config]        Build static site files',
  '',
  'Project:',
  '  sovrium init [dir]            Scaffold a new project (in [dir], or cwd)',
  '  sovrium schema                Print JSON Schema to stdout',
  '  sovrium types                 Emit sovrium.d.ts + tsconfig.json for a .ts config',
  '  sovrium validate <config>     Validate a config file against AppSchema',
  '  sovrium design-system         Export the design system as an agent brief or DTCG JSON',
  '  sovrium seed [config]         Load seed/<table>.yaml data into the tables',
  '  sovrium migrate [config]      Bring the database schema forward, without booting',
  '',
  'Operate:',
  '  sovrium admin create <email>  Create an admin user',
  '  sovrium secret generate       Print fresh secrets as .env lines',
  '  sovrium secret adopt          Persist $SOVRIUM_ENCRYPTION_KEY to the data dir',
  '  sovrium update                Update to the latest version',
  '',
  'Options:',
  '  --help, -h                    Show this help message',
  '  --version, -v                 Show version number',
  '  --watch, -w                   Watch config file and hot reload (start)',
  '  --output <path>               Write to a file (schema, design-system) or dir (types)',
  '  --typescript                  Scaffold a typed app.ts instead of app.yaml (init)',
  '  --format <md|json>            Export format (design-system; default: md)',
  '  --template <name>             Bundled template, or <owner>/<repo>[#ref] from GitHub (init)',
  '  --name <name>                 App name (init)',
  '  --password <value>            Admin password (admin create; else prompted)',
  '  --force                       Overwrite existing files (init)',
  '  --dir <path>                  Seed-file directory (seed; default: <config>/seed)',
  '  --mode <mode>                 if-empty | upsert | replace (seed; default: if-empty)',
  '  --table <name>                Restrict to one table, repeatable (seed)',
  '  --dry-run                     Report the plan and write nothing (seed, migrate)',
  '  --check                       Report whether the database is safe to migrate (migrate)',
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
  '  sovrium design-system app.ts --output DESIGN.md    # Brief an agent can read',
  '  sovrium types                                      # Types for a .ts config, zero npm',
  '  sovrium init ./my-app --typescript                 # Scaffold a typed app.ts',
  '  sovrium init ./my-app --template blog              # Scaffold from template',
  '  sovrium init ./my-app --template sovrium/crm-template  # Scaffold from a GitHub repo',
  '  sovrium seed app.yaml --mode replace               # Deterministic full refresh',
  '  sovrium migrate app.yaml                           # Migrate without starting the app',
  '  sovrium admin create me@example.com                # Create an admin (prompts)',
  '  sovrium secret generate                            # Print AUTH_SECRET + key',
  '',
  'For more information, see the documentation at https://sovrium.com/docs/cli',
].join('\n')

/**
 * Show CLI help text
 */
const showHelp = (): void => {
  Effect.runSync(Console.log(HELP_TEXT))
}

/**
 * Commands that exit after completion (no persistent server)
 */
const exitCommands: Readonly<Record<string, () => Promise<void>>> = {
  stop: async () => handleStopCommand(),
  restart: async () => handleRestartCommand(parsed.configFile),
  reload: async () => handleReloadCommand(rawArgs),
  init: async () =>
    handleInitCommand({
      templateName: parsed.templateName,
      outputDir: parsed.outputPath,
      positionalDir: parsed.configFile,
      forceFlag: parsed.forceFlag,
      appName: parsed.appName,
      typescript: parsed.typescript ?? false,
    }),
  admin: async () =>
    handleAdminCommand(parsed.subcommand, parsed.positionalArg, {
      configFile: parsed.configFile,
      password: parsed.password,
    }),
  secret: async () => handleSecretCommand(parsed.subcommand, parsed.positionalArg),
  update: async () => handleUpdateCommand({ helpRequested: parsed.helpRequested ?? false }),
  // An EXIT command, not a persistent one: it brings the schema forward and
  // stops. A platform release phase waits on the exit code.
  migrate: async () =>
    handleMigrateCommand({
      configFile: parsed.configFile,
      dryRun: parsed.dryRun ?? false,
      check: parsed.check ?? false,
    }),
  '--version': async () => showVersion(),
  version: async () => showVersion(),
  '--help': async () => showHelp(),
  help: async () => showHelp(),
}

/**
 * Commands that may keep the process alive (server mode)
 */
const persistentCommands: Readonly<Record<string, () => Promise<void>>> = {
  start: async () =>
    handleStartCommand(
      parsed.configFile,
      parsed.watchMode,
      parsed.publicDir,
      parsed.helpRequested ?? false
    ),
  build: async () => handleBuildCommand(parsed.configFile, parsed.publicDir),
  schema: async () => handleSchemaCommand(parsed.outputPath),
  types: async () => handleTypesCommand({ outputDir: parsed.outputPath }),
  validate: async () => handleValidateCommand(parsed.configFile),
  'design-system': async () =>
    handleDesignSystemCommand({
      configFile: parsed.configFile,
      outputPath: parsed.outputPath,
      format: parsed.format,
    }),
  seed: async () =>
    handleSeedCommand({
      configFile: parsed.configFile,
      seedDir: parsed.seedDir,
      mode: parsed.seedMode,
      tables: parsed.seedTables ?? [],
      dryRun: parsed.dryRun ?? false,
    }),
}

// Main CLI entry point
const rawArgs = Bun.argv.slice(2)
const parsed = parseArgs(rawArgs)

/**
 * Answer `<command> --help` and exit 0, BEFORE either dispatch table runs.
 *
 * `--help` used to be opt-in per command, and only `start` and `update` opted
 * in — so `schema --help` dumped the whole JSON Schema, `stop --help` stopped a
 * live server, and `init --help` scaffolded a project into the working
 * directory, overwriting an existing `CLAUDE.md`. Asking a command what its
 * options are must never be the thing that runs it.
 *
 * Centralising the lookup (rather than threading a flag into each handler) is
 * what makes the behaviour hold for commands not yet written: a new command
 * inherits `--help` by appearing in `COMMAND_HELP`.
 *
 * @returns `true` when help was printed and the process is exiting.
 */
const showCommandHelpIfRequested = (): boolean => {
  const commandHelp = parsed.helpRequested === true ? getCommandHelp(parsed.command) : undefined
  if (commandHelp === undefined) return false
  Effect.runSync(Console.log(commandHelp))
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(0)
  return true
}

/**
 * Reject unknown flags BEFORE dispatching — otherwise `--definitely-not-a-flag`
 * silently falls through to implicit `start` and the user gets a misleading
 * "No configuration provided" message instead of "Unknown flag: --foo".
 * Skipped when `--help` / `--version` short-circuits (early exit already accepted).
 */
const rejectUnknownFlag = (): void => {
  if (parsed.command === '--help' || parsed.command === '--version') return
  const unknownFlag = findUnknownFlag(rawArgs)
  if (unknownFlag === undefined) return

  printFailure({
    headline: `Unknown flag "${unknownFlag}".`,
    guidance: "Run 'sovrium --help' to list the accepted flags.",
  })
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
}

const runCommand = async (): Promise<void> => {
  rejectUnknownFlag()

  // Answered ahead of BOTH dispatch tables — see `showCommandHelpIfRequested`.
  if (showCommandHelpIfRequested()) return

  const exitHandler = exitCommands[parsed.command]
  if (exitHandler) {
    // eslint-disable-next-line functional/no-expression-statements -- CLI command execution requires side effects
    await exitHandler()
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(0)
    return
  }

  const persistentHandler = persistentCommands[parsed.command]
  if (persistentHandler) {
    // eslint-disable-next-line functional/no-expression-statements -- CLI command execution requires side effects
    await persistentHandler()
    return
  }

  // Unknown command. This used to fall through to an implicit `start` with no
  // config, which was survivable only because that path then errored on "No
  // configuration provided". Auto-discovery removes that accidental backstop:
  // in a directory holding an `app.yaml`, `sovrium strt` would silently BOOT A
  // SERVER. So an unknown word is now reported as a typo, exactly as an unknown
  // *flag* already is above.
  //
  // Still reaching their handlers, and not this branch: bare `sovrium` (parseArgs
  // defaults the command to `start`) and `sovrium ./app.yaml` (isConfigFile
  // rewrites it to `start` with a configFile).
  printFailure({
    headline: `Unknown command "${parsed.command}".`,
    guidance: "Run 'sovrium --help' to list the available commands.",
  })
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
}

runCommand().catch((error: unknown) => {
  // formatRuntimeError unwraps Effect FiberFailure / Cause / ParseError /
  // TaggedError into actionable diagnostics. Without it, schema decode
  // failures and most Effect-thrown errors surface as "An error has occurred"
  // — see commit 68b20a5af for the full motivation.
  // NOTE: this headline is a CRASH marker and nothing else — it means Sovrium
  // reached a failure it has no specific handling for. A rejected config never
  // arrives here: `commands/start.ts` routes refusals through
  // `formatConfigRejection` and exits 1 before this catch. Nothing keys on the
  // wording any more; the E2E fixture decides
  // whether to retry a boot from an allow-list of transient signatures, and
  // the refusal side of that boundary is pinned by
  // `commands/start.test.ts` rather than by a string match here.
  const message = formatRuntimeError(error)

  printFailure({
    headline: 'Unexpected failure — Sovrium changed nothing.',
    detail: [message],
    guidance:
      'If this looks like a bug, report it at\n' +
      '  https://github.com/sovrium/sovrium/issues/new',
  })
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
})
