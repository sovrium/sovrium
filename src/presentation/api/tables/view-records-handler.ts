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
 * `fields` and `labels`. `deleted` and `includeDeleted` are never read — the
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

import { isViewAccessible } from '@/application/use-cases/tables/table-operations'
import {
  getViewRecordsProgram,
  type ViewRecordsQuery,
} from '@/application/use-cases/tables/view-records-program'
import { getViewRecordsResponseSchema } from '@/domain/models/api/tables/tables'
import {
  fieldsOutsideView,
  filterFieldNames,
  findViewByKey,
  sortFieldNames,
} from '@/domain/models/app/tables/views/view-read-service'
import { provideTableLive } from '@/infrastructure/layers/table-layer'
import { runEffect } from '@/presentation/api/runtime'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { parseFilter } from './list-records-filter'
import { buildSearchFilter } from './list-records-search'
import { validatePaginationParams } from './pagination-validation'
import { parseListRecordsParams } from './param-parsers'
import { resolveGuardForTable } from './row-level-guard'
import { buildListFilter, mergeFilters } from './row-level-read-helpers'
import { validateSortPermission } from './sort-validation'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

type TableView = NonNullable<Table['views']>[number]

type PreparedViewQuery =
  | { readonly ok: true; readonly query: ViewRecordsQuery }
  | { readonly ok: false; readonly response: Response }

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

function prepareViewQuery(
  c: Context,
  input: { readonly app: App; readonly table: Table; readonly view: TableView }
): PreparedViewQuery {
  const { app, table, view } = input
  const { userRole } = getTableContext(c)
  const tableName = table.name

  const paginationError = validatePaginationParams(c)
  if (paginationError) return { ok: false, response: paginationError }

  const filter = parseFilter(c, app, tableName, userRole)
  if (filter.error) {
    const response =
      filter.response ??
      c.json({ success: false, message: 'Invalid filter', code: 'VALIDATION_ERROR' }, 400)
    return { ok: false, response }
  }

  const params = parseListRecordsParams(c)
  const sortError = validateSortPermission({ sort: params.sort, app, tableName, userRole, c })
  if (sortError) return { ok: false, response: sortError }

  const outside = fieldsOutsideView(view.fields, [
    ...filterFieldNames(filter.value),
    ...sortFieldNames(params.sort),
  ])
  if (outside !== undefined) return { ok: false, response: refuseOutsideView(c, outside) }

  const search = buildSearchFilter({
    c,
    app,
    tableName,
    userRole,
    table: narrowToView(table, view),
  })
  return {
    ok: true,
    query: {
      filter: mergeFilters(filter.value, search),
      sort: params.sort,
      fields: params.fields,
      limit: params.limit,
      offset: params.offset,
      labels: params.labels,
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
  viewId: string
): PreparedViewQuery | undefined {
  const { tableName, userRole } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)
  const view = findViewByKey(table?.views, viewId)
  if (table === undefined || view === undefined || !isViewAccessible(view, userRole)) {
    return undefined
  }
  return prepareViewQuery(c, { app, table, view })
}

/**
 * The admitted caller's query with the table's row-level read rule folded in.
 *
 * A view narrows what a role may read; it never lifts the row rule the table
 * declares for that role, so a member scoped to their own rows stays scoped
 * whichever view they read through. A public view never reaches this — one on
 * a table with `rowLevelPermissions` is refused when the config loads — so it
 * only ever scopes a signed-in reader. `'empty'` when the rule admits no row.
 */
async function withRowLevelScope(
  c: Context,
  app: App,
  query: ViewRecordsQuery
): Promise<ViewRecordsQuery | 'empty'> {
  const { session, tableName, userRole } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)
  if (table?.rowLevelPermissions === undefined) return query
  const guard = await resolveGuardForTable(session, userRole, table, app)
  const scoped = buildListFilter(table, guard, undefined, query.filter)
  return scoped === 'empty' || scoped === 'reject' ? 'empty' : { ...query, filter: scoped }
}

export async function handleListViewRecords(c: Context, app: App) {
  const { session, tableId, userRole, userGroups } = getTableContext(c)
  const viewId = c.req.param('viewId') ?? ''
  const prepared = prepareForAdmittedCaller(c, app, viewId)
  if (prepared?.ok === false) return prepared.response
  const query = prepared?.ok === true ? await withRowLevelScope(c, app, prepared.query) : undefined
  if (query === 'empty') {
    return c.json({ records: [], pagination: { total: 0, limit: 0, offset: 0 } }, 200)
  }

  return runEffect(
    c,
    provideTableLive(
      getViewRecordsProgram({
        tableId,
        viewId,
        app,
        userRole,
        userGroups,
        session,
        ...(query !== undefined && { query }),
        origin: new URL(c.req.url).origin,
      })
    ),
    getViewRecordsResponseSchema
  )
}
