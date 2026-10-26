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

import { Effect, Console } from 'effect'
import { getCommandHelp } from '@/cli/runtime/command-help'
import { parseArgs } from '@/cli/runtime/dispatch'
import { failIfCrashInjected } from '@/cli/runtime/fault-injection'
import { findUnknownFlag, getFlagValue, getFlagValues } from '@/cli/runtime/flag-vocabulary'
import { printFailure } from '@/infrastructure/logging/cli-output'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'

/**
 * Show CLI version (delegates to getCurrentVersion from cli-update module).
 */
const showVersion = async (): Promise<void> => {
  const version = await (await import('@/cli/commands/update')).getCurrentVersion()
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
  "  sovrium skills                Write this version's agent skills into .claude/skills/",
  '  sovrium validate <config>     Validate a config file against AppSchema',
  '  sovrium render <asset>        Render a template asset offline, with its sample data or yours',
  '  sovrium design-system         Export the design system as a brief, DTCG JSON or a bundle (--pages)',
  '  sovrium import <file|dir>     Migrate tables, records and automations from another tool',
  '  sovrium docs [address]        Read the platform manual out of this binary',
  '  sovrium changelog [version]   Read the release notes this binary carries',
  '  sovrium licenses              Print the third-party license notices this binary carries',
  '  sovrium report                Print a prefilled issue address to report a problem',
  '  sovrium library <verb>        Browse and install ready-made blocks, connections, recipes',
  '  sovrium seed [config]         Load seed/<table>.yaml data into the tables',
  '  sovrium migrate [config]      Bring the database schema forward, without booting',
  '  sovrium bundle [config]       Package the validated config, public/ and seed/ for deployment',
  '  sovrium mcp [--project <dir>] Serve the config read tools to an AI client over stdio',
  '',
  'Operate:',
  '  sovrium admin create <email>  Create an admin user',
  '  sovrium secret generate       Print fresh secrets as .env lines',
  '  sovrium secret adopt          Persist $SOVRIUM_ENCRYPTION_KEY to the data dir',
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
  '  --output <path>               Write to a file (schema, design-system, backup, bundle) or dir (types, skills)',
  '  --typescript                  Scaffold a typed app.ts instead of app.yaml (init)',
  '  --format <format>             md (default), json, llms or bundle (design-system, docs, changelog, licenses)',
  '  --full                        Print the whole manual (docs)',
  '  --list-sections               Print the section slugs and exit (docs)',
  '  --lang <code>                 Manual locale — `en` only (docs)',
  '  --section <slug>              Restrict to one section, repeatable (docs)',
  '  --list                        List every release, newest first (changelog)',
  '  --since <version>             Every release after <version>, breaking first (changelog)',
  '  --template <name>             Bundled template, or <owner>/<repo>[#ref] from GitHub (init)',
  '  --name <name>                 App name (init), display name (admin create)',
  '  --password <value>            Admin password (admin create; else prompted)',
  '  --force                       Overwrite existing files (init, restore), edited skill files (skills)',
  '  --data-dir <dir>              Data directory to restore into (restore)',
  '  --target <name>               claude | agents | all (skills; default: claude)',
  '  --dir <path>                  Seed-file directory (seed; default: <config>/seed)',
  '  --mode <mode>                 if-empty | upsert | replace (seed; default: if-empty)',
  '  --table <name>                Restrict to one table, repeatable (seed)',
  '  --today <YYYY-MM-DD>          The day {{today}} resolves against (seed)',
  '  --dry-run                     Report the plan and write nothing (seed, migrate)',
  '  --check                       Report and write nothing (migrate, skills)',
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
  '  sovrium design-system app.ts --output DESIGN.md    # Brief an agent can read',
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
const showHelp = (): void => {
  Effect.runSync(Console.log(HELP_TEXT))
}

/** What `deploy` and `preview` read: the config, and the whole command line. */
const shipOptions = () => ({ configFile: parsed.configFile, argv: rawArgs })

/**
 * Commands that exit after completion (no persistent server)
 *
 * Every handler is imported by the entry that runs it, never at the top of this
 * file: a static import of all of them made every invocation — `--version`, a
 * server start — evaluate every command's graph (the MCP server, backup, the
 * template scaffolder). Literal specifiers keep each one in the compiled binary.
 */
const exitCommands: Readonly<Record<string, () => Promise<void>>> = {
  stop: async () => (await import('@/cli/commands/stop')).handleStopCommand(),
  restart: async () =>
    (await import('@/cli/commands/restart')).handleRestartCommand(parsed.configFile),
  reload: async () => (await import('@/cli/commands/reload')).handleReloadCommand(),
  init: async () =>
    parsed.fromBundle !== undefined
      ? (await import('@/cli/commands/init-from-bundle')).handleInitFromBundle({
          ...parsed,
          source: parsed.fromBundle,
          targetDir: parsed.configFile ?? parsed.outputPath,
        })
      : (await import('@/cli/commands/init')).handleInitCommand({
          templateName: parsed.templateName,
          outputDir: parsed.outputPath,
          positionalDir: parsed.configFile,
          forceFlag: parsed.forceFlag,
          appName: parsed.appName,
          typescript: parsed.typescript ?? false,
          gitInit: parsed.gitInit ?? false,
          fromUrl: parsed.fromUrl,
        }),
  admin: async () =>
    (await import('@/cli/commands/admin')).handleAdminCommand(
      parsed.subcommand,
      parsed.positionalArg,
      {
        configFile: parsed.configFile,
        password: parsed.password,
        name: parsed.appName,
      }
    ),
  secret: async () =>
    (await import('@/cli/commands/secret')).handleSecretCommand(
      parsed.subcommand,
      parsed.positionalArg
    ),
  backup: async () =>
    (await import('@/cli/commands/backup')).handleBackupCommand({
      configFile: parsed.configFile,
      outputPath: parsed.outputPath,
    }),
  usage: async () =>
    (await import('@/cli/commands/usage')).handleUsageCommand(parsed.configFile, rawArgs),
  bundle: async () =>
    (await import('@/cli/commands/bundle')).handleBundleCommand({
      configFile: parsed.configFile,
      outputPath: parsed.outputPath,
    }),
  login: async () => (await import('@/cli/commands/login')).handleLoginCommand(rawArgs),
  deploy: async () => (await import('@/cli/commands/deploy')).handleDeployCommand(shipOptions()),
  preview: async () => (await import('@/cli/commands/preview')).handlePreviewCommand(shipOptions()),
  env: async () =>
    (await import('@/cli/commands/env')).handleEnvCommand({
      args: parsed.positionalArgs ?? [],
      argv: rawArgs,
    }),
  restore: async () =>
    (await import('@/cli/commands/restore')).handleRestoreCommand({
      archivePath: parsed.configFile,
      dataDir: parsed.dataDir,
      force: parsed.forceFlag,
    }),
  update: async () =>
    (await import('@/cli/commands/update')).handleUpdateCommand({
      helpRequested: parsed.helpRequested ?? false,
      insecureSkipChecksum: rawArgs.includes('--insecure-skip-checksum'),
    }),
  // An EXIT command, not a persistent one: it brings the schema forward and
  // stops. A platform release phase waits on the exit code.
  migrate: async () =>
    (await import('@/cli/commands/migrate')).handleMigrateCommand({
      configFile: parsed.configFile,
      dryRun: parsed.dryRun ?? false,
      check: parsed.check ?? false,
      allowDestructive: parsed.allowDestructive ?? false,
    }),
  // An EXIT command, not a persistent one. It looks like a server and is not:
  // it binds no port and owns no lifetime of its own — the CLIENT owns the
  // lifetime, and the verb ends when that client closes the pipe. Exiting 0 on
  // EOF is what makes "the client quit" a success rather than a crash.
  mcp: async () =>
    (await import('@/cli/commands/mcp')).handleMcpCommand({ projectDir: parsed.projectDir }),
  changelog: async () =>
    (await import('@/cli/commands/changelog')).handleChangelogCommand({
      args: parsed.positionalArgs ?? [],
      format: parsed.format,
      outputPath: parsed.outputPath,
      list: parsed.changelogList ?? false,
      sinceRequested: parsed.changelogSinceRequested ?? false,
      since: parsed.changelogSince,
    }),
  // An EXIT command: a migration converts files once and stops; only `--apply`
  // opens the database, through the seed path, and it closes with the run.
  import: async () =>
    (await import('@/cli/commands/import')).handleImportCommand(
      rawArgs,
      parsed.positionalArgs ?? []
    ),
  // An EXIT command: it renders one template and stops — no server, no database.
  render: async () => (await import('@/cli/commands/render')).handleRenderCommand(rawArgs),
  report: async () => (await import('@/cli/commands/report')).handleReportCommand(rawArgs),
  // An EXIT command: it prints the embedded template catalogue and stops.
  templates: async () => (await import('@/cli/commands/templates')).handleTemplatesCommand(parsed),
  licenses: async () =>
    (await import('@/cli/commands/licenses')).handleLicensesCommand({
      format: parsed.format,
      outputPath: parsed.outputPath,
    }),
  '--version': async () => showVersion(),
  version: async () => showVersion(),
  '--help': async () => showHelp(),
  help: async () => showHelp(),
}

/**
 * Commands that may keep the process alive (server mode)
 */
const persistentCommands: Readonly<Record<string, () => Promise<unknown>>> = {
  start: async () =>
    (await import('@/cli/commands/start')).handleStartCommand(
      parsed.configFile,
      parsed.watchMode,
      parsed.publicDir,
      parsed.helpRequested ?? false
    ),
  dev: async () => (await import('@/cli/commands/dev')).handleDevCommand(parsed, rawArgs),
  build: async () =>
    (await import('@/cli/commands/build')).handleBuildCommand(parsed.configFile, parsed.publicDir),
  schema: async () =>
    (await import('@/cli/commands/schema')).handleSchemaCommand(parsed.outputPath),
  types: async () =>
    (await import('@/cli/commands/types')).handleTypesCommand({ outputDir: parsed.outputPath }),
  skills: async () =>
    (await import('@/cli/commands/skills')).handleSkillsCommand({
      outputDir: parsed.outputPath,
      target: parsed.skillsTarget,
      check: parsed.check ?? false,
      force: parsed.forceFlag,
    }),
  validate: async () =>
    (await import('@/cli/commands/validate')).handleValidateCommand(parsed.configFile, parsed.json),
  'design-system': async () =>
    parsed.positionalArgs?.[0] === 'import'
      ? (await import('@/cli/commands/design-system-import')).handleDesignSystemImportCommand(
          rawArgs,
          parsed.positionalArgs
        )
      : (await import('@/cli/commands/design-system')).handleDesignSystemCommand({
          // `--seed` is a switch to `deploy`, so its folder is read among the positionals.
          configFile: (parsed.positionalArgs ?? []).find(
            (arg) => arg !== getFlagValue(rawArgs, '--seed')
          ),
          outputPath: parsed.outputPath,
          format: parsed.format,
          mode: parsed.mode,
          force: parsed.forceFlag,
          pages: rawArgs.includes('--pages'),
          pageNames: getFlagValues(rawArgs, '--page'),
          argv: rawArgs,
        }),
  docs: async () =>
    (await import('@/cli/commands/docs')).handleDocsCommand({
      args: parsed.positionalArgs ?? [],
      format: parsed.format,
      lang: parsed.lang,
      outputPath: parsed.outputPath,
      full: parsed.full ?? false,
      listSections: parsed.listSections ?? false,
      sections: parsed.docsSections ?? [],
      exportRequested: parsed.exportRequested ?? false,
      exportDir: parsed.exportDir,
      force: parsed.forceFlag,
    }),
  library: async () =>
    (await import('@/cli/commands/library')).handleLibraryCommand({
      args: parsed.positionalArgs ?? [],
      kind: parsed.libraryKind,
      category: parsed.libraryCategory,
      format: parsed.format,
      sets: parsed.librarySets ?? [],
      as: parsed.libraryAs,
      into: parsed.libraryInto,
      dryRun: parsed.dryRun ?? false,
      noWire: parsed.noWire ?? false,
      tag: parsed.libraryTag,
      limit: parsed.libraryLimit,
      all: parsed.libraryAll ?? false,
      yes: parsed.libraryYes ?? false,
      update: parsed.libraryUpdate ?? false,
    }),
  seed: async () =>
    (await import('@/cli/commands/seed')).handleSeedCommand({
      configFile: parsed.configFile,
      seedDir: parsed.seedDir,
      mode: parsed.mode,
      tables: parsed.seedTables ?? [],
      dryRun: parsed.dryRun ?? false,
      as: parsed.seedAs,
      today: parsed.seedToday,
      argv: rawArgs,
    }),
}

// Main CLI entry point
const rawArgs = Bun.argv.slice(2)
const parsed = parseArgs(rawArgs)

/**
 * Answer `<command> --help` and exit 0, BEFORE either dispatch table runs.
 *
 * If `--help` were opt-in per command, a command that forgot to opt in would
 * simply run — `schema --help` dumping the whole JSON Schema, `stop --help`
 * stopping a live server, `init --help` scaffolding a project into the working
 * directory and overwriting an existing `CLAUDE.md`. Asking a command what its
 * options are must never be the thing that runs it.
 *
 * Centralising the lookup (rather than threading a flag into each handler) is
 * what makes the behaviour hold for commands not yet written: a new command
 * inherits `--help` by appearing in `COMMAND_HELP`.
 *
 * @returns `true` when help was printed and the process is exiting.
 */
const showCommandHelpIfRequested = (): boolean => {
  const commandHelp =
    parsed.helpRequested === true ? getCommandHelp(parsed.command, parsed.subcommand) : undefined
  if (commandHelp === undefined) return false
  Effect.runSync(Console.log(commandHelp))
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
  // `import` refuses a token on the command line itself, naming the variable to use.
  if (parsed.command === 'import' && /^--token(?:=|$)/.test(unknownFlag)) return

  printFailure({
    headline: `Unknown flag "${unknownFlag}".`,
    guidance: "Run 'sovrium --help' to list the accepted flags.",
  })
  process.exit(1)
}

const runCommand = async (): Promise<void> => {
  // The E2E harness's generic-stylesheet seam, ahead of everything else: it
  // ignores the command line. Not a capability — see the module's docblock.
  const genericCssPath = process.env['SOVRIUM_E2E_PRECOMPILE_CSS']
  if (genericCssPath) {
    await (
      await import('@/cli/runtime/precompile-generic-css')
    ).handlePrecompileGenericCss(genericCssPath)
    return
  }

  rejectUnknownFlag()

  // Answered ahead of BOTH dispatch tables — see `showCommandHelpIfRequested`.
  if (showCommandHelpIfRequested()) return

  // The non-production `SOVRIUM_FAULT_INJECTION=crash` seam: a failure before
  // the named command runs, which only the crash handler below catches.
  await failIfCrashInjected(parsed.command)

  const exitHandler = exitCommands[parsed.command]
  if (exitHandler) {
    await exitHandler()
    process.exit(0)
    return
  }

  const persistentHandler = persistentCommands[parsed.command]
  if (persistentHandler) {
    await persistentHandler()
    return
  }

  // Unknown command. It does not fall through to an implicit `start`: with
  // config auto-discovery, in a directory holding an `app.yaml`, `sovrium strt`
  // would silently BOOT A SERVER. So an unknown word is reported as a typo,
  // exactly as an unknown *flag* already is above.
  //
  // Still reaching their handlers, and not this branch: bare `sovrium` (parseArgs
  // defaults the command to `start`) and `sovrium ./app.yaml` (isConfigFile
  // rewrites it to `start` with a configFile).
  printFailure({
    headline: `Unknown command "${parsed.command}".`,
    guidance: "Run 'sovrium --help' to list the available commands.",
  })
  process.exit(1)
}

runCommand().catch(async (error: unknown) => {
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
  const { offerFailureReport, withoutSecretValues } = await import('@/cli/runtime/failure-report')

  printFailure({
    headline: 'Unexpected failure — Sovrium changed nothing.',
    detail: [withoutSecretValues(message)],
    guidance: offerFailureReport({ command: parsed.command, error, text: message }),
  })
  process.exit(1)
})
