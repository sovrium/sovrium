/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/tables/:tableId/views/:viewId/records` — the request half.
 *
 * The program applies the view; this handler turns the query string into what
 * the caller may ask of it: `page`/`limit`/`offset`, `sort`, `q`, `filter`,
 * `fields`, `labels` and `aggregate` — the totals of a grid's summary row,
 * computed over the rows the view returns. `deleted` and `includeDeleted` are never read — the
 * trash is a privilege of the records route, not a parameter a reader can add.
 *
 * A caller's filter, sort and search are held to the columns the view serves:
 * a filter on a withheld column would still answer a question about it (the
 * rows it keeps), so it is refused, and the search runs over the view's own
 * columns only.
 *
 * The query is only examined for a caller the view admits. For anyone else the
 * program answers on its own — the same "not found" whether the view is
 * private or was never declared — so a malformed query cannot make a refusal
 * say more than the view's existence would.
 */

import { Effect } from 'effect'
import { emptyAggregations } from '@/application/use-cases/tables/aggregation-helpers'
import { DEFAULT_PAGE_SIZE } from '@/application/use-cases/tables/list-helpers'
import { viewReadAdmits } from '@/application/use-cases/tables/table-operations'
import {
  getViewRecordsProgram,
  type ViewRecordsQuery,
} from '@/application/use-cases/tables/view-records-program'
import {
  emptyViewRecordsResponseSchema,
  getViewRecordsResponseSchema,
} from '@/domain/models/api/tables/tables'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { findTableByIdOrName } from '@/domain/models/app/tables/table-lookup-service'
import {
  fieldsOutsideView,
  filterFieldNames,
  findViewByKey,
  sortFieldNames,
  viewGroupByParam,
} from '@/domain/models/app/tables/views/view-read-service'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { respondWith, runHandlerEffect, shapedJson } from '@/presentation/api/runtime/run-effect'
import { validateAggregateParam } from './field-permission-validation'
import { parseFilter } from './list-records-filter'
import { buildSearchFilter } from './list-records-search'
import { validatePaginationParams } from './pagination-validation'
import { parseListRecordsParams } from './param-parsers'
import { guardForTable, resolveAccessRolesFor } from './row-level-guard'
import { buildListFilter, mergeFilters } from './row-level-read-helpers'
import { validateSortPermission } from './sort-validation'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

type TableView = NonNullable<Table['views']>[number]

type PreparedViewQuery =
  | { readonly ok: true; readonly query: ViewRecordsQuery }
  | { readonly ok: false; readonly response: Response }

/** Every field an `?aggregate=` names. */
const aggregateFieldNames = (
  aggregate: ReturnType<typeof parseListRecordsParams>['aggregate']
): readonly string[] => [
  ...(aggregate?.sum ?? []),
  ...(aggregate?.avg ?? []),
  ...(aggregate?.min ?? []),
  ...(aggregate?.max ?? []),
]

const refuseOutsideView = (c: Context, field: string): Response =>
  c.json(
    {
      success: false,
      message: `Field '${field}' is not one of this view's fields`,
      code: 'VALIDATION_ERROR',
      errors: [{ field, message: `Field '${field}' is not one of this view's fields` }],
    },
    400
  )

/** The table as the view shows it: only the fields it lists, when it lists any. */
const narrowToView = (table: Table, view: TableView): Table =>
  view.fields === undefined || view.fields.length === 0
    ? table
    : { ...table, fields: table.fields.filter((field) => view.fields!.includes(field.name)) }

/**
 * A ratio's two sides, parsed and field-checked as `filter` is, or `undefined`
 * when none is asked; one side without the other is a `400`, as on the
 * table's aggregate read.
 */
function readViewRatioSides(
  c: Context,
  access: {
    readonly app: App
    readonly tableName: string
    readonly userRole: string
    readonly userGroups: readonly string[]
  }
): NonNullable<ViewRecordsQuery['ratio']> | undefined | Response {
  const { app, tableName, userRole, userGroups } = access
  const invalid = (message: string): Response =>
    c.json({ success: false, message, code: 'VALIDATION_ERROR' }, 400)
  const sent = ['numerator', 'denominator'].filter((side) => Boolean(c.req.query(side)))
  if (sent.length === 0) return undefined
  if (sent.length === 1) return invalid('A ratio needs both numerator and denominator')
  const numerator = parseFilter(c, app, tableName, { userRole, userGroups, param: 'numerator' })
  if (numerator.error) return numerator.response ?? invalid('Invalid numerator')
  const denominator = parseFilter(c, app, tableName, { userRole, userGroups, param: 'denominator' })
  if (denominator.error) return denominator.response ?? invalid('Invalid denominator')
  return { numerator: numerator.value, denominator: denominator.value }
}

/** The caller's `filter` and a ratio's two sides, each parsed and field-checked. */
function parseViewConditions(
  c: Context,
  access: Parameters<typeof readViewRatioSides>[1]
):
  | { readonly filter: ViewRecordsQuery['filter']; readonly ratio: ViewRecordsQuery['ratio'] }
  | Response {
  const { app, tableName, userRole, userGroups } = access
  const filter = parseFilter(c, app, tableName, { userRole, userGroups })
  if (filter.error) {
    return (
      filter.response ??
      c.json({ success: false, message: 'Invalid filter', code: 'VALIDATION_ERROR' }, 400)
    )
  }
  const ratio = readViewRatioSides(c, access)
  return ratio instanceof Response ? ratio : { filter: filter.value, ratio }
}

function prepareViewQuery(
  c: Context,
  input: { readonly app: App; readonly table: Table; readonly view: TableView }
): PreparedViewQuery {
  const { app, table, view } = input
  const { userRole, userGroups } = getTableContext(c)
  const tableName = table.name
  const access = { app, tableName, userRole, userGroups, c }

  const paginationError = validatePaginationParams(c)
  if (paginationError) return { ok: false, response: paginationError }

  const conditions = parseViewConditions(c, { app, tableName, userRole, userGroups })
  if (conditions instanceof Response) return { ok: false, response: conditions }
  const { filter, ratio } = conditions

  const params = parseListRecordsParams(c)
  const sortError = validateSortPermission({ sort: params.sort, ...access })
  if (sortError) return { ok: false, response: sortError }

  // A summary total is a read of the view's rows: it may name only the
  // columns the view serves, and only those the reader may read.
  const aggregateError = validateAggregateParam(params.aggregate, access)
  if (aggregateError) return { ok: false, response: aggregateError }

  const outside = fieldsOutsideView(view.fields, [
    ...filterFieldNames(filter),
    ...sortFieldNames(params.sort),
    ...aggregateFieldNames(params.aggregate),
    ...filterFieldNames(ratio?.numerator),
    ...filterFieldNames(ratio?.denominator),
  ])
  if (outside !== undefined) return { ok: false, response: refuseOutsideView(c, outside) }

  const search = buildSearchFilter({ ...access, table: narrowToView(table, view) })
  return {
    ok: true,
    query: {
      filter: mergeFilters(filter, search),
      sort: params.sort,
      fields: params.fields,
      limit: params.limit,
      offset: params.offset,
      labels: params.labels,
      ...(params.aggregate !== undefined && { aggregate: params.aggregate }),
      ...(ratio !== undefined && { ratio }),
      language: params.language,
    },
  }
}

/**
 * The caller's query, examined only when the view admits them; `undefined` for
 * anyone else, whom the program refuses on its own.
 */
function prepareForAdmittedCaller(
  c: Context,
  app: App,
  input: { readonly viewId: string; readonly accessRoles: readonly string[] }
): PreparedViewQuery | undefined {
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)
  const view = findViewByKey(table?.views, input.viewId)
  const caller = {
    role: userRole,
    groups: userGroups,
    accessRoles: input.accessRoles,
    anonymous: isGuestSession(session?.userId),
  }
  if (table === undefined || view === undefined || !viewReadAdmits(app, table, view, caller)) {
    return undefined
  }
  return prepareViewQuery(c, { app, table, view })
}

/**
 * The admitted caller's query with the table's row-level read rule folded in.
 *
 * A view narrows what a role may read; it never lifts the row rule the table
 * declares for that role, so a member scoped to their own rows stays scoped
 * whichever view they read through. A visitor reading a public view is scoped
 * the same way: her guard is the signed-out one, in which no `$currentUser`
 * value resolves, so a rule naming the signed-in person keeps no row for her
 * and a rule naming no one keeps what it keeps for everyone. The rule goes
 * into the read's filter, so the records, their total and every group count
 * follow it. `'empty'` when the rule admits no row, or cannot be projected.
 */
const withRowLevelScope = (app: App, c: Context, query: ViewRecordsQuery) => {
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)
  if (table?.rowLevelPermissions === undefined) return Effect.succeed(query)
  return Effect.map(
    guardForTable(session, { userRole, userGroups }, table, app),
    (guard): ViewRecordsQuery | 'empty' => {
      const scoped = buildListFilter(table, guard, undefined, query.filter)
      return scoped === 'empty' || scoped === 'reject' ? 'empty' : { ...query, filter: scoped }
    }
  )
}

/**
 * What a row rule admitting no row answers: the page a read over no row gives,
 * with every key the request asked for — the requested `limit`, `groups: []`
 * on a grouped view, zeroed `aggregations` and a ratio of nothing — so a
 * grouped grid or a KPI reads it as it reads any empty page.
 */
const emptyViewAnswer = (
  c: Context,
  query: ViewRecordsQuery,
  view: TableView | undefined
): Response =>
  shapedJson(
    c,
    {
      records: [],
      pagination: { total: 0, limit: query.limit ?? DEFAULT_PAGE_SIZE, offset: query.offset ?? 0 },
      ...(query.aggregate !== undefined && { aggregations: emptyAggregations(query.aggregate) }),
      ...(viewGroupByParam(view?.groupBy) !== undefined && { groups: [] }),
      ...(query.ratio !== undefined && { ratio: { numerator: 0, denominator: 0, percent: null } }),
    },
    emptyViewRecordsResponseSchema
  )

/**
 * The admitted caller's query with the row rule folded in, or the empty page
 * when the rule admits no row; `undefined` for a caller the view does not
 * admit, whom the program refuses on its own.
 */
const scopedQueryOrEmpty = (
  c: Context,
  app: App,
  input: { readonly prepared: PreparedViewQuery | undefined; readonly view: TableView | undefined }
) => {
  const { prepared, view } = input
  if (prepared?.ok !== true) return Effect.undefined
  return Effect.map(
    withRowLevelScope(app, c, prepared.query),
    (scoped): ViewRecordsQuery | Response =>
      scoped === 'empty' ? emptyViewAnswer(c, prepared.query, view) : scoped
  )
}

export function handleListViewRecords(c: Context, app: App) {
  return runHandlerEffect(
    c,
    Effect.gen(function* () {
      const { session, tableId, userRole, userGroups } = getTableContext(c)
      const viewId = c.req.param('viewId') ?? ''
      const table = findTableByIdOrName(app.tables, tableId)
      const accessRoles = yield* resolveAccessRolesFor(session, table === undefined ? [] : [table])
      const prepared = prepareForAdmittedCaller(c, app, { viewId, accessRoles })
      if (prepared?.ok === false) return prepared.response
      const query = yield* scopedQueryOrEmpty(c, app, {
        prepared,
        view: findViewByKey(table?.views, viewId),
      })
      if (query instanceof Response) return query

      return yield* respondWith(
        c,
        getViewRecordsProgram({
          tableId,
          viewId,
          app,
          userRole,
          userGroups,
          accessRoles,
          session,
          ...(query !== undefined && { query }),
          origin: new URL(c.req.url).origin,
        }),
        getViewRecordsResponseSchema
      )
    })
  )
}
