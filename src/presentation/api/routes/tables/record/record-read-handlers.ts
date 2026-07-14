/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hasReadPermissionForRoles } from '@/application/use-cases/tables/permissions/permissions'
import {
  createListRecordsProgram,
  createListTrashProgram,
  createGetRecordProgram,
} from '@/application/use-cases/tables/programs'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import {
  listRecordsResponseSchema,
  getRecordResponseSchema,
} from '@/domain/models/api/tables/tables'
import { provideTableLive } from '@/infrastructure/layers/table-layer'
import { runEffect } from '@/presentation/api/utils'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { handleRouteError } from '../error-handlers'
import { parseListRecordsParams } from '../parsers/param-parsers'
import {
  validateFilterParam,
  validateAggregateParam,
  validateFieldsParam,
  validateGroupByParam,
} from '../validation/field-permission-validation'
import { validateSortPermission } from '../validation/sort-validation'
import { validateTimezoneParam } from '../validation/timezone-validation'
import { parseFilter } from './list-records-filter'
import { resolveGuardForTable, type RowLevelGuardContext } from './row-level-guard'
import {
  buildListFilter,
  checkGetReadGate,
  checkListReadGate,
  EMPTY_LIST_RESPONSE,
  enforceGetReadPredicate,
  NOT_FOUND_RESPONSE,
  type FilterStructure,
} from './row-level-read-helpers'
import type { hasReadPermission } from '@/application/use-cases/tables/permissions/permissions'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

function checkReadPermission(
  table: Parameters<typeof hasReadPermission>[0],
  effectiveRoles: readonly string[],
  c: Context,
  allTables?: App['tables']
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
  readonly table:
    { readonly fields: readonly { readonly name: string; readonly type: string }[] } | undefined
  readonly timezone: string | undefined
  readonly sort: string | undefined
  readonly filter: Parameters<typeof validateFilterParam>[0]
  readonly aggregate: Parameters<typeof validateAggregateParam>[0]
  readonly fields: string | undefined
  readonly groupBy: string | undefined
}

function validateListRecordsParams(input: ListRecordsValidationInput) {
  return (
    validateTimezoneParam(input.timezone, input.c) ??
    validateSortPermission({
      sort: input.sort,
      app: input.app,
      tableName: input.tableName,
      userRole: input.userRole,
      c: input.c,
    }) ??
    validateFilterParam(input.filter, input.table, input.userRole, input.c) ??
    validateAggregateParam(input.aggregate, input.table, input.userRole, input.c) ??
    validateGroupByParam(input.groupBy, input.table, input.userRole, input.c) ??
    validateFieldsParam(input.fields, input.table, input.c)
  )
}

type ResolvedView = {
  readonly filter: FilterStructure
  readonly sort: string | undefined
}

type ResolveViewResult =
  | { readonly error: false; readonly view: ResolvedView | undefined }
  | { readonly error: true; readonly response: Response }

type ViewSort = { readonly field: string; readonly direction: string }
type ViewCondition = { readonly field: string; readonly operator: string; readonly value: unknown }
type ViewConfig = {
  readonly id: string | number
  readonly name: string
  readonly filters?: unknown
  readonly sorts?: readonly ViewSort[]
  readonly query?: string
}

function normalizeViewFilter(rawFilters: unknown): FilterStructure {
  if (!rawFilters) return undefined
  const f = rawFilters as {
    readonly and?: readonly ViewCondition[]
    readonly or?: unknown
    readonly field?: string
    readonly operator?: string
    readonly value?: unknown
  }
  if ('and' in f && f.and) return { and: f.and }
  if (!('and' in f) && !('or' in f) && f.field && f.operator) {
    return { and: [{ field: f.field, operator: f.operator, value: f.value }] }
  }
  return undefined
}

function normalizeViewSort(sorts: readonly ViewSort[] | undefined): string | undefined {
  if (!sorts || sorts.length === 0) return undefined
  return sorts.map((s) => `${s.field}:${s.direction}`).join(',')
}

function resolveView(
  c: Context,
  table: { readonly views?: unknown } | undefined
): ResolveViewResult {
  const viewName = c.req.query('view')
  if (!viewName) return { error: false, view: undefined }

  const views = table?.views as readonly ViewConfig[] | undefined
  if (!views || views.length === 0) {
    return {
      error: true,
      response: c.json(
        { success: false, message: `View '${viewName}' not found`, code: 'NOT_FOUND' },
        404
      ),
    }
  }

  const foundView = views.find((v) => String(v.id) === viewName || v.name === viewName)
  if (!foundView) {
    return {
      error: true,
      response: c.json(
        { success: false, message: `View '${viewName}' not found`, code: 'NOT_FOUND' },
        404
      ),
    }
  }

  return {
    error: false,
    view: {
      filter: normalizeViewFilter(foundView.filters),
      sort: normalizeViewSort(foundView.sorts),
    },
  }
}

type ParsedRequestFilter =
  | { readonly ok: true; readonly value: FilterStructure }
  | { readonly ok: false; readonly response: Response }

function parseRequestFilter(
  c: Context,
  app: App,
  tableName: string,
  userRole: string
): ParsedRequestFilter {
  const filter = parseFilter(c, app, tableName, userRole)
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
  readonly table: Table | undefined
  readonly guard: RowLevelGuardContext | undefined
}

function prepareListRequest(input: PrepareListInput): ListRequestPrep | ListRequestReady {
  const { c, app, tableName, userRole, table, guard } = input
  const viewResult = resolveView(c, table)
  if (viewResult.error) return { type: 'response', response: viewResult.response }

  const filterResult = parseRequestFilter(c, app, tableName, userRole)
  if (!filterResult.ok) return { type: 'response', response: filterResult.response }

  const finalFilter = buildListFilter(table, guard, viewResult.view?.filter, filterResult.value)
  if (finalFilter === 'empty' || finalFilter === 'reject') {
    return { type: 'response', response: EMPTY_LIST_RESPONSE(c) }
  }

  const params = parseListRecordsParams(c)
  const effectiveSort = params.sort ?? viewResult.view?.sort
  return { type: 'ready', finalFilter, effectiveSort, params }
}

export async function handleListRecords(c: Context, app: App) {
  if (c.req.query('deleted') === 'true') {
    return handleListTrash(c, app)
  }

  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, userRole, table, app)

  const gateError = checkListReadGate({ c, app, table, userRole, userGroups, guard })
  if (gateError) return gateError

  const prepared = prepareListRequest({ c, app, tableName, userRole, table, guard })
  if (prepared.type === 'response') return prepared.response

  const { finalFilter, effectiveSort, params } = prepared

  const validationError = validateListRecordsParams({
    c,
    app,
    tableName,
    userRole,
    table,
    timezone: params.timezone,
    sort: effectiveSort,
    filter: finalFilter,
    aggregate: params.aggregate,
    fields: params.fields,
    groupBy: params.groupBy,
  })
  if (validationError) return validationError

  return runEffect(
    c,
    provideTableLive(
      createListRecordsProgram({
        session,
        tableName,
        app,
        userRole,
        filter: finalFilter,
        ...params,
        sort: effectiveSort,
        origin: new URL(c.req.url).origin,
      })
    ),
    listRecordsResponseSchema
  )
}

export async function handleListTrash(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)

  const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
  const permissionError = checkReadPermission(table, effectiveRoles, c, app.tables)
  if (permissionError) return permissionError

  const filter = parseFilter(c, app, tableName, userRole)
  if (filter.error) {
    return (
      filter.response ??
      c.json(
        { success: false, message: 'Invalid filterByFormula syntax', code: 'VALIDATION_ERROR' },
        400
      )
    )
  }

  const { sort, limit, offset } = parseListRecordsParams(c)

  const sortError = validateSortPermission({ sort, app, tableName, userRole, c })
  if (sortError) return sortError

  const filterError = validateFilterParam(filter.value, table, userRole, c)
  if (filterError) return filterError

  return runEffect(
    c,
    provideTableLive(
      createListTrashProgram({
        session,
        tableName,
        app,
        userRole,
        filter: filter.value,
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

  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, userRole, table, app)

  const gateError = checkGetReadGate({ c, app, table, userRole, userGroups, guard })
  if (gateError) return gateError

  try {
    const response = await runEffect(
      c,
      provideTableLive(
        createGetRecordProgram({
          session,
          tableName,
          app,
          userRole,
          recordId,
          includeDeleted,
          format: formatParam === 'display' ? 'display' : undefined,
          origin: new URL(c.req.url).origin,
        })
      ),
      getRecordResponseSchema
    )
    return await enforceGetReadPredicate(c, response, guard, table)
  } catch (error) {
    return handleRouteError(c, error)
  }
}


