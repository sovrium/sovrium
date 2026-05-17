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
import { handleAgentsCommand } from '@/cli/agents'
import { handleBuildCommand } from '@/cli/commands/build'
import { handleInitCommand } from '@/cli/commands/init'
import { handleReloadCommand } from '@/cli/commands/reload'
import { handleRestartCommand } from '@/cli/commands/restart'
import { handleSchemaCommand } from '@/cli/commands/schema'
import { handleStartCommand } from '@/cli/commands/start'
import { handleStopCommand } from '@/cli/commands/stop'
import { handleValidateCommand } from '@/cli/commands/validate'
import { parseArgs } from '@/cli/dispatch'
import { getCurrentVersion, handleUpdateCommand } from '@/cli/update'
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
  'Sovrium CLI',
  '',
  'Commands:',
  '  sovrium start <config>        Start a development server (default)',
  '  sovrium build <config>        Build static site files',
  '  sovrium schema                Print JSON Schema to stdout',
  '  sovrium validate <config>     Validate a config file against AppSchema',
  '  sovrium init --template <t>   Scaffold a new project from a template',
  '  sovrium agents list           List available agent templates',
  '  sovrium update                Update to the latest version',
  '  sovrium --help                Show this help message',
  '  sovrium --version             Show version number',
  '',
  'Options:',
  '  --help, -h                    Show this help message',
  '  --version, -v                 Show version number',
  '  --watch, -w                   Watch config file for changes and hot reload',
  '  --output <path>               Write schema to file (schema command only)',
  '',
  'Supported config formats: .json, .yaml, .yml, .ts',
  '',
  'Examples:',
  '  sovrium start app.json                             # Start dev server',
  '  sovrium start app.yaml --watch                     # Hot reload on changes',
  '  sovrium start app.ts                               # TypeScript config',
  '  sovrium build app.json                             # Build static site',
  '  sovrium schema --output app.schema.json            # Write JSON Schema',
  '  sovrium validate app.yaml                          # Validate config',
  '  sovrium init --template blog --output ./my-app     # Scaffold project',
  '  sovrium agents list                                # List agent templates',
  '  sovrium update                                     # Update binary',
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
  reload: async () => handleReloadCommand(),
  init: async () =>
    handleInitCommand({
      templateName: parsed.templateName,
      outputDir: parsed.outputPath,
      positionalDir: parsed.configFile,
      forceFlag: parsed.forceFlag,
      appName: parsed.appName,
    }),
  agents: async () =>
    handleAgentsCommand(parsed.subcommand, parsed.agentName, parsed.targetPath, parsed.forceFlag),
  update: async () => handleUpdateCommand(),
  '--version': async () => showVersion(),
  version: async () => showVersion(),
  '--help': async () => showHelp(),
  help: async () => showHelp(),
}

/**
 * Commands that may keep the process alive (server mode)
 */
const persistentCommands: Readonly<Record<string, () => Promise<void>>> = {
  start: async () => handleStartCommand(parsed.configFile, parsed.watchMode),
  build: async () => handleBuildCommand(parsed.configFile, parsed.publicDir),
  schema: async () => handleSchemaCommand(parsed.outputPath),
  validate: async () => handleValidateCommand(parsed.configFile),
}

// Main CLI entry point
const parsed = parseArgs(Bun.argv.slice(2))

const runCommand = async (): Promise<void> => {
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

  // Unknown command — try as implicit start or show error
  if (!parsed.command.startsWith('-')) {
    // eslint-disable-next-line functional/no-expression-statements -- CLI command execution requires side effects
    await handleStartCommand(undefined, parsed.watchMode)
  } else {
    Effect.runSync(Console.error(`Error: Unknown command "${parsed.command}"\n`))
    showHelp()
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }
}

runCommand().catch((error: unknown) => {
  // formatRuntimeError unwraps Effect FiberFailure / Cause / ParseError /
  // TaggedError into actionable diagnostics. Without it, schema decode
  // failures and most Effect-thrown errors surface as "An error has occurred"
  // — see commit 68b20a5af for the full motivation.
  const message = formatRuntimeError(error)
  Effect.runSync(
    Console.error(
      `\nUnexpected error:\n  ${message}\n\nIf this looks like a bug, please open an issue:\n  https://github.com/sovrium/sovrium/issues/new\n`
    )
  )
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
})
