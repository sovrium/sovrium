#!/usr/bin/env bun
/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

const showVersion = async (): Promise<void> => {
  const version = await getCurrentVersion()
  Effect.runSync(Console.log(version))
}

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

const showHelp = (): void => {
  Effect.runSync(Console.log(HELP_TEXT))
}

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

const persistentCommands: Readonly<Record<string, () => Promise<void>>> = {
  start: async () => handleStartCommand(parsed.configFile, parsed.watchMode),
  build: async () => handleBuildCommand(parsed.configFile, parsed.publicDir),
  schema: async () => handleSchemaCommand(parsed.outputPath),
  validate: async () => handleValidateCommand(parsed.configFile),
}

const parsed = parseArgs(Bun.argv.slice(2))

const runCommand = async (): Promise<void> => {
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

  if (!parsed.command.startsWith('-')) {
    await handleStartCommand(undefined, parsed.watchMode)
  } else {
    Effect.runSync(Console.error(`Error: Unknown command "${parsed.command}"\n`))
    showHelp()
    process.exit(1)
  }
}

runCommand().catch((error: unknown) => {
  const message = formatRuntimeError(error)
  Effect.runSync(
    Console.error(
      `\nUnexpected error:\n  ${message}\n\nIf this looks like a bug, please open an issue:\n  https://github.com/sovrium/sovrium/issues/new\n`
    )
  )
  process.exit(1)
})
