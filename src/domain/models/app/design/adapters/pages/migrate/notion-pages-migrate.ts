/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Chunk } from 'effect'
import { slugifyTitle } from '@/domain/kernel/identity/slug'
import { pageNodeIdOf } from '@/domain/models/app/pages/node-identity'
import { migratedLiteral, migratedPageLiteralTokens } from './migrated-literal-tokens-service'
import { MIGRATED_GRID_MAX_COLUMNS, MIGRATION_PAGE_FACTS } from './migrated-page-mapping'
import {
  allMigratedNodes,
  migratedPageStructure,
  pageCollisionRefusal,
  withMigratedKeys,
} from './migrated-page-tree-service'
import { NOTION_PAGE_MAPPINGS } from './notion-page-mappings'
import {
  readNotionExport,
  type NotionExportEntry,
  type NotionExportPage,
} from './notion-pages-parse'
import type { MappedNode, MigratedComponentMapping } from './migrated-page-mapping'
import type { MigratedPagesReport } from './migrated-pages-report'
import type { NotionBlock, NotionColumn } from './notion-export-blocks'

/**
 * The Notion page migration: a Notion export, already inflated, to NEW
 * Sovrium pages and the report's `pages` section ([internal ref] A14, pages part).
 *
 * - Each exported page becomes a page; a sub-page becomes a page of its own,
 *   under its parent's path, linked from where it sat.
 * - A block becomes a kit node only through `NOTION_PAGE_MAPPINGS`. A block
 *   the table does not hold is reported where it sat and nothing is drawn; a
 *   block whose kit type needs a value the export does not give (a toggle with
 *   no summary) is reported the same way, never given a placeholder.
 * - A mention arrives unbound: its node keeps its text, and the mention is
 *   listed verbatim. An inline database is left behind for the data migration,
 *   and so are the image files a page shows, which a page migration does not
 *   copy.
 * - A page whose name or path the config already holds is refused, never
 *   renamed and never merged.
 * - Every node gets a fresh kebab-case `key`, `<type>-<n>` in page order: the
 *   same export always gives the same keys, the same pages and the same
 *   section, byte for byte.
 *
 * Pure: entries in, plan out. Nothing is fetched, nothing is run, no clock.
 */

/** What the config already holds, read before a migration: a migration never overwrites it. */
export interface MigrationTarget {
  readonly pages?: readonly { readonly name: string; readonly path: string }[] | undefined
}

/** One kit node a migration writes. */
export interface MigratedNode {
  readonly type: string
  readonly key?: string
  readonly element?: string
  readonly content?: string
  readonly triggerLabel?: string
  readonly props?: Readonly<Record<string, string>>
  readonly children?: readonly MigratedNode[]
}

/** One page a migration writes. */
export interface MigratedPageEntry {
  readonly name: string
  readonly path: string
  readonly meta: { readonly title: string }
  readonly components: readonly MigratedNode[]
}

/** The converter's answer: the new pages and the report's section, or why the export is refused. */
export type NotionPagesResult =
  | {
      readonly ok: true
      readonly pages: readonly MigratedPageEntry[]
      readonly report: MigratedPagesReport
    }
  | { readonly ok: false; readonly reason: string }

type Report = MigratedPagesReport

/** The findings a page's conversion produces, beside its nodes. */
interface Findings {
  readonly unbound: Report['unbound']
  readonly unmapped: Report['unmapped']
  readonly offScale: Report['offScale']
  readonly leftBehind: Report['leftBehind']
}

interface Converted extends Findings {
  readonly nodes: readonly MigratedNode[]
}

const NO_FINDINGS: Converted = {
  nodes: [],
  unbound: [],
  unmapped: [],
  offScale: [],
  leftBehind: [],
}

/** Sibling conversions joined, in order, in one pass over each list. */
const joinAll = (parts: readonly Converted[]): Converted => ({
  nodes: parts.flatMap((part) => part.nodes),
  unbound: parts.flatMap((part) => part.unbound),
  unmapped: parts.flatMap((part) => part.unmapped),
  offScale: parts.flatMap((part) => part.offScale),
  leftBehind: parts.flatMap((part) => part.leftBehind),
})

/**
 * Convert sibling items, each told how many nodes the siblings before it
 * produced. The parts are collected in a chunk and joined once: joining them
 * per sibling made a long page quadratic.
 */
const convertSiblings = <T>(
  items: readonly T[],
  convert: (item: T, before: number) => Converted
): Converted =>
  joinAll(
    Chunk.toReadonlyArray(
      items.reduce<{ readonly parts: Chunk.Chunk<Converted>; readonly count: number }>(
        (acc, item) => {
          const part = convert(item, acc.count)
          return { parts: Chunk.append(acc.parts, part), count: acc.count + part.nodes.length }
        },
        { parts: Chunk.empty(), count: 0 }
      ).parts
    )
  )

/** What converting one page's blocks reads. */
interface ConvertContext {
  readonly page: string
  /** The migrated path of a page of the export, by its entry. */
  readonly pathOf: (file: string) => string | undefined
  /** The export entry holding an inline database's data, by its title. */
  readonly databaseFileOf: (title: string) => string | undefined
  /** Every entry of the export. */
  readonly files: ReadonlySet<string>
}

/** The table row of a Notion block, own keys only. */
const rowOf = (block: string): MigratedComponentMapping | undefined =>
  Object.hasOwn(NOTION_PAGE_MAPPINGS.components, block)
    ? NOTION_PAGE_MAPPINGS.components[block]
    : undefined

/** The name Notion gives a recognised block. */
const blockNameOf = (block: NotionBlock): string => {
  if (block.kind === 'text' || block.kind === 'leaf' || block.kind === 'other') return block.block
  return block.kind === 'columns' ? 'column_list' : block.kind
}

const baseNameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

const unmapped = (
  context: ConvertContext,
  pointer: string,
  component: string,
  missing?: string
): Converted => ({
  ...NO_FINDINGS,
  unmapped: [
    {
      page: context.page,
      at: pageNodeIdOf(context.page, pointer),
      component,
      ...(missing === undefined
        ? { reason: 'not-in-table' as const }
        : { reason: 'required-value-missing' as const, missing }),
    },
  ],
})

/** A node of `row`'s type: its element, and nothing it holds yet. */
const shellOf = (row: MappedNode): MigratedNode => ({
  type: row.type,
  ...(row.element !== undefined && row.element !== 'source-tag' ? { element: row.element } : {}),
})

const mentionsUnbound = (
  context: ConvertContext,
  pointer: string,
  component: string,
  mentions: readonly string[]
): Report['unbound'] =>
  mentions.map((expression) => ({
    page: context.page,
    node: pageNodeIdOf(context.page, pointer),
    component,
    expression,
  }))

/** The kit node a column list becomes: a grid, with its columns on the table's column count. */
const columnListOf = (
  columns: readonly NotionColumn[],
  row: MappedNode,
  pointer: string,
  context: ConvertContext
): Converted => {
  const column = rowOf('column')
  const converted = convertSiblings(columns, (entry, before) => {
    const at = `${pointer}/children/${before}`
    if (column?.outcome !== 'node') return unmapped(context, at, 'column')
    const inner = convertBlocks(entry.children, `${at}/children`, context)
    return { ...inner, nodes: [{ ...shellOf(column), children: inner.nodes }] }
  })
  const widths = columns.map((entry) => entry.width)
  const equal = widths.every((width) => width === widths[0])
  const count = columns.length
  const onScale = equal && count > 0 && count <= MIGRATED_GRID_MAX_COLUMNS
  const layout = NOTION_PAGE_MAPPINGS.layout['column_list.columns']
  const offScale: Report['offScale'] =
    onScale || count === 0 || layout === undefined
      ? []
      : [
          {
            page: context.page,
            node: pageNodeIdOf(context.page, pointer),
            property: layout.property,
            value: equal ? String(count) : widths.map((width) => width ?? 'auto').join(', '),
          },
        ]
  const grid: MigratedNode = {
    ...shellOf(row),
    ...(onScale ? { props: { className: ['grid', 'cols', String(count)].join('-') } } : {}),
    children: converted.nodes,
  }
  return { ...converted, nodes: [grid], offScale: [...offScale, ...converted.offScale] }
}

type Block<K extends NotionBlock['kind']> = Extract<NotionBlock, { readonly kind: K }>

const toggleNodeOf = (
  block: Block<'toggle'>,
  row: MappedNode,
  pointer: string,
  context: ConvertContext
): Converted => {
  if (block.summary === '') return unmapped(context, pointer, 'toggle', 'triggerLabel')
  const inner = convertBlocks(block.children, `${pointer}/children`, context)
  return {
    ...inner,
    nodes: [
      { ...shellOf(row), triggerLabel: migratedLiteral(block.summary), children: inner.nodes },
    ],
  }
}

/** An image node; a file of the export is named for the operator to carry, never copied. */
const imageNodeOf = (
  block: Block<'image'>,
  row: MappedNode,
  pointer: string,
  context: ConvertContext
): Converted => {
  if (block.src === undefined) return unmapped(context, pointer, 'image', 'src')
  const src = block.file === undefined ? block.src : encodeURI(`/${block.file}`)
  const file = block.file === undefined ? [] : [block.file]
  return {
    ...NO_FINDINGS,
    nodes: [
      {
        ...shellOf(row),
        props:
          block.alt === undefined || block.alt === ''
            ? { src }
            : { src, alt: migratedLiteral(block.alt) },
      },
    ],
    leftBehind: file.map((entry) => ({
      page: context.page,
      what: `Image file: ${baseNameOf(entry)}`,
      file: entry,
    })),
  }
}

const childPageNodeOf = (
  block: Block<'child_page'>,
  row: MappedNode,
  pointer: string,
  context: ConvertContext
): Converted => {
  const href = context.pathOf(block.target)
  return href === undefined
    ? unmapped(context, pointer, 'child_page', 'href')
    : {
        ...NO_FINDINGS,
        nodes: [{ ...shellOf(row), content: migratedLiteral(block.label), props: { href } }],
      }
}

/** One mapped block, as the node its row names. */
const nodeOf = (
  block: NotionBlock,
  row: MappedNode,
  pointer: string,
  context: ConvertContext
): Converted => {
  switch (block.kind) {
    case 'text':
      return {
        ...NO_FINDINGS,
        nodes: [{ ...shellOf(row), content: migratedLiteral(block.text) }],
        unbound: mentionsUnbound(context, pointer, block.block, block.mentions),
      }
    case 'toggle':
      return toggleNodeOf(block, row, pointer, context)
    case 'columns':
      return columnListOf(block.columns, row, pointer, context)
    case 'image':
      return imageNodeOf(block, row, pointer, context)
    case 'child_page':
      return childPageNodeOf(block, row, pointer, context)
    case 'leaf':
      return { ...NO_FINDINGS, nodes: [shellOf(row)] }
    case 'child_database':
    case 'other':
      return unmapped(context, pointer, blockNameOf(block))
  }
}

/** The CSV holding every property of a database (fact d3b), else the one named. */
const everyPropertyCsv = (file: string, files: ReadonlySet<string>): string => {
  const all = file.replace(/\.csv$/i, '_all.csv')
  return all !== file && files.has(all) ? all : file
}

/**
 * A database a page shows, left behind for the data migration: its CSV when
 * the export holds it, or — a linked view, which exports as a link to a CSV
 * that is not there and a title-only page (fact a8) — named with no file.
 */
const leftBehindOf = (block: NotionBlock, name: string, context: ConvertContext): Converted => {
  const title = block.kind === 'child_database' ? block.title : name
  const linked = block.kind === 'child_database' ? block.file : undefined
  if (linked !== undefined && !context.files.has(linked)) {
    return {
      ...NO_FINDINGS,
      leftBehind: [{ page: context.page, what: `Linked database view: ${title}` }],
    }
  }
  const named = linked ?? context.databaseFileOf(title)
  const file = named === undefined ? undefined : everyPropertyCsv(named, context.files)
  return {
    ...NO_FINDINGS,
    leftBehind: [
      {
        page: context.page,
        what: `Inline database: ${title}`,
        ...(file === undefined ? {} : { file }),
      },
    ],
  }
}

/** A block the table has no row for: reported, and an attached file named for the operator to carry. */
const unmappedBlock = (
  block: NotionBlock,
  name: string,
  pointer: string,
  context: ConvertContext
): Converted => {
  const reported = unmapped(context, pointer, name)
  const file = block.kind === 'other' ? block.file : undefined
  return file === undefined
    ? reported
    : {
        ...reported,
        leftBehind: [{ page: context.page, what: `Attached file: ${baseNameOf(file)}`, file }],
      }
}

/** Convert sibling blocks at `parent` (a pointer to the array they fill). */
const convertBlocks = (
  blocks: readonly NotionBlock[],
  parent: string,
  context: ConvertContext
): Converted =>
  convertSiblings(blocks, (block, before) => {
    const pointer = `${parent}/${before}`
    const name = blockNameOf(block)
    const row = block.kind === 'other' ? undefined : rowOf(name)
    if (row === undefined) return unmappedBlock(block, name, pointer, context)
    if (row.outcome === 'left-behind') return leftBehindOf(block, name, context)
    if (row.outcome !== 'node') return unmapped(context, pointer, name)
    return nodeOf(block, row, pointer, context)
  })

/** A title as a kebab-case slug: accents folded, everything else a hyphen. */
export const pageSlugOf = (title: string): string =>
  slugifyTitle(
    title
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
  ) || 'page'

/** The page a page's folder names: the page whose id, or whose file stem, the folder ends with. */
const folderParentOf = (
  page: NotionExportPage,
  pages: readonly NotionExportPage[]
): NotionExportPage | undefined => {
  if (page.folder === '') return undefined
  const segment = page.folder.slice(page.folder.lastIndexOf('/') + 1)
  const above = page.folder.includes('/') ? page.folder.slice(0, page.folder.lastIndexOf('/')) : ''
  const id = /\s([0-9a-f]{32})$/.exec(segment)?.[1]
  return pages.find(
    (candidate) =>
      candidate !== page &&
      (id === undefined
        ? candidate.folder === above &&
          baseNameOf(candidate.file).replace(/\.[^.]+$/, '') === segment
        : candidate.id === id)
  )
}

const linksTo = (blocks: readonly NotionBlock[], file: string): boolean =>
  blocks.some(
    (block) =>
      (block.kind === 'child_page' && block.target === file) ||
      (block.kind === 'toggle' && linksTo(block.children, file)) ||
      (block.kind === 'columns' && block.columns.some((column) => linksTo(column.children, file)))
  )

/** Every page's parent, by entry: its folder's page, else the first page linking to it. */
const parentsOf = (pages: readonly NotionExportPage[]): ReadonlyMap<string, string> =>
  pages.reduce<ReadonlyMap<string, string>>((parents, page) => {
    const byFolder = folderParentOf(page, pages)
    const ancestorOf = (file: string | undefined, seen: number): boolean =>
      file !== undefined &&
      seen < pages.length &&
      (file === page.file || ancestorOf(parents.get(file), seen + 1))
    const byLink =
      byFolder ??
      pages.find(
        (candidate) =>
          candidate !== page &&
          linksTo(candidate.blocks, page.file) &&
          !ancestorOf(candidate.file, 0)
      )
    return byLink === undefined ? parents : new Map([...parents, [page.file, byLink.file]])
  }, new Map())

/**
 * A page that is a database row: it sits in the folder of a database's CSV
 * (facts a3, d3b), or it carries property values and its parent never links
 * to it.
 */
const isDatabaseRow = (
  page: NotionExportPage,
  parent: NotionExportPage | undefined,
  files: ReadonlySet<string>
): boolean =>
  (page.folder !== '' && files.has(`${page.folder}.csv`)) ||
  (page.properties && parent !== undefined && !linksTo(parent.blocks, page.file))

const blocksOf = (blocks: readonly NotionBlock[]): readonly NotionBlock[] =>
  blocks.flatMap((block) => [
    block,
    ...(block.kind === 'toggle' ? blocksOf(block.children) : []),
    ...(block.kind === 'columns'
      ? block.columns.flatMap((column) => blocksOf(column.children))
      : []),
  ])

const withoutExtension = (path: string): string => path.replace(/\.[^./]+$/, '')

/**
 * The title-only pages a linked database view leaves (fact a8): a page beside
 * the CSV a page links to, under the CSV's own name, when the CSV is not in
 * the export. They are the view's stub, not a page.
 */
const linkedViewStubsOf = (
  pages: readonly NotionExportPage[],
  files: ReadonlySet<string>
): ReadonlySet<string> => {
  const views = new Set(
    pages.flatMap((page) =>
      blocksOf(page.blocks).flatMap((block) =>
        block.kind === 'child_database' && block.file !== undefined && !files.has(block.file)
          ? [withoutExtension(block.file)]
          : []
      )
    )
  )
  return new Set(
    pages.filter((page) => views.has(withoutExtension(page.file))).map((page) => page.file)
  )
}

/**
 * The databases of the export: a CSV with no page of its name. One a page
 * shows is already named there, so only its row pages are counted, on that
 * page; one no page shows is named under its own name, its row pages counted.
 */
const fullPageDatabases = (
  read: { readonly pages: readonly NotionExportPage[]; readonly files: ReadonlySet<string> },
  rows: readonly NotionExportPage[],
  linkerOf: (csv: string) => string | undefined
): Report['leftBehind'] => {
  const pageStems = new Set(read.pages.map((page) => withoutExtension(page.file)))
  return [...read.files]
    .filter((file) => /\.csv$/i.test(file) && !/_all\.csv$/i.test(file))
    .filter((file) => !pageStems.has(withoutExtension(file)))
    .flatMap((file): Report['leftBehind'] => {
      const folder = withoutExtension(file)
      const count = rows.filter((row) => row.folder === folder).length
      const rowPages = `${count} ${count === 1 ? 'row page' : 'row pages'}`
      const linker = linkerOf(file)
      if (linker !== undefined) {
        // Already named where the page shows it; only its row pages remain to count.
        return count === 0
          ? []
          : [{ page: linker, what: `Database rows: ${rowPages}`, file: folder }]
      }
      const title = titleOfStem(baseNameOf(folder))
      return [
        {
          page: pageSlugOf(title),
          what: `Database: ${title}, ${rowPages}`,
          file: everyPropertyCsv(file, read.files),
        },
      ]
    })
}

const titleOfStem = (stem: string): string => stem.replace(/ [0-9a-f]{32}$/, '')

interface Placed {
  readonly page: NotionExportPage
  readonly name: string
  readonly path: string
}

/** The pages in the order they are written: each parent before its children, siblings by file path. */
const placePages = (
  pages: readonly NotionExportPage[],
  parents: ReadonlyMap<string, string>
): readonly Placed[] => {
  const childrenOf = (file: string | undefined): readonly NotionExportPage[] =>
    pages.filter((page) => parents.get(page.file) === file)
  const visit = (
    file: string | undefined,
    parentPath: string,
    placed: readonly Placed[]
  ): readonly Placed[] =>
    childrenOf(file).reduce<readonly Placed[]>((acc, page) => {
      const slug = pageSlugOf(page.title)
      const names = new Set(acc.map((entry) => entry.name))
      const suffix = page.id === undefined ? undefined : page.id.slice(0, 8)
      const candidates = [
        slug,
        ...(suffix === undefined ? [] : [`${slug}-${suffix}`]),
        ...Array.from({ length: pages.length }, (_, index) => `${slug}-${index + 2}`),
      ]
      const name = candidates.find((candidate) => !names.has(candidate)) ?? slug
      const paths = new Set(acc.map((entry) => entry.path))
      const base = parentPath === '' ? '' : parentPath
      const path = paths.has(`${base}/${slug}`) ? `${base}/${name}` : `${base}/${slug}`
      return visit(page.file, path, [...acc, { page, name, path }])
    }, placed)
  return visit(undefined, '', [])
}

/** The entry holding an inline database's data: a CSV first, then any entry, named after it. */
const databaseFileFinder =
  (files: ReadonlySet<string>) =>
  (title: string): string | undefined => {
    const named = [...files].filter((file) => {
      const stem = baseNameOf(file)
        .replace(/\.[^.]+$/, '')
        .replace(/_all$/, '')
      return stem === title || stem.replace(/ [0-9a-f]{32}$/, '') === title
    })
    return named.find((file) => file.toLowerCase().endsWith('.csv')) ?? named[0]
  }

/** Group of findings for one page. */
interface PageResult extends Findings {
  readonly entry: MigratedPageEntry
  readonly file: string
}

const convertPage = (
  placed: Placed,
  pathOf: (file: string) => string | undefined,
  databaseFileOf: (title: string) => string | undefined,
  files: ReadonlySet<string>
): PageResult => {
  const context: ConvertContext = { page: placed.name, pathOf, databaseFileOf, files }
  const converted = convertBlocks(placed.page.blocks, '/components', context)
  const components = withMigratedKeys(converted.nodes)
  return {
    entry: {
      name: placed.name,
      path: placed.path,
      meta: { title: migratedLiteral(placed.page.title) },
      components,
    },
    file: placed.page.file,
    unbound: converted.unbound,
    unmapped: converted.unmapped,
    offScale: converted.offScale,
    leftBehind: converted.leftBehind,
  }
}

/**
 * What the rows of a database left out of the pages amount to: one entry on
 * the written page above them, counting each row and every page under it.
 */
const rowsLeftBehind = (
  left: readonly NotionExportPage[],
  keptAbove: (file: string) => string | undefined,
  nameOf: (file: string) => string | undefined
): Report['leftBehind'] => {
  const byParent = left.reduce<ReadonlyMap<string, readonly NotionExportPage[]>>((acc, row) => {
    const parent = keptAbove(row.file)
    return parent === undefined
      ? acc
      : new Map([...acc, [parent, [...(acc.get(parent) ?? []), row]]])
  }, new Map())
  return [...byParent].flatMap(([parent, grouped]) => {
    const page = nameOf(parent)
    const [first] = grouped
    return page === undefined || first === undefined
      ? []
      : [
          {
            page,
            what: `Database rows: ${grouped.length} ${grouped.length === 1 ? 'page' : 'pages'}`,
            file: first.folder,
          },
        ]
  })
}

/**
 * Plan the migration of a Notion export's pages into an app whose config
 * already holds `target`.
 */
export const planNotionPages = (
  entries: readonly NotionExportEntry[],
  target: MigrationTarget = {}
): NotionPagesResult => {
  const read = readNotionExport(entries)
  if (!read.ok) return read
  const parents = parentsOf(read.pages)
  const byFile = new Map(read.pages.map((page) => [page.file, page]))
  const rowFiles = new Set(
    read.pages
      .filter((page) => {
        const parent = parents.get(page.file)
        return isDatabaseRow(
          page,
          parent === undefined ? undefined : byFile.get(parent),
          read.files
        )
      })
      .map((page) => page.file)
  )
  const stubs = linkedViewStubsOf(read.pages, read.files)
  const underRow = (file: string, depth: number): boolean => {
    const parent = parents.get(file)
    return (
      parent !== undefined &&
      depth < read.pages.length &&
      (rowFiles.has(parent) || underRow(parent, depth + 1))
    )
  }
  const kept = read.pages.filter(
    (page) => !rowFiles.has(page.file) && !underRow(page.file, 0) && !stubs.has(page.file)
  )
  const left = read.pages.filter((page) => !kept.includes(page) && !stubs.has(page.file))
  const keptFiles = new Set(kept.map((page) => page.file))
  const keptAbove = (file: string, depth = 0): string | undefined => {
    const parent = parents.get(file)
    if (parent === undefined || depth >= read.pages.length) return undefined
    return keptFiles.has(parent) ? parent : keptAbove(parent, depth + 1)
  }
  const placed = placePages(kept, parents)
  const pathByFile = new Map(placed.map((entry) => [entry.page.file, entry.path]))
  const nameByFile = new Map(placed.map((entry) => [entry.page.file, entry.name]))
  const databaseFileOf = databaseFileFinder(read.files)
  const results = placed.map((entry) =>
    convertPage(entry, (file) => pathByFile.get(file), databaseFileOf, read.files)
  )
  /** The page a database is named on: the page showing it, by the CSV its finding names. */
  const linkerOf = (csv: string): string | undefined =>
    results.find((result) =>
      result.leftBehind.some(
        (item) => item.file === csv || item.file === everyPropertyCsv(csv, read.files)
      )
    )?.entry.name
  const refused = results.flatMap((result) => {
    const refusal = pageCollisionRefusal(result.entry, target.pages ?? [])
    return refusal === undefined ? [] : [refusal]
  })
  const refusedNames = new Set(refused.map((refusal) => refusal.page))
  const written = results.filter((result) => !refusedNames.has(result.entry.name))
  const writtenNames = new Set(written.map((result) => result.entry.name))
  const ofWritten = <T extends { readonly page: string }>(items: readonly T[]): readonly T[] =>
    items.filter((item) => writtenNames.has(item.page))
  const report: MigratedPagesReport = {
    status: 'converted',
    source: 'notion',
    facts: MIGRATION_PAGE_FACTS.notion,
    created: written.map((result) => ({
      name: result.entry.name,
      path: result.entry.path,
      file: result.file,
      nodes: allMigratedNodes(result.entry.components).length,
    })),
    refused,
    unbound: ofWritten(results.flatMap((result) => result.unbound)),
    unmapped: ofWritten(results.flatMap((result) => result.unmapped)),
    offScale: ofWritten(results.flatMap((result) => result.offScale)),
    forms: [],
    literalTokens: written.flatMap((result) =>
      migratedPageLiteralTokens(result.entry.name, result.entry.components, [
        { pointer: '/meta', value: result.entry.meta },
      ])
    ),
    leftBehind: [
      ...ofWritten([
        ...results.flatMap((result) => result.leftBehind),
        ...rowsLeftBehind(left, keptAbove, (file) => nameByFile.get(file)),
      ]),
      ...fullPageDatabases(read, left, linkerOf),
    ],
    structure: written.map((result) =>
      migratedPageStructure(result.entry.name, result.entry.components)
    ),
    templates: { created: false },
  }
  return { ok: true, pages: written.map((result) => result.entry), report }
}
