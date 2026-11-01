/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { recordWriteRequester } from '@/application/use-cases/tables/record-create-orchestration'
import {
  type DeleteMode,
  type DeleteResult,
} from '@/application/use-cases/tables/record-delete-orchestration'
import { restoreRecordWithSideEffects } from '@/application/use-cases/tables/record-restore-orchestration'
import { deleteRecordWithSideEffects } from '@/application/use-cases/tables/record-write-roads'
import { isDriverOriginatedFailure } from '@/domain/errors/driver-failure'
import { resolveRedirectAgainst } from '@/domain/kernel/url/redirect-resolution'
import {
  deleteRecordResponseSchema,
  restoreRecordResponseSchema,
} from '@/domain/models/api/tables/tables'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { readFormBody } from '@/presentation/api/runtime/request-body'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
} from '@/presentation/api/runtime/run-effect'
import { handleRestoreRecordError, handleRouteError } from './error-handlers'
import { refuseUnlistedRow } from './readable-table-gate'
import { checkDeleteGate } from './record-delete-gate'
import { withWebhookReceipt } from './record-webhook-receipt'
import {
  enforceRestoreGate,
  formMutationGate,
  guardForTable,
  passesUnguardedTableGate,
} from './row-level-guard'
import { stillLinkedConflict } from './still-linked-conflict'
import { maskUnreadableUniqueConflict, restoredWrite } from './unique-conflict-mask'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** Session type derived from table context to respect layer boundaries */
type SessionContext = ReturnType<typeof getTableContext>['session']

/**
 * Response for a failed delete program.
 *
 * Collapsing `result._tag === 'Left'` — i.e. EVERY failure, a dropped table
 * and a lost connection included — to an unconditional 404 would report an
 * infrastructure fault to the caller as "Resource not found" and never alert
 * the operator.
 *
 * So a driver-raised failure is sanitized into its real status; everything
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
 * here under that tag. A `BusinessRuleViolationError` is a lock blocking the
 * delete: it is raised only after the caller's own access was judged, so its
 * 400 never answers for a record she cannot reach.
 */
function deleteFailureResponse(c: Context, error: unknown): Response {
  const isValidationRefusal =
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    (error._tag === 'ValidationError' || error._tag === 'BusinessRuleViolationError')
  if (isDriverOriginatedFailure(error) || isValidationRefusal) return handleRouteError(c, error)
  return notFound(c)
}

/**
 * Run one delete — the write and every side effect it carries, in the order
 * `record-delete-orchestration.ts` pins — as a step of the handler's program.
 */
function runDelete(
  c: Context,
  input: {
    readonly session: SessionContext
    readonly app: App
    readonly tableName: string
    readonly recordId: string
    readonly mode: DeleteMode
  }
) {
  const { userRole, userGroups } = getTableContext(c)
  return deleteRecordWithSideEffects({
    ...input,
    requester: recordWriteRequester(input.session.userId, userRole),
    userGroups,
    forgetDerivedVariants: evictTransformCacheForKey,
  }).pipe(withWebhookReceipt(c), Effect.result)
}

/** The `{ success: true }` a delete answers, through its published schema. */
const deletedResponse = (c: Context) =>
  respondWith(c, Effect.succeed({ success: true }), deleteRecordResponseSchema)

/** Map a soft-delete result to a JSON HTTP response. */
function softDeleteResultToResponse(c: Context, result: DeleteResult) {
  if (result.restrictViolation) {
    return Effect.succeed(
      c.json(
        {
          success: false,
          message: 'Cannot delete record: child records exist and onDelete is set to restrict',
          code: 'CONFLICT',
        },
        400
      )
    )
  }
  if (!result.success) return Effect.succeed(notFound(c))
  if (result.setNullPerformed) return deletedResponse(c)
  return Effect.succeed(c.body(null, 204))
}

export async function handleDeleteRecord(c: Context, app: App) {
  return runHandlerEffect(c, answerFailures(c, deleteResponse(c, app)))
}

/** Gate, delete and answer a `DELETE`, as one program. */
const deleteResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    const { session, tableName, userRole, userGroups } = getTableContext(c)

    const table = app.tables?.find((t) => t.name === tableName)
    const recordId = c.req.param('recordId')!
    const guard = yield* guardForTable(session, { userRole, userGroups }, table, app)

    const gateError = yield* checkDeleteGate({
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

    // Both irreversible deletes — a permanent delete and a purge — are reserved
    // to an admin-equivalent role, whatever the caller's `delete` grant.
    // S1 anti-enumeration: anyone else gets the 404 of a missing record, so
    // the boundary is not discoverable, and nothing is deleted.
    const mode = requestedDeleteMode(c)
    if (mode !== 'soft' && !isAdminEquivalent(userRole, app)) return notFound(c)

    const outcome = yield* runDelete(c, { session, app, tableName, recordId, mode })
    if (outcome._tag === 'Failure') {
      // A record other rows still link to answers 409, naming the linking table
      // only to a caller who reads it; every other failure as before.
      const stillLinked = yield* stillLinkedConflict(c, app, outcome.failure)
      return stillLinked ?? deleteFailureResponse(c, outcome.failure)
    }
    if (mode === 'soft') return yield* softDeleteResultToResponse(c, outcome.success)
    return outcome.success.success ? yield* deletedResponse(c) : notFound(c)
  })

/**
 * The delete a request asks for: `?permanent=true` deletes for good,
 * `?purge=true` deletes for good together with the record's unshared stored
 * files, and neither moves the record to the trash. `permanent` wins over
 * `purge` when both are sent.
 */
function requestedDeleteMode(c: Context): DeleteMode {
  if (c.req.query('permanent') === 'true') return 'permanent'
  return c.req.query('purge') === 'true' ? 'purge' : 'soft'
}

/**
 * Handle form-based DELETE (POST) with redirect
 *
 * Used for non-confirmation delete buttons rendered as <form method="POST">.
 * Performs soft delete and redirects to the _redirect path from form body.
 */
export async function handleFormDeleteRecord(c: Context, app: App) {
  return runHandlerEffect(c, answerFailures(c, formDeleteResponse(c, app)))
}

/** The refusal of a delete or restore naming one record, by the door's own row gate. */
const refuseUnguardedOrUnlisted = (input: {
  readonly c: Context
  readonly app: App
  readonly table: ReturnType<NonNullable<App['tables']>['find']>
  readonly recordId: string
  readonly caller: { readonly userRole: string; readonly userGroups: readonly string[] }
  readonly guarded: boolean
}) => {
  const { c, app, table, recordId, caller, guarded } = input
  // S1 anti-enumeration: a delete- or restore-permission denial returns 404.
  if (!guarded && !passesUnguardedTableGate(app, table, caller, 'delete')) {
    return Effect.succeed(notFound(c))
  }
  // A record her list of the table does not admit is a missing one.
  return refuseUnlistedRow(c, app, recordId)
}

/** Gate, delete and redirect a form's delete, as one program. */
const formDeleteResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    const { session, tableName, userRole, userGroups } = getTableContext(c)

    const table = app.tables?.find((t) => t.name === tableName)
    const recordId = c.req.param('recordId')!
    const guard = yield* guardForTable(session, { userRole, userGroups }, table, app)

    // Z-3: row-level scoping. Falls back to canonical role-only check when
    // the table doesn't declare rowLevelPermissions (preserves existing
    // behaviour for non-row-level-enforced tables).
    const gateError = guard
      ? yield* formMutationGate({ c, table, session, tableName, recordId, guard, op: 'delete' })
      : undefined
    const refusal =
      gateError ??
      (yield* refuseUnguardedOrUnlisted({
        ...{ c, app, table, recordId },
        caller: { userRole, userGroups },
        guarded: guard !== undefined,
      }))
    if (refusal) return refusal

    // Parse form body for redirect path
    const body = yield* readFormBody(c)
    const redirectPath = typeof body['_redirect'] === 'string' ? body['_redirect'] : undefined

    // The same delete the JSON verb runs, so its automations and webhooks fire alike.
    const result = yield* runDelete(c, { session, app, tableName, recordId, mode: 'soft' })

    if (result._tag === 'Failure') return deleteFailureResponse(c, result.failure)
    if (!result.success.success) {
      return notFound(c)
    }

    // The address arrives in the request body — a relative one resolved against
    // the page that posted it — so it is only honoured once proven same-origin:
    // otherwise it is an open redirect off this site.
    const target = resolveRedirectAgainst(redirectPath, c.req.header('referer'))
    if (target !== undefined) return c.redirect(target, 302)

    return c.body(null, 204)
  })

export async function handleRestoreRecord(c: Context, app: App) {
  return runHandlerEffect(c, answerFailures(c, restoreResponse(c, app)))
}

/** Gate, restore and answer a record restore, as one program. */
const restoreResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    const { session, tableName, userRole, userGroups } = getTableContext(c)

    const table = app.tables?.find((t) => t.name === tableName)
    const recordId = c.req.param('recordId')!
    const guard = yield* guardForTable(session, { userRole, userGroups }, table, app)

    // Z-3: row-level scoping. Restore reuses the delete role gate AND the
    // read and delete rules, judged on the trashed row itself.
    const gateError = guard
      ? yield* enforceRestoreGate({ c, table, session, tableName, ids: [recordId], guard })
      : undefined
    const refusal =
      gateError ??
      (yield* refuseUnguardedOrUnlisted({
        ...{ c, app, table, recordId },
        caller: { userRole, userGroups },
        guarded: guard !== undefined,
      }))
    if (refusal) return refusal

    const result = yield* Effect.result(
      restoreRecordWithSideEffects({
        ...{ session, app, tableName, recordId, userRole, userGroups },
        requester: recordWriteRequester(session.userId, userRole),
      }).pipe(withWebhookReceipt(c))
    )

    if (result._tag === 'Failure') {
      const failed = handleRestoreRecordError(c, result.failure)
      return yield* maskUnreadableUniqueConflict(c, app, restoredWrite(c, [recordId]), failed)
    }

    if (!result.success.success) {
      return notFound(c)
    }

    return yield* respondWith(c, Effect.succeed(result.success), restoreRecordResponseSchema)
  })
