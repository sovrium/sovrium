/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { triggerRecordEventAutomations } from '@/application/use-cases/automations/trigger-record-event'
import { hasUpdatePermission } from '@/application/use-cases/tables/permissions/permissions'
import { updateRecordProgram, rawGetRecordProgram } from '@/application/use-cases/tables/programs'
import { transformRecord } from '@/application/use-cases/tables/utils/record-transformer'
import {
  provideTableWithNotificationsAndAutomationsLive,
  runTableProgram,
} from '@/infrastructure/layers/table-layer'
import { publishRecordChange } from '@/infrastructure/realtime/record-change-publisher'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'
import { triggerTableWebhooks } from '@/infrastructure/webhooks/table-webhook-dispatch'
import { validateFieldWritePermissions } from '@/presentation/api/utils/field-permission-validator'
import { handleRouteError } from './error-handlers'
import { isStaleWrite } from './record-conflict-check'
import { isAuthorizationError, type Session } from './utils'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

const SYSTEM_PROTECTED_FIELDS = new Set(['user_id'])

function maybeApplyPublishedAtAutoSet(
  app: App,
  tableName: string,
  oldRecord: Record<string, unknown> | undefined,
  fields: Record<string, unknown>
): Record<string, unknown> {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table?.fields) return fields
  const hasStatus = table.fields.some((f) => f.name === 'status' && f.type === 'single-select')
  const hasPublishedAt = table.fields.some(
    (f) => f.name === 'published_at' && f.type === 'datetime'
  )
  if (!hasStatus || !hasPublishedAt) return fields
  if (fields['status'] !== 'published') return fields
  if ('published_at' in fields) return fields
  if (oldRecord?.['status'] === 'published') return fields
  return { ...fields, published_at: new Date().toISOString() }
}

function collectReplacedAttachmentKeys(
  oldRecord: Record<string, unknown>,
  updateData: Record<string, unknown>,
  app: App,
  tableName: string
): readonly string[] {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table?.fields) return []
  return table.fields
    .filter((f) => f.type === 'single-attachment' && f.name in updateData)
    .filter((f) => {
      const oldValue = oldRecord[f.name]
      return typeof oldValue === 'string' && oldValue.length > 0 && oldValue !== updateData[f.name]
    })
    .map((f) => oldRecord[f.name] as string)
}

async function deleteStorageFiles(keys: readonly string[]): Promise<void> {
  return Promise.all(
    keys.map((key) => {
      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage['delete'](key)
      })
      return Effect.runPromise(Effect.either(Effect.provide(program, StorageServiceLive)))
    })
  ).then(() => undefined)
}

export function checkTableUpdatePermissionWithRole(
  app: App,
  tableName: string,
  userRole: string,
  c: Context
): { allowed: true } | { allowed: false; response: Response } {
  const table = app.tables?.find((t) => t.name === tableName)

  if (!hasUpdatePermission(table, userRole, app.tables)) {
    return {
      allowed: false,
      response: c.json(
        {
          success: false,
          message: 'Resource not found',
          code: 'NOT_FOUND',
        },
        404
      ),
    }
  }

  return { allowed: true }
}

export function filterAllowedFieldsWithRole(
  app: App,
  tableName: string,
  userRole: string,
  data: Record<string, unknown>
): {
  allowedData: Record<string, unknown>
  forbiddenFields: readonly string[]
} {
  const forbiddenFields = validateFieldWritePermissions(app, tableName, userRole, data)

  const allowedData = Object.fromEntries(
    Object.entries(data).filter(
      ([fieldName]) =>
        !forbiddenFields.includes(fieldName) && !SYSTEM_PROTECTED_FIELDS.has(fieldName)
    )
  )

  return { allowedData, forbiddenFields }
}

export async function handleNoAllowedFields(config: {
  session: Session
  tableName: string
  recordId: string
  forbiddenFields: readonly string[]
  c: Context
}): Promise<Response> {
  const { session, tableName, recordId, forbiddenFields, c } = config
  const attemptedForbiddenFields = forbiddenFields.filter(
    (field) => !SYSTEM_PROTECTED_FIELDS.has(field)
  )

  if (attemptedForbiddenFields.length > 0) {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  try {
    const result = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
    if (result._tag === 'Left') {
      return handleRouteError(c, result.left)
    }
    const record = result.right

    if (!record) {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }

    return c.json({ record: transformRecord(record) }, 200)
  } catch (error) {
    return handleRouteError(c, error)
  }
}

function hasUpdateRecordTrigger(app: App, tableName: string): boolean {
  return (app.automations ?? []).some((automation) => {
    if (automation.enabled === false) return false
    const { trigger } = automation
    if (trigger.type !== 'record') return false
    if (trigger.table !== tableName) return false
    return trigger.events.includes('update')
  })
}

async function executeUpdateNoTrigger(config: {
  readonly session: Session
  readonly tableName: string
  readonly recordId: string
  readonly oldRecord: Record<string, unknown> | undefined
  readonly dataWithPublishedAt: Record<string, unknown>
  readonly app: App
  readonly userRole: string
  readonly c: Context
}): Promise<Response> {
  const { session, tableName, recordId, oldRecord, dataWithPublishedAt, app, userRole, c } = config
  const result = await runTableProgram(
    updateRecordProgram(session, tableName, recordId, {
      fields: dataWithPublishedAt,
      app,
      userRole,
    })
  )
  if (result._tag === 'Left') {
    return handleUpdateError({ session, tableName, recordId, error: result.left, c })
  }
  const updateResult = result.right
  if (!updateResult || Object.keys(updateResult).length === 0) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  await fireUpdateWebhooks(app, tableName, updateResult, oldRecord)
  publishUpdateChange({ appId: app.name, tableName, recordId, updateResult, oldRecord })
  if (oldRecord) {
    const replacedKeys = collectReplacedAttachmentKeys(
      oldRecord,
      dataWithPublishedAt,
      app,
      tableName
    )
    return deleteStorageFiles(replacedKeys).then(() => c.json(updateResult, 200))
  }
  return c.json(updateResult, 200)
}

function staleWriteConflictResponse(c: Context): Response {
  return c.json(
    {
      success: false,
      message:
        'The record was modified after you last read it. Reload the latest version and retry.',
      code: 'CONFLICT',
    },
    409
  )
}

export async function executeUpdate(config: {
  session: Session
  tableName: string
  recordId: string
  allowedData: Record<string, unknown>
  app: App
  userRole: string
  clientUpdatedAt?: string
  c: Context
}): Promise<Response> {
  const { session, tableName, recordId, allowedData, app, userRole, clientUpdatedAt, c } = config

  const rawResult = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
  const oldRecord = rawResult._tag === 'Right' && rawResult.right ? rawResult.right : undefined

  if (isStaleWrite({ clientUpdatedAt, storedRecord: oldRecord })) {
    return staleWriteConflictResponse(c)
  }

  const dataWithPublishedAt = maybeApplyPublishedAtAutoSet(app, tableName, oldRecord, allowedData)

  try {
    if (!hasUpdateRecordTrigger(app, tableName)) {
      return await executeUpdateNoTrigger({
        session,
        tableName,
        recordId,
        oldRecord,
        dataWithPublishedAt,
        app,
        userRole,
        c,
      })
    }

    return await executeUpdateWithRecordTrigger({
      session,
      tableName,
      recordId,
      allowedData: dataWithPublishedAt,
      app,
      userRole,
      c,
    })
  } catch (error) {
    return handleRouteError(c, error)
  }
}

async function executeUpdateWithRecordTrigger(config: {
  session: Session
  tableName: string
  recordId: string
  allowedData: Record<string, unknown>
  app: App
  userRole: string
  c: Context
}): Promise<Response> {
  const { session, tableName, recordId, allowedData, app, userRole, c } = config
  const program = Effect.gen(function* () {
    const previous = yield* rawGetRecordProgram(session, tableName, recordId)
    const updated = yield* updateRecordProgram(session, tableName, recordId, {
      fields: allowedData,
      app,
      userRole,
    })
    return { previous, updated }
  }).pipe(
    Effect.tap(({ updated, previous }) =>
      triggerRecordEventAutomations({
        app,
        tableName,
        event: 'update',
        record: extractRecordFields(updated),
        previousRecord: previous ?? undefined,
        processEnv: process.env,
        userId: session.userId,
      })
    )
  )

  const result = await Effect.runPromise(
    Effect.either(provideTableWithNotificationsAndAutomationsLive(program))
  )

  if (result._tag === 'Left') {
    return handleUpdateError({ session, tableName, recordId, error: result.left, c })
  }

  const updateResult = result.right.updated
  if (!updateResult || Object.keys(updateResult).length === 0) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  const oldRecord = result.right.previous ?? undefined
  await fireUpdateWebhooks(app, tableName, updateResult, oldRecord)
  publishUpdateChange({ appId: app.name, tableName, recordId, updateResult, oldRecord })
  return c.json(updateResult, 200)
}

function extractRecordFields(updateResult: Record<string, unknown>): Record<string, unknown> {
  const nested = updateResult['fields']
  if (nested !== null && typeof nested === 'object') {
    return { id: updateResult['id'], ...(nested as Record<string, unknown>) }
  }
  return updateResult
}

function extractRecordForWebhook(updateResult: Record<string, unknown>): Record<string, unknown> {
  return {
    ...extractRecordFields(updateResult),
    ...(updateResult['createdAt'] !== undefined ? { createdAt: updateResult['createdAt'] } : {}),
    ...(updateResult['updatedAt'] !== undefined ? { updatedAt: updateResult['updatedAt'] } : {}),
  }
}

async function fireUpdateWebhooks(
  app: App,
  tableName: string,
  updateResult: Record<string, unknown>,
  previousRecord?: Record<string, unknown> | undefined
): Promise<void> {
  return triggerTableWebhooks({
    table: app.tables?.find((t) => t.name === tableName),
    event: 'update',
    record: extractRecordForWebhook(updateResult),
    previousRecord,
  })
}

function publishUpdateChange(params: {
  readonly appId: string
  readonly tableName: string
  readonly recordId: string
  readonly updateResult: Record<string, unknown>
  readonly oldRecord: Record<string, unknown> | undefined
}): void {
  publishRecordChange({
    appId: params.appId,
    tableName: params.tableName,
    event: 'update',
    recordId: params.recordId,
    record: extractRecordFields(params.updateResult),
    oldRecord: params.oldRecord,
  })
}

async function handleUpdateError(config: {
  session: Session
  tableName: string
  recordId: string
  error: unknown
  c: Context
}): Promise<Response> {
  const { session, tableName, recordId, error, c } = config
  if (!isAuthorizationError(error)) {
    return handleRouteError(c, error)
  }

  try {
    const result = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
    if (result._tag === 'Left') {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }
    const readResult = result.right

    if (readResult !== null) {
      return c.json(
        {
          success: false,
          message: 'Resource not found',
          code: 'NOT_FOUND',
        },
        404
      )
    }

    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  } catch {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
}
