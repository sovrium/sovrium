/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname, basename, join, resolve } from 'node:path'
import { Effect, Console } from 'effect'
import { printConfigDeprecationWarnings } from '@/cli/runtime/config-deprecation-warnings'
import { detectFormat } from '@/domain/kernel/config-parsing/format-detection'
import { formatMessageReport } from '@/domain/models/app/app-config-report-service'
import { messageAsConfigFinding } from '@/domain/models/app/app-excess-property-report'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { lazyImportSchema } from './utils'
import {
  parseConfigWithRefSources,
  validateFileExists,
  validateFileFormat,
} from './validate-config-source'
import { coveredFiles, discoverValidationConfig, printJsonReport } from './validate-report'
import type { ConfigFinding } from '@/domain/models/app/app-excess-property-report'

/**
 * The `$ref` source map of a config file, for ATTRIBUTION only, never fatal.
 *
 * `start` and `build` read their config through their own loader, which keeps
 * no source map; this re-reads the root's raw content so their refusal can name
 * the partial a problem lives in, exactly as `validate`'s does. Any failure here
 * yields an empty map: the loader has already parsed the file, and a report
 * without headings is better than a refusal about attribution. A TypeScript
 * config has no `$ref`s.
 */
export const collectConfigAttribution = async (
  configFile: string | undefined
): Promise<{ readonly refSources?: ReadonlyMap<string, string>; readonly configFile?: string }> => {
  // An inline config (`APP_SCHEMA=...`) has no file, so nothing to attribute to.
  if (configFile === undefined) return {}
  const absolutePath = resolve(configFile)
  const format = detectFormat(absolutePath)
  if (format !== 'json' && format !== 'yaml') {
    return { refSources: new Map<string, string>(), configFile: absolutePath }
  }
  try {
    const { collectRefSources } = await lazyImportSchema()
    const { parseYamlContent, parseJsonContent } =
      await import('@/domain/models/app/app-content-parsing')
    const content = await Bun.file(absolutePath).text()
    const raw = format === 'json' ? parseJsonContent(content) : parseYamlContent(content)
    return { refSources: collectRefSources(raw, dirname(absolutePath)), configFile: absolutePath }
  } catch {
    return { refSources: new Map<string, string>(), configFile: absolutePath }
  }
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
    process.exit(1)
  }
}

/**
 * Check if a field type is recognized.
 *
 * A type is recognized if:
 * 1. It exactly matches a known type
 * 2. Its hyphenated form (underscores -> hyphens) matches a known type
 *
 * Anything else is unknown — a single word included. An earlier third rule
 * waved through any separator-free string as a "plausible alias" (`number`,
 * `text`), so `foobar` validated and then refused to boot. `number` is now a
 * catalogued type in its own right; nothing else single-word is an alias.
 */
const isRecognizedFieldType = (fieldType: string, knownTypes: readonly string[]): boolean =>
  knownTypes.includes(fieldType) || knownTypes.includes(fieldType.replace(/_/g, '-'))

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
        return `${prefix}Unknown field type "${field.type}" in field "${field.name}". Known field types: ${KNOWN_FIELD_TYPES.join(', ')}`
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
 * ON THE UNKNOWN-FIELD-TYPE SWEEP, which is the `validate`-only one. The
 * data-table field-reference sweep, the cross-component field-reference sweep
 * and the `rowColorField` sweep run inside `decodeAppConfigObject`, so `start`
 * and `build` refuse the same configs `validate` does. This sweep deliberately
 * does NOT run there.
 *
 * NOT BECAUSE OF THE SOURCE MAP. It is tempting to say the sweep "depends on
 * the `$ref` source map collected at parse time, which an in-memory config
 * never has". It does not: `refSources` is used for ATTRIBUTION only — the `<file>: ` prefix
 * naming which partial a table came from. Detection is
 * `isRecognizedFieldType(field.type, KNOWN_FIELD_TYPES)` and needs no map at
 * all; handed an empty one the sweep still detects, it just cannot name a
 * source. That is graceful degradation, not a dependency.
 *
 * THE REAL REASON: BOOT ALREADY REFUSES, AND THREE SPECS PIN HOW. An
 * unrecognised `type` reaches `generateCreateTableDDL`, which throws `Unknown
 * field type: <type>` from INSIDE the migration transaction. A migration error spec
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
 *
 * Exported because `sovrium mcp` owes the identical sweep: `{app}_config_validate`
 * reports on the config ON DISK, so a config that decodes and would then refuse
 * to boot must not come back clean there either. A second copy would be free to
 * drift, and only one of the two would receive the next fix.
 *
 * @public
 */
export const runPostDecodeChecks = async (
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
export interface ValidationOutcome {
  readonly valid: boolean
  readonly name: string
  readonly errors: readonly string[]
  /**
   * The same refusal as `errors`, located and structured — what `--json`
   * publishes.
   *
   * Two renderings of one verdict rather than two verdicts: they are derived
   * from the same decode, so a caller reading the JSON and a caller reading the
   * terminal cannot be told about different mistakes.
   */
  readonly findings: readonly ConfigFinding[]
  /**
   * The same refusal as the report a person reads — a count line, then every
   * problem grouped by file. What `sovrium validate` prints, and what `start`
   * and `build` print for the same config.
   */
  readonly report: readonly string[]
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
 * One implementation for both, so they cannot disagree (as they would if the
 * interactive command re-implemented the decode inline). Both land here, which
 * in turn lands on `decodeAppConfigObject` — the same pipeline `sovrium start`
 * and `sovrium build` run.
 *
 * `refSources` is forwarded into the pipeline as well as used by the sweep
 * below: the excess-property reporter uses it to name which `$ref` partial an
 * unrecognised key came from, and that attribution is available here and only
 * here, because only a file-backed config has partials to attribute to.
 *
 * Exported because `sovrium library add` owes the identical verdict, twice: on
 * the config before it touches it, and on the candidate graph before it writes.
 * A second copy would let `library add` accept a config `validate` refuses.
 */
export const validateParsedConfig = async (
  parsed: unknown,
  refSources: ReadonlyMap<string, string>,
  configFile?: string
): Promise<ValidationOutcome> => {
  // Lazily imported to keep the compiled-binary `validate` path domain-only.
  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const decoded = decodeAppConfigObject(parsed, {
    refSources,
    ...(configFile !== undefined && { configFile }),
  })

  if (!decoded.valid) {
    return {
      valid: false,
      name: '',
      errors: decoded.errors,
      findings: decoded.findings,
      report: decoded.report,
      notices: [],
    }
  }

  // The asset files, checked as the boot loads them: same function, same verdict.
  const { assetProjectDir, assetTemplateIssues, loadPrivateAssets } =
    await import('@/infrastructure/assets/private-assets')
  const projectDir = assetProjectDir(configFile)
  const assets = await loadPrivateAssets(decoded.app.assets, projectDir, join(projectDir, 'public'))
  const postDecodeErrors = [
    ...(await runPostDecodeChecks(decoded, refSources)),
    ...(assets.ok ? assetTemplateIssues(decoded.app, assets.store) : assets.issues),
  ]
  return {
    valid: postDecodeErrors.length === 0,
    name: decoded.name,
    errors: postDecodeErrors,
    // The two sweeps above relate a declaration to a catalogue rather than to a
    // position in the document, so they have no path to publish and are carried
    // whole. Dropping them from the structured channel is the alternative, and
    // it would let a caller that reads only `findings` see `valid: false` with
    // nothing to act on.
    findings: postDecodeErrors.map((error) => messageAsConfigFinding(error)),
    report: formatMessageReport(postDecodeErrors),
    notices: decoded.notices,
  }
}

/**
 * Handle the 'validate' command - validate a config file against AppSchema
 */
export const handleValidateCommand = async (filePath?: string, json = false): Promise<void> => {
  const resolvedPath = filePath ?? (await discoverValidationConfig())

  // Load resolved config and collect $ref source mappings for error attribution
  const { parsed, refSources } = await loadConfigForValidationWithSources(resolvedPath)
  // Deprecated keys still decode, so only a walk of the raw config sees them.
  printConfigDeprecationWarnings(parsed)
  const outcome = await validateParsedConfig(parsed, refSources, resolve(resolvedPath))

  if (json) {
    return printJsonReport(outcome, coveredFiles(resolvedPath, refSources))
  }

  if (!outcome.valid) {
    // The `Error: ` prefix is what operators and log scrapers grep for, and this
    // is the one fatal path in the CLI that omitted it. The wording is otherwise
    // unchanged: "Validation failed" is the constraint, and it is asserted
    // verbatim by config-validation.spec.ts and printed in the published docs.
    //
    // No guidance line, deliberately (T18): the error block already names every
    // offending property and value, so the block IS the guidance. `validate` also
    // has no side effects, so there is no "nothing was written" to reassure about.
    //
    // The report is the one `start` and `build` print for the same config: every
    // problem, counted, grouped under the file it lives in.
    printStderr(`Error: Validation failed.\n\n${outcome.report.join('\n')}`)
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
