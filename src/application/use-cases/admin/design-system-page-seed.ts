/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The seed a page export draws its data-bound nodes from, as the projection
 * applies it to one page (`design-system-page-projection.ts`): the synthetic
 * seed (`synthetic-seed-service.ts`), or the seed folder `--seed` named
 * (`design-system-page-seed-folder.ts`) for every source it holds rows for —
 * which declared table a node reads, the address a routed page is drawn at,
 * and the drawn copy of a seeded table or list. No row of any instance is read.
 */

import { primaryPagePath } from '@/domain/kernel/matching/localized-path'
import { queriedSeededRows } from '@/domain/models/app/pages/seeded-rows-service'
import {
  syntheticCellText,
  syntheticRowsOf,
  syntheticTitleOf,
} from '@/domain/models/app/pages/synthetic-seed-service'
import { cellTextOf, type ExportTextContext } from './design-system-page-record-text'
import {
  SECRET_SPECIMEN,
  type PageSeed,
  type PageSeedAccount,
  type PageSeedRow,
} from './design-system-page-seed-folder'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { SpecimenFieldShape } from '@/domain/models/app/pages/specimen-sample-service'

type Node = Readonly<Record<string, unknown>>

/** What a page's seed is read against: the app's tables, and the page's route values. */
export interface SeedContext {
  readonly tables: ReadonlyArray<{ readonly name: string; readonly fields: unknown }>
  /** The value each route parameter of the page is drawn at. */
  readonly routeValues: Readonly<Record<string, string>>
  /** The seed folder the export draws from, when `--seed` named one. */
  readonly seed?: PageSeed | undefined
  /** The seeded account the page is drawn as. */
  readonly viewer?: PageSeedAccount | undefined
  /** Draw every data source as holding no row (`data=empty`). */
  readonly empty?: boolean | undefined
  /** The write-only fields of the record a seeded page is drawn at: each drawn as a secret. */
  readonly secretFields?: ReadonlySet<string> | undefined
  /** What a seeded value is written in where a reader sees it: language, zone, clock. */
  readonly text?: ExportTextContext | undefined
}

/** A `$currentUser.<field>` reference, as drawn text and filter values write it. */
const CURRENT_USER = /\$currentUser\.(id|name|email|role)\b/g

/** A text with each `$currentUser.<field>` read as the seeded account it is drawn as. */
const asViewer = (context: SeedContext, text: string): string => {
  const { viewer } = context
  return viewer === undefined
    ? text
    : text.replace(CURRENT_USER, (_match, field: 'id' | 'name' | 'email' | 'role') => viewer[field])
}

/** A `$record.<field>` reference, as drawn text writes it. */
const RECORD_FIELD = /\$record\.(\w+)/g

/** A value with each reference to a secret field of the record read as the secret specimen. */
const masked = (secrets: ReadonlySet<string>, value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.replace(RECORD_FIELD, (match, field: string) =>
      secrets.has(field) ? SECRET_SPECIMEN : match
    )
  }
  if (Array.isArray(value)) return value.map((item: unknown) => masked(secrets, item))
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, masked(secrets, item)])
  )
}

/**
 * A node as a seeded page draws it: its own drawn text (its `content` and its
 * string children) with each `$currentUser.<field>` read as the seeded
 * account, and every reference to a write-only field of the record drawn as
 * the secret specimen; as written without a seed.
 */
export const drawnAsViewer = (context: SeedContext, node: Node): Node => {
  const { children: _children, ...own } = node
  const secrets = context.secretFields ?? new Set<string>()
  const shown = secrets.size === 0 ? node : { ...node, ...(masked(secrets, own) as Node) }
  if (context.viewer === undefined) return shown
  const { content, children } = shown
  return {
    ...shown,
    ...(typeof content === 'string' ? { content: asViewer(context, content) } : {}),
    ...(Array.isArray(children)
      ? {
          children: children.map((child: unknown) =>
            typeof child === 'string' ? asViewer(context, child) : child
          ),
        }
      : {}),
  }
}

/** A data source's filter, each `$currentUser` value read as the seeded account. */
const viewerFilterOf = (context: SeedContext, filter: unknown) =>
  (Array.isArray(filter) ? (filter as readonly Node[]) : []).map((condition) => ({
    field: String(condition['field']),
    operator: String(condition['operator']),
    value:
      typeof condition['value'] === 'string'
        ? asViewer(context, condition['value'])
        : condition['value'],
  }))

/** The most rows of one seeded table a page export draws and plays. */
export const SEEDED_ROW_CAP = 300

/** A seeded table's rows as the export reads them: its first `SEEDED_ROW_CAP`. */
export const cappedSeedRows = <Row>(rows: readonly Row[]): readonly Row[] =>
  rows.length > SEEDED_ROW_CAP ? rows.slice(0, SEEDED_ROW_CAP) : rows

/** One `Note:` line per seeded table the export cuts to its first `SEEDED_ROW_CAP` rows. */
export const seedRowCapNoticesOf = (seed: PageSeed | undefined): readonly string[] =>
  Object.entries(seed?.tables ?? {}).flatMap(([table, rows]) =>
    rows.length > SEEDED_ROW_CAP
      ? [
          `Note: table ${table} holds ${rows.length} seeded rows; the pages are drawn ` +
            `and played from its first ${SEEDED_ROW_CAP}.`,
        ]
      : []
  )

/** The last segment of a system endpoint's path: `/api/auth/device?x` → `device`. */
const endpointNameOf = (endpoint: unknown): string | undefined =>
  typeof endpoint === 'string' ? endpoint.split('?')[0]?.split('/').at(-1) : undefined

/**
 * The rows a node's data source reads from the seed folder: a declared table
 * the folder seeds (its filter kept), an auth list from `auth/<list>.yaml`, a
 * system endpoint from `system/<name>.yaml`; `undefined` when the folder holds
 * none, and the node is drawn as it is without `--seed`.
 */
export const seedFolderRowsOf = (
  context: SeedContext,
  node: Node
): readonly PageSeedRow[] | undefined => {
  const { seed } = context
  const dataSource = node['dataSource'] as Node | undefined
  if (dataSource !== undefined && context.empty === true) return []
  if (seed === undefined || dataSource === undefined) return undefined
  if (typeof dataSource['auth'] === 'string') return seed.auth[dataSource['auth']]
  const system = dataSource['system'] as Node | undefined
  if (system !== undefined) {
    const name = endpointNameOf(system['endpoint'])
    return name === undefined ? undefined : seed.system[name]
  }
  const table = boundTableName(context, dataSource['table'])
  const rows = table === undefined ? undefined : seed.tables[table]
  return rows === undefined
    ? undefined
    : queriedSeededRows(cappedSeedRows(rows), {
        filter: viewerFilterOf(context, dataSource['filter']),
      })
}

/** What a data-bound node was drawn from, as the node map records it. */
export const islandSeedOf = (
  context: SeedContext,
  node: Node
): { readonly seed: 'synthetic' | 'empty' | 'file'; readonly dir?: string } =>
  context.seed !== undefined && seedFolderRowsOf(context, node) !== undefined
    ? { seed: 'file', dir: context.seed.dir }
    : { seed: seededTableOf(context, node) === undefined ? 'empty' : 'synthetic' }

const stringField = (node: Node, field: string): string | undefined =>
  typeof node[field] === 'string' ? (node[field] as string) : undefined

/** The types the synthetic seed draws when bound to a declared table. */
const SEEDED_TYPES: ReadonlySet<unknown> = new Set(['table', 'list', 'kanban'])

/** A route parameter name, as a page path writes it (`:table`). */
const ROUTE_PARAMETER = /:([A-Za-z_]\w*)/g

/**
 * The value each route parameter of a page is drawn at. A parameter the page
 * binds a table to (`dataSource.table: $param.<name>`, written anywhere in its
 * components, a template's variables included) takes the first table the app
 * declares, so the grid is drawn from that table's synthetic seed; any other
 * takes the sample record's id.
 */
export const sampleRouteValuesOf = (app: App, page: Page): Readonly<Record<string, string>> => {
  const firstTable = app.tables?.[0]?.name
  const written = JSON.stringify(page.components ?? [])
  return Object.fromEntries(
    [...primaryPagePath(page.path).matchAll(ROUTE_PARAMETER)].map((match) => {
      const name = match[1] ?? ''
      const bindsTable = written.includes(`"table":"$param.${name}"`)
      return [name, firstTable !== undefined && bindsTable ? firstTable : '1'] as const
    })
  )
}

/** The table a data source names, a route parameter read at the value the page is drawn at. */
const boundTableName = (context: SeedContext, table: unknown): string | undefined => {
  if (typeof table !== 'string') return undefined
  return table.startsWith('$param.') ? context.routeValues[table.slice('$param.'.length)] : table
}

/** The declared table a seeded type reads, when its data source names one. */
export const seededTableOf = (context: SeedContext, node: Node) => {
  const dataSource = node['dataSource'] as { readonly table?: unknown } | undefined
  if (!SEEDED_TYPES.has(node['type'])) return undefined
  const name = boundTableName(context, dataSource?.table)
  return context.tables.find((table) => table.name === name)
}

/** The fields of a declared table, as the seed reads them. */
const fieldsOf = (table: { readonly fields: unknown } | undefined) =>
  (table?.fields ?? []) as readonly SpecimenFieldShape[]

/**
 * A bound table drawn as the rows the config would write: from the seed when
 * it reads a declared table, a column per field when it names no column of its
 * own, and empty otherwise.
 */
/**
 * The columns and rows a bound table is drawn with: its named columns (a
 * column per field when it names none), and its seed folder's rows, else the
 * synthetic seed's, else none.
 */
export const drawnTableRowsOf = (
  context: SeedContext,
  node: Node
): { readonly columns: readonly Node[]; readonly rows: readonly PageSeedRow[] } => {
  const table = seededTableOf(context, node)
  const declared = (Array.isArray(node['columns']) ? node['columns'] : []) as readonly Node[]
  const named = declared.flatMap((column) => (typeof column['field'] === 'string' ? [column] : []))
  return {
    columns: named.length > 0 ? named : fieldsOf(table).map((field) => ({ field: field.name })),
    rows:
      seedFolderRowsOf(context, node) ??
      (table === undefined ? [] : syntheticRowsOf(fieldsOf(table))),
  }
}

/**
 * A cell of a bound table drawn from the seed folder: its column's `format`,
 * else its field type's default, as the app writes the value; as stored
 * otherwise, and for a row of the synthetic seed.
 */
export const drawnCellText = (
  context: SeedContext,
  node: Node,
  column: Node,
  row: PageSeedRow
): string => {
  const field = String(column['field'])
  const table = seededTableOf(context, node)?.name
  const formatted =
    context.text === undefined || seedFolderRowsOf(context, node) === undefined
      ? undefined
      : cellTextOf(context.tables, { table, field, format: column['format'] }, row, context.text)
  return formatted ?? syntheticCellText(row[field])
}

const drawnTable = (context: SeedContext, node: Node): Node => {
  const { columns, rows } = drawnTableRowsOf(context, node)
  const { dataSource: _dataSource, columns: _columns, ...rest } = node
  return {
    ...rest,
    tableHeaders: columns.map((column) => stringField(column, 'label') ?? String(column['field'])),
    tableRows: rows.map((row) =>
      columns.map((column) => drawnCellText(context, node, column, row))
    ),
  }
}

/**
 * A list bound to a declared table, with no item template or children of its
 * own, drawn as one item per seeded row, each titled as the row is. Any other
 * list is drawn as the renderer draws it.
 */
const drawnList = (context: SeedContext, node: Node): Node => {
  const table = seededTableOf(context, node)
  const templated = node['listDisplay'] !== undefined || Array.isArray(node['children'])
  if (table === undefined || templated) return node
  const { dataSource: _dataSource, ...rest } = node
  const fields = fieldsOf(table)
  return {
    ...rest,
    children: (seedFolderRowsOf(context, node) ?? syntheticRowsOf(fields)).map((row) => ({
      type: 'li',
      content: syntheticTitleOf(fields, row),
    })),
  }
}

/**
 * A bound node as the export draws it: a table and a list from the seed (or
 * empty); every other island as the renderer draws its design-system specimen.
 */
export const drawnIsland = (context: SeedContext, node: Node): Node =>
  node['type'] === 'table'
    ? drawnTable(context, node)
    : node['type'] === 'list'
      ? drawnList(context, node)
      : node

/** The write-only fields of the table a page is bound to, whose values are never drawn. */
export const writeOnlyFieldsOf = (app: App, page: Page): ReadonlySet<string> => {
  const table = (page as { readonly dataSource?: { readonly table?: unknown } }).dataSource?.table
  const fields = (app.tables?.find((candidate) => candidate.name === table)?.fields ??
    []) as readonly Node[]
  return new Set(
    fields.flatMap((field) => (field['writeOnly'] === true ? [String(field['name'])] : []))
  )
}
