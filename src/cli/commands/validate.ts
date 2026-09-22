/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname, basename, resolve } from 'node:path'
import { Effect, Console } from 'effect'
import {
  formatConfigCandidatesLine,
  formatDiscoveredConfigNotice,
} from '@/domain/kernel/config-parsing/default-config-files'
import { detectFormat } from '@/domain/kernel/config-parsing/format-detection'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { lazyImportSchema } from './utils'

/**
 * Load config file for validation, returning both resolved data and $ref source mappings
 */
const validateFileExists = async (filePath: string): Promise<void> => {
  const exists = await Bun.file(filePath).exists()
  if (!exists) {
    printStderr(`Error: File not found: ${filePath}`)
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }
}

const validateFileFormat = (filePath: string): ReturnType<typeof detectFormat> => {
  const format = detectFormat(filePath)
  if (format === 'unsupported') {
    printStderr(`Error: Unsupported file format. Supported: .json, .yaml, .yml, .ts`)
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

  const { parseYamlContent, parseJsonContent } =
    await import('@/domain/models/app/app-content-parsing')

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

/**
 * Parse a config file and collect its `$ref` source map, exiting the process on
 * a missing file, an unsupported extension, or a parse failure.
 *
 * Exported because `sovrium design-system` needs the SAME parse: a config that
 * this command can read and that one cannot (or reads differently) would let
 * the two disagree about what an operator's config says.
 */
export const loadConfigForValidationWithSources = async (
  filePath: string
): Promise<{ readonly parsed: unknown; readonly refSources: ReadonlyMap<string, string> }> => {
  await validateFileExists(filePath)
  const format = validateFileFormat(filePath)
  const { loadSchemaFromFile: loadFromFile, collectRefSources } = await lazyImportSchema()

  try {
    return await parseConfigWithRefSources(filePath, format, loadFromFile, collectRefSources)
  } catch (error) {
    printStderr(
      `Error: Failed to parse file: ${error instanceof Error ? error.message : String(error)}`
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

  // Bulk source: the entire `tables` array came from a single `$ref` file
  // (e.g. `tables: { $ref: ./tables.yaml }`). Each entity in that array
  // shares the same source label.
  const bulkSourceFile = refSources.get('tables')
  const bulkSourceLabel = bulkSourceFile ? basename(bulkSourceFile) : undefined

  return tables.flatMap((table: Readonly<Record<string, unknown>>, index: number) => {
    const { fields } = table
    if (!Array.isArray(fields)) {
      return []
    }

    // Per-entity source: this specific table came from an array-element `$ref`
    // (e.g. `tables: [{ $ref: ./tables/widgets.yaml }]`). Per-index attribution
    // wins over the bulk label so error messages point at the entity file.
    const perIndexSourceFile = refSources.get(`tables[${index}]`)
    const sourceLabel = perIndexSourceFile ? basename(perIndexSourceFile) : bulkSourceLabel

    return fields
      .filter(
        (field: Readonly<Record<string, unknown>>) =>
          typeof field.type === 'string' && !isRecognizedFieldType(field.type, KNOWN_FIELD_TYPES)
      )
      .map((field: Readonly<Record<string, unknown>>) => {
        const prefix = sourceLabel ? `${sourceLabel}: ` : ''
        return `${prefix}Unknown field type "${field.type}" in field "${field.name}"`
      })
  })
}

/**
 * The post-decode sweeps `validate` runs on its own.
 *
 * Two of them, for opposite reasons. The code-action type-check is here because
 * `start` runs it and `validate` did not — a gap that let this command print
 * `Valid configuration` for a config whose boot dies with `TSValidationError`;
 * see `validate-code-actions.ts` for why that gate crosses over and the ten
 * env/network-dependent ones deliberately do not. The unknown-field-type sweep
 * below is the reverse case: `validate`-only on purpose, documented at its own
 * definition.
 *
 * ON THE UNKNOWN-FIELD-TYPE SWEEP, which is the `validate`-only one. Its three
 * former companions — the data-table field-reference sweep, the cross-component
 * field-reference sweep and the `rowColorField` sweep — now run inside
 * `decodeAppConfigObject`, so `start` and `build` refuse the same configs
 * `validate` does. That sweep deliberately did NOT go with them, and the reason
 * is NOT the one this file used to give.
 *
 * WHAT THE OLD REASON SAID, AND WHY IT WAS WRONG. It claimed the sweep "depends
 * on the `$ref` source map collected at parse time, which an in-memory config
 * never has". `refSources` is used for ATTRIBUTION only — the `<file>: ` prefix
 * naming which partial a table came from. Detection is
 * `isRecognizedFieldType(field.type, KNOWN_FIELD_TYPES)` and needs no map at
 * all; handed an empty one the sweep still detects, it just cannot name a
 * source. That is graceful degradation, not a dependency.
 *
 * THE REAL REASON: BOOT ALREADY REFUSES, AND THREE SPECS PIN HOW. An
 * unrecognised `type` reaches `generateCreateTableDDL`, which throws `Unknown
 * field type: <type>` from INSIDE the migration transaction. `[internal ref]`
 * and its two siblings assert that exact message AND the rollback it causes —
 * that a sibling table named earlier in the same config was not created.
 * Refusing at decode time would move the refusal before any transaction opened,
 * so those specs would keep passing while no longer exercising a rollback at
 * all: green assertions over an unreached code path. Changing where this refusal
 * lives is a re-specification of the migration contract, not a tightening of the
 * config contract, and it belongs with the specs that own that message.
 *
 * ONE NARROW GAP THIS LEAVES, recorded rather than papered over: the DDL
 * refusal fires when the table is CREATED. A second boot on an unchanged config
 * can take the schema-checksum fast path and never reach DDL, so `validate`
 * refuses where that boot would not. It is a real divergence and a small one —
 * the first boot of any such config already fails, so the config never reaches
 * a steady state this could hide.
 *
 * Returns a flat list of human-readable errors, empty when the config is clean.
 */
const runPostDecodeChecks = async (
  decoded: Readonly<{ readonly raw: unknown; readonly app: unknown }>,
  refSources: ReadonlyMap<string, string>
): Promise<readonly string[]> => {
  // Lazily imported for the same reason the decoder above is: it keeps the
  // compiled-binary `validate` path from resolving modules it may never need.
  const { validateCodeActionBodies } =
    await import('@/application/use-cases/config/validate-code-actions')
  // The code-action check is handed the DECODED app, which is what
  // `startServer` type-checks — so the two commands examine the same bodies
  // rather than two parses that could drift.
  const [fieldTypeErrors, codeActionErrors] = await Promise.all([
    detectUnknownFieldTypes(decoded.raw, refSources),
    validateCodeActionBodies(decoded.app),
  ])
  return [...fieldTypeErrors, ...codeActionErrors]
}

/**
 * The verdict on one already-parsed config: the shared pipeline plus the CLI's
 * own sweeps that need the `$ref` source map.
 */
interface ValidationOutcome {
  readonly valid: boolean
  readonly name: string
  readonly errors: readonly string[]
  /**
   * Non-fatal notices from the shared pipeline — today, deprecated config keys.
   *
   * Kept apart from `errors` all the way to the print site. A deprecation is
   * not a refusal: the config is valid, it ships, and it keeps shipping until
   * the key is actually removed. Folding the two together would make
   * `sovrium validate` exit non-zero on a working config, which is the one
   * thing a deploy gate must never do.
   */
  readonly notices: readonly string[]
}

/**
 * Validate one parsed config. THE single decode path behind both the
 * interactive `sovrium validate` command and the progress pipeline's sweep.
 *
 * Those two used to be separate implementations in this same file, and they
 * could disagree: the interactive command re-implemented the decode inline
 * while the pipeline sweep called the shared decoder. Now both land here, which
 * in turn lands on `decodeAppConfigObject` — the same pipeline `sovrium start`
 * and `sovrium build` run.
 *
 * `refSources` is forwarded into the pipeline as well as used by the sweep
 * below: the excess-property reporter uses it to name which `$ref` partial an
 * unrecognised key came from, and that attribution is available here and only
 * here, because only a file-backed config has partials to attribute to.
 */
const validateParsedConfig = async (
  parsed: unknown,
  refSources: ReadonlyMap<string, string>
): Promise<ValidationOutcome> => {
  // Lazily imported to keep the compiled-binary `validate` path domain-only.
  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const decoded = decodeAppConfigObject(parsed, { refSources })

  if (!decoded.valid) {
    return { valid: false, name: '', errors: decoded.errors, notices: [] }
  }

  const postDecodeErrors = await runPostDecodeChecks(decoded, refSources)
  return {
    valid: postDecodeErrors.length === 0,
    name: decoded.name,
    errors: postDecodeErrors,
    notices: decoded.notices,
  }
}

/**
 * Validate a config file against AppSchema WITHOUT exiting the process.
 *
 * Same parsing ($ref resolution), same pipeline and same post-decode sweeps as
 * `handleValidateCommand`, but collects errors and returns them instead of
 * calling `process.exit`. Used by the progress pipeline's app-config sweep so a
 * single invalid `app.yaml` can fail the gate without tearing down the run.
 *
 * @returns `{ valid: true, name }` on success, or `{ valid: false, errors }` with a
 *   flat list of human-readable validation messages.
 */
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

  // Parse + collect $ref sources without exiting the process on parse failure.
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

  const outcome = await validateParsedConfig(parseResult.parsed, parseResult.refSources)
  return outcome.valid
    ? { valid: true, name: outcome.name }
    : { valid: false, errors: outcome.errors }
}

/**
 * Resolve the config to validate when the operator named none.
 *
 * `validate` has no env-var source, so its order is simply positional →
 * discovery → refusal. Everything downstream is untouched: a discovered file
 * travels the same `loadConfigForValidationWithSources` path a named one does,
 * so it fails identically when it is broken.
 */
const discoverValidationConfig = async (): Promise<string> => {
  const { discoverDefaultConfigFile } = await lazyImportSchema()
  const discovered = await discoverDefaultConfigFile(process.cwd())

  if (!discovered) {
    printStderr(
      `Error: No config file provided.\n\n` +
        `${formatConfigCandidatesLine(process.cwd())}\n\n` +
        `Usage:\n  sovrium validate <config.json|config.yaml>\n\n` +
        `Run 'sovrium init' to scaffold a new project.`
    )
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  printStderr(formatDiscoveredConfigNotice(discovered))
  return discovered
}

/**
 * Handle the 'validate' command - validate a config file against AppSchema
 */
export const handleValidateCommand = async (filePath?: string): Promise<void> => {
  const resolvedPath = filePath ?? (await discoverValidationConfig())

  // Load resolved config and collect $ref source mappings for error attribution
  const { parsed, refSources } = await loadConfigForValidationWithSources(resolvedPath)
  const outcome = await validateParsedConfig(parsed, refSources)

  if (!outcome.valid) {
    // The `Error: ` prefix is what operators and log scrapers grep for, and this
    // is the one fatal path in the CLI that omitted it. The wording is otherwise
    // unchanged: "Validation failed" is the constraint, and it is asserted
    // verbatim by config-validation.spec.ts and printed in the published docs.
    //
    // No guidance line, deliberately (T18): the error block already names every
    // offending property and value, so the block IS the guidance. `validate` also
    // has no side effects, so there is no "nothing was written" to reassure about.
    const errorLines = outcome.errors.map((err) => `  ${err}`).join('\n')
    printStderr(`Error: Validation failed.\n\n${errorLines}`)
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  // Notices print BEFORE the verdict and on stderr, so the success line stays
  // the last thing on stdout — a caller piping `sovrium validate` still reads
  // one clean line, and a human still sees the deprecation.
  if (outcome.notices.length > 0) {
    const noticeLines = outcome.notices.map((notice) => `  ${notice}`).join('\n')
    printStderr(`Notice:\n\n${noticeLines}\n`)
  }

  Effect.runSync(Console.log(`Valid configuration: ${outcome.name}`))
}
