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
 * SOVRIUM_APP_SCHEMA='{"name":"My App"}' sovrium   # Or use env variable
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
 * - `SOVRIUM_APP_SCHEMA` (optional if file provided) - JSON string containing app configuration
 * - `SOVRIUM_PORT` (optional) - Server port (default: 3000)
 * - `SOVRIUM_HOSTNAME` (optional) - Server hostname (default: localhost)
 *
 * ## Environment Variables (static command)
 * - `SOVRIUM_APP_SCHEMA` (optional if file provided) - JSON string containing app configuration
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

import { Effect, Console } from 'effect'
import { start, generateStatic, type StartOptions, type GenerateStaticOptions } from '@/index'

interface AppSchema {
  readonly name?: string
  readonly description?: string
  readonly [key: string]: unknown
}

/**
 * Show CLI help text
 */
const showHelp = (): void => {
  Effect.runSync(
    Effect.gen(function* () {
      yield* Console.log('Sovrium CLI')
      yield* Console.log('')
      yield* Console.log('Commands:')
      yield* Console.log('  sovrium start [config.json]   Start a development server (default)')
      yield* Console.log('  sovrium static [config.json]  Generate static site files')
      yield* Console.log('  sovrium --help                Show this help message')
      yield* Console.log('')
      yield* Console.log('Examples:')
      yield* Console.log('  # Start development server with JSON file')
      yield* Console.log('  sovrium start app.json')
      yield* Console.log('')
      yield* Console.log('  # Start with environment variable')
      yield* Console.log('  SOVRIUM_APP_SCHEMA=\'{"name":"My App"}\' sovrium start')
      yield* Console.log('')
      yield* Console.log('  # Generate static site')
      yield* Console.log('  sovrium static app.json')
      yield* Console.log('')
      yield* Console.log(
        'For more information, see the documentation at https://sovrium.com/docs/cli'
      )
    })
  )
}

/**
 * Load app schema from a JSON file
 */
const loadSchemaFromFile = async (filePath: string, command: string): Promise<AppSchema> => {
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

  try {
    const content = await file.text()
    return JSON.parse(content) as AppSchema
  } catch (error) {
    Effect.runSync(
      Effect.gen(function* () {
        yield* Console.error(`Error: Failed to parse JSON file: ${filePath}`)
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
const parseAppSchema = async (command: string, filePath?: string): Promise<AppSchema> => {
  // If a file path is provided, load from file
  if (filePath) {
    return loadSchemaFromFile(filePath, command)
  }

  // Otherwise, try environment variable
  const appSchemaString = Bun.env.SOVRIUM_APP_SCHEMA

  if (!appSchemaString) {
    Effect.runSync(
      Effect.gen(function* () {
        yield* Console.error('Error: No configuration provided')
        yield* Console.error('')
        yield* Console.error('Usage:')
        yield* Console.error(`  sovrium ${command} <config.json>`)
        yield* Console.error('')
        yield* Console.error('Or with environment variable:')
        yield* Console.error(`  SOVRIUM_APP_SCHEMA='{"name":"My App"}' sovrium ${command}`)
      })
    )
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  try {
    return JSON.parse(appSchemaString) as AppSchema
  } catch {
    Effect.runSync(
      Effect.gen(function* () {
        yield* Console.error('Error: SOVRIUM_APP_SCHEMA must be valid JSON')
        yield* Console.error('')
        yield* Console.error('Received:', appSchemaString)
        yield* Console.error('')
        yield* Console.error('Example:')
        yield* Console.error(
          `  SOVRIUM_APP_SCHEMA='{"name":"My App","description":"My Description"}' sovrium ${command}`
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
  const port = Bun.env.SOVRIUM_PORT
  const hostname = Bun.env.SOVRIUM_HOSTNAME

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
const handleStartCommand = async (filePath?: string): Promise<void> => {
  const app = await parseAppSchema('start', filePath)
  const options = parseStartOptions()

  Effect.runSync(
    Effect.gen(function* () {
      yield* Console.log('Starting Sovrium server from CLI...')
      yield* Console.log(`App: ${app.name}${app.description ? ` - ${app.description}` : ''}`)
      if (filePath) yield* Console.log(`Config: ${filePath}`)
      if (options.port) yield* Console.log(`Port: ${options.port}`)
      if (options.hostname) yield* Console.log(`Hostname: ${options.hostname}`)
      yield* Console.log('')
    })
  )

  // Start the server
  // eslint-disable-next-line functional/no-expression-statements
  await start(app, options).catch((error) => {
    Effect.runSync(Console.error('Failed to start server:', error))
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  })
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
  await generateStatic(app, options).catch((error) => {
    Effect.runSync(Console.error('Failed to generate static site:', error))
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  })
}

// Main CLI entry point
const command = Bun.argv[2] || 'start'
const configArg = Bun.argv[3]

/**
 * Check if argument is a JSON file path
 */
const isJsonFile = (arg: string | undefined): boolean =>
  arg !== undefined && (arg.endsWith('.json') || arg.includes('/'))

// Execute command - side effects required for CLI operation
;(async () => {
  switch (command) {
    case 'start':
      // eslint-disable-next-line functional/no-expression-statements -- CLI command execution requires side effects
      await handleStartCommand(configArg)
      break
    case 'static':
      // eslint-disable-next-line functional/no-expression-statements -- CLI command execution requires side effects
      await handleStaticCommand(configArg)
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
      // If the command looks like a JSON file path, treat it as config for 'start'
      if (isJsonFile(command)) {
        // eslint-disable-next-line functional/no-expression-statements -- CLI command execution requires side effects
        await handleStartCommand(command)
      } else if (!command.startsWith('-')) {
        // Unknown command without dash - try as start command
        // eslint-disable-next-line functional/no-expression-statements -- CLI command execution requires side effects
        await handleStartCommand()
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
