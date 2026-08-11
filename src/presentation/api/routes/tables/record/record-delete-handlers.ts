/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { StorageService } from '@/application/ports/services/storage-service'
import { triggerRecordEventAutomations } from '@/application/use-cases/automations/trigger-record-event'
import {
  rawGetRecordProgram,
  restoreRecordProgram,
  deleteRecordProgram,
  permanentlyDeleteRecordProgram,
} from '@/application/use-cases/tables/programs'
import { isDriverOriginatedFailure } from '@/domain/errors/driver-failure'
import { isAdminRole } from '@/domain/models/shared/permission-evaluation'
import { parseJsonObjectCell } from '@/domain/utils/database/sqlite-json-cell'
import { hasDeletePermission } from '@/domain/validators/permission-evaluators'
import {
  provideTableWithAutomationsLive,
  runTableProgram,
} from '@/infrastructure/layers/table-layer'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { publishRecordChange } from '@/infrastructure/realtime/record-change-publisher'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { triggerTableWebhooks } from '@/infrastructure/webhooks/table-webhook-dispatch'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { handleRestoreRecordError, handleRouteError } from '../error-handlers'
import {
  enforceFormMutationGate,
  enforceRestoreGate,
  passesTableRoleGate,
  recordPassesPredicate,
  resolveGuardForTable,
  type RowLevelGuardContext,
} from './row-level-guard'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

/** Session type derived from table context to respect layer boundaries */
type SessionContext = ReturnType<typeof getTableContext>['session']

/**
 * Response for a failed delete program.
 *
 * Every delete path used to collapse `result._tag === 'Left'` — i.e. EVERY
 * failure, a dropped table and a lost connection included — to an
 * unconditional 404, so an infrastructure fault was reported to the caller as
 * "Resource not found" and never alerted the operator.
 *
 * A driver-raised failure is now sanitized into its real status; everything
 * else keeps the S1 404 so an authorization denial stays indistinguishable
 * from a genuinely absent record.
 */
function deleteFailureResponse(c: Context, error: unknown): Response {
  if (isDriverOriginatedFailure(error)) return handleRouteError(c, error)
  return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
}

/**
 * Fire table webhooks AND publish a realtime `delete` change event for a
 * successful delete (fire-and-forget). Shared by the permanent-delete and
 * soft-delete pipelines so both dispatch `event: 'delete'` consistently.
 * `skip` (e.g. row absent, restrict-violation) short-circuits to a no-op so
 * no delivery row is logged and no change event is broadcast.
 *
 * Delete change events bypass the subscription filter — a
 * filtered view must still drop a removed row regardless of its field values.
 */
function fireDeleteWebhooks(
  app: App,
  tableName: string,
  record: Record<string, unknown> | null,
  skip: boolean
): Effect.Effect<void> {
  if (skip || !record) return Effect.void
  return Effect.promise(() =>
    triggerTableWebhooks({
      table: app.tables?.find((t) => t.name === tableName),
      event: 'delete',
      record,
    })
  ).pipe(
    Effect.tap(() =>
      Effect.sync(() =>
        publishRecordChange({
          appId: app.name,
          tableName,
          event: 'delete',
          recordId: (record['id'] as string | number | undefined) ?? '',
        })
      )
    )
  )
}

/**
 * Execute permanent delete and return response. Pre-fetches the record so a
 * successful permanent-delete fires matching record-triggered automations
 * (`event: 'delete'`); pipeline runs inside the composite layer used by
 * create/update. Trigger errors are absorbed inside the trigger use case.
 */
async function executePermanentDelete({
  session,
  tableName,
  recordId,
  c,
  app,
  userId,
}: {
  readonly session: SessionContext
  readonly tableName: string
  readonly recordId: string
  readonly c: Context
  readonly app: App
  readonly userId?: string
}) {
  const program = Effect.gen(function* () {
    const previous = yield* rawGetRecordProgram(session, tableName, recordId)
    const success = yield* permanentlyDeleteRecordProgram(session, tableName, recordId)
    return { previous, success }
  }).pipe(
    Effect.tap(({ previous, success }) => {
      // Skip when row didn't exist or wasn't deleted — dispatching against
      // an empty record would surface as `undefined` for every field in
      // {{trigger.data.record.X}}.
      if (!success || !previous) return Effect.void
      return triggerRecordEventAutomations({
        app,
        tableName,
        event: 'delete',
        record: previous,
        processEnv: process.env,
        userId,
      })
    }),
    Effect.tap(({ previous, success }) => fireDeleteWebhooks(app, tableName, previous, !success))
  )
  const result = await runRequestEffect(c, Effect.either(provideTableWithAutomationsLive(program)))
  if (result._tag === 'Left') return deleteFailureResponse(c, result.left)
  if (!result.right.success)
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  return c.json({ success: true }, 200)
}

type SoftDeletePipelineInput = {
  readonly session: SessionContext
  readonly tableName: string
  readonly recordId: string
  readonly app: App
  readonly userId?: string
}

/**
 * Build the soft-delete Effect program: pre-fetch row, soft-delete, tap
 * matching record-triggered automations. Shared by `executeSoftDelete`
 * and `handleFormDeleteRecord` so both paths fire delete-event triggers
 * consistently. Trigger errors are absorbed inside the trigger use case.
 */
function buildSoftDeleteProgram(input: SoftDeletePipelineInput) {
  const { session, tableName, recordId, app, userId } = input
  return Effect.gen(function* () {
    const previous = yield* rawGetRecordProgram(session, tableName, recordId)
    const result = yield* deleteRecordProgram(session, tableName, recordId, app)
    return { previous, result }
  }).pipe(
    Effect.tap(({ previous, result }) => {
      // Skip the trigger on restrict-violation (no actual delete happened)
      // or when the row didn't exist / wasn't deleted.
      if (result.restrictViolation || !result.success || !previous) return Effect.void
      return triggerRecordEventAutomations({
        app,
        tableName,
        event: 'delete',
        record: previous,
        processEnv: process.env,
        userId,
      })
    }),
    Effect.tap(({ previous, result }) =>
      fireDeleteWebhooks(app, tableName, previous, result.restrictViolation || !result.success)
    )
  )
}

/** Map a soft-delete result to a JSON HTTP response. */
function softDeleteResultToResponse(
  c: Context,
  result: { restrictViolation: boolean; success: boolean; setNullPerformed: boolean }
): Response {
  if (result.restrictViolation) {
    return c.json(
      {
        success: false,
        message: 'Cannot delete record: child records exist and onDelete is set to restrict',
        code: 'CONFLICT',
      },
      400
    )
  }
  if (!result.success)
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  if (result.setNullPerformed) return c.json({ success: true }, 200)
  // eslint-disable-next-line unicorn/no-null -- Hono's c.body() requires null for 204 No Content
  return c.body(null, 204)
}

/** Execute soft delete and return response (see `buildSoftDeleteProgram`). */
async function executeSoftDelete(input: SoftDeletePipelineInput & { readonly c: Context }) {
  const { c } = input
  const outcome = await runRequestEffect(
    c,
    Effect.either(provideTableWithAutomationsLive(buildSoftDeleteProgram(input)))
  )
  if (outcome._tag === 'Left') return deleteFailureResponse(c, outcome.left)
  return softDeleteResultToResponse(c, outcome.right.result)
}

const NOT_FOUND_RESPONSE = (c: Context) =>
  c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)

const FORBIDDEN_DELETE_RESPONSE = (c: Context) =>
  // S1 anti-enumeration: delete-permission denials return 404 so the
  // delete-permission boundary is not discoverable. Uniform with read denials.
  c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)

interface DeleteGateInput {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableName: string
  readonly userRole: string
  readonly recordId: string
  readonly guard: RowLevelGuardContext | undefined
}

/** Predicate check that bundles read.when + delete.when against the same fetched row. */
function evaluateDeletePredicates(
  c: Context,
  table: Table,
  guard: RowLevelGuardContext,
  fetchedRecord: Readonly<Record<string, unknown>>
): Response | undefined {
  const rlp = table.rowLevelPermissions
  if (!rlp) return undefined
  if (rlp.read?.when && !recordPassesPredicate(rlp, 'read', fetchedRecord, guard.current)) {
    return NOT_FOUND_RESPONSE(c)
  }
  if (!passesTableRoleGate(table.permissions, 'delete', guard.effectiveRoles)) {
    return FORBIDDEN_DELETE_RESPONSE(c)
  }
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- `delete` is a property on RowLevelPermissions, not a Drizzle query.
  if (rlp.delete?.when && !recordPassesPredicate(rlp, 'delete', fetchedRecord, guard.current)) {
    return NOT_FOUND_RESPONSE(c)
  }
  return undefined
}

/**
 * Extract the storage key from an attachment field value.
 * Handles both plain string keys and metadata objects (when storeMetadata: true).
 * Metadata objects store the key inside the url: "/api/buckets/default/files/<key>"
 *
 * The value arrives from a RAW database row, so the metadata object is only an
 * object on PostgreSQL. `storeMetadata: true` promotes the column to JSONB and
 * SQLite has no JSONB, so on the zero-config DEFAULT engine the same cell reads
 * back as the TEXT `'{"filename":…,"url":…}'`. Without the parse below, the bare-
 * string arm fired on the serialized document itself and handed the entire JSON
 * blob to `storage.delete()` as if it were a key: the delete matched nothing, and
 * purging a record left its file in the bucket forever. Postgres was unaffected,
 * so the leak was invisible on the engine the tests default to.
 */
function extractAttachmentKey(value: unknown): string | undefined {
  const parsed = parseJsonObjectCell(value) ?? value
  if (typeof parsed === 'string' && parsed.length > 0) return parsed
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>
    if (typeof obj['url'] === 'string') {
      const key = obj['url'].split('/').at(-1)
      if (key && key.length > 0) return key
    }
  }
  return undefined
}

/**
 * Z-3 delete gate enforcing read.when before the delete role gate so
 * users who can't see the record always get 404 (enumeration safety),
 * even when their role lacks delete authority.
 */
async function checkDeleteGate(input: DeleteGateInput): Promise<Response | undefined> {
  const { c, app, table, session, tableName, userRole, recordId, guard } = input

  if (!guard) {
    if (!hasDeletePermission(table, userRole, app.tables)) return FORBIDDEN_DELETE_RESPONSE(c)
    return undefined
  }

  if (!passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)) {
    return NOT_FOUND_RESPONSE(c)
  }

  const fetched = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
  if (fetched._tag === 'Left' || !fetched.right) return NOT_FOUND_RESPONSE(c)
  if (!table) return NOT_FOUND_RESPONSE(c)

  return evaluateDeletePredicates(c, table, guard, fetched.right)
}

/**
 * Collect storage keys from single-attachment fields in a raw DB record.
 * Handles both plain string keys and storeMetadata objects (url-embedded key).
 */
function collectAttachmentKeys(
  record: Record<string, unknown>,
  app: App,
  tableName: string
): readonly string[] {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table?.fields) return []
  return table.fields
    .filter((f) => f.type === 'single-attachment')
    .map((f) => extractAttachmentKey(record[f.name]))
    .filter((k): k is string => k !== undefined)
}

/**
 * Delete files from storage by key, ignoring errors so a missing file
 * does not block the record purge.
 *
 * Each key's cached image transforms are evicted after the delete so a later
 * `GET .../files/<key>` (with or without transform params) correctly returns
 * 404 instead of serving stale cached transformed bytes.
 */
async function deleteStorageFiles(keys: readonly string[]): Promise<void> {
  return Promise.all(
    keys.map((key) => {
      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage['delete'](key)
      })
      return Effect.runPromise(Effect.either(Effect.provide(program, StorageServiceLive))).then(
        () => evictTransformCacheForKey(key)
      )
    })
  ).then(() => undefined)
}

/**
 * Check whether a file key is still referenced by any record OTHER than
 * the one being purged. Includes soft-deleted records so a key shared
 * between a live record and a deleted record is preserved.
 */
async function isFileKeyReferencedElsewhere(opts: {
  readonly session: SessionContext
  readonly tableName: string
  readonly excludeRecordId: string
  readonly fileKey: string
  readonly attachmentFieldNames: readonly string[]
}): Promise<boolean> {
  const results = await Promise.all(
    opts.attachmentFieldNames.map((fieldName) =>
      runTableProgram(
        Effect.gen(function* () {
          const repo = yield* TableRepository
          return yield* repo.listRecords({
            session: opts.session,
            tableName: opts.tableName,
            filter: { and: [{ field: fieldName, operator: 'eq', value: opts.fileKey }] },
            includeDeleted: true,
          })
        })
      )
    )
  )
  return results.some(
    (result) =>
      result._tag === 'Right' &&
      result.right.some((r) => String(r['id']) !== String(opts.excludeRecordId))
  )
}

/**
 * Purge a record: delete attached files from storage, then permanently
 * remove the DB row. Requires admin role (enforced by caller).
 */
async function executePurge({
  session,
  tableName,
  recordId,
  app,
  c,
  userId,
}: {
  readonly session: SessionContext
  readonly tableName: string
  readonly recordId: string
  readonly app: App
  readonly c: Context
  readonly userId?: string
}) {
  const rawResult = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
  if (rawResult._tag === 'Right' && rawResult.right) {
    const keys = collectAttachmentKeys(rawResult.right, app, tableName)
    const table = app.tables?.find((t) => t.name === tableName)
    const attachmentFieldNames =
      table?.fields?.filter((f) => f.type === 'single-attachment').map((f) => f.name) ?? []
    const keysToDelete = (
      await Promise.all(
        keys.map(async (key) => {
          const referenced = await isFileKeyReferencedElsewhere({
            session,
            tableName,
            excludeRecordId: recordId,
            fileKey: key,
            attachmentFieldNames,
          })
          return referenced ? undefined : key
        })
      )
    ).filter((k): k is string => k !== undefined)
    return deleteStorageFiles(keysToDelete).then(() =>
      executePermanentDelete({ session, tableName, recordId, c, app, userId })
    )
  }
  return executePermanentDelete({ session, tableName, recordId, c, app, userId })
}

export async function handleDeleteRecord(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  const recordId = c.req.param('recordId')!
  const guard = await resolveGuardForTable(session, userRole, table, app)

  const gateError = await checkDeleteGate({
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

  const permanent = c.req.query('permanent') === 'true'
  const purge = c.req.query('purge') === 'true'

  // Pure permanent delete (no storage cleanup) requires admin role.
  // S1 anti-enumeration: non-admin attempts return 404 so the
  // admin-only delete boundary is not discoverable.
  if (permanent) {
    if (!isAdminRole(userRole)) {
      return c.json(
        {
          success: false,
          message: 'Resource not found',
          code: 'NOT_FOUND',
        },
        404
      )
    }
    return executePermanentDelete({
      session,
      tableName,
      recordId,
      c,
      app,
      userId: session.userId,
    })
  }

  // Purge: remove attached storage files then permanently delete the DB row.
  // Requires the same delete permission already checked above — no extra admin gate.
  if (purge) {
    return executePurge({ session, tableName, recordId, app, c, userId: session.userId })
  }

  // Regular soft delete
  return executeSoftDelete({ session, tableName, recordId, app, c, userId: session.userId })
}

/**
 * Handle form-based DELETE (POST) with redirect
 *
 * Used for non-confirmation delete buttons rendered as <form method="POST">.
 * Performs soft delete and redirects to the _redirect path from form body.
 */
export async function handleFormDeleteRecord(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  const recordId = c.req.param('recordId')!
  const guard = await resolveGuardForTable(session, userRole, table, app)

  // Z-3: row-level scoping. Falls back to canonical role-only check when
  // the table doesn't declare rowLevelPermissions (preserves existing
  // behaviour for non-row-level-enforced tables).
  if (guard) {
    const gateError = await enforceFormMutationGate({
      c,
      table,
      session,
      tableName,
      recordId,
      guard,
      op: 'delete',
    })
    if (gateError) return gateError
  } else if (!hasDeletePermission(table, userRole, app.tables)) {
    // S1 anti-enumeration: delete-permission denial returns 404.
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  // Parse form body for redirect path
  const body = await c.req.parseBody()
  const redirectPath = typeof body['_redirect'] === 'string' ? body['_redirect'] : undefined

  // Reuse `buildSoftDeleteProgram` so form-delete fires record-triggered
  // automations consistently with the JSON-API soft-delete path.
  const program = buildSoftDeleteProgram({
    session,
    tableName,
    recordId,
    app,
    userId: session.userId,
  })
  const result = await runRequestEffect(c, Effect.either(provideTableWithAutomationsLive(program)))

  if (result._tag === 'Left') return deleteFailureResponse(c, result.left)
  if (!result.right.result.success) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  if (redirectPath && redirectPath.startsWith('/')) {
    return c.redirect(redirectPath, 302)
  }

  // eslint-disable-next-line unicorn/no-null -- Hono's c.body() requires null for 204 No Content
  return c.body(null, 204)
}

export async function handleRestoreRecord(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  const recordId = c.req.param('recordId')!
  const guard = await resolveGuardForTable(session, userRole, table, app)

  // Z-3: row-level scoping. Restore reuses the delete role gate AND the
  // read predicate (the user must have been entitled to the row before
  // it was soft-deleted).
  if (guard) {
    const gateError = await enforceRestoreGate({
      c,
      table,
      session,
      tableName,
      recordId,
      guard,
    })
    if (gateError) return gateError
  } else if (!hasDeletePermission(table, userRole, app.tables)) {
    // S1 anti-enumeration: restore-permission denial returns 404.
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  const result = await runTableProgram(restoreRecordProgram(session, tableName, recordId))

  if (result._tag === 'Left') {
    return handleRestoreRecordError(c, result.left)
  }

  if (!result.right.success) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  return c.json(result.right, 200)
}
