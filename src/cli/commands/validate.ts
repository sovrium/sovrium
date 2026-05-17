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

/**
 * Load config file for validation, returning both resolved data and $ref source mappings
 */
const validateFileExists = async (filePath: string): Promise<void> => {
  const exists = await Bun.file(filePath).exists()
  if (!exists) {
    Effect.runSync(Console.error(`Error: File not found: ${filePath}`))
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }
}

const validateFileFormat = (filePath: string): ReturnType<typeof detectFormat> => {
  const format = detectFormat(filePath)
  if (format === 'unsupported') {
    Effect.runSync(
      Console.error(`Error: Unsupported file format. Supported: .json, .yaml, .yml, .ts`)
    )
    // eslint-disable-next-line functional/no-expression-statements
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
  // TypeScript configs use native imports, no $ref resolution needed
  if (format === 'typescript') {
    const parsed = await loadFromFile(filePath)
    return { parsed, refSources: new Map<string, string>() }
  }

  const { parseYamlContent, parseJsonContent } = await import('@/domain/utils')

  // Read and parse raw content to collect $ref sources before resolution
  const content = await Bun.file(filePath).text()
  const rawParsed = format === 'json' ? parseJsonContent(content) : parseYamlContent(content)
  const absolutePath = resolve(filePath)
  const baseDir = dirname(absolutePath)
  const refSources = collectRefSources(rawParsed, baseDir)

  // Load with full $ref resolution
  const parsed = await loadFromFile(filePath)
  return { parsed, refSources }
}

const loadConfigForValidationWithSources = async (
  filePath: string
): Promise<{ readonly parsed: unknown; readonly refSources: ReadonlyMap<string, string> }> => {
  // eslint-disable-next-line functional/no-expression-statements
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
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }
}

/**
 * Check if a field type is recognized or plausible.
 *
 * A type is considered recognized if:
 * 1. It exactly matches a known type
 * 2. Its hyphenated form (underscores -> hyphens) matches a known type
 * 3. It is a single-word type (no separators) -- common SQL/programming aliases
 *
 * Multi-segment types that don't normalize to a known type are flagged as unknown.
 */
const isRecognizedFieldType = (fieldType: string, knownTypes: readonly string[]): boolean => {
  if (knownTypes.includes(fieldType as (typeof knownTypes)[number])) {
    return true
  }
  const normalized = fieldType.replace(/_/g, '-')
  if (knownTypes.includes(normalized as (typeof knownTypes)[number])) {
    return true
  }
  // Single-word types without separators are plausible type aliases (e.g. "number", "text")
  return !fieldType.includes('_') && !fieldType.includes('-')
}

/**
 * Detect unknown field types in tables and report with source file attribution
 */
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

/**
 * Handle the 'validate' command - validate a config file against AppSchema
 */
export const handleValidateCommand = async (filePath?: string): Promise<void> => {
  if (!filePath) {
    Effect.runSync(
      Console.error(
        'Error: No config file provided\n\nUsage:\n  sovrium validate <config.json|config.yaml>'
      )
    )
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  // Load resolved config and collect $ref source mappings for error attribution
  const { parsed, refSources } = await loadConfigForValidationWithSources(filePath)

  // Inline validation using domain-only imports (avoids loading native CSS modules
  // that would fail in compiled binary mode)
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
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  // Post-validation: check for unknown field types that passed via UnknownFieldSchema
  const unknownFieldErrors = await detectUnknownFieldTypes(parsed, refSources)

  if (unknownFieldErrors.length > 0) {
    const errorLines = unknownFieldErrors.map((err) => `  ${err}`).join('\n')
    Effect.runSync(Console.error(`Validation failed:\n${errorLines}`))
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  // Coming-soon warnings: emit advisory lines for any property whose value
  // references a coming-soon Effect Schema. Non-fatal — the config is still
  // valid; we're flagging that some features are unimplemented and will be
  // ignored at runtime. The warner's output goes to stdout (same channel as
  // the success message) because Bun wraps stderr in ANSI codes under
  // FORCE_COLOR (Playwright sets it for E2E), which would break the locked
  // line-anchored regex in CLI-COMING-SOON-007.
  Effect.runSync(warnForConfig(parsed))

  Effect.runSync(
    Console.log(`Valid configuration: ${(parsed as Record<string, unknown>).name ?? 'unnamed'}`)
  )
}
