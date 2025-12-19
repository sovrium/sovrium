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
 * This script provides commands for running an Sovrium server or generating static sites.
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
 * ### sovrium static [config.json]
 * Generate static site files
 * ```bash
 * sovrium static app.json                          # Load from JSON file
 * SOVRIUM_OUTPUT_DIR=./build sovrium static        # Or use env variable
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
 * ## Environment Variables (static command)
 * - `SOVRIUM_APP_JSON` (optional if file provided) - JSON string containing app configuration
 * - `SOVRIUM_OUTPUT_DIR` (optional) - Output directory (default: ./static)
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

import { watch } from 'fs'
import { Effect, Console } from 'effect'
import { load as parseYaml } from 'js-yaml'
import { start, build, type StartOptions, type GenerateStaticOptions } from '@/index'
import type { AppEncoded } from '@/domain/models/app'

// Server instance type (returned by start())
type ServerInstance = Awaited<ReturnType<typeof start>>

/**
 * TODO(human): Implement the reload logic for watch mode
 *
 * This function is called when the config file changes during --watch mode.
 * It should gracefully reload the server with the new configuration.
 *
 * @param filePath - Path to the config file that changed
 * @param currentServer - The currently running server instance
 * @param options - Server options (port, hostname)
 * @returns Promise with the new server instance
 *
 * Considerations:
 * - Should you stop the old server before starting the new one?
 * - How do you handle parse errors in the new config? (don't crash, keep old server)
 * - Should you debounce rapid file changes? (editors often save multiple times)
 */
const reloadServer = async (
  _filePath: string,
  _currentServer: ServerInstance,
  _options: StartOptions
): Promise<ServerInstance> => {
  // TODO(human): Implement reload logic
  // Hint: Use loadSchemaFromFile() to parse the new config
  // Hint: The server has a stop() method
  // Hint: Consider wrapping in try/catch to handle config errors gracefully
  throw new Error('Not implemented - implement reloadServer()')
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
    '  sovrium static [config]       Generate static site files',
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
    '  # Generate static site',
    '  sovrium static app.json',
    '',
    'For more information, see the documentation at https://sovrium.com/docs/cli',
  ]

  Effect.runSync(Console.log(helpText.join('\n')))
}

/**
 * Detect file format from file extension
 */
const detectFormat = (filePath: string): 'json' | 'yaml' | 'unsupported' => {
  const lowerPath = filePath.toLowerCase()
  if (lowerPath.endsWith('.json')) return 'json'
  if (lowerPath.endsWith('.yaml') || lowerPath.endsWith('.yml')) return 'yaml'
  return 'unsupported'
}

/**
 * Extract file extension from path
 */
const getFileExtension = (filePath: string): string => {
  const match = filePath.match(/\.([^.]+)$/)
  return match?.[1] ?? ''
}

/**
 * Load app schema from a config file (JSON or YAML)
 */
const loadSchemaFromFile = async (filePath: string, command: string): Promise<AppEncoded> => {
  const file = Bun.file(filePath)
  const exists = await file.exists()

  if (!exists) {
    Effect.runSync(
      Effect.gen(function* () {
        yield* Console.error(`Error: File not found: ${filePath}`)
        yield* Console.error('')
        yield* Console.error('Usage:')
        yield* Console.error(`  sovrium ${command} <config.json>`)
      })
    )
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  // Detect format from file extension
  const format = detectFormat(filePath)

  if (format === 'unsupported') {
    const extension = getFileExtension(filePath)
    Effect.runSync(
      Effect.gen(function* () {
        yield* Console.error(`Error: Unsupported file format: .${extension}`)
        yield* Console.error('')
        yield* Console.error('Supported formats: .json, .yaml, .yml')
        yield* Console.error('')
        yield* Console.error('Usage:')
        yield* Console.error(`  sovrium ${command} <config.json>`)
        yield* Console.error(`  sovrium ${command} <config.yaml>`)
      })
    )
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  try {
    const content = await file.text()

    if (format === 'json') {
      return JSON.parse(content) as AppEncoded
    } else {
      // format === 'yaml'
      const parsed = parseYaml(content)
      return parsed as AppEncoded
    }
  } catch (error) {
    const formatName = format === 'json' ? 'JSON' : 'YAML'
    Effect.runSync(
      Effect.gen(function* () {
        yield* Console.error(`Error: Failed to parse ${formatName} file: ${filePath}`)
        yield* Console.error('')
        yield* Console.error('Details:', error instanceof Error ? error.message : String(error))
      })
    )
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }
}

/**
 * Parse and validate app schema from file path or environment variable
 */
const parseAppSchema = async (command: string, filePath?: string): Promise<AppEncoded> => {
  // If a file path is provided, load from file
  if (filePath) {
    return loadSchemaFromFile(filePath, command)
  }

  // Otherwise, try environment variable
  const appSchemaString = Bun.env.SOVRIUM_APP_JSON

  if (!appSchemaString) {
    Effect.runSync(
      Effect.gen(function* () {
        yield* Console.error('Error: No configuration provided')
        yield* Console.error('')
        yield* Console.error('Usage:')
        yield* Console.error(`  sovrium ${command} <config.json>`)
        yield* Console.error('')
        yield* Console.error('Or with environment variable:')
        yield* Console.error(`  SOVRIUM_APP_JSON='{"name":"My App"}' sovrium ${command}`)
      })
    )
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  try {
    return JSON.parse(appSchemaString) as AppEncoded
  } catch {
    Effect.runSync(
      Effect.gen(function* () {
        yield* Console.error('Error: SOVRIUM_APP_JSON must be valid JSON')
        yield* Console.error('')
        yield* Console.error('Received:', appSchemaString)
        yield* Console.error('')
        yield* Console.error('Example:')
        yield* Console.error(
          `  SOVRIUM_APP_JSON='{"name":"My App","description":"My Description"}' sovrium ${command}`
        )
      })
    )
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }
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
  // eslint-disable-next-line functional/no-expression-statements
  const server = await start(app, options).catch((error) => {
    Effect.runSync(Console.error('Failed to start server:', error))
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  })

  // If watch mode enabled, set up file watcher
  if (watchMode && filePath) {
    Effect.runSync(Console.log(`\n👀 Watching ${filePath} for changes...\n`))

    // Track current server instance (mutable for watch mode)
    // eslint-disable-next-line functional/no-let
    let currentServer = server

    // Set up file watcher using Node.js fs.watch (stable in Bun)
    // eslint-disable-next-line functional/no-expression-statements
    watch(filePath, async (eventType) => {
      if (eventType === 'change') {
        Effect.runSync(Console.log(`\n🔄 Config changed, reloading...`))

        try {
          // eslint-disable-next-line functional/no-expression-statements
          currentServer = await reloadServer(filePath, currentServer, options)
          Effect.runSync(Console.log(`✅ Server reloaded successfully\n`))
        } catch (error) {
          Effect.runSync(
            Console.error(`❌ Reload failed: ${error instanceof Error ? error.message : error}\n`)
          )
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
 * Parse static generation options from environment variables
 */
const parseStaticOptions = (): GenerateStaticOptions => {
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
 * Handle the 'static' command
 */
const handleStaticCommand = async (filePath?: string): Promise<void> => {
  const app = await parseAppSchema('static', filePath)
  const options = parseStaticOptions()

  Effect.runSync(
    Effect.gen(function* () {
      yield* Console.log('Generating static site from CLI...')
      yield* Console.log(`App: ${app.name}${app.description ? ` - ${app.description}` : ''}`)
      if (filePath) yield* Console.log(`Config: ${filePath}`)
      if (options.outputDir) yield* Console.log(`Output directory: ${options.outputDir}`)
      if (options.baseUrl) yield* Console.log(`Base URL: ${options.baseUrl}`)
      if (options.deployment) yield* Console.log(`Deployment: ${options.deployment}`)
      yield* Console.log('')
    })
  )

  // Generate static site
  // eslint-disable-next-line functional/no-expression-statements
  await build(app, options).catch((error) => {
    Effect.runSync(Console.error('Failed to generate static site:', error))
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
): { command: string; configFile?: string; watchMode: boolean } => {
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
    case 'static':
    case 'build': // Alias for static
      // eslint-disable-next-line functional/no-expression-statements -- CLI command execution requires side effects
      await handleStaticCommand(configFile)
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
