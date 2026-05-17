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
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'
import { validateFieldWritePermissions } from '@/presentation/api/utils/field-permission-validator'
import { handleRouteError } from './error-handlers'
import { isAuthorizationError, type Session } from './utils'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

const SYSTEM_PROTECTED_FIELDS = new Set(['user_id'])

/**
 * Auto-publishedAt convention (US-PAGES-ACCESS-PUBLISHING-001 /
 * APP-PAGES-PUBLISHING-004).
 *
 * When a table has BOTH a `single-select` field named `status` and a
 * `datetime` field named `published_at`, the engine populates
 * `published_at` automatically the first time `status` transitions to
 * `'published'`. The convention is intentionally narrow:
 *
 *  - Only fires when the incoming PATCH sets `status: 'published'`
 *    AND the request did NOT explicitly include `published_at` in its
 *    body (caller-provided values always win).
 *  - Only fires when the *previous* row's `status` was NOT already
 *    `'published'` — re-saving an already-published row is a no-op so
 *    the original publication datetime is preserved (the user story
 *    explicitly says "stores the datetime when status FIRST changed
 *    to published").
 *  - Returns the original `fields` reference unchanged when neither
 *    field exists on the table, so non-CMS tables pay no overhead.
 *
 * Pure helper — no side effects, no DB roundtrip; the previous row is
 * already pre-fetched by `executeUpdate` for replaced-attachment
 * cleanup, so this convention reuses that read.
 */
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

/**
 * Collect storage keys from single-attachment fields that are being replaced.
 * Returns only old keys that differ from the incoming update values.
 */
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

/**
 * Delete files from storage by key, ignoring errors so a missing file
 * does not block the record update.
 */
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

/**
 * Check if user has table-level update permission (using pre-fetched role from middleware)
 */
export function checkTableUpdatePermissionWithRole(
  app: App,
  tableName: string,
  userRole: string,
  c: Context
): { allowed: true } | { allowed: false; response: Response } {
  const table = app.tables?.find((t) => t.name === tableName)

  if (!hasUpdatePermission(table, userRole, app.tables)) {
    // Viewer-specific message for default permission denial
    const message =
      userRole === 'viewer'
        ? 'You do not have permission to perform this action'
        : 'You do not have permission to update records in this table'

    return {
      allowed: false,
      response: c.json(
        {
          success: false,
          message,
          code: 'FORBIDDEN',
        },
        403
      ),
    }
  }

  return { allowed: true }
}

/**
 * Filter update data to only include fields user has permission to modify (using pre-fetched role from middleware)
 */
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

/**
 * Handle case where no fields are allowed after filtering
 */
export async function handleNoAllowedFields(config: {
  session: Session
  tableName: string
  recordId: string
  forbiddenFields: readonly string[]
  c: Context
}): Promise<Response> {
  const { session, tableName, recordId, forbiddenFields, c } = config
  // Filter out system-protected fields from forbidden list
  const attemptedForbiddenFields = forbiddenFields.filter(
    (field) => !SYSTEM_PROTECTED_FIELDS.has(field)
  )

  // If user tried to modify forbidden fields (not system-protected), return 403
  if (attemptedForbiddenFields.length > 0) {
    return c.json(
      {
        success: false,
        message: `You do not have permission to modify any of the specified fields: ${attemptedForbiddenFields.join(', ')}`,
        code: 'FORBIDDEN',
      },
      403
    )
  }

  // If only system-protected fields were filtered, return unchanged record
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

/**
 * Whether the schema declares any update-event record-trigger automation
 * targeting this table. Skips the pre-fetch + automation dispatch wiring
 * for the common case where no update automations are configured. Cheap
 * iteration over an in-memory array, no DB roundtrip.
 */
function hasUpdateRecordTrigger(app: App, tableName: string): boolean {
  return (app.automations ?? []).some((automation) => {
    if (automation.enabled === false) return false
    const { trigger } = automation
    if (trigger.type !== 'record') return false
    if (trigger.table !== tableName) return false
    return trigger.events.includes('update')
  })
}

/**
 * No-trigger fast path for `executeUpdate`. Runs the program, handles
 * the standard error/empty-result branches, and asynchronously cleans
 * up replaced single-attachment storage keys. Extracted so the parent
 * `executeUpdate` stays under the per-function line cap after the
 * APP-PAGES-PUBLISHING-004 auto-publishedAt convention was wired in.
 */
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

/**
 * Execute update and handle RLS authorization errors. When any
 * update-event record-trigger automation is configured for this table the
 * pre-update row is captured (for `watchFields` diffing) and the matching
 * automations are fired sequentially after the write commits. Sequential
 * (await): both the update and the trigger dispatch run BEFORE the HTTP
 * response is built so callers observing downstream state (e.g. the
 * automation cascade-mutating the same row) do not see a race window.
 */
export async function executeUpdate(config: {
  session: Session
  tableName: string
  recordId: string
  allowedData: Record<string, unknown>
  app: App
  userRole: string
  c: Context
}): Promise<Response> {
  const { session, tableName, recordId, allowedData, app, userRole, c } = config

  // Capture current record before update to detect replaced attachments
  const rawResult = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
  const oldRecord = rawResult._tag === 'Right' && rawResult.right ? rawResult.right : undefined

  // APP-PAGES-PUBLISHING-004: convention auto-fills `published_at` when
  // `status` transitions to `'published'` for the first time. Runs after
  // permission filtering (caller-provided forbidden fields are already
  // dropped) but before the DB write so the auto-set value persists in
  // the same atomic update.
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

/**
 * Update a record and dispatch matching record-trigger automations.
 *
 * Composition: pre-fetch raw row → update → tap automations. The pre-fetch
 * is necessary so `watchFields` diff knows the previous values; without it
 * we cannot tell whether a watched field actually changed. Reusing
 * `rawGetRecordProgram` keeps the read aligned with the same session/RLS
 * context as the update.
 *
 * The full pipeline runs inside one Effect request scope so it shares the
 * `TableWithNotificationsAndAutomations` layer (the engine needs the
 * Automation* repositories to seed `automation_definitions` and persist
 * runs).
 */
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
  return c.json(updateResult, 200)
}

/**
 * Flatten an `updateRecordProgram` result into a plain field map suitable
 * for record-trigger context. The program returns a structure with both
 * flat fields and a nested `fields` envelope; the trigger only cares about
 * the column values plus `id`.
 */
function extractRecordFields(updateResult: Record<string, unknown>): Record<string, unknown> {
  const nested = updateResult['fields']
  if (nested !== null && typeof nested === 'object') {
    return { id: updateResult['id'], ...(nested as Record<string, unknown>) }
  }
  return updateResult
}

/**
 * Handle update errors including RLS authorization failures
 */
async function handleUpdateError(config: {
  session: Session
  tableName: string
  recordId: string
  error: unknown
  c: Context
}): Promise<Response> {
  const { session, tableName, recordId, error, c } = config
  // Check if this is an authorization error (RLS blocking the update)
  if (!isAuthorizationError(error)) {
    return handleRouteError(c, error)
  }

  // Try to read the record to differentiate between "not found" and "forbidden"
  try {
    const result = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
    if (result._tag === 'Left') {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }
    const readResult = result.right

    // If we can read the record but couldn't update it, return 403 Forbidden
    if (readResult !== null) {
      return c.json(
        {
          success: false,
          message: 'You do not have permission to update this record',
          code: 'FORBIDDEN',
        },
        403
      )
    }

    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  } catch {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
}
