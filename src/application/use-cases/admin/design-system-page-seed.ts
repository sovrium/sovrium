/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The synthetic seed a page export draws its data-bound nodes from
 * (`synthetic-seed-service.ts`), as the projection applies it to one page
 * (`design-system-page-projection.ts`): which declared table a node reads,
 * the address a routed page is drawn at, and the drawn copy of a seeded table
 * or list. No row of any instance is read.
 */

import {
  syntheticCellText,
  syntheticRowsOf,
  syntheticTitleOf,
} from '@/domain/models/app/pages/synthetic-seed-service'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { SpecimenFieldShape } from '@/domain/models/app/pages/specimen-sample-service'

type Node = Readonly<Record<string, unknown>>

/** What a page's seed is read against: the app's tables, and the page's route values. */
export interface SeedContext {
  readonly tables: ReadonlyArray<{ readonly name: string; readonly fields: unknown }>
  /** The value each route parameter of the page is drawn at. */
  readonly routeValues: Readonly<Record<string, string>>
}

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
    [...page.path.matchAll(ROUTE_PARAMETER)].map((match) => {
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
const drawnTable = (context: SeedContext, node: Node): Node => {
  const table = seededTableOf(context, node)
  const declared = (Array.isArray(node['columns']) ? node['columns'] : []) as readonly Node[]
  const named = declared.flatMap((column) => (typeof column['field'] === 'string' ? [column] : []))
  const columns: readonly Node[] =
    named.length > 0 ? named : fieldsOf(table).map((field) => ({ field: field.name }))
  const rows = table === undefined ? [] : syntheticRowsOf(fieldsOf(table))
  const { dataSource: _dataSource, columns: _columns, ...rest } = node
  return {
    ...rest,
    tableHeaders: columns.map((column) => stringField(column, 'label') ?? String(column['field'])),
    tableRows: rows.map((row) =>
      columns.map((column) => syntheticCellText(row[String(column['field'])]))
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
    children: syntheticRowsOf(fields).map((row) => ({
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
