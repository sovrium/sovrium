/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Read the graph a `graph` or `matrix` TABLE source names, as one visitor.
 *
 * The endpoint arm reads an envelope over HTTP with the caller's identity; the
 * table arm reads the same envelope from the app's own tables, through the one
 * gate every server-drawn read goes through ({@link readRowsForCaller}):
 *
 *  - a node table the visitor may not read yields no node, a row its
 *    row-level rule hides is not a node, and a column she may not read never
 *    reaches a label, a group or a state;
 *  - a link table is read the same way, so an edge she may not read is not
 *    drawn either;
 *  - a many-to-many self link is read from its junction only when she may
 *    read the field.
 *
 * A node entry bound to a view reads the view's filters as page filters. A view
 * holding a condition with no page-filter translation (an `or` group,
 * `startsWith`, …) makes the whole source UNAVAILABLE rather than draw rows the
 * view would have kept out.
 *
 * The envelope itself is built by the domain
 * (`graph-tables-source-service.ts`), so the two projections read a table
 * source exactly as they read an endpoint.
 */

import {
  buildGraphTablesEnvelope,
  fieldEdgeParts,
  isLinkEdge,
  relationshipIndexOf,
  viewFiltersAsDataFilters,
  type GraphTablesRows,
} from '@/domain/models/app/pages/graph-tables-source-service'
import { callerReaderFromSession } from '@/domain/models/app/tables/caller-record-gate-service'
import { filterReadableFields } from '@/domain/models/app/tables/field-read-filter-service'
import { findViewByKey } from '@/domain/models/app/tables/views/view-read-service'
import { readRowsForCaller } from './record-read-gate'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'
import type { GraphTablesSource } from '@/domain/models/app/pages/components/graph-tables-source'

type Row = Readonly<Record<string, unknown>>

/** Reads one table source's envelope for the visitor; `undefined` is unavailable. */
export type TablesEnvelopeReader = (
  source: GraphTablesSource
) => Promise<Readonly<Record<string, unknown>> | undefined>

/** The prefix a table source's envelope key carries, beside the endpoint URLs. */
const TABLES_KEY = 'tables:'

/** The table source of a component's `dataSource`, when it is one. */
export const tablesSourceOf = (dataSource: unknown): GraphTablesSource | undefined =>
  typeof dataSource === 'object' &&
  dataSource !== null &&
  Array.isArray((dataSource as { readonly nodes?: unknown }).nodes)
    ? (dataSource as GraphTablesSource)
    : undefined

/** The key a table source's envelope is read and found under. */
export const tablesKeyOf = (source: GraphTablesSource): string =>
  `${TABLES_KEY}${JSON.stringify(source)}`

/** The table source a key names, when it names one. */
export const tablesSourceOfKey = (key: string): GraphTablesSource | undefined =>
  key.startsWith(TABLES_KEY)
    ? (JSON.parse(key.slice(TABLES_KEY.length)) as GraphTablesSource)
    : undefined

interface ReadContext {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
}

/** The rows of one table the visitor may read, narrowed by `filter`. */
const rowsOf = async (
  ctx: ReadContext,
  tableName: string,
  filter: readonly DataFilter[]
): Promise<readonly Row[]> => {
  const { rows } = await readRowsForCaller({
    ...ctx,
    tableName,
    query: filter.length === 0 ? {} : { filter },
  })
  return rows
}

/** The page filters of a node entry's view; `[]` with no view, `undefined` untranslatable. */
const entryFilters = (
  app: App,
  entry: GraphTablesSource['nodes'][number]
): readonly DataFilter[] | undefined => {
  if (entry.view === undefined) return []
  const table = app.tables?.find((t) => t.name === entry.table)
  const view = findViewByKey(table?.views, entry.view)
  return view === undefined ? undefined : viewFiltersAsDataFilters(view.filters)
}

/** Whether the visitor may read `field` of `tableName`. */
const mayReadField = (ctx: ReadContext, tableName: string, field: string): boolean => {
  if (!ctx.app.auth) return true
  const reader = callerReaderFromSession(ctx.session, ctx.app)
  const caller = { role: reader?.role ?? 'guest', groups: reader?.groups ?? [] }
  const kept = filterReadableFields({
    app: ctx.app,
    tableName,
    caller,
    record: { [field]: true },
  })
  return Object.hasOwn(kept, field)
}

/** The ids each read row links through a many-to-many field edge. */
const fieldLinksOf = async (
  ctx: ReadContext,
  edge: { readonly table: string; readonly field: string; readonly relatedTable: string },
  rows: readonly Row[]
): Promise<ReadonlyMap<string, readonly string[]>> => {
  const fetchLinks = ctx.db.fetchManyToManyLinks
  if (fetchLinks === undefined || !mayReadField(ctx, edge.table, edge.field)) return new Map()
  const fields = [{ fieldName: edge.field, relatedTable: edge.relatedTable }]
  const ids = [...new Set(rows.map((row) => String(row['id'])))]
  return new Map(
    await Promise.all(
      ids.map(async (id) => {
        const links = await fetchLinks(edge.table, id, fields)
        return [id, (links[edge.field] ?? []).map(String)] as const
      })
    )
  )
}

/** Read one table source's envelope for the visitor `ctx` names. */
export const readTablesEnvelope = async (
  ctx: ReadContext,
  source: GraphTablesSource
): Promise<Readonly<Record<string, unknown>> | undefined> => {
  const filters = source.nodes.map((entry) => entryFilters(ctx.app, entry))
  if (filters.some((filter) => filter === undefined)) return undefined
  const relationships = relationshipIndexOf(ctx.app.tables)
  const nodeRows = await Promise.all(
    source.nodes.map((entry, index) => rowsOf(ctx, entry.table, filters[index] ?? []))
  )
  const edges = source.edges ?? []
  const edgeReads = await Promise.all(
    edges.map(async (edge, index) => {
      if (isLinkEdge(edge)) return { index, rows: await rowsOf(ctx, edge.table, []) }
      const { table, field } = fieldEdgeParts(edge)
      const info = relationships.get(table)?.get(field)
      if (info === undefined || !info.many) return { index }
      const rows = source.nodes.flatMap((entry, at) =>
        entry.table === table ? (nodeRows[at] ?? []) : []
      )
      const links = await fieldLinksOf(ctx, { table, field, ...info }, rows)
      return { index, links }
    })
  )
  const rows: GraphTablesRows = {
    nodeRows,
    linkRows: new Map(
      edgeReads.flatMap((read) =>
        'rows' in read && read.rows !== undefined ? [[read.index, read.rows] as const] : []
      )
    ),
    fieldLinks: new Map(
      edgeReads.flatMap((read) =>
        'links' in read && read.links !== undefined ? [[read.index, read.links] as const] : []
      )
    ),
  }
  return buildGraphTablesEnvelope(source, rows, relationships)
}

/** The reader the page's graph and matrix passes are handed, for one visitor. */
export const tablesEnvelopeReaderFor =
  (ctx: ReadContext): TablesEnvelopeReader =>
  (source) =>
    readTablesEnvelope(ctx, source).catch(() => undefined)
