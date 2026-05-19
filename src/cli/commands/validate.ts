/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname, basename, resolve } from 'node:path'
import { Effect, Console } from 'effect'
import { detectFormat } from '@/domain/utils'
import { warnForConfig } from '@/infrastructure/coming-soon'
import { lazyImportSchema } from './utils'

const validateFileExists = async (filePath: string): Promise<void> => {
  const exists = await Bun.file(filePath).exists()
  if (!exists) {
    Effect.runSync(Console.error(`Error: File not found: ${filePath}`))
    process.exit(1)
  }
}

const validateFileFormat = (filePath: string): ReturnType<typeof detectFormat> => {
  const format = detectFormat(filePath)
  if (format === 'unsupported') {
    Effect.runSync(
      Console.error(`Error: Unsupported file format. Supported: .json, .yaml, .yml, .ts`)
    )
    process.exit(1)
  }
  return format
}

const parseConfigWithRefSources = async (
  filePath: string,
  format: ReturnType<typeof detectFormat>,
  loadFromFile: (path: string) => Promise<unknown>,
  collectRefSources: (data: unknown, baseDir: string) => ReadonlyMap<string, string>
): Promise<{ readonly parsed: unknown; readonly refSources: ReadonlyMap<string, string> }> => {
  if (format === 'typescript') {
    const parsed = await loadFromFile(filePath)
    return { parsed, refSources: new Map<string, string>() }
  }

  const { parseYamlContent, parseJsonContent } = await import('@/domain/utils')

  const content = await Bun.file(filePath).text()
  const rawParsed = format === 'json' ? parseJsonContent(content) : parseYamlContent(content)
  const absolutePath = resolve(filePath)
  const baseDir = dirname(absolutePath)
  const refSources = collectRefSources(rawParsed, baseDir)

  const parsed = await loadFromFile(filePath)
  return { parsed, refSources }
}

const loadConfigForValidationWithSources = async (
  filePath: string
): Promise<{ readonly parsed: unknown; readonly refSources: ReadonlyMap<string, string> }> => {
  await validateFileExists(filePath)
  const format = validateFileFormat(filePath)
  const { loadSchemaFromFile: loadFromFile, collectRefSources } = await lazyImportSchema()

  try {
    return await parseConfigWithRefSources(filePath, format, loadFromFile, collectRefSources)
  } catch (error) {
    Effect.runSync(
      Console.error(
        `Error: Failed to parse file: ${error instanceof Error ? error.message : String(error)}`
      )
    )
    process.exit(1)
  }
}

const isRecognizedFieldType = (fieldType: string, knownTypes: readonly string[]): boolean => {
  if (knownTypes.includes(fieldType as (typeof knownTypes)[number])) {
    return true
  }
  const normalized = fieldType.replace(/_/g, '-')
  if (knownTypes.includes(normalized as (typeof knownTypes)[number])) {
    return true
  }
  return !fieldType.includes('_') && !fieldType.includes('-')
}

const detectUnknownFieldTypes = async (
  parsed: unknown,
  refSources: ReadonlyMap<string, string>
): Promise<readonly string[]> => {
  const { KNOWN_FIELD_TYPES } =
    await import('@/domain/models/app/tables/fields/field-types/advanced/unknown-field')

  const { tables } = parsed as Record<string, unknown>

  if (!Array.isArray(tables)) {
    return []
  }

  const sourceFile = refSources.get('tables')
  const sourceLabel = sourceFile ? basename(sourceFile) : undefined

  return tables.flatMap((table: Record<string, unknown>) => {
    const { fields } = table
    if (!Array.isArray(fields)) {
      return []
    }

    return fields
      .filter(
        (field: Record<string, unknown>) =>
          typeof field.type === 'string' && !isRecognizedFieldType(field.type, KNOWN_FIELD_TYPES)
      )
      .map((field: Record<string, unknown>) => {
        const prefix = sourceLabel ? `${sourceLabel}: ` : ''
        return `${prefix}Unknown field type "${field.type}" in field "${field.name}"`
      })
  })
}

export const handleValidateCommand = async (filePath?: string): Promise<void> => {
  if (!filePath) {
    Effect.runSync(
      Console.error(
        'Error: No config file provided\n\nUsage:\n  sovrium validate <config.json|config.yaml>'
      )
    )
    process.exit(1)
  }

  const { parsed, refSources } = await loadConfigForValidationWithSources(filePath)

  const { Schema: S, Either } = await import('effect')
  const { TreeFormatter } = await import('effect/ParseResult')
  const { AppSchema } = await import('@/domain/models/app')

  const result = S.decodeUnknownEither(AppSchema, { onExcessProperty: 'error' })(parsed)

  if (Either.isLeft(result)) {
    const formatted = TreeFormatter.formatErrorSync(result.left)
    const errorLines = formatted
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((err) => `  ${err}`)
      .join('\n')
    Effect.runSync(Console.error(`Validation failed:\n${errorLines}`))
    process.exit(1)
  }

  const unknownFieldErrors = await detectUnknownFieldTypes(parsed, refSources)

  if (unknownFieldErrors.length > 0) {
    const errorLines = unknownFieldErrors.map((err) => `  ${err}`).join('\n')
    Effect.runSync(Console.error(`Validation failed:\n${errorLines}`))
    process.exit(1)
  }

  Effect.runSync(warnForConfig(parsed))

  Effect.runSync(
    Console.log(`Valid configuration: ${(parsed as Record<string, unknown>).name ?? 'unnamed'}`)
  )
}
