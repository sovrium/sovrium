/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `library` section of `sovrium docs` — one article per catalogue entry.
 *
 * ─── RENDERED FROM THE ENTRIES, NOT WRITTEN BESIDE THEM ─────────────────────
 *
 * An entry already carries every fact its article states: the install command,
 * the key it lands under, its parameters, the secret names, the provider link
 * and the date it was verified. Writing those again as prose would be a second
 * copy free to disagree with the first, so the article is a projection of the
 * entry, plus the entry's own `notes` for the parts only a sentence can say.
 *
 * ─── WHO CALLS THIS, AND HOW ────────────────────────────────────────────────
 *
 * Only `docs-render.ts`, lazily, after it has itself loaded the catalogue with
 * `await import()`. This module takes the entries as an ARGUMENT and imports
 * nothing from `src/library/` but types, so it adds no path by which the
 * catalogue could reach the boot of `sovrium start`. And no section manifest
 * under `src/docs/sections/` names the library: a manifest importing the
 * catalogue would put the whole tree behind every importer of the registry.
 */

import { escapeMarkdownTableCell } from '@/domain/kernel/markdown/markdown-escaping'
import { libraryArticleAddress } from './library-wire'
import type { ManualArticle, ManualSection } from '@/application/use-cases/admin/docs-manual'
import type { LibraryCatalogueApi, LibraryEntry, LibraryKind } from '@/library/manifest/define'
import type { LibraryOperationSet } from '@/library/manifest/operations'

/** The section slug — and why there is no `docs library` sub-command. */
const LIBRARY_SECTION_SLUG = 'library'

/** Sorts after every hand-written section. */
const LIBRARY_SECTION_ORDER = 12_000

/** What this module needs from the catalogue, handed over by the caller. */
type CatalogueApi = Pick<
  LibraryCatalogueApi,
  'LIBRARY_KINDS' | 'LIBRARY_TARGET_KEY' | 'libraryEntryId'
>

/** The section, the article bodies keyed as each article's `body`, and the index. */
export interface LibraryManual {
  readonly section: ManualSection
  readonly bodies: ReadonlyMap<string, string>
  readonly index: string
}

const KIND_HEADINGS: Readonly<Record<LibraryKind, string>> = {
  block: 'Blocks',
  connection: 'Connections',
  recipe: 'Recipes',
}

/** The key under which the embedded payload would file a body — never a real path. */
const bodyKey = (id: string): string => `library:${id}`

const paramRows = (entry: LibraryEntry): readonly string[] =>
  entry.params.length === 0
    ? []
    : [
        '## Parameters',
        '',
        'Set each with `--set <name>=<value>` when installing.',
        '',
        '| Parameter | Type | Default | Description |',
        '| --- | --- | --- | --- |',
        ...entry.params.map(
          (param) =>
            `| \`${param.name}\` | ${param.type} | ${param.required === true ? 'required' : param.default === undefined ? '—' : `\`${String(param.default)}\``} | ${param.description} |`
        ),
        '',
      ]

/** A parameter's default as text, for a table or field named by one. */
const defaultOf = (entry: LibraryEntry, param: string): string =>
  String(entry.params.find((candidate) => candidate.name === param)?.default ?? `<${param}>`)

const tableRows = (entry: LibraryEntry): readonly string[] =>
  (entry.tables ?? []).length === 0
    ? []
    : [
        '## Tables it expects',
        '',
        'The entry reads a table your config already defines; it never creates one. Installing it into a config without the table, or without one of these fields, is refused and nothing is written. Point it at your own table and fields with `--set`.',
        '',
        '| Table | Field | Type | Rename with |',
        '| --- | --- | --- | --- |',
        ...(entry.tables ?? []).flatMap((table) =>
          table.fields.map(
            (field) =>
              `| \`${defaultOf(entry, table.param)}\` (\`--set ${table.param}=…\`) | \`${field.param === undefined ? field.name : defaultOf(entry, field.param)}\` | ${field.type} | ${field.param === undefined ? '—' : `\`--set ${field.param}=…\``} |`
          )
        ),
        '',
      ]

const envRows = (entry: LibraryEntry): readonly string[] =>
  entry.env.length === 0
    ? []
    : [
        '## Environment variables',
        '',
        `The entry reads ${entry.env.map((name) => `\`${name}\``).join(' and ')}. Declare ${entry.env.length === 1 ? 'it' : 'them'} under \`env\` in your config first: \`library add\` refuses until you do, and prints the lines to add. Installing it then adds the names (never a value) to \`.env.example\`; set the values in your environment or in \`.env\`.`,
        '',
      ]

const providerRows = (entry: LibraryEntry): readonly string[] =>
  entry.provider === undefined
    ? []
    : [
        '## Provider',
        '',
        `${entry.provider.name} documents this API at ${entry.provider.docsUrl}. The entry was last checked against that documentation on ${entry.provider.verifiedOn}.`,
        '',
      ]

/**
 * A connection's API operations, a heading per group and a row per operation —
 * projected from the provider's generated set, like the rest of the article.
 */
const operationRows = (
  entry: LibraryEntry,
  set: LibraryOperationSet | undefined
): readonly string[] =>
  set === undefined
    ? []
    : [
        '## Operations',
        '',
        `The library ships ${set.operations.length} ${set.title} API operations, generated from the vendor's own API description (${set.docsUrl}). Declare one on this connection with \`sovrium library add ${set.provider}/<operation>\`, a whole group with \`sovrium library add ${set.provider} --tag <group>\`, or every one with \`--all\`. Each lands under \`operations\` in \`library/connection/${entry.slug}.yaml\`, installing the connection first when your config does not have it.`,
        '',
        ...Object.entries(set.groups)
          .toSorted(([left], [right]) => left.localeCompare(right))
          .flatMap(([group, names]) => [
            `### ${group}`,
            '',
            '| Operation | Method | Path | Summary |',
            '| --- | --- | --- | --- |',
            ...names.flatMap((name) => {
              const operation = set.operations.find((candidate) => candidate.name === name)
              return operation === undefined
                ? []
                : [
                    `| \`${operation.name}\` | ${operation.method} | \`${operation.path}\` | ${escapeMarkdownTableCell(operation.summary ?? '')} |`,
                  ]
            }),
            '',
          ]),
      ]

/** One entry's article body, below the title and summary the renderer adds. */
const articleBody = (
  catalogue: CatalogueApi,
  entry: LibraryEntry,
  set: LibraryOperationSet | undefined
): string => {
  const id = catalogue.libraryEntryId(entry)
  const key = catalogue.LIBRARY_TARGET_KEY[entry.kind]
  return [
    '## Install',
    '',
    '```bash',
    `sovrium library add ${id}`,
    '```',
    '',
    `This writes \`library/${entry.kind}/${entry.slug}.yaml\` beside your config and adds one \`- $ref:\` line under \`${key}\` in \`app.yaml\`. The fragment is yours to edit afterwards. Preview the change first with \`--dry-run\`, and see every detail with \`sovrium library show ${id}\`.`,
    '',
    ...(entry.requires.length === 0
      ? []
      : [
          `It requires ${entry.requires.map((required) => `\`${required}\``).join(', ')}, which is installed with it when your config does not already define it.`,
          '',
        ]),
    ...paramRows(entry),
    ...tableRows(entry),
    ...envRows(entry),
    ...providerRows(entry),
    ...operationRows(entry, set),
    '## How it works',
    '',
    ...entry.notes.flatMap((note) => [note, '']),
    `It is an ordinary entry of your config's \`${key}\` list — read \`sovrium docs config ${key}\` for every option it can carry.`,
    '',
  ].join('\n')
}

const articleOf = (catalogue: CatalogueApi, entry: LibraryEntry, order: number): ManualArticle => ({
  slug: `${entry.kind}-${entry.slug}`,
  title: entry.title,
  description: entry.description,
  keywords: [
    ...entry.tags,
    ...(entry.provider === undefined ? [] : [entry.provider.name]),
    catalogue.libraryEntryId(entry),
  ],
  order,
  sidebarLabel: entry.title,
  body: bodyKey(catalogue.libraryEntryId(entry)),
  documents: [],
  stories: [],
})

/** The section index: entries grouped by kind, blocks, then connections, then recipes. */
const renderIndex = (catalogue: CatalogueApi, entries: readonly LibraryEntry[]): string =>
  [
    '# Library',
    '',
    `> \`${LIBRARY_SECTION_SLUG}\` — ${entries.length} entries. Read one with`,
    `> \`sovrium docs ${LIBRARY_SECTION_SLUG}/<kind>-<slug>\`; install one with`,
    '> `sovrium library add <kind>/<slug>`.',
    ...catalogue.LIBRARY_KINDS.flatMap((kind) => {
      const ofKind = entries.filter((entry) => entry.kind === kind)
      return ofKind.length === 0
        ? []
        : [
            '',
            `## ${KIND_HEADINGS[kind]}`,
            '',
            ...ofKind.map(
              (entry) =>
                `- \`${libraryArticleAddress(catalogue.libraryEntryId(entry))}\` — ${entry.description}`
            ),
          ]
    }),
    '',
  ].join('\n')

/** The whole `library` section, ready to sit beside the registered ones. */
export const buildLibraryManual = (
  catalogue: CatalogueApi,
  entries: readonly LibraryEntry[],
  operationSets: readonly LibraryOperationSet[] = []
): LibraryManual => {
  /** A connection's set — by slug, as `library add <provider>/<operation>` attaches it. */
  const setOf = (entry: LibraryEntry): LibraryOperationSet | undefined =>
    entry.kind === 'connection'
      ? operationSets.find((set) => set.provider === entry.slug)
      : undefined
  const ordered = catalogue.LIBRARY_KINDS.flatMap((kind) =>
    entries.filter((entry) => entry.kind === kind)
  )
  return {
    section: {
      slug: LIBRARY_SECTION_SLUG,
      title: 'Library',
      order: LIBRARY_SECTION_ORDER,
      tab: 'library',
      articles: ordered.map((entry, index) => articleOf(catalogue, entry, (index + 1) * 10)),
    },
    bodies: new Map(
      ordered.map((entry) => [
        bodyKey(catalogue.libraryEntryId(entry)),
        articleBody(catalogue, entry, setOf(entry)),
      ])
    ),
    index: renderIndex(catalogue, ordered),
  }
}
