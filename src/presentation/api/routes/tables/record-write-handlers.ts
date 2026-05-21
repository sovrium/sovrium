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
  hasCreatePermissionForRoles,
  hasReadPermissionForRoles,
} from '@/application/use-cases/tables/permissions/permissions'
import {
  createRecordProgram,
  rawGetRecordProgram,
  updateRecordProgram,
} from '@/application/use-cases/tables/programs'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import {
  createRecordRequestSchema,
  updateRecordRequestSchema,
} from '@/domain/models/api/tables/records'
import { createRecordResponseSchema } from '@/domain/models/api/tables/tables'
import {
  provideTableWithNotificationsAndAutomationsLive,
  runTableProgram,
} from '@/infrastructure/layers/table-layer'
import { triggerTableWebhooks } from '@/infrastructure/webhooks/table-webhook-dispatch'
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
  checkFieldConditionReadOnly,
  validateUpdateForbiddenFields,
  validateUpdateReadonlyFields,
} from './record-update-guards'
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
import type {
  hasCreatePermission,
  hasReadPermission,
} from '@/application/use-cases/tables/permissions/permissions'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

function checkCreatePermission(
  table: Parameters<typeof hasCreatePermission>[0],
  effectiveRoles: readonly string[],
  c: Context,
  allTables?: App['tables']
) {
  if (!hasCreatePermissionForRoles(table, effectiveRoles, allTables)) {
    if (
      !hasReadPermissionForRoles(
        table as Parameters<typeof hasReadPermission>[0],
        effectiveRoles,
        allTables
      )
    ) {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }
    return forbiddenCreateResponse(c)
  }
  return undefined
}

interface CreateGateInput {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly userRole: string
  readonly userGroups: readonly string[]
  readonly guard: RowLevelGuardContext | undefined
}

function checkCreateGate(input: CreateGateInput): Response | undefined {
  const { c, app, table, userRole, userGroups, guard } = input
  if (!guard) {
    const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
    return checkCreatePermission(table, effectiveRoles, c, app.tables)
  }
  if (passesTableRoleGate(table?.permissions, 'create', guard.effectiveRoles)) return undefined
  if (!passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  return forbiddenCreateResponse(c)
}

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
    ),
    Effect.tap((record) =>
      Effect.promise(() =>
        triggerTableWebhooks({
          table: app.tables?.find((t) => t.name === tableName),
          event: 'create',
          record: {
            id: record.id,
            ...record.fields,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          },
        })
      )
    )
  )
}

export async function handleCreateRecord(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)

  const result = await validateRequest(c, createRecordRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, userRole, table)

  const gateError = checkCreateGate({ c, app, table, userRole, userGroups, guard })
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

async function checkUpdateGates(input: UpdateGateInput): Promise<Response | undefined> {
  const { c, table, session, tableName, recordId } = input
  const updateGateError = await checkUpdateGateAndPredicate(input)
  if (updateGateError) return updateGateError
  return checkFieldConditionReadOnly({ c, table, session, tableName, recordId })
}

export async function handleUpdateRecord(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const result = await validateRequest(c, updateRecordRequestSchema)
  if (!result.success) return result.response

  const readonlyValidation = validateUpdateReadonlyFields(result.data.fields, c)
  if (readonlyValidation) return readonlyValidation

  const table = app.tables?.find((t) => t.name === tableName)
  const recordId = c.req.param('recordId')!
  const guard = await resolveGuardForTable(session, userRole, table)

  const gateError = await checkUpdateGates({
    c,
    app,
    table,
    session,
    tableName,
    userRole,
    recordId,
    guard,
  })
  if (gateError) return gateError

  const { allowedData, forbiddenFields } = filterAllowedFieldsWithRole(
    app,
    tableName,
    userRole,
    result.data.fields
  )

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
    clientUpdatedAt: result.data.updatedAt,
    c,
  })
}
