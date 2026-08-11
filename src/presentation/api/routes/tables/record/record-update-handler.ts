/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines -- the single record-UPDATE orchestration surface
   (permission filter → optimistic-lock → publishedAt convention → SQLite
   AI-compute baseline merge → no-trigger/with-trigger write → realtime +
   webhooks + automations + [internal ref] AI-compute write-phase signalling). The
   no-trigger and with-trigger arms share the post-write seam; splitting them
   would duplicate that composition. */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { signalAiComputeWritePhase } from '@/application/use-cases/ai-compute/enqueue-refinement'
import { triggerRecordEventAutomations } from '@/application/use-cases/automations/trigger-record-event'
import { updateRecordProgram, rawGetRecordProgram } from '@/application/use-cases/tables/programs'
import { transformRecord } from '@/application/use-cases/tables/utils/record-transformer'
import { applyAiComputeBaseline } from '@/domain/services/ai-compute/apply-baseline'
import { hasUpdatePermission } from '@/domain/validators/permission-evaluators'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  provideTableWithAutomationsLive,
  runTableProgram,
} from '@/infrastructure/layers/table-layer'
import { publishRecordChange } from '@/infrastructure/realtime/record-change-publisher'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'
import { triggerTableWebhooks } from '@/infrastructure/webhooks/table-webhook-dispatch'
import { validateFieldWritePermissions } from '@/presentation/api/utils/field-permission-validator'
import { handleRouteError } from '../error-handlers'
import { isAuthorizationError } from '../utils'
import { isStaleWrite } from './record-conflict-check'
import type { UserSession } from '@/application/ports/models/user-session'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Names omitted from the `forbiddenFields` list reported back to the caller, so
 * an error response never enumerates an internal column name. This is the set's
 * ONLY remaining role — it must NOT be used to strip fields from a write. Doing
 * so dropped the column silently while still returning 201/200, which is data
 * loss rather than protection; genuinely readonly fields are rejected loudly and
 * by TYPE in `validateReadonlyIdField` / `validateReadonlyComputedFields`.
 */
const SYSTEM_PROTECTED_FIELDS = new Set(['user_id'])

/**
 * Auto-publishedAt convention ([internal ref] /
 * [internal ref]).
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
 * [internal ref] Phase 2 baseline (SQLite only): recompute the AI-compute baseline
 * in-process before the UPDATE so the refreshed value lands in the same write.
 * Postgres computes this in a synchronous BEFORE trigger, so this is a no-op on
 * Postgres (and for tables with no AI-compute fields). The shared guard honours
 * direct user edits and skips recompute when no source field changed.
 */
function mergeSqliteAiBaselineOnUpdate(
  app: App,
  tableName: string,
  fields: Record<string, unknown>,
  oldRecord: Record<string, unknown> | undefined
): Record<string, unknown> {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table || !isSqliteRuntime()) return fields
  return {
    ...fields,
    ...applyAiComputeBaseline({ table, op: 'update', incoming: fields, old: oldRecord }),
  }
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
    // S1 anti-enumeration: authz denial returns 404 with a generic envelope.
    // The pre-S1 code branched on `userRole === 'viewer'` to customise the
    // error message; that branch is intentionally removed so the response
    // shape stays uniform regardless of which role triggered the denial.
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

  // Filter out forbidden fields only. `SYSTEM_PROTECTED_FIELDS` is deliberately
  // NOT applied here: stripping a name-matched column from the write silently
  // dropped it while the PATCH still reported 200. The set's remaining, valid
  // purpose is 403/404-suppression in `handleNoAllowedFields` below.
  const allowedData = Object.fromEntries(
    Object.entries(data).filter(([fieldName]) => !forbiddenFields.includes(fieldName))
  )

  return { allowedData, forbiddenFields }
}

/**
 * Handle case where no fields are allowed after filtering
 */
export async function handleNoAllowedFields(config: {
  session: UserSession
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

  // S1 anti-enumeration: forbidden-field attempts return 404 (not 403) so
  // the field-permission boundary is not discoverable. The attempted field
  // names are intentionally omitted from the response envelope.
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
 * [internal ref] auto-publishedAt convention was wired in.
 */
async function executeUpdateNoTrigger(config: {
  readonly session: UserSession
  readonly tableName: string
  readonly recordId: string
  readonly oldRecord: Record<string, unknown> | undefined
  readonly dataWithPublishedAt: Record<string, unknown>
  /** The user-supplied update map (pre baseline merge) — AI-compute override detection. */
  readonly incoming: Record<string, unknown>
  readonly app: App
  readonly userRole: string
  readonly c: Context
}): Promise<Response> {
  const {
    session,
    tableName,
    recordId,
    oldRecord,
    dataWithPublishedAt,
    incoming,
    app,
    userRole,
    c,
  } = config
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
  // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget webhook dispatch
  await fireUpdateWebhooks(app, tableName, updateResult, oldRecord)
  publishUpdateChange({ app, tableName, recordId, incoming, updateResult, oldRecord })
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
 * Build the canonical `409 Conflict` response for a stale optimistic-locked
 * write. The envelope uses `message` (the `error` key is
 * being phased out) so callers can surface a reload-and-retry prompt.
 */
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

/**
 * Pre-update data preparation: fetch the pre-update row (for attachment-replace
 * detection + optimistic-lock check), reject stale writes (409), then apply the
 * auto-publishedAt convention and the SQLite AI-compute baseline merge. Returns
 * the prepared write data, or a `conflict` response for a stale write.
 */
async function prepareUpdateData(config: {
  readonly session: UserSession
  readonly tableName: string
  readonly recordId: string
  readonly allowedData: Record<string, unknown>
  readonly app: App
  readonly clientUpdatedAt?: string
  readonly c: Context
}): Promise<
  | { readonly conflict: Response }
  | {
      readonly oldRecord: Record<string, unknown> | undefined
      readonly dataWithBaseline: Record<string, unknown>
    }
> {
  const { session, tableName, recordId, allowedData, app, clientUpdatedAt, c } = config
  const rawResult = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
  const oldRecord = rawResult._tag === 'Right' && rawResult.right ? rawResult.right : undefined
  if (isStaleWrite({ clientUpdatedAt, storedRecord: oldRecord })) {
    return { conflict: staleWriteConflictResponse(c) }
  }
  const dataWithPublishedAt = maybeApplyPublishedAtAutoSet(app, tableName, oldRecord, allowedData)
  const dataWithBaseline = mergeSqliteAiBaselineOnUpdate(
    app,
    tableName,
    dataWithPublishedAt,
    oldRecord
  )
  return { oldRecord, dataWithBaseline }
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
  session: UserSession
  tableName: string
  recordId: string
  allowedData: Record<string, unknown>
  app: App
  userRole: string
  clientUpdatedAt?: string
  c: Context
}): Promise<Response> {
  const { session, tableName, recordId, allowedData, app, userRole, clientUpdatedAt, c } = config

  const prep = await prepareUpdateData({
    session,
    tableName,
    recordId,
    allowedData,
    app,
    clientUpdatedAt,
    c,
  })
  if ('conflict' in prep) return prep.conflict
  const { oldRecord, dataWithBaseline } = prep

  try {
    if (!hasUpdateRecordTrigger(app, tableName)) {
      return await executeUpdateNoTrigger({
        session,
        tableName,
        recordId,
        oldRecord,
        dataWithPublishedAt: dataWithBaseline,
        incoming: allowedData,
        app,
        userRole,
        c,
      })
    }

    return await executeUpdateWithRecordTrigger({
      session,
      tableName,
      recordId,
      allowedData: dataWithBaseline,
      incoming: allowedData,
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
 * `TableWithAutomations` layer (the engine needs the
 * Automation* repositories to seed `automation_definitions` and persist
 * runs).
 */
async function executeUpdateWithRecordTrigger(config: {
  session: UserSession
  tableName: string
  recordId: string
  allowedData: Record<string, unknown>
  /** The user-supplied update map (pre baseline merge) — AI-compute override detection. */
  incoming: Record<string, unknown>
  app: App
  userRole: string
  c: Context
}): Promise<Response> {
  const { session, tableName, recordId, allowedData, incoming, app, userRole, c } = config
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

  const result = await Effect.runPromise(Effect.either(provideTableWithAutomationsLive(program)))

  if (result._tag === 'Left') {
    return handleUpdateError({ session, tableName, recordId, error: result.left, c })
  }

  const updateResult = result.right.updated
  if (!updateResult || Object.keys(updateResult).length === 0) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  const oldRecord = result.right.previous ?? undefined
  // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget webhook dispatch
  await fireUpdateWebhooks(app, tableName, updateResult, oldRecord)
  publishUpdateChange({ app, tableName, recordId, incoming, updateResult, oldRecord })
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
 * Flatten an `updateRecordProgram` result for webhook delivery. Mirrors
 * {@link extractRecordFields} but additionally surfaces the `createdAt` /
 * `updatedAt` system timestamps so webhooks with `payload.includeMetadata`
 * can expose them under `data.record`.
 */
function extractRecordForWebhook(updateResult: Record<string, unknown>): Record<string, unknown> {
  return {
    ...extractRecordFields(updateResult),
    ...(updateResult['createdAt'] !== undefined ? { createdAt: updateResult['createdAt'] } : {}),
    ...(updateResult['updatedAt'] !== undefined ? { updatedAt: updateResult['updatedAt'] } : {}),
  }
}

/**
 * Fire table webhooks for a successful record update (fire-and-forget).
 * Extracted so both the no-trigger and with-trigger update paths dispatch
 * webhooks consistently. `previousRecord` (the pre-update row) is forwarded
 * so webhooks with `payload.includePreviousValues` can emit `previousValues`
 * and `changedFields`.
 */
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

/**
 * Wave-1 realtime delivery: publish an `update` change event to the table's
 * channel. `oldRecord` carries the pre-update row so a filtered subscription
 * can detect a filter enter/exit transition.
 */
function publishUpdateChange(params: {
  readonly app: App
  readonly tableName: string
  readonly recordId: string
  /** The user-supplied update map (pre baseline merge) — AI-compute override detection. */
  readonly incoming: Record<string, unknown>
  readonly updateResult: Record<string, unknown>
  readonly oldRecord: Record<string, unknown> | undefined
}): void {
  const { app, tableName, recordId, incoming, updateResult, oldRecord } = params
  const record = extractRecordFields(updateResult)
  publishRecordChange({ appId: app.name, tableName, event: 'update', recordId, record, oldRecord })
  // [internal ref] Phase 2: signal the AI-compute write phase. A user override is
  // recorded as `skipped` (both dialects); a recomputed field is enqueued to the
  // shared worker on SQLite (Postgres uses the NOTIFY listener). Fire-and-forget,
  // gated for non-AI tables.
  signalAiComputeWritePhase({
    app,
    tableName,
    op: 'update',
    recordId,
    incoming,
    old: oldRecord,
    record,
  })
}

/**
 * Handle update errors including RLS authorization failures
 */
async function handleUpdateError(config: {
  session: UserSession
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

    // S1 anti-enumeration: if we can read but not update, still return 404
    // so the write-permission boundary is not discoverable.
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
