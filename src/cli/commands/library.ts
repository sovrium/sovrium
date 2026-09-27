/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium library list|search|show|add`
 *
 * A catalogue of ready-made blocks, connections and automation recipes, shipped
 * inside the binary and copied into an operator's project on request. The
 * installed fragment belongs to the operator: there is no runtime dependency on
 * the library, no registry to reach and no update that changes an app behind
 * its owner's back.
 *
 * ─── THE CATALOGUE IS LOADED INSIDE THE HANDLER ─────────────────────────────
 *
 * `src/cli/index.ts` imports every command eagerly, so a value import of the
 * catalogue at the top of this module would load every entry on the boot path
 * of `sovrium start`. It is reached through `await import()` below and nowhere
 * else in this file; the only static imports of `src/library/` are `type`
 * imports, which erase. `library-boot.test.ts` measures it.
 *
 * ─── EVERY REFUSAL NAMES WHAT WOULD HAVE BEEN ACCEPTED ──────────────────────
 *
 * An unknown subcommand, entry id, `--kind` or `--format` exits 1 and prints
 * the accepted values, rather than falling back to a default: a `--kind widget`
 * that listed nothing would read as "the library has no widgets".
 */

import { printStderr } from '@/infrastructure/logging/cli-output'
import { runLibraryAdd } from './library-add'
import {
  interleaveByProvider,
  isOperationId,
  loadAllOperationSets,
  loadOperationsModule,
  rankOperations,
  renderOperationHits,
  resolveOperationsRequest,
  selectsOperations,
  showOperation,
} from './library-operations'
import { libraryArticleAddress } from './library-wire'
import { getCurrentVersion } from './update'
import type { LibraryCatalogueApi, LibraryEntry } from '@/library/manifest/define'

/** Options as parsed from argv. */
export interface LibraryCommandOptions {
  /** Positionals after `library` — the subcommand, then its argument. */
  readonly args: readonly string[]
  readonly kind?: string
  readonly category?: string
  /** The RAW `--format` value, deliberately unvalidated by the parser. */
  readonly format?: string
  readonly sets: readonly string[]
  readonly as?: string
  readonly into?: string
  readonly dryRun: boolean
  readonly noWire: boolean
  /** `--tag <group>` — install one group of a provider's operations. */
  readonly tag?: string
  /** The RAW `--limit` value — `search` owns the refusal. */
  readonly limit?: string
  /** `--all` — install every operation of a provider. */
  readonly all?: boolean
  /** `--yes` — confirm an `--all` above the threshold. */
  readonly yes?: boolean
}

type LibraryFormat = 'md' | 'json'

const SUBCOMMANDS = ['list', 'search', 'show', 'add'] as const

/** The most results `library search` prints. */
const SEARCH_LIMIT = 20

/** Stop with a refusal on stderr and exit 1. */
const refuse = (message: string): never => {
  printStderr(message)
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
}

const emit = (content: string): void => {
  // eslint-disable-next-line functional/no-expression-statements
  process.stdout.write(content.endsWith('\n') ? content : `${content}\n`)
}

// eslint-disable-next-line unicorn/no-null -- JSON.stringify requires null as its replacer
const asJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`

/** Normalise `--format`, refusing anything else by name. */
const resolveFormat = (raw: string | undefined): LibraryFormat => {
  if (raw === undefined) return 'md'
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'md' || normalized === 'markdown') return 'md'
  if (normalized === 'json') return 'json'
  return refuse(
    `Error: Unsupported --format "${raw}".\n\n` +
      '  Accepted values: md (or markdown), json.\n' +
      '  Omitting --format prints the human-readable listing.'
  )
}

/**
 * The catalogue, loaded on demand — destructured at the await so `knip` can
 * see which of its exports are used, and handed on as readonly data.
 */
const loadCatalogueModule = async (): Promise<LibraryCatalogueApi> => {
  const { LIBRARY_KINDS, LIBRARY_TARGET_KEY, expectedTables, libraryEntryId, loadCatalogue } =
    await import('@/library/manifest/catalogue')
  return { LIBRARY_KINDS, LIBRARY_TARGET_KEY, expectedTables, libraryEntryId, loadCatalogue }
}

type CatalogueModule = LibraryCatalogueApi

/** An entry as `list --format json` publishes it. */
const publicShape = (catalogue: CatalogueModule, entry: LibraryEntry) => ({
  id: catalogue.libraryEntryId(entry),
  kind: entry.kind,
  category: entry.category,
  title: entry.title,
  tags: entry.tags,
  requires: entry.requires,
  env: entry.env,
  ...(entry.provider === undefined ? {} : { provider: entry.provider }),
})

/** One aligned row per entry: id, kind, category, title. */
const renderRows = (catalogue: CatalogueModule, entries: readonly LibraryEntry[]): string => {
  const ids = entries.map((entry) => catalogue.libraryEntryId(entry))
  const idWidth = Math.max(0, ...ids.map((id) => id.length))
  const kindWidth = Math.max(0, ...entries.map((entry) => entry.kind.length))
  const categoryWidth = Math.max(0, ...entries.map((entry) => entry.category.length))
  return entries
    .map(
      (entry, index) =>
        `${(ids[index] ?? '').padEnd(idWidth)}  ${entry.kind.padEnd(kindWidth)}  ` +
        `${entry.category.padEnd(categoryWidth)}  ${entry.title}`
    )
    .join('\n')
}

// =============================================================================
// list
// =============================================================================

const handleList = async (options: LibraryCommandOptions): Promise<void> => {
  const format = resolveFormat(options.format)
  const catalogue = await loadCatalogueModule()
  const kinds: readonly string[] = catalogue.LIBRARY_KINDS
  if (options.kind !== undefined && !kinds.includes(options.kind))
    return refuse(
      `Error: Unknown --kind "${options.kind}".\n\n  Accepted values: ${kinds.join(', ')}.`
    )

  const entries = (await catalogue.loadCatalogue()).filter(
    (entry) =>
      (options.kind === undefined || entry.kind === options.kind) &&
      (options.category === undefined || entry.category === options.category)
  )
  if (format === 'json') return emit(asJson(entries.map((entry) => publicShape(catalogue, entry))))

  return emit(
    entries.length === 0
      ? 'No library entry matches.\n'
      : `${renderRows(catalogue, entries)}\n\nShow one with \`sovrium library show <id>\`.\n`
  )
}

// =============================================================================
// search
// =============================================================================

/** How well one entry matches one lower-cased term. Zero means no match. */
const termScore = (catalogue: CatalogueModule, entry: LibraryEntry, term: string): number => {
  const includes = (text: string): boolean => text.toLowerCase().includes(term)
  return [
    catalogue.libraryEntryId(entry) === term || entry.slug === term ? 100 : 0,
    entry.slug.includes(term) ? 50 : 0,
    entry.provider?.name.toLowerCase() === term ? 40 : 0,
    entry.tags.some((tag) => tag.toLowerCase() === term) ? 30 : 0,
    includes(entry.title) ? 20 : 0,
    includes(entry.category) ? 10 : 0,
    includes(entry.description) ? 5 : 0,
  ].reduce((sum, score) => sum + score, 0)
}

/** A query as the lower-cased terms every hit must match. */
const termsOf = (query: string): readonly string[] =>
  query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term !== '')

/** `--limit`, a positive whole number, refused by name otherwise. */
const resolveLimit = (raw: string | undefined): number => {
  if (raw === undefined) return SEARCH_LIMIT
  const value = Number(raw)
  return Number.isInteger(value) && value > 0
    ? value
    : refuse(`Error: --limit expects a positive whole number, got "${raw}".`)
}

/** Every entry matching EVERY term, best first, ties broken by id. */
const rankEntries = (
  catalogue: CatalogueModule,
  entries: readonly LibraryEntry[],
  terms: readonly string[]
): readonly LibraryEntry[] =>
  entries
    .map((entry) => ({
      entry,
      scores: terms.map((term) => termScore(catalogue, entry, term)),
    }))
    .filter(({ scores }) => scores.every((score) => score > 0))
    .map(({ entry, scores }) => ({ entry, score: scores.reduce((a, b) => a + b, 0) }))
    .toSorted(
      (left, right) =>
        right.score - left.score ||
        catalogue.libraryEntryId(left.entry).localeCompare(catalogue.libraryEntryId(right.entry))
    )
    .map(({ entry }) => entry)

const handleSearch = async (options: LibraryCommandOptions): Promise<void> => {
  const format = resolveFormat(options.format)
  const query = options.args.slice(1).join(' ')
  if (query.trim() === '')
    return refuse('Error: `sovrium library search <query>` needs something to look for.')

  const limit = resolveLimit(options.limit)
  const terms = termsOf(query)
  const [catalogue, operations] = await Promise.all([loadCatalogueModule(), loadOperationsModule()])
  // The catalogue's entries first, then the API operations, under one limit.
  const hits = rankEntries(catalogue, await catalogue.loadCatalogue(), terms).slice(0, limit)
  const operationHits = interleaveByProvider(
    rankOperations(await loadAllOperationSets(operations), terms)
  ).slice(0, limit - hits.length)
  if (format === 'json')
    return emit(
      asJson([
        ...hits.map((entry) => publicShape(catalogue, entry)),
        ...operationHits.map((hit) => ({
          id: hit.id,
          kind: 'operation',
          provider: hit.provider,
          method: hit.operation.method,
          path: hit.operation.path,
          ...(hit.operation.summary === undefined ? {} : { summary: hit.operation.summary }),
        })),
      ])
    )
  if (hits.length === 0 && operationHits.length === 0)
    return refuse(
      `Error: No library entry matches "${query}".\n\n` +
        '  The whole catalogue is `sovrium library list`.'
    )
  return emit(
    [
      ...(hits.length === 0 ? [] : [renderRows(catalogue, hits), '']),
      ...(operationHits.length === 0
        ? []
        : [
            'API operations — install one with `sovrium library add <provider>/<operation>`:',
            '',
            renderOperationHits(operationHits),
          ]),
    ].join('\n')
  )
}

// =============================================================================
// show
// =============================================================================

const renderParams = (entry: LibraryEntry): readonly string[] =>
  entry.params.length === 0
    ? ['Parameters: none']
    : [
        'Parameters:',
        ...entry.params.map((param) => {
          const status =
            param.required === true
              ? 'required'
              : param.default === undefined
                ? 'optional'
                : `default: ${String(param.default)}`
          return `  ${param.name} (${param.type}, ${status}) — ${param.description}`
        }),
      ]

/**
 * The tables the entry reads, named by their defaults, and the `--set` that
 * binds each one to the operator's own table.
 */
const renderTables = (catalogue: CatalogueModule, entry: LibraryEntry): readonly string[] => {
  const defaults = Object.fromEntries(entry.params.map((param) => [param.name, param.default]))
  const tables = catalogue.expectedTables(entry, defaults)
  return tables.length === 0
    ? []
    : [
        'Expects these tables in your config:',
        ...tables.flatMap((table) => [
          `  ${table.table} (--set ${table.param}=<your table>) with fields:`,
          ...table.fields.map(
            (field) =>
              `    ${field.name} (${field.type})${field.param === undefined ? '' : ` — --set ${field.param}=<your field>`}`
          ),
        ]),
      ]
}

const renderShow = (catalogue: CatalogueModule, entry: LibraryEntry): string => {
  const id = catalogue.libraryEntryId(entry)
  const key = catalogue.LIBRARY_TARGET_KEY[entry.kind]
  return [
    `# ${entry.title}`,
    '',
    `${id} — ${entry.kind}, ${entry.category}`,
    '',
    entry.description,
    '',
    `Installs into: ${key} (library/${entry.kind}/${entry.slug}.yaml)`,
    ...renderParams(entry),
    ...renderTables(catalogue, entry),
    `Environment variables: ${entry.env.length === 0 ? 'none' : entry.env.join(', ')}`,
    `Requires: ${entry.requires.length === 0 ? 'nothing' : entry.requires.join(', ')}`,
    ...(entry.provider === undefined
      ? []
      : [
          `Provider: ${entry.provider.name} — ${entry.provider.docsUrl}`,
          `Verified against the provider's documentation on ${entry.provider.verifiedOn}`,
        ]),
    '',
    `Install: sovrium library add ${id}`,
    `Read:    sovrium docs ${libraryArticleAddress(id)}`,
    '',
  ].join('\n')
}

/** The entry an id names, or a refusal pointing at `library search`. */
export const findEntryOrRefuse = (
  catalogue: CatalogueModule,
  entries: readonly LibraryEntry[],
  id: string | undefined,
  usage: string
): LibraryEntry => {
  if (id === undefined)
    return refuse(`Error: ${usage} needs an entry id, e.g. \`block/hero-centered\`.`)
  const entry = entries.find((candidate) => catalogue.libraryEntryId(candidate) === id)
  return (
    entry ??
    refuse(
      `Error: No library entry "${id}".\n\n` +
        `  Find the right id with \`sovrium library search ${id.split('/').at(-1) ?? id}\`,\n` +
        '  or list the catalogue with `sovrium library list`.'
    )
  )
}

const handleShow = async (options: LibraryCommandOptions): Promise<void> => {
  const format = resolveFormat(options.format)
  const catalogue = await loadCatalogueModule()
  const id = options.args[1]
  if (id !== undefined && isOperationId(id, catalogue.LIBRARY_KINDS))
    return emit(await showOperation(id, format))
  const entry = findEntryOrRefuse(
    catalogue,
    await catalogue.loadCatalogue(),
    options.args[1],
    '`sovrium library show <id>`'
  )
  if (format === 'json') {
    const { build: _build, ...data } = entry
    return emit(asJson({ id: catalogue.libraryEntryId(entry), ...data }))
  }
  return emit(renderShow(catalogue, entry))
}

// =============================================================================
// The verb
// =============================================================================

/** `library add <provider>/<operation>`, `--tag` or `--all`: its connection, with the operations. */
const handleAddOperations = async (
  options: LibraryCommandOptions,
  catalogue: CatalogueModule
): Promise<void> => {
  const { provider, request } = await resolveOperationsRequest(
    {
      id: options.args[1],
      ...(options.tag === undefined ? {} : { tag: options.tag }),
      all: options.all === true,
      yes: options.yes === true,
    },
    catalogue.LIBRARY_KINDS
  )
  const entries = await catalogue.loadCatalogue()
  const entry = findEntryOrRefuse(
    catalogue,
    entries,
    `connection/${provider}`,
    '`sovrium library add <provider>/<operation>`'
  )
  return runLibraryAdd({
    catalogue,
    entries,
    entry,
    sets: options.sets,
    as: options.as,
    into: options.into,
    dryRun: options.dryRun,
    noWire: options.noWire,
    version: await getCurrentVersion(),
    operations: request,
  })
}

const handleAdd = async (options: LibraryCommandOptions): Promise<void> => {
  const catalogue = await loadCatalogueModule()
  if (
    selectsOperations(
      {
        id: options.args[1],
        tag: options.tag,
        all: options.all === true,
        yes: options.yes === true,
      },
      catalogue.LIBRARY_KINDS
    )
  )
    return handleAddOperations(options, catalogue)
  const entries = await catalogue.loadCatalogue()
  const entry = findEntryOrRefuse(catalogue, entries, options.args[1], '`sovrium library add <id>`')
  return runLibraryAdd({
    catalogue,
    entries,
    entry,
    sets: options.sets,
    as: options.as,
    into: options.into,
    dryRun: options.dryRun,
    noWire: options.noWire,
    version: await getCurrentVersion(),
  })
}

/**
 * Handle the `library` command.
 *
 * @param options - The parsed positionals and flag values.
 */
export const handleLibraryCommand = async (options: LibraryCommandOptions): Promise<void> => {
  const [subcommand] = options.args
  if (subcommand === 'list') return handleList(options)
  if (subcommand === 'search') return handleSearch(options)
  if (subcommand === 'show') return handleShow(options)
  if (subcommand === 'add') return handleAdd(options)
  return refuse(
    `${subcommand === undefined ? 'Error: `sovrium library` needs a subcommand.' : `Error: Unknown subcommand "library ${subcommand}".`}\n\n` +
      `  Accepted: ${SUBCOMMANDS.join(', ')}. Start with \`sovrium library list\`.`
  )
}
