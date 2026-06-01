/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Console } from 'effect'
import {
  detectFormat,
  getFileExtension,
  isInlineJson,
  isUrl,
  parseJsonContent,
  parseYamlContent,
} from '@/domain/utils'
import {
  loadSchemaFromFile as loadFromFile,
  fileExists,
  fetchRemoteSchema,
} from '@/infrastructure/schema'
import type { AppEncoded } from '@/domain/models/app'

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
    process.exit(1)
  }

  const format = detectFormat(filePath)

  if (format === 'unsupported') {
    Effect.runSync(
      Effect.gen(function* () {
        yield* Console.error(`Error: Unsupported file format: .${getFileExtension(filePath)}`)
        yield* Console.error('')
        yield* Console.error('Supported formats: .json, .yaml, .yml, .ts')
      })
    )
    process.exit(1)
  }

  try {
    return await loadFromFile(filePath)
  } catch (error) {
    const formatLabel = format === 'json' ? 'JSON' : format === 'yaml' ? 'YAML' : 'TypeScript'
    const verb = format === 'typescript' ? 'load' : 'parse'
    Effect.runSync(
      Effect.gen(function* () {
        yield* Console.error(`Error: Failed to ${verb} ${formatLabel} file: ${filePath}`)
        yield* Console.error('')
        yield* Console.error('Details:', error instanceof Error ? error.message : String(error))
      })
    )
    process.exit(1)
  }
}

export const loadSchemaFromFileForReload = async (filePath: string): Promise<AppEncoded> =>
  loadFromFile(filePath)

export const parseSchemaFromEnv = async (envValue: string): Promise<AppEncoded> => {
  const trimmedValue = envValue.trim()

  if (isInlineJson(trimmedValue)) {
    try {
      return parseJsonContent(trimmedValue)
    } catch (error) {
      throw new Error(
        `Invalid JSON in APP_SCHEMA: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  if (isUrl(trimmedValue)) {
    return fetchRemoteSchema(trimmedValue)
  }

  try {
    return parseYamlContent(trimmedValue)
  } catch (error) {
    throw new Error(
      `Invalid YAML in APP_SCHEMA: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

const showNoConfigError = (command: string): never => {
  Effect.runSync(
    Effect.gen(function* () {
      yield* Console.error('Error: No configuration provided')
      yield* Console.error('')
      yield* Console.error('Usage:')
      yield* Console.error(`  sovrium ${command} <config.json>`)
      yield* Console.error('')
      yield* Console.error('Or with environment variable:')
      yield* Console.error(`  APP_SCHEMA='{"name":"My App"}' sovrium ${command}`)
    })
  )
  process.exit(1)
}

export const parseAppSchema = async (command: string, filePath?: string): Promise<AppEncoded> => {
  if (filePath) {
    return loadSchemaFromFile(filePath, command)
  }

  const appSchemaFileEnv = Bun.env.APP_SCHEMA_FILE
  if (appSchemaFileEnv) {
    return loadSchemaFromFile(appSchemaFileEnv, command)
  }

  const appSchemaEnv = Bun.env.APP_SCHEMA

  if (appSchemaEnv) {
    try {
      return await parseSchemaFromEnv(appSchemaEnv)
    } catch (error) {
      Effect.runSync(
        Console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
      )
      process.exit(1)
    }
  }

  return showNoConfigError(command)
}
