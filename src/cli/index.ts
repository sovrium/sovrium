#!/usr/bin/env bun
/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Console } from 'effect'
import { handleAdminCommand } from '@/cli/admin'
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
import { handleSecretCommand } from '@/cli/secret'
import { getCurrentVersion, handleUpdateCommand } from '@/cli/update'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'

const showVersion = async (): Promise<void> => {
  const version = await getCurrentVersion()
  Effect.runSync(Console.log(version))
}

const HELP_TEXT = [
  'Sovrium CLI — configuration-driven application platform',
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
  '  sovrium validate <config>     Validate a config file against AppSchema',
  '',
  'Extend:',
  '  sovrium agents list           List available agent templates',
  '  sovrium agents install <name> Install an agent template',
  '',
  'Operate:',
  '  sovrium admin create <email>  Create an admin user',
  '  sovrium secret generate       Print fresh secrets as .env lines',
  '  sovrium update                Update to the latest version',
  '',
  'Options:',
  '  --help, -h                    Show this help message',
  '  --version, -v                 Show version number',
  '  --watch, -w                   Watch config file and hot reload (start)',
  '  --output <path>               Write schema to file (schema command)',
  '  --template <name>             Project template (init)',
  '  --name <name>                 App name (init)',
  '  --password <value>            Admin password (admin create; else prompted)',
  '  --force                       Overwrite existing files (init, agents install)',
  '',
  'Environment variables (all optional — Sovrium runs zero-config):',
  '  DATABASE_URL                  Postgres connection (omit → embedded SQLite)',
  '  PORT                          Server port (default: 3000)',
  '  BASE_URL                      Public base URL (default: http://localhost:PORT)',
  '  AUTH_SECRET                   Auth signing secret (run: sovrium secret generate)',
  '  AI_PROVIDER                   Enable AI: ollama|openai|anthropic|… (default: off)',
  '  STORAGE_PROVIDER              s3|local (default: auto — local files / Postgres)',
  '  Eco defaults (override to opt out): ECO_PAGE_CACHE=on  ECO_IMAGE_FORMAT=avif',
  '  Full reference: see .env.example or https://sovrium.com/docs/configuration',
  '',
  'Supported config formats: .json, .yaml, .yml, .ts',
  '',
  'Examples:',
  '  sovrium start app.yaml --watch                     # Hot reload on changes',
  '  sovrium build app.json                             # Build static site',
  '  sovrium schema --output app.schema.json            # Write JSON Schema',
  '  sovrium init ./my-app --template blog              # Scaffold from template',
  '  sovrium admin create me@example.com                # Create an admin (prompts)',
  '  sovrium secret generate                            # Print AUTH_SECRET + key',
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
      skipAgent: parsed.skipAgent,
      appName: parsed.appName,
    }),
  agents: async () =>
    handleAgentsCommand(parsed.subcommand, parsed.agentName, parsed.targetPath, parsed.forceFlag),
  admin: async () =>
    handleAdminCommand(parsed.subcommand, parsed.positionalArg, {
      configFile: parsed.configFile,
      password: parsed.password,
    }),
  secret: async () => handleSecretCommand(parsed.subcommand, parsed.positionalArg),
  update: async () => handleUpdateCommand(),
  '--version': async () => showVersion(),
  version: async () => showVersion(),
  '--help': async () => showHelp(),
  help: async () => showHelp(),
}

const persistentCommands: Readonly<Record<string, () => Promise<void>>> = {
  start: async () => handleStartCommand(parsed.configFile, parsed.watchMode, parsed.publicDir),
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
    await handleStartCommand(undefined, parsed.watchMode, parsed.publicDir)
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
