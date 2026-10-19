/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium design-system import <path> [--config <file>] [--from <format>]
 * [--dry-run | --write] [--json]`
 *
 * A file-to-file conversion: it reads a token file a design tool exported,
 * converts it through that tool's adapter into canonical tokens, maps those
 * onto the app's `design` key through the one mapper, and prints the change —
 * or, with `--write`, writes it. No flag is a dry run.
 *
 * ─── THE BOUNDS IT KEEPS ───────────────────────────────────────────────────
 *
 * It reads a local path and the operator's config, and writes only `design`
 * (or, for a TypeScript config, a sidecar beside it). No network, no server,
 * no database, no environment, no table data; never over HTTP, in the
 * console or as an MCP tool. The same input gives the same output every time,
 * a second `--write` changes nothing, and components are never imported.
 *
 * ─── EVERY REFUSAL IS A REFUSAL ───────────────────────────────────────────
 *
 * A file that is not a token file, one matching two formats, an unknown
 * `--from`, a URL, and a config that fails validation all exit 1 with what
 * to do instead. Each would otherwise exit 0 with a diff that misleads.
 */

import { resolve } from 'node:path'
import {
  IMPORT_FORMATS,
  type ImportFormat,
} from '@/domain/models/app/design/adapters/import/canonical-tokens-service'
import {
  detectImportFormats,
  readImportSource,
} from '@/domain/models/app/design/adapters/import/import-format-service'
import { planDesignImport } from '@/domain/models/app/design/design-import-service'
import { getFlagValue } from '../runtime/flag-vocabulary'
import { refuse } from './app-prelude'
import { readImportSourcePath, type ReadSource } from './design-system-import-source'
import {
  designCommentLines,
  designIncludeOf,
  writeConfigDesign,
  writeDesignSidecar,
  type WrittenDesign,
} from './design-system-import-write'
import { indented, rootFormatOf } from './library-add-config'
import { lazyImportSchema } from './utils'
import { loadConfigForValidationWithSources, validateParsedConfig } from './validate'
import type {
  DesignSystemImportReport,
  DesignSystemImportFormat,
} from '@/domain/models/app/design/adapters/import/design-import-report'
import type { DesignImportPlan } from '@/domain/models/app/design/design-import-service'

/** The request, as read from argv. */
interface ImportRequest {
  readonly source: string
  readonly config: string | undefined
  readonly from: ImportFormat | undefined
  readonly write: boolean
  readonly json: boolean
}

const FORMAT_LIST = IMPORT_FORMATS.join(', ')

const USAGE =
  'Usage:\n  sovrium design-system import <file|folder> --config <app.yaml|app.json|app.ts> ' +
  '[--from <format>] [--dry-run | --write] [--json]'

const readFrom = (raw: string | undefined): ImportFormat | undefined => {
  if (raw === undefined) return undefined
  const format = IMPORT_FORMATS.find((candidate) => candidate === raw.trim().toLowerCase())
  return (
    format ?? refuse(`Error: Unsupported --from "${raw}".\n\n  Accepted formats: ${FORMAT_LIST}.`)
  )
}

/** Read the request off argv (`design-system import <path> …`). */
const readRequest = (argv: readonly string[], positional: readonly string[]): ImportRequest => {
  const source = positional[1]
  if (source === undefined) return refuse(`Error: No token file or folder given.\n\n${USAGE}`)
  const write = argv.includes('--write')
  if (write && argv.includes('--dry-run')) {
    return refuse('Error: --write and --dry-run contradict each other. Choose one.')
  }
  return {
    source,
    config: getFlagValue(argv, '--config'),
    from: readFrom(getFlagValue(argv, '--from')),
    write,
    json: argv.includes('--json'),
  }
}

/** The config to import into: `--config`, else the one discovered in the working directory. */
const resolveConfig = async (config: string | undefined): Promise<string> => {
  if (config !== undefined) {
    const path = resolve(process.cwd(), config)
    return (await Bun.file(path).exists()) ? path : refuse(`Error: No config file at "${config}".`)
  }
  const { discoverDefaultConfigFile } = await lazyImportSchema()
  const discovered = await discoverDefaultConfigFile(process.cwd())
  return discovered === undefined
    ? refuse(`Error: No app config found in ${process.cwd()}. Name one with --config.\n\n${USAGE}`)
    : resolve(process.cwd(), discovered)
}

/** Load and judge the config, refusing with the verdict `sovrium validate` gives. */
const loadValidConfig = async (configPath: string) => {
  const loaded = await loadConfigForValidationWithSources(configPath)
  const outcome = await validateParsedConfig(loaded.parsed, loaded.refSources)
  if (outcome.errors.length > 0) {
    return refuse(
      `Error: The config does not validate, so the import changed nothing.\n\n${indented(outcome.errors)}`
    )
  }
  return loaded
}

/** The format to read the source as: `--from`, or the one its shape matches. */
const chooseFormat = (read: ReadSource, from: ImportFormat | undefined): ImportFormat => {
  if (from !== undefined) return from
  const formats = detectImportFormats(read.source)
  if (formats.length > 1) {
    return refuse(
      `Error: "${read.path}" matches more than one token format: ${formats.join(', ')}.\n\n` +
        `  Name the one it is with --from ${formats.map((format) => `<${format}>`).join(' or ')}, ` +
        `e.g. --from ${formats[0] ?? ''}.`
    )
  }
  return (
    formats[0] ??
    refuse(
      `Error: "${read.path}" is not a token file the import reads.\n\n` +
        `  Accepted formats: ${FORMAT_LIST}.\n` +
        '  Pass the file or folder a design tool exported, or name its format with --from.'
    )
  )
}

/** Everything one run decided, for the report. */
interface RunOutcome {
  readonly read: ReadSource
  readonly format: ImportFormat
  readonly forced: boolean
  readonly plan: DesignImportPlan
  readonly modes: DesignSystemImportReport['modes']
  readonly components: number
  readonly written: WrittenDesign | undefined
}

const buildReport = ({
  read,
  format,
  forced,
  plan,
  modes,
  components,
  written,
}: RunOutcome): DesignSystemImportReport => ({
  format: 'sovrium.design-system.import-report',
  version: 1,
  source: { path: read.path, format: format satisfies DesignSystemImportFormat, forced },
  modes,
  changes: plan.changes.map((change) => ({
    path: `design.${change.path.join('.')}`,
    ...(change.before === undefined ? {} : { before: change.before }),
    after: String(change.value),
  })),
  unmapped: plan.unmapped,
  components: { imported: false, found: components },
  ...(written === undefined ? {} : { written }),
})

const changeLine = (change: DesignSystemImportReport['changes'][number]): string =>
  change.before === undefined
    ? `  + ${change.path}: ${change.after}`
    : `  ~ ${change.path}: ${change.before} -> ${change.after}`

/** Unmapped entries sharing one kind and reason past this many are summarised in text. */
const UNMAPPED_SUMMARY_AT = 6

/**
 * The unmapped report as text lines. A run of entries with the same kind and
 * reason (a Style Dictionary `dimensions` group, say) is one line naming the
 * first few; `--json` keeps every entry.
 */
const unmappedLines = (unmapped: DesignSystemImportReport['unmapped']): readonly string[] => {
  const groups = Map.groupBy(unmapped, (entry) => `${entry.kind}\u0000${entry.reason}`)
  return [...groups.values()].flatMap((entries) => {
    const [first] = entries
    if (first === undefined) return []
    if (entries.length < UNMAPPED_SUMMARY_AT) {
      return entries.map((entry) => `  ${entry.kind} ${entry.token}: ${entry.reason}`)
    }
    const named = entries.slice(0, 3).map((entry) => entry.token)
    return [
      `  ${first.kind} ${named.join(', ')} and ${entries.length - named.length} more: ${first.reason}`,
    ]
  })
}

const writtenLines = (written: WrittenDesign | undefined, dryRun: boolean): readonly string[] => {
  if (written === undefined) {
    return [
      dryRun
        ? 'Nothing written (dry run). Run again with --write to apply.'
        : 'Nothing to change, so nothing was written.',
    ]
  }
  if (written.sidecar === undefined) return [`Wrote design into ${written.config ?? ''}.`]
  return [
    `Wrote the whole design to ${written.sidecar}. The TypeScript config was not edited.`,
    '',
    'Add this line at the top of the config:',
    `  ${written.importLine ?? ''}`,
    'and replace its inline `design: { … }` block with:',
    `  ${written.propertyLine ?? ''}`,
  ]
}

const renderText = (
  report: DesignSystemImportReport,
  dryRun: boolean,
  droppedComments: number
): string => {
  const { changes, unmapped, components } = report
  const lines = [
    `Design import from ${report.source.path} (${report.source.format}, ${report.source.forced ? 'named with --from' : 'detected'})`,
    `Modes read: ${report.modes.join(', ')}`,
    '',
    changes.length === 0
      ? 'No change: the config already paints these tokens.'
      : `Changes (${changes.length}):`,
    ...changes.map(changeLine),
    ...(unmapped.length === 0 ? [] : ['', `Unmapped (${unmapped.length}), left out of design:`]),
    ...unmappedLines(unmapped),
    ...(components.found === 0
      ? []
      : [
          '',
          `${components.found} component${components.found === 1 ? '' : 's'} found, not imported: the import reads tokens only.`,
        ]),
    '',
    ...writtenLines(report.written, dryRun),
    ...(droppedComments === 0
      ? []
      : [
          `Note: ${droppedComments} comment line${droppedComments === 1 ? '' : 's'} inside \`design:\` ` +
            `${dryRun ? 'would not be' : droppedComments === 1 ? 'was not' : 'were not'} kept: ` +
            'the import rewrites that block.',
        ]),
  ]
  return `${lines.join('\n').trimEnd()}\n`
}

const write = async (
  configPath: string,
  loaded: { readonly parsed: unknown; readonly refSources: ReadonlyMap<string, string> },
  plan: DesignImportPlan
): Promise<WrittenDesign | undefined> => {
  // Nothing to change writes nothing, a sidecar included: an unchanged design
  // needs no file to paste.
  if (plan.changes.length === 0) return undefined
  const format = rootFormatOf(configPath)
  if (format === 'typescript') {
    return writeDesignSidecar(configPath, loaded.parsed, loaded.refSources, plan.design)
  }
  const declared = (loaded.parsed as Readonly<Record<string, unknown>> | undefined)?.['design']
  const include = designIncludeOf(await Bun.file(configPath).text(), format, declared)
  if (include !== undefined) {
    return refuse(
      `Error: The config includes its design from "${include}", so the import does not patch it in place.\n\n` +
        '  Import into a config whose `design` is inline, or copy the dry-run changes into that file.'
    )
  }
  return writeConfigDesign(configPath, format, plan.design)
}

/**
 * Handle `sovrium design-system import`.
 *
 * @param argv - the raw arguments after the binary name.
 * @param positional - the positional arguments after `design-system` (`import`, the path).
 */
export const handleDesignSystemImportCommand = async (
  argv: readonly string[],
  positional: readonly string[]
): Promise<void> => {
  const request = readRequest(argv, positional)
  const read = await readImportSourcePath(request.source)
  const configPath = await resolveConfig(request.config)
  const loaded = await loadValidConfig(configPath)
  const format = chooseFormat(read, request.from)
  const result = readImportSource(read.source, format)
  if (!result.ok)
    return refuse(`Error: "${read.path}" cannot be read as ${format}. ${result.error}`)
  const declared = (loaded.parsed as Readonly<Record<string, unknown>> | undefined)?.['design']
  const plan = planDesignImport(result.value, declared)
  // Counted before the write, which is what drops them.
  const droppedComments =
    plan.changes.length > 0 && rootFormatOf(configPath) === 'yaml'
      ? designCommentLines(await Bun.file(configPath).text())
      : 0
  const written = request.write ? await write(configPath, loaded, plan) : undefined
  const components = read.isFolder || format === 'claude-design' ? read.components : 0
  const modes =
    result.value.dark === undefined ? (['light'] as const) : (['light', 'dark'] as const)
  const report = buildReport({
    read,
    format,
    forced: request.from !== undefined,
    plan,
    modes,
    components,
    written,
  })
  process.stdout.write(
    request.json
      ? `${JSON.stringify(report, undefined, 2)}\n`
      : renderText(report, !request.write, droppedComments)
  )
}
