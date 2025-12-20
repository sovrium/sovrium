/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * CLI Schema Loader - Presentation Layer
 *
 * CLI-specific schema loading with user-facing error messages and process.exit.
 * Orchestrates domain and infrastructure layers.
 */

import { Effect, Console } from 'effect'
import {
  detectFormat,
  getFileExtension,
  isInlineJson,
  isUrl,
  parseJsonContent,
  parseYamlContent,
} from '@/domain/schema'
import {
  loadSchemaFromFile as loadFromFile,
  fileExists,
  fetchRemoteSchema,
} from '@/infrastructure/schema'
import type { AppEncoded } from '@/domain/models/app'

/**
 * Load schema from file with CLI error handling (calls process.exit on error)
 */
export const loadSchemaFromFile = async (
  filePath: string,
  command: string
): Promise<AppEncoded> => {
  const exists = await fileExists(filePath)

  if (!exists) {
    Effect.runSync(
      Effect.gen(function* () {
        yield* Console.error(`Error: File not found: ${filePath}`)
        yield* Console.error('')
        yield* Console.error('Usage:')
        yield* Console.error(`  sovrium ${command} <config.json>`)
      })
    )
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  const format = detectFormat(filePath)

  if (format === 'unsupported') {
    Effect.runSync(
      Effect.gen(function* () {
        yield* Console.error(`Error: Unsupported file format: .${getFileExtension(filePath)}`)
        yield* Console.error('')
        yield* Console.error('Supported formats: .json, .yaml, .yml')
      })
    )
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  try {
    return await loadFromFile(filePath)
  } catch (error) {
    Effect.runSync(
      Effect.gen(function* () {
        yield* Console.error(
          `Error: Failed to parse ${format === 'json' ? 'JSON' : 'YAML'} file: ${filePath}`
        )
        yield* Console.error('')
        yield* Console.error('Details:', error instanceof Error ? error.message : String(error))
      })
    )
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }
}

/**
 * Load schema from file for watch mode reloads (throws instead of process.exit)
 */
export const loadSchemaFromFileForReload = async (filePath: string): Promise<AppEncoded> =>
  loadFromFile(filePath)

/**
 * Parse schema from environment variable value
 * Supports: inline JSON, inline YAML, remote URL
 *
 * @throws Error if parsing fails
 */
export const parseSchemaFromEnv = async (envValue: string): Promise<AppEncoded> => {
  const trimmedValue = envValue.trim()

  // Detect if value is inline JSON
  if (isInlineJson(trimmedValue)) {
    try {
      return parseJsonContent(trimmedValue)
    } catch (error) {
      // eslint-disable-next-line functional/no-throw-statements
      throw new Error(
        `Invalid JSON in SOVRIUM_APP_SCHEMA: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // Detect if value is a URL
  if (isUrl(trimmedValue)) {
    return fetchRemoteSchema(trimmedValue)
  }

  // Otherwise, treat as YAML
  try {
    return parseYamlContent(trimmedValue)
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error(
      `Invalid YAML in SOVRIUM_APP_SCHEMA: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Show error message when no configuration is provided
 */
const showNoConfigError = (command: string): never => {
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
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
}

/**
 * Parse and validate app schema from file path or environment variable
 */
export const parseAppSchema = async (command: string, filePath?: string): Promise<AppEncoded> => {
  // If a file path is provided, load from file (takes precedence over env)
  if (filePath) {
    return loadSchemaFromFile(filePath, command)
  }

  // Try SOVRIUM_APP_SCHEMA environment variable
  const appSchemaEnv = Bun.env.SOVRIUM_APP_SCHEMA

  if (appSchemaEnv) {
    try {
      return await parseSchemaFromEnv(appSchemaEnv)
    } catch (error) {
      Effect.runSync(
        Console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
      )
      // eslint-disable-next-line functional/no-expression-statements
      process.exit(1)
    }
  }

  // No configuration provided
  return showNoConfigError(command)
}
