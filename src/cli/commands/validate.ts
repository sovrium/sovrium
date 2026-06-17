/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname, basename, resolve } from 'node:path'
import { Effect, Console } from 'effect'
import { detectFormat } from '@/domain/utils'
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

export const detectUnknownFieldTypes = async (
  parsed: unknown,
  refSources: ReadonlyMap<string, string>
): Promise<readonly string[]> => {
  const { KNOWN_FIELD_TYPES } =
    await import('@/domain/models/app/tables/fields/field-types/advanced/unknown-field')

  const { tables } = parsed as Record<string, unknown>

  if (!Array.isArray(tables)) {
    return []
  }

  const bulkSourceFile = refSources.get('tables')
  const bulkSourceLabel = bulkSourceFile ? basename(bulkSourceFile) : undefined

  return tables.flatMap((table: Record<string, unknown>, index: number) => {
    const { fields } = table
    if (!Array.isArray(fields)) {
      return []
    }

    const perIndexSourceFile = refSources.get(`tables[${index}]`)
    const sourceLabel = perIndexSourceFile ? basename(perIndexSourceFile) : bulkSourceLabel

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

const isCloudModeEnabled = (): boolean => {
  const flag = Bun.env.SOVRIUM_CLOUD_MODE
  return typeof flag === 'string' && flag.trim().length > 0
}

const collectCloudActionNames = (actions: unknown): readonly string[] => {
  if (!Array.isArray(actions)) return []
  return actions.flatMap((action: unknown): readonly string[] => {
    if (typeof action !== 'object' || action === null) return []
    const a = action as Record<string, unknown>
    const self = a.type === 'cloud' ? [typeof a.name === 'string' ? a.name : '<unnamed>'] : []

    const props = a.props as Record<string, unknown> | undefined
    const loopNested = props ? collectCloudActionNames(props.actions) : []
    const pathNested = Array.isArray(props?.paths)
      ? props.paths.flatMap((branch: unknown) =>
          typeof branch === 'object' && branch !== null
            ? collectCloudActionNames((branch as Record<string, unknown>).actions)
            : []
        )
      : []

    return [...self, ...loopNested, ...pathNested]
  })
}

export const detectGatedCloudActions = (parsed: unknown): readonly string[] => {
  if (isCloudModeEnabled()) return []

  const { automations } = parsed as Record<string, unknown>
  if (!Array.isArray(automations)) return []

  const offending = automations.flatMap((automation: unknown): readonly string[] => {
    if (typeof automation !== 'object' || automation === null) return []
    const auto = automation as Record<string, unknown>
    const automationName = typeof auto.name === 'string' ? auto.name : '<unnamed>'
    return collectCloudActionNames(auto.actions).map(
      (actionName) =>
        `Action "${actionName}" in automation "${automationName}" uses "type: cloud", which requires the Sovrium Cloud host gate (SOVRIUM_CLOUD_MODE). This config is not running in cloud mode.`
    )
  })

  return offending
}

const runPostDecodeChecks = async (
  parsed: unknown,
  refSources: ReadonlyMap<string, string>
): Promise<readonly string[]> => {
  const unknownFieldErrors = await detectUnknownFieldTypes(parsed, refSources)
  if (unknownFieldErrors.length > 0) return unknownFieldErrors
  return detectGatedCloudActions(parsed)
}

export const validateAppConfig = async (
  filePath: string
): Promise<
  | { readonly valid: true; readonly name: string }
  | { readonly valid: false; readonly errors: readonly string[] }
> => {
  const format = detectFormat(filePath)
  if (format === 'unsupported') {
    return {
      valid: false,
      errors: [`Unsupported file format (expected .json, .yaml, .yml, or .ts)`],
    }
  }

  const { loadSchemaFromFile: loadFromFile, collectRefSources } = await lazyImportSchema()

  const parseResult = await parseConfigWithRefSources(
    filePath,
    format,
    loadFromFile,
    collectRefSources
  ).then(
    (result) => ({ ok: true as const, ...result }),
    (error: unknown) => ({ ok: false as const, error })
  )
  if (!parseResult.ok) {
    return {
      valid: false,
      errors: [
        `Failed to parse file: ${parseResult.error instanceof Error ? parseResult.error.message : String(parseResult.error)}`,
      ],
    }
  }
  const { parsed, refSources } = parseResult

  const { decodeAppConfigObject } = await import('@/application/use-cases/schema/decode-app-config')
  const decoded = decodeAppConfigObject(parsed)
  if (!decoded.valid) return decoded

  const unknownFieldErrors = await detectUnknownFieldTypes(parsed, refSources)
  if (unknownFieldErrors.length > 0) {
    return { valid: false, errors: unknownFieldErrors }
  }

  return decoded
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

  const postDecodeErrors = await runPostDecodeChecks(parsed, refSources)

  if (postDecodeErrors.length > 0) {
    const errorLines = postDecodeErrors.map((err) => `  ${err}`).join('\n')
    Effect.runSync(Console.error(`Validation failed:\n${errorLines}`))
    process.exit(1)
  }

  Effect.runSync(
    Console.log(`Valid configuration: ${(parsed as Record<string, unknown>).name ?? 'unnamed'}`)
  )
}
