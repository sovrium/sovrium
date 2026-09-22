/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { signalAiComputeWritePhase } from '@/application/use-cases/ai-compute/enqueue-refinement'
import { loadPausedAutomationNames } from '@/application/use-cases/automations/paused-automation-names'
import { triggerRecordEventAutomations } from '@/application/use-cases/automations/trigger-record-event'
import { rawGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import { updateRecordProgram } from '@/application/use-cases/tables/write-record-programs'
import { isAutomationOperationallyEnabled } from '@/domain/models/app/automations/automation-operational-state'
import { DEFAULT_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { applyAiComputeBaseline } from '@/domain/models/app/tables/ai-compute-apply-baseline'
import { AiLive } from '@/infrastructure/ai/layer'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  provideTableWithAutomationsLive,
  runTableProgram,
} from '@/infrastructure/layers/table-layer'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { publishRecordChange } from '@/infrastructure/realtime/record-change-publisher'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'
import { triggerTableWebhooks } from '@/infrastructure/webhooks/table-webhook-dispatch'
import { handleRouteError } from './error-handlers'
import { isAuthorizationError } from './error-helpers'
import { isStaleWrite } from './record-conflict-check'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

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
 * A superseded stored object, paired with the bucket that owns it. Keys are
 * flat, so the delete must name the bucket the object was written under.
 */
interface ReplacedAttachment {
  readonly key: string
  readonly bucket: string
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
): readonly ReplacedAttachment[] {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table?.fields) return []
  return table.fields
    .filter((f) => f.type === 'single-attachment' && f.name in updateData)
    .filter((f) => {
      const oldValue = oldRecord[f.name]
      return typeof oldValue === 'string' && oldValue.length > 0 && oldValue !== updateData[f.name]
    })
    .map((f) => ({
      key: oldRecord[f.name] as string,
      bucket: resolveFieldBucket(app, tableName, f.name) ?? DEFAULT_BUCKET_NAME,
    }))
}

/**
 * Delete files from storage by key, ignoring errors so a missing file
 * does not block the record update.
 */
async function deleteStorageFiles(refs: readonly ReplacedAttachment[]): Promise<void> {
  return Promise.all(
    refs.map(({ key, bucket }) => {
      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage['delete'](key, bucket)
      })
      return Effect.runPromise(Effect.result(Effect.provide(program, StorageServiceLive)))
    })
  ).then(() => undefined)
}

/**
 * Whether the schema declares any update-event record-trigger automation
 * targeting this table that is currently allowed to run. Skips the pre-fetch +
 * automation dispatch wiring for the common case where no update automations
 * are configured — or where every one of them is off.
 *
 * This is an OPTIMISATION, not the correctness gate: the authoritative filter
 * is `findMatchingRecordAutomations` inside `triggerRecordEventAutomations`,
 * which re-reads the pauses itself. Routing the pause through here too means a
 * fully-paused table also skips the now-pointless previous-record pre-fetch,
 * rather than paying for it and then dispatching nothing.
 */
function hasUpdateRecordTrigger(
  app: App,
  tableName: string,
  pausedNames: ReadonlySet<string>
): boolean {
  return (app.automations ?? []).some((automation) => {
    if (!isAutomationOperationallyEnabled(automation, pausedNames)) return false
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
  if (result._tag === 'Failure') {
    return handleUpdateError({ session, tableName, recordId, error: result.failure, c })
  }
  const updateResult = result.success
  if (!updateResult || Object.keys(updateResult).length === 0) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
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
  const oldRecord =
    rawResult._tag === 'Success' && rawResult.success ? rawResult.success : undefined
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
/**
 * Whether an update on this table has a LIVE record-update automation behind it.
 *
 * Reads the operational pauses off THIS request's services: a paused automation
 * must take the same no-trigger fast path a table with no trigger at all takes.
 */
async function hasArmedUpdateTrigger(c: Context, app: App, tableName: string): Promise<boolean> {
  const paused = await runDomainPromise(c, loadPausedAutomationNames)
  return hasUpdateRecordTrigger(app, tableName, paused)
}

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
    if (!(await hasArmedUpdateTrigger(c, app, tableName))) {
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

  const result = await Effect.runPromise(Effect.result(provideTableWithAutomationsLive(program)))

  if (result._tag === 'Failure') {
    return handleUpdateError({ session, tableName, recordId, error: result.failure, c })
  }

  const updateResult = result.success.updated
  if (!updateResult || Object.keys(updateResult).length === 0) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  const oldRecord = result.success.previous ?? undefined
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
  // Detached HERE rather than inside the use case (standing rule E1). Unlike
  // the insert path, this runs after the update program has already resolved,
  // so there is no fiber left to fork from and the `AiService` the enqueue
  // reads has to be bound at this seam. TODO(W4): hand this to the server
  // runtime's scope once long-lived work has an owner.
  // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget; the response has already been decided
  void Effect.runPromise(
    Effect.provide(
      signalAiComputeWritePhase({
        app,
        tableName,
        op: 'update',
        recordId,
        incoming,
        old: oldRecord,
        record,
      }),
      AiLive
    )
  )
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
    if (result._tag === 'Failure') {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }
    const readResult = result.success

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
