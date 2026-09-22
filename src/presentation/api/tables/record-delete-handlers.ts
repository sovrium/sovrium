/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { triggerRecordEventAutomations } from '@/application/use-cases/automations/trigger-record-event'
import { rawGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import {
  restoreRecordProgram,
  deleteRecordProgram,
  permanentlyDeleteRecordProgram,
} from '@/application/use-cases/tables/record-lifecycle-programs'
import { isDriverOriginatedFailure } from '@/domain/errors/driver-failure'
import { isSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { isAdminRole } from '@/domain/models/app/auth/permission-evaluation'
import { hasDeletePermission } from '@/domain/models/app/auth/permission-evaluator-service'
import { SHARED_POOL_FANOUT_CONCURRENCY } from '@/infrastructure/database/sql/db-effect'
import {
  provideTableWithAutomationsLive,
  runTableProgram,
} from '@/infrastructure/layers/table-layer'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { publishRecordChange } from '@/infrastructure/realtime/record-change-publisher'
import { triggerTableWebhooks } from '@/infrastructure/webhooks/table-webhook-dispatch'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { handleRestoreRecordError, handleRouteError } from './error-handlers'
import {
  collectAttachmentKeys,
  deleteStorageFiles,
  type AttachmentRef,
} from './record-attachment-cleanup'
import { checkDeleteGate } from './record-delete-gate'
import {
  enforceFormMutationGate,
  enforceRestoreGate,
  resolveGuardForTable,
} from './row-level-guard'
import type { App } from '@/domain/models/app'
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
 *
 * A `ValidationError` is sanitized too, and that is NOT an S1 hole. The only
 * one this pipeline can raise is the refusal owed to a table whose declared
 * primary key gives it no single-value record address — a verdict read off the
 * app's own declared schema, reached before any row is looked at, and therefore
 * identical whether the record exists or not. It discloses nothing an
 * enumerator could use, and answering it 404 would instead hide a permanent
 * contract refusal behind a status that invites a retry. The delete path's
 * repository methods declare `DatabaseError` alone, so nothing else arrives
 * here under that tag.
 */
function deleteFailureResponse(c: Context, error: unknown): Response {
  const isValidationRefusal =
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    error._tag === 'ValidationError'
  if (isDriverOriginatedFailure(error) || isValidationRefusal) return handleRouteError(c, error)
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
  // effect-promise: total -- `triggerTableWebhooks` wraps its whole dispatch in a try/catch; a webhook endpoint that is down, slow or missing must never fail the record write that fired it.
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
    // `app` so this pre-fetch refuses a table with no single-value record
    // address, rather than being the statement that names its missing `id`.
    const previous = yield* rawGetRecordProgram(session, tableName, recordId, app)
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
  const result = await runRequestEffect(c, Effect.result(provideTableWithAutomationsLive(program)))
  if (result._tag === 'Failure') return deleteFailureResponse(c, result.failure)
  if (!result.success.success)
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
    // `app` so this pre-fetch refuses a table with no single-value record
    // address, rather than being the statement that names its missing `id`.
    const previous = yield* rawGetRecordProgram(session, tableName, recordId, app)
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
    Effect.result(provideTableWithAutomationsLive(buildSoftDeleteProgram(input)))
  )
  if (outcome._tag === 'Failure') return deleteFailureResponse(c, outcome.failure)
  return softDeleteResultToResponse(c, outcome.success.result)
}

/**
 * Check whether a file key is still referenced by any record OTHER than
 * the one being purged. Includes soft-deleted records so a key shared
 * between a live record and a deleted record is preserved.
 *
 * ONE query, whatever the table's width. This previously fanned out one
 * unbounded, unprojected `listRecords` PER attachment field, so a purge cost
 * |keys| x |fields| reads against a ten-connection pool — 419 queries for a
 * 14-field record, the shape behind the 2026-07-25 production 504. The fields
 * are now folded into a single `or` filter.
 *
 * `limit: 2` and not `limit: 1`: the purged record is itself a match, so one
 * row cannot distinguish "only this record references the key" from "another
 * record does too". Two rows can — at most one of them is the excluded id, so
 * a second row is by definition a different record. `columns: ['id']` because
 * the id is the whole question; the rest of the row was never read.
 */
async function isFileKeyReferencedElsewhere(opts: {
  readonly session: SessionContext
  readonly tableName: string
  readonly excludeRecordId: string
  readonly fileKey: string
  readonly attachmentFieldNames: readonly string[]
}): Promise<boolean> {
  if (opts.attachmentFieldNames.length === 0) return false

  const result = await runTableProgram(
    Effect.gen(function* () {
      const repo = yield* TableRepository
      return yield* repo.listRecords({
        session: opts.session,
        tableName: opts.tableName,
        // `QueryFilter` exposes only a top-level `and`, whose entries may
        // themselves be `or` groups — so "this key in ANY attachment field" is
        // an `and` wrapping one `or`, not a bare `or`.
        filter: {
          and: [
            {
              or: opts.attachmentFieldNames.map((fieldName) => ({
                field: fieldName,
                operator: 'eq',
                value: opts.fileKey,
              })),
            },
          ],
        },
        includeDeleted: true,
        columns: ['id'],
        limit: 2,
      })
    })
  )

  return (
    result._tag === 'Success' &&
    result.success.some((r) => String(r['id']) !== String(opts.excludeRecordId))
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
  if (rawResult._tag === 'Success' && rawResult.success) {
    const keys = collectAttachmentKeys(rawResult.success, app, tableName)
    const table = app.tables?.find((t) => t.name === tableName)
    const attachmentFieldNames =
      table?.fields?.filter((f) => f.type === 'single-attachment').map((f) => f.name) ?? []
    // Bounded, not `Promise.all`: one reference check is one pooled query, and
    // a record carries as many as the table has attachment fields. Firing them
    // all at once takes the whole ten-connection pool and starves every
    // co-firing request —.
    const keysToDelete = (
      await Effect.runPromise(
        Effect.all(
          keys.map((ref) =>
            // effect-promise: total -- `isFileKeyReferencedElsewhere` runs its query through `runTableProgram`, which resolves an `Effect.result`; a failed lookup returns `false` as a value rather than rejecting.
            Effect.promise(async () => {
              const referenced = await isFileKeyReferencedElsewhere({
                session,
                tableName,
                excludeRecordId: recordId,
                fileKey: ref.key,
                attachmentFieldNames,
              })
              return referenced ? undefined : ref
            })
          ),
          { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
        )
      )
    ).filter((ref): ref is AttachmentRef => ref !== undefined)
    return deleteStorageFiles(keysToDelete).then(() =>
      executePermanentDelete({ session, tableName, recordId, c, app, userId })
    )
  }
  return executePermanentDelete({ session, tableName, recordId, c, app, userId })
}

export async function handleDeleteRecord(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)

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
    userGroups,
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
  const result = await runRequestEffect(c, Effect.result(provideTableWithAutomationsLive(program)))

  if (result._tag === 'Failure') return deleteFailureResponse(c, result.failure)
  if (!result.success.result.success) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  // The path arrives in the request body, so it is only honoured once proven
  // same-origin — otherwise it is an open redirect off this site.
  if (isSafeRedirectPath(redirectPath)) {
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

  const result = await runTableProgram(
    restoreRecordProgram(session, tableName, recordId, { app, userRole })
  )

  if (result._tag === 'Failure') {
    return handleRestoreRecordError(c, result.failure)
  }

  if (!result.success.success) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  return c.json(result.success, 200)
}
