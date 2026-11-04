/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a data island's FIRST read would answer its reader, drawn on the server.
 *
 * A KPI, a grid or a list mounts its island lazily: one far below the first
 * screen waits until the reader comes near it (`island-mount-timing.ts`). With
 * only a skeleton in the page meanwhile, the browser's find could not reach its
 * values and a print started at once showed it empty. So the server reads, for
 * the visitor and through the records gate every server-drawn list answers
 * (`readRowsForCaller`: the rows her row-level rule admits, less the columns
 * she may not read), what the island would show first, and stamps it here: the
 * renderer draws it as readable markup, and the island's props carry it so the
 * mounted island starts from it instead of a loading state.
 *
 * Only a binding the island would read exactly as the server does is drawn: a
 * declared table, read directly, and, for a list, one of its views, read
 * through the view's own records route as the reader. A KPI or a grid bound to
 * a view, a system endpoint and a binding a filter control narrows are read in
 * the browser alone; their host draws its skeleton and its island mounts at once.
 *
 * What reaches the island is SHAPED, never a raw row: the record's id and the
 * plain values of the fields the component prints, as the records API answers
 * this reader. Anything richer arrives with the island's own read.
 */

import { MAX_PAGE_SIZE } from '@/domain/kernel/sql/page-window'
import { aggregateKpi } from '@/domain/models/app/pages/components/component-types/data/kpi/kpi-figure-service'
import {
  scopedTokensIn,
  substituteRecordVars,
  withRecordText,
} from '@/domain/models/app/pages/substitute-record-vars'
import { findViewByKey } from '@/domain/models/app/tables/views/view-read-service'
import { isListIslandMode } from '@/presentation/render/registry/list-island-mode'
import { componentField, keyOf, rewriteComponent, tableBindingOf } from './component-rewrite'
import { labelledPageRows } from './record-display-labels'
import { readRowsForCaller } from './record-read-gate'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'
import type { KpiAggregateConfig } from '@/domain/models/app/pages/components/component-types/data/kpi/kpi-figure-service'
import type { DrawnGridPage } from '@/presentation/design/drawn-grid'

/** The prop a drawn island carries its first answer under, from the resolver to the renderer. */
export const DRAWN_CONTENT_KEY = '_drawn'

/** The rows a grid draws on its first page when its author declared no page size. */
const GRID_FIRST_PAGE = 25

type Row = Readonly<Record<string, unknown>>

/** A drawn grid's or list's first page: its records, shaped, and the text each prints. */
export interface DrawnRows {
  readonly records: readonly Row[]
  readonly total: number
  /** Per record, the text of each printed field (a grid) or of the item's slots (a list). */
  readonly text: readonly (readonly string[])[]
}

/** A drawn KPI: its figure, `null` for no figure (a percentile over no values). */
export interface DrawnFigure {
  readonly metric: number | null
}

/** Whether the island reads its binding exactly as the server can: a declared table, directly. */
export function readsAsServer(component: Component): boolean {
  const binding = tableBindingOf(component)
  return (
    binding !== undefined &&
    typeof binding.table === 'string' &&
    binding.view === undefined &&
    keyOf(binding, 'system') === undefined &&
    keyOf(binding, 'bindTo') === undefined &&
    keyOf(binding, 'sharedFilter') === undefined
  )
}

/** A value the records API would print as it is: text, a number, a boolean or nothing. */
const isPlainValue = (value: unknown): boolean =>
  value === null || ['string', 'number', 'boolean'].includes(typeof value)

/** A record reduced to its id and the plain values of `fields`. */
const shapedRecord = (row: Row, fields: readonly string[]): Row =>
  Object.fromEntries(
    ['id', ...fields].flatMap((field) =>
      isPlainValue(row[field]) ? [[field, row[field]] as const] : []
    )
  )

/** The text `template` prints for `row`, every `$record.` token filled. */
const printed = (template: string, row: Row): string =>
  substituteRecordVars(template, withRecordText(row))

/** A grid column the server draws: its field, and the heading it prints. */
export interface DrawnColumn {
  readonly field: string
  readonly label: string
}

/** The columns a grid shows, in order: each declared column naming a field, unless hidden. */
export const drawnColumnsOf = (columns: unknown): readonly DrawnColumn[] =>
  (Array.isArray(columns) ? columns : []).flatMap((column) => {
    const field = keyOf(column, 'field')
    const label = keyOf(column, 'label')
    const visible = keyOf(column, 'visible')
    if (typeof field !== 'string' || visible === false || visible === 'hidden') return []
    return [{ field, label: typeof label === 'string' ? label : field }]
  })

/** The fields a grid prints: each shown column's `field`, in order. */
const gridFieldsOf = (component: Component): readonly string[] =>
  drawnColumnsOf(componentField(component, 'columns')).map((column) => column.field)

/** How many rows a grid's first page holds: its page size, never past its `limit`. */
const gridFirstPage = (component: Component): number => {
  const pageSize = keyOf(componentField(component, 'pagination'), 'pageSize')
  const bindingSize = keyOf(tableBindingOf(component)?.pagination, 'pageSize')
  const size =
    typeof pageSize === 'number'
      ? pageSize
      : typeof bindingSize === 'number'
        ? bindingSize
        : GRID_FIRST_PAGE
  const limit = tableBindingOf(component)?.limit
  return limit === undefined ? size : Math.min(limit, size)
}

/**
 * Whether a grid's author made it a place to edit rows: it declares `autoSave`,
 * or a column declared `editable: true`.
 *
 * Such a grid is never drawn. A save declares the version of the row it was
 * written against, read from the island's own read; a drawn row carries no
 * version, and the version its reader saw on the served page would not be the
 * one a later read hands the save. Its island mounts at once and reads.
 */
function editsInPlace(component: Component): boolean {
  if (componentField(component, 'autoSave') !== undefined) return true
  const columns = componentField(component, 'columns')
  return Array.isArray(columns) && columns.some((column) => keyOf(column, 'editable') === true)
}

/** A grid's first page: the shown columns of its first rows, in the order read. */
function drawnGrid(component: Component, rows: readonly Row[]): DrawnRows | undefined {
  const fields = gridFieldsOf(component)
  if (fields.length === 0 || rows.length === 0 || editsInPlace(component)) return undefined
  const page = rows.slice(0, gridFirstPage(component))
  const limit = tableBindingOf(component)?.limit
  return {
    records: page.map((row) => shapedRecord(row, fields)),
    total: limit === undefined ? rows.length : Math.min(rows.length, limit),
    text: page.map((row) => fields.map((field) => printed(`$record.${field}`, row))),
  }
}

/**
 * The first page drawn for a grid's reader, from its renderer's props — unless
 * the grid opens on something that page does not show: a view picked from its
 * switcher, or groups.
 */
export function drawnGridOf(
  elementProps: Readonly<Record<string, unknown>>
): DrawnRows | undefined {
  if (elementProps['viewSwitcher'] !== undefined || elementProps['groupBy'] !== undefined) {
    return undefined
  }
  return elementProps[DRAWN_CONTENT_KEY] as DrawnRows | undefined
}

/** A drawn grid's page as its placeholder prints it: its column headings and each row's text. */
export const drawnGridPageOf = (drawn: DrawnRows, columns: unknown): DrawnGridPage => ({
  headings: drawnColumnsOf(columns).map((column) => column.label),
  rows: drawn.text,
})

/**
 * What a drawn grid's island props carry: the page it shows, as text, until its
 * own read answers. Never records: the grid draws a row from a record only once
 * it has read it, decorated and wired as its read returns it.
 */
export const drawnGridProp = (
  drawn: DrawnRows | undefined,
  columns: unknown
): { readonly drawn?: DrawnGridPage } =>
  drawn === undefined ? {} : { drawn: drawnGridPageOf(drawn, columns) }

/** What a drawn list's island props carry: its first page, without the text. */
export const drawnIslandProp = (
  drawn: DrawnRows | undefined
): { readonly drawn?: Pick<DrawnRows, 'records' | 'total'> } =>
  drawn === undefined ? {} : { drawn: { records: drawn.records, total: drawn.total } }

/** The mark a drawn island's host carries, the one sign the mounter reads to let it wait. */
export const drawnHostMark = (drawn: unknown): { readonly 'data-island-drawn'?: '' } =>
  drawn === undefined ? {} : { 'data-island-drawn': '' }

/** The style of drawn rows: read and found, never pressed (`design/drawn-grid.tsx`). */
export { DRAWN_ROWS_STYLE } from '@/presentation/design/drawn-rows-style'

/** Whether a field holds a value an aggregate counts: the aggregate read skips an empty one. */
const holdsValue = (value: unknown): boolean =>
  value !== null && value !== undefined && value !== ''

/**
 * A KPI's figure over every row its binding admits — what the aggregate read
 * answers. A ratio, counted by that read alone, and a capped binding are not
 * drawn.
 */
function drawnFigure(component: Component, rows: readonly Row[]): DrawnFigure | undefined {
  const aggregate = (componentField(component, 'kpiAggregate') as
    KpiAggregateConfig | undefined) ?? { function: 'count' }
  if (aggregate.function === 'ratio' || isCapped(tableBindingOf(component))) return undefined
  const { field } = aggregate
  if (aggregate.function === 'count' || field === undefined) return { metric: rows.length }
  const counted = rows.filter((row) => holdsValue(row[field]))
  const none = counted.length === 0 && aggregate.function.startsWith('p')
  return { metric: none ? null : aggregateKpi(counted, aggregate) }
}

/** Whether a binding reads fewer rows than it admits: a `limit` or a page size. */
const isCapped = (binding: ReturnType<typeof tableBindingOf>): boolean =>
  binding?.limit !== undefined || binding?.pagination !== undefined

/**
 * `component` carrying its first answer, read from `rows` — the rows the
 * server read for its reader, prepared for `$record.` text — when it is a KPI
 * or a grid the server can answer as its island would; else as it was.
 */
export function withDrawnContent(component: Component, rows: readonly Row[]): Component {
  if (!readsAsServer(component)) return component
  const drawn =
    component.type === 'kpi'
      ? drawnFigure(component, rows)
      : component.type === 'table'
        ? drawnGrid(component, rows)
        : undefined
  if (drawn === undefined) return component
  return rewriteComponent(component, {
    props: { ...(component.props ?? {}), [DRAWN_CONTENT_KEY]: drawn },
  })
}

/** The record fields an item template names, `$record.<field>` anywhere in it. */
const templateFieldsOf = (template: unknown): readonly string[] => [
  ...new Set(
    scopedTokensIn(JSON.stringify(template ?? {}))
      .filter((token) => token.namespace === 'record')
      .map((token) => token.field.split('.')[0] as string)
  ),
]

/**
 * A list's first page: each item's title and subtitle as its template prints
 * them, and `total`, how many records the read admits past that page. A list
 * whose page claimed to be the whole set would draw no way to the next one, and
 * announce every record loaded, until its own read answered.
 */
function drawnListRows(
  template: Readonly<Record<string, unknown>> | undefined,
  rows: readonly Row[],
  total: number
): DrawnRows | undefined {
  const title = keyOf(template, 'title')
  if (typeof title !== 'string' || rows.length === 0) return undefined
  const subtitle = keyOf(template, 'subtitle')
  const fields = templateFieldsOf(template)
  return {
    records: rows.map((row) => shapedRecord(row, fields)),
    total: Math.max(total, rows.length),
    text: rows.map((row) => [
      printed(title, row),
      ...(typeof subtitle === 'string' ? [printed(subtitle, row)] : []),
    ]),
  }
}

/** A list's first page as its island asks for it: filter, sort, `limit`, capped by `maxItems`. */
const listFirstPageQuery = (
  binding: NonNullable<ReturnType<typeof tableBindingOf>>,
  maxItems: unknown
) => {
  const pageSize = Math.min(binding.limit ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE)
  return {
    ...(binding.filter !== undefined ? { filter: binding.filter } : {}),
    ...(binding.sort !== undefined ? { sort: binding.sort } : {}),
    pageSize: typeof maxItems === 'number' ? Math.min(maxItems, pageSize) : pageSize,
  }
}

/** Who a list's server read answers, and through which reader. */
interface ListReader {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
}

/**
 * Whether a list reads one of its table's views and nothing besides: its
 * island then reads the view's own records route, with no condition of its own.
 */
function readsViewAsServer(component: Component): boolean {
  const binding = tableBindingOf(component)
  return (
    binding !== undefined &&
    typeof binding.table === 'string' &&
    binding.view !== undefined &&
    binding.filter === undefined &&
    binding.sort === undefined &&
    ['system', 'bindTo', 'sharedFilter'].every((key) => keyOf(binding, key) === undefined)
  )
}

type ListBinding = NonNullable<ReturnType<typeof tableBindingOf>>

/** A list's first page, and how many records its read admits in all. */
interface PageRows {
  readonly rows: readonly Row[]
  readonly total: number
}

/** A table-bound list's first page, read for its reader through the records gate. */
async function tablePageRows(
  binding: ListBinding,
  maxItems: unknown,
  reader: ListReader
): Promise<PageRows> {
  const { rows, total } = await readRowsForCaller({
    ...reader,
    tableName: binding.table as string,
    query: listFirstPageQuery(binding, maxItems),
    withTotal: true,
  })
  return { rows, total }
}

/**
 * A view-bound list's first page, read through the view's own records route
 * as its reader (`db.fetchSystemRows`): that route's gate decides, so a public
 * view answers a visitor, a view she may not read answers her no row, and only
 * the fields the view serves her arrive, in its order. `undefined` with no
 * such reader (a static build), or over a view that groups, when the list is
 * not drawn.
 */
async function viewPageRows(
  binding: ListBinding,
  maxItems: unknown,
  reader: ListReader
): Promise<PageRows | undefined> {
  const fetchRows = reader.db.fetchSystemRows
  const table = reader.app.tables?.find((candidate) => candidate.name === binding.table)
  const view = findViewByKey(table?.views, String(binding.view))
  // A grouped view's first page is its groups, which the island draws from its own read.
  if (fetchRows === undefined || view === undefined || view.groupBy !== undefined) return undefined
  const address = [binding.table as string, String(binding.view)].map(encodeURIComponent)
  const { pageSize } = listFirstPageQuery(binding, maxItems)
  const endpoint = `/api/tables/${address[0]}/views/${address[1]}/records?limit=${pageSize}`
  const records = await fetchRows(endpoint, 'records').catch(() => [])
  const rows = records.map((record) => ({
    id: record['id'],
    ...(record['fields'] as Row | undefined),
  }))
  return { rows, total: rows.length }
}

/**
 * A client-fetching `list` carrying its first page, read for its reader as its
 * island would read it — the binding's filter and sort, its `limit` as the page
 * size, `listDisplay.maxItems` as the cap — through the records gate; or, bound
 * to one of its table's views, through that view's own records route. A list
 * with no row to show, or one the server cannot read as its island does, is
 * returned as it was.
 */
export async function withDrawnList(component: Component, reader: ListReader): Promise<Component> {
  if (!isListIslandMode(component)) return component
  const binding = tableBindingOf(component)
  const tableName = binding?.table
  if (!(reader.app.tables ?? []).some((table) => table.name === tableName)) return component
  const display = componentField(component, 'listDisplay')
  const maxItems = keyOf(display, 'maxItems')
  const page = readsAsServer(component)
    ? await tablePageRows(binding!, maxItems, reader)
    : readsViewAsServer(component)
      ? await viewPageRows(binding!, maxItems, reader)
      : undefined
  if (page === undefined) return component
  const pageRows = await labelledPageRows(page.rows, { ...reader, tableName: tableName as string })
  const template = keyOf(display, 'itemTemplate') as Row | undefined
  const drawn = drawnListRows(template, pageRows, page.total)
  if (drawn === undefined) return component
  return rewriteComponent(component, {
    props: { ...(component.props ?? {}), [DRAWN_CONTENT_KEY]: drawn },
  })
}
