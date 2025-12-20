#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
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
 * ### sovrium start [config.json]
 * Start a development server
 * ```bash
 * sovrium start app.json                           # Load from JSON file
 * SOVRIUM_APP_JSON='{"name":"My App"}' sovrium   # Or use env variable
 * ```
 *
 * ### sovrium build [config.json]
 * Build static site files
 * ```bash
 * sovrium build app.json                           # Load from JSON file
 * SOVRIUM_OUTPUT_DIR=./dist sovrium build          # Or use env variable
 * ```
 *
 * ## Arguments
 * - `config.json` (optional) - Path to JSON file containing app configuration
 *
 * ## Environment Variables (start command)
 * - `SOVRIUM_APP_JSON` (optional if file provided) - JSON string containing app configuration
 * - `PORT` (optional) - Server port (default: 3000)
 * - `HOSTNAME` (optional) - Server hostname (default: localhost)
 *
 * ## Environment Variables (build command)
 * - `SOVRIUM_APP_JSON` (optional if file provided) - JSON string containing app configuration
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

import { watch } from 'node:fs'
import { Effect, Console } from 'effect'
import { parseAppSchema, loadSchemaFromFileForReload } from '@/cli/schema-parser'
import { start, build, type StartOptions, type GenerateStaticOptions } from '@/index'

// Server instance type (returned by start())
type ServerInstance = Awaited<ReturnType<typeof start>>

/**
 * Reload server with new configuration from changed config file
 *
 * This function is called when the config file changes during --watch mode.
 * It gracefully reloads the server with the new configuration.
 *
 * @param filePath - Path to the config file that changed
 * @param currentServer - The currently running server instance
 * @param options - Server options (port, hostname)
 * @returns Promise with the new server instance
 * @throws Error if config file cannot be parsed or new server fails to start
 */
const reloadServer = async (
  filePath: string,
  currentServer: ServerInstance,
  options: StartOptions
): Promise<ServerInstance> => {
  // Parse the new config file (throws on invalid JSON/YAML, doesn't exit process)
  const newApp = await loadSchemaFromFileForReload(filePath)

  // Stop the current server before starting the new one
  // eslint-disable-next-line functional/no-expression-statements
  await currentServer.stop()

  // Start new server with the updated config
  const newServer = await start(newApp, options)

  return newServer
}

/**
 * Show CLI help text
 */
const showHelp = (): void => {
  const helpText = [
    'Sovrium CLI',
    '',
    'Commands:',
    '  sovrium start [config]        Start a development server (default)',
    '  sovrium build [config]        Build static site files',
    '  sovrium --help                Show this help message',
    '',
    'Options:',
    '  --watch, -w                   Watch config file for changes and hot reload',
    '',
    'Supported config formats: .json, .yaml, .yml',
    '',
    'Examples:',
    '  # Start development server with JSON file',
    '  sovrium start app.json',
    '',
    '  # Start with YAML file',
    '  sovrium start app.yaml',
    '',
    '  # Start with watch mode (hot reload on config changes)',
    '  sovrium start app.yaml --watch',
    '',
    '  # Start with environment variable',
    '  SOVRIUM_APP_JSON=\'{"name":"My App"}\' sovrium start',
    '',
    '  # Build static site',
    '  sovrium build app.json',
    '',
    'For more information, see the documentation at https://sovrium.com/docs/cli',
  ]

  Effect.runSync(Console.log(helpText.join('\n')))
}

/**
 * Parse server options from environment variables
 */
const parseStartOptions = (): StartOptions => {
  const port = Bun.env.PORT
  const hostname = Bun.env.HOSTNAME

  if (!port && !hostname) {
    return {}
  }

  const parsedPort = port ? parseInt(port, 10) : undefined
  if (parsedPort !== undefined && (isNaN(parsedPort) || parsedPort < 0 || parsedPort > 65_535)) {
    Effect.runSync(
      Console.error(
        `Error: Invalid port number "${port}". Must be between 0 and 65535 (0 = auto-select).`
      )
    )
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  return {
    ...(parsedPort !== undefined && { port: parsedPort }),
    ...(hostname && { hostname }),
  }
}

/**
 * Handle the 'start' command
 */
const handleStartCommand = async (filePath?: string, watchMode = false): Promise<void> => {
  const app = await parseAppSchema('start', filePath)
  const options = parseStartOptions()

  Effect.runSync(
    Effect.gen(function* () {
      yield* Console.log('Starting Sovrium server from CLI...')
      yield* Console.log(`App: ${app.name}${app.description ? ` - ${app.description}` : ''}`)
      if (filePath) yield* Console.log(`Config: ${filePath}`)
      if (options.port) yield* Console.log(`Port: ${options.port}`)
      if (options.hostname) yield* Console.log(`Hostname: ${options.hostname}`)
      if (watchMode) yield* Console.log(`Watch mode: enabled`)
      yield* Console.log('')
    })
  )

  // Start the server
  const server = await start(app, options).catch((error) => {
    Effect.runSync(Console.error('Failed to start server:', error))
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  })

  // If watch mode enabled, set up file watcher
  if (watchMode && filePath) {
    console.log(`\n👀 Watching ${filePath} for changes...\n`)

    // Track current server instance (mutable for watch mode)
    // eslint-disable-next-line functional/no-let
    let currentServer = server

    // Set up file watcher using Node.js fs.watch (stable in Bun)

    watch(filePath, async (eventType) => {
      if (eventType === 'change') {
        console.log(`\n🔄 Config changed, reloading...`)

        try {
          // eslint-disable-next-line functional/no-expression-statements
          currentServer = await reloadServer(filePath, currentServer, options)

          console.log(`✅ Server reloaded successfully\n`)
        } catch (error) {
          console.error(`❌ Reload failed: ${error instanceof Error ? error.message : error}\n`)
          // Keep the old server running on error
        }
      }
    })
  }
}

/**
 * Parse boolean environment variable
 */
const parseBooleanEnv = (value: string | undefined): boolean | undefined =>
  value === 'true' ? true : value === 'false' ? false : undefined

/**
 * Parse build options from environment variables
 */
const parseBuildOptions = (): GenerateStaticOptions => {
  // Parse environment variables
  const envVars = {
    outputDir: Bun.env.SOVRIUM_OUTPUT_DIR,
    baseUrl: Bun.env.SOVRIUM_BASE_URL,
    basePath: Bun.env.SOVRIUM_BASE_PATH,
    deployment: Bun.env.SOVRIUM_DEPLOYMENT as 'github-pages' | 'generic' | undefined,
    languages: Bun.env.SOVRIUM_LANGUAGES?.split(',').map((lang) => lang.trim()),
    defaultLanguage: Bun.env.SOVRIUM_DEFAULT_LANGUAGE,
    generateSitemap: parseBooleanEnv(Bun.env.SOVRIUM_GENERATE_SITEMAP),
    generateRobotsTxt: parseBooleanEnv(Bun.env.SOVRIUM_GENERATE_ROBOTS),
    hydration: parseBooleanEnv(Bun.env.SOVRIUM_HYDRATION),
    generateManifest: parseBooleanEnv(Bun.env.SOVRIUM_GENERATE_MANIFEST),
    bundleOptimization: Bun.env.SOVRIUM_BUNDLE_OPTIMIZATION as 'split' | 'none' | undefined,
    publicDir: Bun.env.SOVRIUM_PUBLIC_DIR,
  }

  // Build options object with only defined values
  const options = [
    { key: 'outputDir', value: envVars.outputDir },
    { key: 'baseUrl', value: envVars.baseUrl },
    { key: 'basePath', value: envVars.basePath },
    { key: 'deployment', value: envVars.deployment },
    { key: 'languages', value: envVars.languages },
    { key: 'defaultLanguage', value: envVars.defaultLanguage },
    { key: 'generateSitemap', value: envVars.generateSitemap },
    { key: 'generateRobotsTxt', value: envVars.generateRobotsTxt },
    { key: 'hydration', value: envVars.hydration },
    { key: 'generateManifest', value: envVars.generateManifest },
    { key: 'bundleOptimization', value: envVars.bundleOptimization },
    { key: 'publicDir', value: envVars.publicDir },
  ].reduce(
    (acc, { key, value }) =>
      value !== undefined && value !== false ? { ...acc, [key]: value } : acc,
    {} as GenerateStaticOptions
  )

  return options
}

/**
 * Handle the 'build' command
 */
const handleBuildCommand = async (filePath?: string): Promise<void> => {
  const app = await parseAppSchema('build', filePath)
  const options = parseBuildOptions()

  Effect.runSync(
    Effect.gen(function* () {
      yield* Console.log('Building static site from CLI...')
      yield* Console.log(`App: ${app.name}${app.description ? ` - ${app.description}` : ''}`)
      if (filePath) yield* Console.log(`Config: ${filePath}`)
      if (options.outputDir) yield* Console.log(`Output directory: ${options.outputDir}`)
      if (options.baseUrl) yield* Console.log(`Base URL: ${options.baseUrl}`)
      if (options.deployment) yield* Console.log(`Deployment: ${options.deployment}`)
      yield* Console.log('')
    })
  )

  // Build static site
  // eslint-disable-next-line functional/no-expression-statements
  await build(app, options).catch((error) => {
    Effect.runSync(Console.error('Failed to build static site:', error))
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  })
}

// Main CLI entry point
const args = Bun.argv.slice(2)

/**
 * Check if argument is a config file path (JSON, YAML, or YML)
 */
const isConfigFile = (arg: string | undefined): boolean =>
  arg !== undefined &&
  (arg.endsWith('.json') ||
    arg.endsWith('.yaml') ||
    arg.endsWith('.yml') ||
    arg.endsWith('.JSON') ||
    arg.endsWith('.YAML') ||
    arg.endsWith('.YML') ||
    arg.includes('/'))

/**
 * Parse CLI arguments into command, config file, and flags
 */
const parseArgs = (
  argv: readonly string[]
): { readonly command: string; readonly configFile?: string; readonly watchMode: boolean } => {
  const watchMode = argv.includes('--watch') || argv.includes('-w')
  const nonFlagArgs = argv.filter((arg) => !arg.startsWith('-'))

  const command = nonFlagArgs[0] || 'start'
  const configFile = nonFlagArgs[1]

  // Handle case where first arg is a config file (implicit 'start' command)
  if (isConfigFile(command)) {
    return { command: 'start', configFile: command, watchMode }
  }

  return { command, configFile, watchMode }
}

const { command, configFile, watchMode } = parseArgs(args)

// Execute command - side effects required for CLI operation
;(async () => {
  switch (command) {
    case 'start':
      // eslint-disable-next-line functional/no-expression-statements -- CLI command execution requires side effects
      await handleStartCommand(configFile, watchMode)
      break
    case 'build':
      // eslint-disable-next-line functional/no-expression-statements -- CLI command execution requires side effects
      await handleBuildCommand(configFile)
      break
    case '--help':
    case '-h':
    case 'help':
      showHelp()
      // Terminate process - imperative statement required for CLI
      // eslint-disable-next-line functional/no-expression-statements
      process.exit(0)
      break
    default:
      if (!command.startsWith('-')) {
        // Unknown command without dash - try as start command
        // eslint-disable-next-line functional/no-expression-statements -- CLI command execution requires side effects
        await handleStartCommand(undefined, watchMode)
      } else {
        Effect.runSync(
          Effect.gen(function* () {
            yield* Console.error(`Error: Unknown command "${command}"`)
            yield* Console.error('')
          })
        )
        showHelp()
        // Terminate process - imperative statement required for CLI
        // eslint-disable-next-line functional/no-expression-statements
        process.exit(1)
      }
  }
})()
