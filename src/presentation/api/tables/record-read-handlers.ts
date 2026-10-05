/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { createListRecordsProgram } from '@/application/use-cases/tables/list-records-program'
import {
  createListTrashProgram,
  createGetRecordProgram,
} from '@/application/use-cases/tables/read-record-programs'
import { viewGrantAdmits, type TableCaller } from '@/application/use-cases/tables/table-operations'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import {
  listRecordsResponseSchema,
  getRecordResponseSchema,
} from '@/domain/models/api/tables/tables'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { hasReadPermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  findViewByKey,
  viewFilterConditions,
  viewSortParam,
} from '@/domain/models/app/tables/views/view-read-service'
import { provideTableLive } from '@/infrastructure/layers/table-layer'
import { runEffect } from '@/presentation/api/runtime'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { handleRouteError } from './error-handlers'
import { validateAggregateParam, validateGroupByParam } from './field-permission-validation'
import { parseFilter } from './list-records-filter'
import { buildSearchFilter, readSearchTerm } from './list-records-search'
import { validatePaginationParams } from './pagination-validation'
import { parseListRecordsParams } from './param-parsers'
import { resolveGuardForTable, type RowLevelGuardContext } from './row-level-guard'
import {
  buildListFilter,
  mergeFilters,
  checkGetReadGate,
  checkListReadGate,
  EMPTY_LIST_RESPONSE,
  readRuleAdmits,
  NOT_FOUND_RESPONSE,
  type FilterStructure,
} from './row-level-read-helpers'
import { validateSortPermission } from './sort-validation'
import { validateTimezoneParam } from './timezone-validation'
import type { App, Table } from '@/domain/models/app'
import type {
  TableGateScope,
  hasReadPermission,
} from '@/domain/models/app/auth/permission-evaluator-service'
import type { Context } from 'hono'

/**
 * Check read permission for a table based on user role.
 * Returns 404 (S1 anti-enumeration) if permission denied, undefined otherwise.
 */
function checkReadPermission(
  table: Parameters<typeof hasReadPermission>[0],
  effectiveRoles: readonly string[],
  c: Context,
  allTables?: TableGateScope
) {
  if (!hasReadPermissionForRoles(table, effectiveRoles, allTables)) {
    return NOT_FOUND_RESPONSE(c)
  }
  return undefined
}

type ListRecordsValidationInput = {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly userGroups: readonly string[]
  readonly timezone: string | undefined
  readonly sort: string | undefined
  readonly aggregate: Parameters<typeof validateAggregateParam>[0]
  readonly groupBy: string | undefined
}

/**
 * Run list-records query parameter validations in order.
 * Returns the first error response, or undefined if all validations pass.
 *
 * The FILTER is deliberately absent from this list. It is checked by
 * `parseFilter`, while it is still the caller's own — by the time the merged
 * filter reaches here it also carries the saved view's clauses, the `?q=`
 * search group and the row-level read predicate, none of which are the
 * caller's to be judged on (see `validateFilterParam`).
 */
function validateListRecordsParams(input: ListRecordsValidationInput) {
  const access = {
    app: input.app,
    tableName: input.tableName,
    userRole: input.userRole,
    userGroups: input.userGroups,
    c: input.c,
  }

  return (
    validatePaginationParams(input.c) ??
    validateTimezoneParam(input.timezone, input.c) ??
    validateSortPermission({
      sort: input.sort,
      app: input.app,
      tableName: input.tableName,
      userRole: input.userRole,
      userGroups: input.userGroups,
      c: input.c,
    }) ??
    validateAggregateParam(input.aggregate, access) ??
    validateGroupByParam(input.groupBy, access)
  )
}

type ResolvedView = {
  readonly filter: FilterStructure
  readonly sort: string | undefined
}

type ResolveViewResult =
  | { readonly error: false; readonly view: ResolvedView | undefined }
  | { readonly error: true; readonly response: Response }

type ViewConfig = {
  readonly id: string | number
  readonly name: string
  readonly filters?: unknown
  readonly sorts?: readonly { readonly field: string; readonly direction: string }[]
  readonly permissions?: unknown
}

/**
 * A view's `filters` as the list's filter structure. Shared with the view
 * records route through `view-read-service`, so `?view=` and
 * `/views/:v/records` narrow to the same rows — an `or`-rooted view filter
 * included, which a hand-written normaliser here used to drop.
 */
function viewFilterStructure(rawFilters: unknown): FilterStructure {
  const conditions = viewFilterConditions(rawFilters)
  return conditions.length === 0 ? undefined : { and: conditions }
}

/**
 * Resolve a saved view (by id or name) from the table configuration.
 *
 * Returns:
 * - `{ error: false, view: undefined }` when no ?view= query param is present,
 *   or when the table has no views configured (view is silently ignored).
 * - `{ error: false, view: { filter, sort } }` when the view is found.
 * - `{ error: true, response }` with HTTP 404 when a view name is given but
 * not found in the table (spec [internal ref]), or names a view
 *   the caller may not open — answered exactly as a view that does not exist.
 *
 * A view is opened here as on its own records route: its grant when it
 * declares one, else its table's read (already passed by the time this runs).
 * Its conditions then narrow the rows whatever fields they name — a condition
 * on a field hidden from the caller still applies, as it does there.
 */
function resolveView(
  c: Context,
  input: Readonly<{ table: Table | undefined; caller: TableCaller }>
): ResolveViewResult {
  const { table, caller } = input
  const viewName = c.req.query('view')
  if (!viewName) return { error: false, view: undefined }

  const views = table?.views as readonly ViewConfig[] | undefined
  if (!views || views.length === 0) {
    return {
      error: true,
      response: notFound(c, `View '${viewName}' not found`),
    }
  }

  const foundView = findViewByKey(views, viewName)
  // The table's read gate has already admitted this caller.
  if (!foundView || !table || !viewGrantAdmits(foundView, caller, true)) {
    return {
      error: true,
      response: notFound(c, `View '${viewName}' not found`),
    }
  }

  return {
    error: false,
    view: {
      filter: viewFilterStructure(foundView.filters),
      sort: viewSortParam(foundView.sorts),
    },
  }
}

type ParsedRequestFilter =
  | { readonly ok: true; readonly value: FilterStructure }
  | { readonly ok: false; readonly response: Response }

/**
 * Parse filter from request and normalize error response to a single shape.
 */
function parseRequestFilter(
  c: Context,
  app: App,
  tableName: string,
  caller: Readonly<{ userRole: string; userGroups: readonly string[] }>
): ParsedRequestFilter {
  const filter = parseFilter(c, app, tableName, caller)
  if (!filter.error) return { ok: true, value: filter.value }
  const response =
    filter.response ??
    c.json(
      { success: false, message: 'Invalid filterByFormula syntax', code: 'VALIDATION_ERROR' },
      400
    )
  return { ok: false, response }
}

interface ListRequestPrep {
  readonly type: 'response'
  readonly response: Response
}

interface ListRequestReady {
  readonly type: 'ready'
  readonly finalFilter: FilterStructure
  readonly effectiveSort: string | undefined
  readonly params: ReturnType<typeof parseListRecordsParams>
}

interface PrepareListInput {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly userGroups: readonly string[]
  readonly table: Table | undefined
  readonly guard: RowLevelGuardContext | undefined
}

/**
 * Resolve the request-level inputs (view, filter, params) and merge them
 * with the row-level read predicate. Returns either a short-circuit
 * response (empty list / view-not-found / invalid filter) or the merged
 * inputs ready for query execution.
 */
function prepareListRequest(input: PrepareListInput): ListRequestPrep | ListRequestReady {
  const { c, app, tableName, userRole, userGroups, table, guard } = input
  const caller = {
    role: userRole,
    groups: userGroups,
    anonymous: isGuestSession(getTableContext(c).session?.userId),
    adminEquivalent: isAdminEquivalent(userRole, app),
  }
  const viewResult = resolveView(c, { table, caller })
  if (viewResult.error) return { type: 'response', response: viewResult.response }

  const filterResult = parseRequestFilter(c, app, tableName, { userRole, userGroups })
  if (!filterResult.ok) return { type: 'response', response: filterResult.response }

  const filterWithSearch = mergeFilters(
    filterResult.value,
    buildSearchFilter({ c, app, tableName, userRole, userGroups, table })
  )
  const finalFilter = buildListFilter(table, guard, viewResult.view?.filter, filterWithSearch)
  if (finalFilter === 'empty' || finalFilter === 'reject') {
    return { type: 'response', response: EMPTY_LIST_RESPONSE(c) }
  }

  const params = parseListRecordsParams(c)
  const effectiveSort = params.sort ?? viewResult.view?.sort
  return { type: 'ready', finalFilter, effectiveSort, params }
}

export async function handleListRecords(c: Context, app: App) {
  // deleted=true means "list only deleted records" (trash view with deletedBy included).
  if (c.req.query('deleted') === 'true') {
    return handleListTrash(c, app)
  }

  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, { userRole, userGroups }, table, app)

  const gateError = checkListReadGate({ c, app, table, userRole, userGroups, guard })
  if (gateError) return gateError

  const prepared = prepareListRequest({ c, app, tableName, userRole, userGroups, table, guard })
  if (prepared.type === 'response') return prepared.response

  const { finalFilter, effectiveSort, params } = prepared

  const validationError = validateListRecordsParams({
    c,
    app,
    tableName,
    userRole,
    userGroups,
    timezone: params.timezone,
    sort: effectiveSort,
    aggregate: params.aggregate,
    groupBy: params.groupBy,
  })
  if (validationError) return validationError

  // The route's own declaration that IT did the filtering, read by the grid by
  // KEY PRESENCE (`use-island-setup.ts` → `serverFiltered`). Composed here
  // rather than inside the program because the term is already folded into
  // `finalFilter` by the time the program runs — passing it again would be a
  // second, drift-prone copy of a fact the presentation layer owns. Attaching
  // it to the LIST program only is also what keeps the trash branch silent: the
  // omission is structural, not a conditional somebody can forget to keep.
  // eslint-disable-next-line unicorn/no-null -- the API envelope canonically distinguishes an explicit `null` ("no term applied") from an ABSENT key ("this branch does not search"); `undefined` erases that distinction on the wire, since JSON.stringify drops the key
  const appliedQuery = readSearchTerm(c) ?? null

  return runEffect(
    c,
    provideTableLive(
      createListRecordsProgram({
        session,
        tableName,
        app,
        userRole,
        userGroups,
        filter: finalFilter,
        ...params,
        sort: effectiveSort,
        origin: new URL(c.req.url).origin,
      })
    ).pipe(Effect.map((response) => ({ ...response, appliedQuery }))),
    listRecordsResponseSchema
  )
}

export async function handleListTrash(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)

  // Check table-level read permission (group-aware, most-permissive-wins)
  const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
  const permissionError = checkReadPermission(table, effectiveRoles, c, app)
  if (permissionError) return permissionError

  // ROW-LEVEL SCOPING. This handler never resolved the guard, so on a table
  // with `rowLevelPermissions.read.when` a scoped caller who could see only
  // their own live rows could see EVERY soft-deleted row — plus each row's
  // `deletedBy`. Its two siblings (`handleListRecords`, `handleGetRecord`) both
  // resolve it; the omission here was the whole of the gap. Deleting a record
  // does not widen who may read it.
  const guard = await resolveGuardForTable(session, { userRole, userGroups }, table, app)

  // Parse filter parameter
  const filter = parseFilter(c, app, tableName, { userRole, userGroups })
  if (filter.error) {
    return (
      filter.response ??
      c.json(
        { success: false, message: 'Invalid filterByFormula syntax', code: 'VALIDATION_ERROR' },
        400
      )
    )
  }

  const scopedFilter = buildListFilter(table, guard, undefined, filter.value)
  if (scopedFilter === 'empty' || scopedFilter === 'reject') {
    // Zero rows, WITHOUT the `appliedQuery` key the list branch carries: the
    // trash branch ignores `?q=` entirely, so announcing a search contract it
    // does not honour would mislead the grid.
    return c.json({ records: [], pagination: { total: 0, limit: 0, offset: 0 } }, 200)
  }

  // Parse query parameters (sort, limit, offset)
  const { sort, limit, offset } = parseListRecordsParams(c)

  // The trash branch answers through the SAME `listRecordsResponseSchema`, so
  // an out-of-range `?limit=`/`?offset=` fails response validation here too
  // and reaches the caller as a 500. Guarded in both branches, after their
  // respective read gates, for one contract on one envelope.
  const paginationError = validatePaginationParams(c)
  if (paginationError) return paginationError

  // Validate sort permission (the filter was checked by `parseFilter` above)
  const sortError = validateSortPermission({ sort, app, tableName, userRole, userGroups, c })
  if (sortError) return sortError

  return runEffect(
    c,
    provideTableLive(
      createListTrashProgram({
        session,
        tableName,
        app,
        userRole,
        userGroups,
        filter: scopedFilter,
        sort,
        limit,
        offset,
      })
    ),
    listRecordsResponseSchema
  )
}

const VALID_FORMAT_VALUES = new Set(['display'])

export async function handleGetRecord(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const recordId = c.req.param('recordId')!
  const includeDeleted = c.req.query('includeDeleted') === 'true'
  const formatParam = c.req.query('format')

  if (formatParam !== undefined && !VALID_FORMAT_VALUES.has(formatParam)) {
    return c.json(
      {
        success: false,
        message: `Invalid format parameter: '${formatParam}'. Valid values are: display`,
        code: 'VALIDATION_ERROR',
      },
      400
    )
  }

  // The requested wall clock. Read and validated HERE, alongside `format`,
  // rather than deeper in: the list sibling already rejects an unknown zone
  // with a 400 (`validateListRecordsParams`), and a route that silently ignored
  // one while its sibling refused it would make the same request mean two
  // things. `convertToTimezone` swallows an invalid zone and returns the
  // untouched instant, so without this the caller would get a 200 carrying the
  // wrong clock and nothing to explain it.
  const timezone = c.req.query('timezone')
  const timezoneError = validateTimezoneParam(timezone, c)
  if (timezoneError) return timezoneError

  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, { userRole, userGroups }, table, app)

  const gateError = checkGetReadGate({ c, app, table, userRole, userGroups, guard })
  if (gateError) return gateError

  try {
    return await runEffect(
      c,
      provideTableLive(
        createGetRecordProgram({
          session,
          tableName,
          app,
          userRole,
          recordId,
          includeDeleted,
          userGroups,
          format: formatParam === 'display' ? 'display' : undefined,
          timezone,
          origin: new URL(c.req.url).origin,
          admits: readRuleAdmits(guard, table),
        })
      ),
      getRecordResponseSchema
    )
  } catch (error) {
    return handleRouteError(c, error)
  }
}

// retrigger

// retrigger
