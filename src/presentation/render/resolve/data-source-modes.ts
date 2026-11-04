/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The four `dataSource.mode` resolvers — single, list, search, and the island
 * short-circuit's props — under the read plan `read-plan-gates.ts` composes;
 * the write half is `write-permission-gates.ts`.
 *
 * One module because the modes share a composition: the same access plan, field
 * filter and `withWritePermissionGates` stamp; `resolveByMode` is the dispatch.
 * The same gates applied one container down are `nested-table-gates.ts`.
 */

import { pageRecordOf } from '@/presentation/render/props/record-value-format'
import { withCallerTableView } from './caller-table-stamp'
import { withChannelFilter } from './channel-row-lists'
import {
  componentField,
  rewriteComponent,
  synthesizedComponent,
  tableBindingOf,
} from './component-rewrite'
import { expandBoundRows } from './conversation-rows'
import {
  SINGLE_RECORD_NOT_FOUND,
  validateDataSourceFields,
  withDataSourceError,
  type DataSourceDb,
  type DataSourceSectionResult,
} from './data-source-contracts'
import { withDrawnContent } from './drawn-island-content'
import { applyFieldLevelPermissions } from './field-permission-filter'
import {
  boundManyToManyFields,
  narrowRecordToComponent,
  withManyToManyLinks,
} from './form-bound-record'
import { ftsFirstRows, ftsSearchProps } from './fts-search-binding'
import { bindRecordToButtonsWithin } from './page-record-buttons'
import { gateInheritedRecord, holdsInheritedRecord, withheldFieldsProps } from './read-plan-gates'
import { restrictedColumnsForReader } from './reader-row-admission'
import { labelledPageRows, withRecordLabels } from './record-display-labels'
import { readRowsForCaller, type CallerRowsQuery } from './record-read-gate'
import { substituteBoundRecord } from './record-repeat-expansion'
import { addressRowAttachments, recordAddresser } from './row-attachment-addresses'
import { readBoundRecordForCaller } from './single-record-read'
import { bindReadRows } from './viewer-own-rows'
import { isReadWithheld } from './withheld-component'
import { withWritePermissionGates } from './write-permission-gates'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'
import type { DataSource } from '@/domain/models/app/pages/components/data-source'
import type { ReadAccessPlan } from '@/domain/models/app/tables/read-access-plan-service'

/**
 * The star toggle bound to a detail page's record, drawn for a signed-in reader alone: favourites
 * belong to a person, and a session exists only in an app declaring `auth`. A visitor gets none.
 */
function favoritesStar(tableName: string, record: RecordRow, session: SessionInfo | undefined) {
  const { id } = record
  const entityId = id === undefined || id === null ? '' : String(id)
  const star = { type: 'favorites-button', entityType: 'record', entityId, tableName }
  return session === undefined ? [] : [synthesizedComponent(star)]
}

function applySingleRecordToComponent(
  component: Component,
  record: RecordRow,
  ctx: Pick<SingleModeOptions, 'tableName' | 'plan' | 'db' | 'session'> & { pageFields: RecordRow }
): Component {
  const pageRecord = pageRecordOf(ctx.pageFields, ctx.tableName, ctx.db.recordText)
  // Its `crud` buttons act on this record, by the record's own id, as on a page bound to one.
  const substituted = bindRecordToButtonsWithin(
    substituteBoundRecord(component, pageRecord, ctx.tableName),
    record,
    ctx.tableName
  )
  const existingChildren = substituted.children ?? []
  return rewriteComponent(substituted, {
    children: [...existingChildren, ...favoritesStar(ctx.tableName, record, ctx.session)],
    props: {
      ...(substituted.props ?? {}),
      ...withheldFieldsProps(component, ctx.plan),
      _dataSourceBound: true,
      _record: narrowRecordToComponent(component, record),
    },
  })
}

type RecordRow = Readonly<Record<string, unknown>>

interface SingleModeOptions {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly tableName: string
  readonly param: string | undefined
  readonly requestedFields: readonly string[] | undefined
  readonly routeParams: Readonly<Record<string, string>>
  readonly db: DataSourceDb
  readonly plan: ReadAccessPlan | undefined
  /** The many-to-many fields the component reads, whose links live in junction tables. */
  readonly manyToManyFields: ReturnType<typeof boundManyToManyFields>
}

/**
 * Resolve a `mode: single` binding for this visitor.
 *
 * The record reaches the page (its `$record.*` text, a form's values, the island props), so
 * it is read through the records gate ({@link readBoundRecordForCaller}): among the rows the
 * binding's `filter` matches, the route parameter's row, or — with no `param` and no matching
 * URL segment (`/profile/edit`) — the first the visitor may read. A row outside the filter,
 * hidden by the row-level rule or in the trash answers as a missing one — the page's 404, so
 * ids cannot be probed — and a readable row arrives less the columns she may not read
 * (`denyWhenUnreadable` refuses the table first).
 */
async function resolveSingleMode(
  component: Component,
  options: SingleModeOptions
): Promise<Component | typeof SINGLE_RECORD_NOT_FOUND> {
  const { tableName, param, routeParams } = options
  const paramName = param ?? tableName
  const paramValue = routeParams[paramName]
  if (!paramValue && param !== undefined) {
    return withDataSourceError(component, `Error: route parameter "${paramName}" not found`)
  }
  const gatedRecord = await readBoundRecordForCaller({
    ...options,
    at: paramValue ? { param: paramName, value: paramValue } : 'first-readable',
    fields: options.requestedFields,
    binding: tableBindingOf(component),
  })
  if (gatedRecord === undefined) return SINGLE_RECORD_NOT_FOUND
  const record = await withManyToManyLinks(gatedRecord, options)
  // Its attachment tokens are addresses, as in a list row; `_record` keeps the stored value.
  const address = recordAddresser(options.app, options.db.signFileUrl)
  const bound = await address(component, record, tableName)
  const ctx = { ...options, tableName, pageFields: await withRecordLabels(bound.record, options) }
  return applySingleRecordToComponent(bound.tree, record, ctx)
}

export function checkFieldErrors(
  component: Component,
  tableName: string,
  requestedFields: readonly string[] | undefined,
  tableFields: readonly { readonly name: string }[]
): Component | undefined {
  if (!requestedFields || requestedFields.length === 0) return undefined
  const tableFieldNames = new Set(tableFields.map((f) => f.name))
  return validateDataSourceFields(component, tableName, requestedFields, tableFieldNames)
}

/** Rows a server-drawn section reads: `limit`, its page size, or the smaller of both. */
function rowCap(dataSource: DataSource | undefined): number | undefined {
  const { limit, pagination } = dataSource ?? {}
  return limit === undefined ? pagination?.pageSize : Math.min(limit, pagination?.pageSize ?? limit)
}

/** Who a server-side read of rows answers, and through which reader. */
interface CallerReadContext {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
}

/** A binding's own `fields`, `filter` and `sort`, as one query of rows. */
function bindingQuery(
  dataSource: DataSource | undefined,
  requestedFields: readonly string[] | undefined
): CallerRowsQuery {
  return {
    ...(requestedFields !== undefined ? { fields: requestedFields } : {}),
    ...(dataSource?.filter !== undefined ? { filter: dataSource.filter } : {}),
    ...(dataSource?.sort !== undefined ? { sort: dataSource.sort } : {}),
  }
}

/**
 * Resolve a list binding: its rows are drawn on the server, so they are read
 * through the records gate ({@link readRowsForCaller}) — the rows the row-level
 * rule shows this visitor, less the columns she may not read — and the pager's
 * total counts those rows alone. Only those rows' attachments get an address.
 */
async function resolveListMode(
  component: Component,
  tableName: string,
  ctx: CallerReadContext & { readonly requestedFields: readonly string[] | undefined }
): Promise<Component> {
  const dataSource = tableBindingOf(component)
  const pagination = dataSource?.pagination
  const pageSize = pagination?.pageSize
  const { rows, total: totalCount } = await readRowsForCaller({
    app: ctx.app,
    tableName,
    session: ctx.session,
    db: ctx.db,
    query: { ...bindingQuery(dataSource, ctx.requestedFields), pageSize: rowCap(dataSource) },
    withTotal: pageSize !== undefined,
  })

  // `limit` caps the whole section, so the pager never offers a page it may not draw.
  const total = Math.min(totalCount, dataSource?.limit ?? totalCount)
  const paginationMeta =
    pageSize !== undefined ? { pageSize, totalCount: total, style: pagination?.style } : undefined
  const sign = ctx.db.signFileUrl
  const own = await bindReadRows(component, rows, ctx)
  const addressed = await addressRowAttachments({ ...own, app: ctx.app, tableName, sign })
  const pageRows = await labelledPageRows(addressed.rows, { ...ctx, tableName })
  // A KPI or a grid draws its first answer from these rows (`drawn-island-content.ts`).
  const drawn = withDrawnContent(addressed.component, pageRows)
  return expandBoundRows(drawn, pageRows, paginationMeta, ctx)
}

function buildSearchProps(
  component: Component,
  records: readonly Record<string, unknown>[]
): Record<string, unknown> {
  const { table, searchFields, debounceMs, limit, bindTo } = tableBindingOf(component) ?? {}
  // `listDisplay` is the declarative search-first display config (itemTemplate,
  // emptyMessage, loadMore, highlight). Only `list` components carry it.
  const listDisplay = componentField(component, 'listDisplay')
  return {
    ...(component.props ?? {}),
    _searchMode: true,
    _searchRecords: JSON.stringify(records),
    _searchFields: JSON.stringify(searchFields ?? []),
    _searchDebounceMs: debounceMs ?? 0,
    _searchLimit: limit ?? 0,
    _searchChildTemplate: JSON.stringify(component.children ?? []),
    // The table the rows come from, carried into the island props so the page's
    // one payload filter judges the search fields and the item template against
    // THIS table's hidden fields — not only against names hidden on every table,
    // which a readable field of the same name on another table would mask.
    ...(typeof table === 'string' ? { _searchTable: table } : {}),
    ...ftsSearchProps(tableBindingOf(component)),
    // `bindTo` defers the query to an external `search-input` component; the list
    // then renders results only (no own input box) to avoid duplicate inputs.
    ...(bindTo !== undefined ? { _searchBindTo: bindTo } : {}),
    // Kept an OBJECT, not a JSON string: the props pass that resolves `$t:`
    // walks nested objects but reads a string whole, so a serialised
    // `emptyMessage: '$t:…'` reached the page as the raw key.
    ...(listDisplay !== undefined ? { _listDisplay: listDisplay } : {}),
  }
}

/**
 * Resolve a `mode: search` binding: the matching rows — every one, or the first
 * page on `searchEngine: 'fts'` — go into the island's props with the text they
 * print, read through the records gate ({@link readRowsForCaller}): only the rows
 * the row-level rule shows this visitor, each less the columns she may not read.
 */
async function resolveSearchMode(
  component: Component,
  tableName: string,
  ctx: CallerReadContext & { readonly requestedFields: readonly string[] | undefined }
): Promise<Component> {
  const dataSource = tableBindingOf(component)
  const { rows } = await readRowsForCaller({
    app: ctx.app,
    tableName,
    session: ctx.session,
    db: ctx.db,
    query: { ...bindingQuery(dataSource, ctx.requestedFields), ...ftsFirstRows(dataSource) },
  })
  const pageRows = rows.map((row) => pageRecordOf(row, tableName, ctx.db.recordText))
  return rewriteComponent(component, { props: buildSearchProps(component, pageRows) })
}

/** Resolves a validated component by mode (list/single/search) with field-level filtering. */
export async function resolveByMode(ctx: {
  readonly component: Component
  readonly app: App
  readonly table: NonNullable<ReturnType<NonNullable<App['tables']>['find']>>
  readonly session: SessionInfo | undefined
  readonly routeParams: Readonly<Record<string, string>>
  readonly db: DataSourceDb
  readonly plan: ReadAccessPlan | undefined
}): Promise<DataSourceSectionResult> {
  // A form holding the record its page handed down has nothing left to fetch:
  // it is not a list, and resolving it as one queried the whole table only to
  // discard every row. Its record answers the caller's read plan instead.
  if (holdsInheritedRecord(ctx.component)) return gateInheritedRecord(ctx.component, ctx.plan)
  const { table: tableName, fields: requestedFields, mode, param } = tableBindingOf(ctx.component)!
  // The plan's restricted set, NOT a locally re-derived one (the predecessor
  // returned none for a table declaring no `permissions.fields`, so a `viewer`
  // saw every column the records API stripped) — less the columns a grant
  // shows her on every row her list admits.
  const restricted = await restrictedColumnsForReader({ ...ctx, tableName })
  const viewed = await withCallerTableView(withWritePermissionGates(ctx), ctx)
  const gated = withChannelFilter(viewed, ctx.table, restricted)
  if (isReadWithheld(gated)) return gated
  const { component: fc, fields: ff } = applyFieldLevelPermissions(
    gated,
    requestedFields,
    restricted
  )
  if (mode === 'single') {
    return resolveSingleMode(fc, {
      app: ctx.app,
      session: ctx.session,
      tableName,
      param,
      requestedFields: ff,
      routeParams: ctx.routeParams,
      db: ctx.db,
      plan: ctx.plan,
      manyToManyFields: boundManyToManyFields(fc, ctx.table, { ...ctx, requestedFields: ff }),
    })
  }
  const reader = { app: ctx.app, session: ctx.session, db: ctx.db, requestedFields: ff }
  if (mode === 'search') return resolveSearchMode(fc, tableName, reader)
  return resolveListMode(fc, tableName, reader)
}
