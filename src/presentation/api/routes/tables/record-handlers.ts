/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  hasCreatePermission,
  hasDeletePermission,
  hasReadPermission,
} from '@/application/use-cases/tables/permissions/permissions'
import {
  createListRecordsProgram,
  createListTrashProgram,
  createGetRecordProgram,
  createRecordProgram,
  restoreRecordProgram,
  deleteRecordProgram,
  permanentlyDeleteRecordProgram,
} from '@/application/use-cases/tables/programs'
import {
  createRecordRequestSchema,
  updateRecordRequestSchema,
} from '@/presentation/api/schemas/request-schemas'
import {
  listRecordsResponseSchema,
  getRecordResponseSchema,
  createRecordResponseSchema,
} from '@/presentation/api/schemas/tables-schemas'
import { runEffect, validateRequest } from '@/presentation/api/utils'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import {
  validateRecordCreation,
  createValidationLayer,
  formatValidationError,
} from '@/presentation/api/validation'
import { handleGetRecordError, handleRestoreRecordError } from './error-handlers'
import { parseFilterParameter } from './filter-parser'
import { parseFormulaToFilter } from './formula-parser'
import {
  checkTableUpdatePermissionWithRole,
  filterAllowedFieldsWithRole,
  handleNoAllowedFields,
  executeUpdate,
} from './record-update-handler'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** Session type derived from table context to respect layer boundaries */
type SessionContext = ReturnType<typeof getTableContext>['session']

/**
 * Validate timezone string using Intl.DateTimeFormat
 * Returns true if timezone is valid, false otherwise
 */
function isValidTimezone(timezone: string): boolean {
  try {
    // Attempt to create a DateTimeFormat with the timezone
    // This will throw if the timezone is invalid
    // eslint-disable-next-line functional/no-expression-statements -- Required for validation side-effect
    Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

type AggregateParams = {
  readonly count?: boolean
  readonly sum?: readonly string[]
  readonly avg?: readonly string[]
  readonly min?: readonly string[]
  readonly max?: readonly string[]
}

/**
 * Parse aggregate JSON parameter
 */
function parseAggregateParam(aggregateParam: string | undefined): AggregateParams | undefined {
  if (!aggregateParam) return undefined

  try {
    return JSON.parse(aggregateParam) as AggregateParams
  } catch {
    // Invalid JSON, ignore aggregation
    return undefined
  }
}

/**
 * Parse list records query parameters
 */
function parseListRecordsParams(c: Context): {
  readonly includeDeleted: boolean
  readonly format: 'display' | undefined
  readonly timezone: string | undefined
  readonly sort: string | undefined
  readonly fields: string | undefined
  readonly limit: number | undefined
  readonly offset: number | undefined
  readonly aggregate: AggregateParams | undefined
} {
  const includeDeleted = c.req.query('includeDeleted') === 'true'
  const format = c.req.query('format') === 'display' ? ('display' as const) : undefined
  const timezone = c.req.query('timezone')
  const sort = c.req.query('sort')
  const fields = c.req.query('fields')
  const limitParam = c.req.query('limit')
  const offsetParam = c.req.query('offset')
  const limit = limitParam ? Number(limitParam) : undefined
  const offset = offsetParam ? Number(offsetParam) : undefined
  const aggregate = parseAggregateParam(c.req.query('aggregate'))

  return { includeDeleted, format, timezone, sort, fields, limit, offset, aggregate }
}

type FilterStructure =
  | {
      readonly and?: readonly {
        readonly field: string
        readonly operator: string
        readonly value: unknown
      }[]
    }
  | undefined

type FilterResult =
  | { readonly error: false; readonly value: FilterStructure }
  | { readonly error: true; readonly response?: Response }

/**
 * Parse filter parameter from request (formula or standard filter)
 */
function parseFilter(c: Context, app: App, tableName: string, userRole: string): FilterResult {
  const filterByFormula = c.req.query('filterByFormula')

  if (filterByFormula) {
    const parsedFormula = parseFormulaToFilter(filterByFormula)
    return parsedFormula ? { error: false, value: parsedFormula } : { error: true }
  }

  const parsedFilterResult = parseFilterParameter({
    filterParam: c.req.query('filter'),
    app,
    tableName,
    userRole,
    c,
  })

  return parsedFilterResult.success
    ? { error: false, value: parsedFilterResult.filter }
    : { error: true, response: parsedFilterResult.error }
}

export async function handleListRecords(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain:
  // requireAuth() → validateTable() → enrichUserRole()
  const { session, tableName, userRole } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  if (!hasReadPermission(table, userRole)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to perform this action',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  const filter = parseFilter(c, app, tableName, userRole)

  if (filter.error) {
    return (
      filter.response ??
      c.json(
        {
          success: false,
          message: 'Invalid filterByFormula syntax',
          code: 'VALIDATION_ERROR',
        },
        400
      )
    )
  }

  const { includeDeleted, format, timezone, sort, fields, limit, offset, aggregate } =
    parseListRecordsParams(c)

  // Validate timezone if provided
  if (timezone && !isValidTimezone(timezone)) {
    return c.json(
      {
        success: false,
        message: `Invalid timezone: ${timezone}`,
        code: 'VALIDATION_ERROR',
      },
      400
    )
  }

  return runEffect(
    c,
    createListRecordsProgram({
      session,
      tableName,
      app,
      userRole,
      filter: filter.value,
      includeDeleted,
      format,
      timezone,
      sort,
      fields,
      limit,
      offset,
      aggregate,
    }),
    listRecordsResponseSchema
  )
}

export async function handleListTrash(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  return runEffect(
    c,
    createListTrashProgram({ session, tableName, app, userRole }),
    listRecordsResponseSchema
  )
}

/**
 * Check create permission for table and user role
 * Returns error response if permission denied, undefined otherwise
 */
function checkCreatePermission(
  table: Parameters<typeof hasCreatePermission>[0],
  userRole: string,
  c: Context
) {
  if (!hasCreatePermission(table, userRole)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to create records in this table',
        code: 'FORBIDDEN',
      },
      403
    )
  }
  return undefined
}

export async function handleCreateRecord(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  const result = await validateRequest(c, createRecordRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)

  // Check table-level create permission
  const permissionError = checkCreatePermission(table, userRole, c)
  if (permissionError) return permissionError

  // Validate fields using Effect-based validation
  const validationLayer = createValidationLayer(app, tableName, userRole)
  const program = validateRecordCreation(result.data.fields).pipe(Effect.provide(validationLayer))

  const validationResult = await Effect.runPromise(program.pipe(Effect.either))

  if (validationResult._tag === 'Left') {
    return formatValidationError(validationResult.left, c)
  }

  return await runEffect(
    c,
    createRecordProgram({ session, tableName, fields: validationResult.right, app, userRole }),
    createRecordResponseSchema,
    201
  )
}

export async function handleGetRecord(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)
  const recordId = c.req.param('recordId')
  const includeDeleted = c.req.query('includeDeleted') === 'true'

  const table = app.tables?.find((t) => t.name === tableName)
  if (!hasReadPermission(table, userRole)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to perform this action',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  try {
    return await runEffect(
      c,
      createGetRecordProgram({ session, tableName, app, userRole, recordId, includeDeleted }),
      getRecordResponseSchema
    )
  } catch (error) {
    return handleGetRecordError(c, error)
  }
}

export async function handleUpdateRecord(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  const result = await validateRequest(c, updateRecordRequestSchema)
  if (!result.success) return result.response

  const permissionCheck = checkTableUpdatePermissionWithRole(app, tableName, userRole, c)
  if (!permissionCheck.allowed) {
    return permissionCheck.response
  }

  const { allowedData, forbiddenFields } = filterAllowedFieldsWithRole(
    app,
    tableName,
    userRole,
    result.data
  )

  if (Object.keys(allowedData).length === 0) {
    return handleNoAllowedFields({
      session,
      tableName,
      recordId: c.req.param('recordId'),
      forbiddenFields,
      c,
    })
  }

  return executeUpdate({
    session,
    tableName,
    recordId: c.req.param('recordId'),
    allowedData,
    c,
  })
}

/**
 * Execute permanent delete and return response
 */
async function executePermanentDelete(
  session: SessionContext,
  tableName: string,
  recordId: string,
  c: Context
) {
  const deleteResult = await Effect.runPromise(
    permanentlyDeleteRecordProgram(session, tableName, recordId)
  )

  if (!deleteResult) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  // eslint-disable-next-line unicorn/no-null -- Hono's c.body() requires null for 204 No Content
  return c.body(null, 204)
}

/**
 * Execute soft delete and return response
 */
async function executeSoftDelete({
  session,
  tableName,
  recordId,
  app,
  c,
}: {
  readonly session: SessionContext
  readonly tableName: string
  readonly recordId: string
  readonly app: App
  readonly c: Context
}) {
  const deleteResult = await Effect.runPromise(
    deleteRecordProgram(session, tableName, recordId, app)
  )

  if (!deleteResult) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  // eslint-disable-next-line unicorn/no-null -- Hono's c.body() requires null for 204 No Content
  return c.body(null, 204)
}

export async function handleDeleteRecord(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  if (!hasDeletePermission(table, userRole)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to delete records in this table',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  const recordId = c.req.param('recordId')
  const permanent = c.req.query('permanent') === 'true'

  // Permanent delete requires admin or owner role
  if (permanent) {
    if (userRole !== 'admin' && userRole !== 'owner') {
      return c.json(
        {
          success: false,
          message: 'Only admins and owners can permanently delete records',
          code: 'FORBIDDEN',
        },
        403
      )
    }

    return executePermanentDelete(session, tableName, recordId, c)
  }

  // Regular soft delete
  return executeSoftDelete({ session, tableName, recordId, app, c })
}

export async function handleRestoreRecord(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  if (!hasCreatePermission(table, userRole)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to restore records in this table',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  const recordId = c.req.param('recordId')

  try {
    const restoreResult = await Effect.runPromise(
      restoreRecordProgram(session, tableName, recordId)
    )

    if (!restoreResult.success) {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }

    return c.json(restoreResult, 200)
  } catch (error) {
    return handleRestoreRecordError(c, error)
  }
}
