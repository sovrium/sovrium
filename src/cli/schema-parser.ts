/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Schema Parser Utilities for CLI
 *
 * Handles parsing of app schemas from various sources:
 * - File paths (JSON, YAML)
 * - Environment variables (inline JSON, inline YAML, remote URLs)
 * - Format auto-detection
 */

import { Effect, Console } from 'effect'
import { load as parseYaml } from 'js-yaml'
import type { AppEncoded } from '@/domain/models/app'

/**
 * Detect file format from file extension
 */
export const detectFormat = (filePath: string): 'json' | 'yaml' | 'unsupported' => {
  const lowerPath = filePath.toLowerCase()
  if (lowerPath.endsWith('.json')) return 'json'
  if (lowerPath.endsWith('.yaml') || lowerPath.endsWith('.yml')) return 'yaml'
  return 'unsupported'
}

/**
 * Extract file extension from path
 */
export const getFileExtension = (filePath: string): string => {
  const match = filePath.match(/\.([^.]+)$/)
  return match?.[1] ?? ''
}

/**
 * Detect format from Content-Type header
 */
export const detectFormatFromContentType = (contentType: string): 'json' | 'yaml' | undefined => {
  if (contentType.includes('application/json')) return 'json'
  if (contentType.includes('application/x-yaml') || contentType.includes('text/yaml')) return 'yaml'
  return undefined
}

/**
 * Detect format from URL file extension
 */
export const detectFormatFromUrl = (url: string): 'json' | 'yaml' | undefined => {
  const urlLower = url.toLowerCase()
  if (urlLower.endsWith('.json')) return 'json'
  if (urlLower.endsWith('.yaml') || urlLower.endsWith('.yml')) return 'yaml'
  return undefined
}

/**
 * Parse schema content based on detected format
 */
export const parseSchemaContent = (
  content: string,
  format: 'json' | 'yaml' | undefined
): AppEncoded => {
  if (format === 'json') {
    return JSON.parse(content) as AppEncoded
  }
  if (format === 'yaml') {
    const parsed = parseYaml(content)
    return parsed as AppEncoded
  }
  // Last fallback: try JSON first, then YAML
  try {
    return JSON.parse(content) as AppEncoded
  } catch {
    const parsed = parseYaml(content)
    return parsed as AppEncoded
  }
}

/**
 * Fetch and parse schema from remote URL
 */
export const fetchRemoteSchema = async (url: string): Promise<AppEncoded> => {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      // eslint-disable-next-line functional/no-throw-statements
      throw new Error(`Failed to fetch schema from ${url}: HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    const content = await response.text()

    // Try to detect format from Content-Type header, then URL extension
    const format = detectFormatFromContentType(contentType) || detectFormatFromUrl(url)

    return parseSchemaContent(content, format)
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error(
      `Failed to fetch or parse schema from ${url}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Parse schema from environment variable (SOVRIUM_APP_SCHEMA)
 * Supports:
 * - Inline JSON (starts with '{')
 * - Remote URL (starts with 'http://' or 'https://')
 * - Inline YAML (default)
 */
export const parseSchemaFromEnv = async (envValue: string): Promise<AppEncoded> => {
  // Detect if value is inline JSON
  const trimmedValue = envValue.trim()
  if (trimmedValue.startsWith('{')) {
    try {
      return JSON.parse(trimmedValue) as AppEncoded
    } catch (error) {
      // eslint-disable-next-line functional/no-throw-statements
      throw new Error(
        `Invalid JSON in SOVRIUM_APP_SCHEMA: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // Detect if value is a URL
  if (trimmedValue.startsWith('http://') || trimmedValue.startsWith('https://')) {
    return fetchRemoteSchema(trimmedValue)
  }

  // Otherwise, treat as YAML
  try {
    const parsed = parseYaml(trimmedValue)
    return parsed as AppEncoded
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error(
      `Invalid YAML in SOVRIUM_APP_SCHEMA: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Load app schema from a config file without process.exit (for watch mode reloads)
 * @throws Error if file doesn't exist, unsupported format, or parsing fails
 */
export const loadSchemaFromFileForReload = async (filePath: string): Promise<AppEncoded> => {
  const file = Bun.file(filePath)
  const exists = await file.exists()

  if (!exists) {
    // eslint-disable-next-line functional/no-throw-statements -- Exceptional case: file not found during reload
    throw new Error(`File not found: ${filePath}`)
  }

  // Detect format from file extension
  const format = detectFormat(filePath)

  if (format === 'unsupported') {
    const extension = getFileExtension(filePath)
    // eslint-disable-next-line functional/no-throw-statements -- Exceptional case: unsupported file format
    throw new Error(`Unsupported file format: .${extension}. Supported: .json, .yaml, .yml`)
  }

  const content = await file.text()

  if (format === 'json') {
    return JSON.parse(content) as AppEncoded
  } else {
    // format === 'yaml'
    const parsed = parseYaml(content)
    return parsed as AppEncoded
  }
}

/**
 * Parse file content based on format
 */
const parseFileContent = async (filePath: string, format: 'json' | 'yaml'): Promise<AppEncoded> => {
  const content = await Bun.file(filePath).text()
  if (format === 'json') {
    return JSON.parse(content) as AppEncoded
  }
  const parsed = parseYaml(content)
  return parsed as AppEncoded
}

/**
 * Load app schema from a config file (JSON or YAML)
 */
export const loadSchemaFromFile = async (
  filePath: string,
  command: string
): Promise<AppEncoded> => {
  const exists = await Bun.file(filePath).exists()

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

  const format = detectFormat(filePath)

  if (format === 'unsupported') {
    Effect.runSync(
      Effect.gen(function* () {
        yield* Console.error(`Error: Unsupported file format: .${getFileExtension(filePath)}`)
        yield* Console.error('')
        yield* Console.error('Supported formats: .json, .yaml, .yml')
      })
    )
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  try {
    return await parseFileContent(filePath, format)
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
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
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
  // Terminate process - imperative statement required for CLI
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
        Effect.gen(function* () {
          yield* Console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
        })
      )
      // Terminate process - imperative statement required for CLI
      // eslint-disable-next-line functional/no-expression-statements
      process.exit(1)
    }
  }

  // No configuration provided
  return showNoConfigError(command)
}
