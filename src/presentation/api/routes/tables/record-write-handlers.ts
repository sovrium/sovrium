/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { triggerRecordEventAutomations } from '@/application/use-cases/automations/trigger-record-event'
import { notifyRecordCreated } from '@/application/use-cases/notifications/notify-record-created'
import {
  hasCreatePermission,
  hasReadPermission,
} from '@/application/use-cases/tables/permissions/permissions'
import {
  createRecordProgram,
  rawGetRecordProgram,
  updateRecordProgram,
} from '@/application/use-cases/tables/programs'
import {
  createRecordRequestSchema,
  updateRecordRequestSchema,
} from '@/domain/models/api/tables/records'
import { createRecordResponseSchema } from '@/domain/models/api/tables/tables'
import {
  provideTableWithNotificationsAndAutomationsLive,
  runTableProgram,
} from '@/infrastructure/layers/table-layer'
import { runEffect, validateRequest } from '@/presentation/api/utils'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import {
  validateRecordCreation,
  createValidationLayer,
  formatValidationError,
} from '@/presentation/api/validation'
import { provideStorageLive } from '../buckets/effect-runner'
import { handleRouteError } from './error-handlers'
import {
  checkTableUpdatePermissionWithRole,
  filterAllowedFieldsWithRole,
  handleNoAllowedFields,
  executeUpdate,
} from './record-update-handler'
import { forbiddenCreateResponse, forbiddenCreateScopeResponse } from './response-helpers'
import {
  enforceFormMutationGate,
  passesTableRoleGate,
  recordPassesPredicate,
  resolveGuardForTable,
  type RowLevelGuardContext,
} from './row-level-guard'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Check create permission for table and user role
 * Returns error response if permission denied, undefined otherwise
 */
function checkCreatePermission(
  table: Parameters<typeof hasCreatePermission>[0],
  userRole: string,
  c: Context,
  allTables?: App['tables']
) {
  if (!hasCreatePermission(table, userRole, allTables)) {
    // Enumeration protection: users without read access get 404 (prevents resource discovery)
    if (!hasReadPermission(table as Parameters<typeof hasReadPermission>[0], userRole, allTables)) {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }
    return forbiddenCreateResponse(c)
  }
  return undefined
}

/**
 * Validate readonly fields for update request
 */
function validateUpdateReadonlyFields(fields: Record<string, unknown>, c: Context) {
  const READONLY_FIELDS = new Set(['id', 'created_at', 'updated_at'])
  const attemptedReadonlyFields = Object.keys(fields).filter((field) => READONLY_FIELDS.has(field))

  if (attemptedReadonlyFields.length > 0) {
    const firstReadonlyField = attemptedReadonlyFields[0]!
    return c.json(
      {
        success: false,
        message: `Cannot write to readonly field '${firstReadonlyField}'`,
        code: 'VALIDATION_ERROR',
      },
      400
    )
  }

  return undefined
}

/**
 * Validate forbidden fields for update request
 */
function validateUpdateForbiddenFields(
  forbiddenFields: readonly string[],
  c: Context
): Response | undefined {
  const SYSTEM_PROTECTED_FIELDS = new Set(['user_id'])
  const attemptedForbiddenFields = forbiddenFields.filter(
    (field) => !SYSTEM_PROTECTED_FIELDS.has(field)
  )

  if (attemptedForbiddenFields.length > 0) {
    const firstForbiddenField = attemptedForbiddenFields[0]!
    return c.json(
      {
        success: false,
        message: `Cannot write to field '${firstForbiddenField}': insufficient permissions`,
        code: 'FORBIDDEN',
        field: firstForbiddenField,
      },
      403
    )
  }

  return undefined
}

interface CreateGateInput {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly userRole: string
  readonly guard: RowLevelGuardContext | undefined
}

/**
 * Z-3 create role gate. Returns 404/403/undefined depending on permissions.
 */
function checkCreateGate(input: CreateGateInput): Response | undefined {
  const { c, app, table, userRole, guard } = input
  if (!guard) return checkCreatePermission(table, userRole, c, app.tables)
  if (passesTableRoleGate(table?.permissions, 'create', guard.effectiveRoles)) return undefined
  // Lack of read access collapses to 404 (enumeration safety).
  if (!passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  return forbiddenCreateResponse(c)
}

/**
 * Z-3 create.when predicate check. The user's proposed row must satisfy
 * the predicate; out-of-scope creates return 403.
 */
function checkCreatePredicate(
  c: Context,
  table: Table | undefined,
  guard: RowLevelGuardContext | undefined,
  fields: Readonly<Record<string, unknown>>
): Response | undefined {
  if (!guard || !table?.rowLevelPermissions) return undefined
  if (recordPassesPredicate(table.rowLevelPermissions, 'create', fields, guard.current)) {
    return undefined
  }
  return forbiddenCreateScopeResponse(c)
}

interface UpdateGateInput {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableName: string
  readonly userRole: string
  readonly recordId: string
  readonly guard: RowLevelGuardContext | undefined
}

/**
 * Z-3 update gate + write.when evaluation. With row-level scoping the
 * order is:
 *   1. role-gate using overlay roles (404 if no read, else 403)
 *   2. fetch existing row (404 on miss)
 *   3. evaluate `write.when` (404 on predicate miss — enumeration safety)
 *
 * Without scoping we fall back to the canonical update permission helper.
 */
/** Helper: enumeration-safe write role-gate. */
function checkWriteRoleGate(
  c: Context,
  table: Table | undefined,
  guard: RowLevelGuardContext
): Response | undefined {
  if (passesTableRoleGate(table?.permissions, 'write', guard.effectiveRoles)) return undefined
  if (!passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  return c.json(
    {
      success: false,
      message: 'You do not have permission to update records in this table',
      code: 'FORBIDDEN',
    },
    403
  )
}

interface WritePredicateInput {
  readonly c: Context
  readonly table: Table | undefined
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableName: string
  readonly recordId: string
  readonly guard: RowLevelGuardContext
}

/** Helper: evaluate write.when against an existing row. */
async function checkWritePredicate(input: WritePredicateInput): Promise<Response | undefined> {
  const { c, table, session, tableName, recordId, guard } = input
  if (!table?.rowLevelPermissions?.write?.when) return undefined
  const fetched = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
  if (fetched._tag === 'Left' || !fetched.right) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  return recordPassesPredicate(table.rowLevelPermissions, 'write', fetched.right, guard.current)
    ? undefined
    : c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
}

async function checkUpdateGateAndPredicate(input: UpdateGateInput): Promise<Response | undefined> {
  const { c, app, table, session, tableName, userRole, recordId, guard } = input

  if (!guard) {
    const permissionCheck = checkTableUpdatePermissionWithRole(app, tableName, userRole, c)
    return permissionCheck.allowed ? undefined : permissionCheck.response
  }

  return (
    checkWriteRoleGate(c, table, guard) ??
    (await checkWritePredicate({ c, table, session, tableName, recordId, guard }))
  )
}

/**
 * Build the create-record Effect program: create row, tap notification dispatch,
 * tap matching record-triggered automations. Tap errors are absorbed inside the
 * downstream use cases so an automation/notification failure cannot mask a
 * successful record-create. Sequential `Effect.tap` chains so callers observing
 * downstream state (inbox, automation_runs) do not see a race window.
 */
function buildCreateRecordProgram(input: {
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableName: string
  readonly fields: Record<string, unknown>
  readonly app: App
  readonly userRole: string
}) {
  const { session, tableName, fields, app, userRole } = input
  return createRecordProgram({ session, tableName, fields, app, userRole }).pipe(
    Effect.tap((record) =>
      notifyRecordCreated({
        app,
        creatorUserId: session.userId,
        tableName,
        recordId: String(record.id),
      })
    ),
    Effect.tap((record) =>
      triggerRecordEventAutomations({
        app,
        tableName,
        event: 'create',
        record: { id: record.id, ...record.fields },
        processEnv: process.env,
        userId: session.userId,
      })
    )
  )
}

export async function handleCreateRecord(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const result = await validateRequest(c, createRecordRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, userRole, table)

  const gateError = checkCreateGate({ c, app, table, userRole, guard })
  if (gateError) return gateError

  const validationLayer = createValidationLayer(app, tableName, userRole)
  const program = validateRecordCreation(result.data.fields).pipe(
    Effect.provide(validationLayer),
    provideStorageLive
  )
  const validationResult = await Effect.runPromise(program.pipe(Effect.either))

  if (validationResult._tag === 'Left') return formatValidationError(validationResult.left, c)

  const predicateError = checkCreatePredicate(c, table, guard, validationResult.right)
  if (predicateError) return predicateError

  return await runEffect(
    c,
    provideTableWithNotificationsAndAutomationsLive(
      buildCreateRecordProgram({
        session,
        tableName,
        fields: validationResult.right,
        app,
        userRole,
      })
    ),
    createRecordResponseSchema,
    201
  )
}

/**
 * Handle form-based UPDATE (POST) with redirect
 *
 * Used for update forms rendered as <form method="POST">.
 * Performs the record update and redirects to the _redirect path from form body
 * (or back to the Referer URL if no redirect is specified).
 *
 * This synchronous-navigation approach ensures the database write completes
 * before the browser proceeds, eliminating race conditions in E2E tests and
 * providing reliable behavior for users on slow connections.
 */
/**
 * Z-3 form-update auth gate: row-level scoping when declared, canonical
 * role-only check otherwise. Extracted so handleFormUpdateRecord stays
 * under the 50-line/function limit.
 */
async function resolveFormUpdateAuth(input: {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly recordId: string
}): Promise<Response | undefined> {
  const { c, app, tableName, userRole, session, recordId } = input
  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, userRole, table)

  if (guard) {
    return enforceFormMutationGate({
      c,
      table,
      session,
      tableName,
      recordId,
      guard,
      op: 'write',
    })
  }
  const permissionCheck = checkTableUpdatePermissionWithRole(app, tableName, userRole, c)
  return permissionCheck.allowed ? undefined : permissionCheck.response
}

export async function handleFormUpdateRecord(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const body = await c.req.parseBody()
  const redirectPath = typeof body['_redirect'] === 'string' ? body['_redirect'] : undefined

  // Extract field values from form body (exclude internal fields)
  const INTERNAL_FIELDS = new Set(['_redirect'])
  const fields = Object.fromEntries(
    Object.entries(body).filter(([key]) => !INTERNAL_FIELDS.has(key))
  )

  const readonlyValidation = validateUpdateReadonlyFields(fields, c)
  if (readonlyValidation) return readonlyValidation

  const recordId = c.req.param('recordId')!
  const authError = await resolveFormUpdateAuth({ c, app, tableName, userRole, session, recordId })
  if (authError) return authError

  const { allowedData, forbiddenFields } = filterAllowedFieldsWithRole(
    app,
    tableName,
    userRole,
    fields
  )

  if (Object.keys(allowedData).length === 0) {
    return handleNoAllowedFields({ session, tableName, recordId, forbiddenFields, c })
  }

  return executeFormUpdate({
    session,
    tableName,
    recordId,
    allowedData,
    app,
    userRole,
    redirectPath,
    referer: c.req.header('referer'),
    c,
  })
}

/**
 * Execute update via form submission and redirect
 */
async function executeFormUpdate(config: {
  readonly session: Parameters<typeof updateRecordProgram>[0]
  readonly tableName: string
  readonly recordId: string
  readonly allowedData: Record<string, unknown>
  readonly app: App
  readonly userRole: string
  readonly redirectPath: string | undefined
  readonly referer: string | undefined
  readonly c: Context
}): Promise<Response> {
  const { session, tableName, recordId, allowedData, app, userRole, redirectPath, referer, c } =
    config
  try {
    const result = await runTableProgram(
      updateRecordProgram(session, tableName, recordId, { fields: allowedData, app, userRole })
    )

    if (result._tag === 'Left' || !result.right || Object.keys(result.right).length === 0) {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }

    // Redirect to specified path, referer, or respond with JSON
    if (redirectPath && redirectPath.startsWith('/')) {
      return c.redirect(redirectPath, 302)
    }
    if (referer) {
      return c.redirect(referer, 302)
    }
    return c.json(result.right, 200)
  } catch (error) {
    return handleRouteError(c, error)
  }
}

export async function handleUpdateRecord(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const result = await validateRequest(c, updateRecordRequestSchema)
  if (!result.success) return result.response

  // Check for readonly fields BEFORE permission checks
  const readonlyValidation = validateUpdateReadonlyFields(result.data.fields, c)
  if (readonlyValidation) return readonlyValidation

  const table = app.tables?.find((t) => t.name === tableName)
  const recordId = c.req.param('recordId')!
  const guard = await resolveGuardForTable(session, userRole, table)

  const updateGateError = await checkUpdateGateAndPredicate({
    c,
    app,
    table,
    session,
    tableName,
    userRole,
    recordId,
    guard,
  })
  if (updateGateError) return updateGateError

  // Extract fields from nested format
  const { allowedData, forbiddenFields } = filterAllowedFieldsWithRole(
    app,
    tableName,
    userRole,
    result.data.fields
  )

  // Validate forbidden fields
  const forbiddenValidation = validateUpdateForbiddenFields(forbiddenFields, c)
  if (forbiddenValidation) return forbiddenValidation

  if (Object.keys(allowedData).length === 0) {
    return handleNoAllowedFields({
      session,
      tableName,
      recordId,
      forbiddenFields,
      c,
    })
  }

  return executeUpdate({
    session,
    tableName,
    recordId,
    allowedData,
    app,
    userRole,
    c,
  })
}
