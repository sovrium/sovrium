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
import { isSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { runOnRequest } from '@/presentation/api/runtime/run-effect'
import { handleRestoreRecordError, handleRouteError } from './error-handlers'
import { checkDeleteGate } from './record-delete-gate'
import {
  enforceFormMutationGate,
  enforceRestoreGate,
  passesUnguardedTableGate,
  resolveGuardForTable,
} from './row-level-guard'
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
 * here under that tag.
 */
function deleteFailureResponse(c: Context, error: unknown): Response {
  const isValidationRefusal =
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    error._tag === 'ValidationError'
  if (isDriverOriginatedFailure(error) || isValidationRefusal) return handleRouteError(c, error)
  return notFound(c)
}

/**
 * Run one delete — the write and every side effect it carries, in the order
 * `record-delete-orchestration.ts` pins — on the request's services.
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
  const program = deleteRecordWithSideEffects({
    ...input,
    requester: recordWriteRequester(input.session.userId, getTableContext(c).userRole),
    processEnv: process.env,
    forgetDerivedVariants: evictTransformCacheForKey,
  })
  return runRequestEffect(c, Effect.result(provideDomain(c, program)))
}

/** Map a soft-delete result to a JSON HTTP response. */
function softDeleteResultToResponse(c: Context, result: DeleteResult): Response {
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
  if (!result.success) return notFound(c)
  if (result.setNullPerformed) return c.json({ success: true }, 200)
  return c.body(null, 204)
}

export async function handleDeleteRecord(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  const recordId = c.req.param('recordId')!
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })

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

  // Both irreversible deletes — a permanent delete and a purge — are reserved
  // to an admin-equivalent role, whatever the caller's `delete` grant.
  // S1 anti-enumeration: anyone else gets the 404 of a missing record, so
  // the boundary is not discoverable, and nothing is deleted.
  const mode = requestedDeleteMode(c)
  if (mode !== 'soft' && !isAdminEquivalent(userRole, app)) return notFound(c)

  const outcome = await runDelete(c, { session, app, tableName, recordId, mode })
  if (outcome._tag === 'Failure') return deleteFailureResponse(c, outcome.failure)
  if (mode === 'soft') return softDeleteResultToResponse(c, outcome.success)
  return outcome.success.success ? c.json({ success: true }, 200) : notFound(c)
}

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
  const { session, tableName, userRole, userGroups } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  const recordId = c.req.param('recordId')!
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })

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
  } else if (!passesUnguardedTableGate(app, table, { userRole, userGroups }, 'delete')) {
    // S1 anti-enumeration: delete-permission denial returns 404.
    return c.json(
      {
        success: false,
        error: 'Not Found',
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  // Parse form body for redirect path
  const body = await c.req.parseBody()
  const redirectPath = typeof body['_redirect'] === 'string' ? body['_redirect'] : undefined

  // The same delete the JSON verb runs, so its automations and webhooks fire alike.
  const result = await runDelete(c, { session, app, tableName, recordId, mode: 'soft' })

  if (result._tag === 'Failure') return deleteFailureResponse(c, result.failure)
  if (!result.success.success) {
    return notFound(c)
  }

  // The path arrives in the request body, so it is only honoured once proven
  // same-origin — otherwise it is an open redirect off this site.
  if (isSafeRedirectPath(redirectPath)) {
    return c.redirect(redirectPath, 302)
  }

  return c.body(null, 204)
}

export async function handleRestoreRecord(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  const recordId = c.req.param('recordId')!
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })

  // Z-3: row-level scoping. Restore reuses the delete role gate AND the
  // read and delete rules, judged on the trashed row itself.
  if (guard) {
    const gateError = await enforceRestoreGate({
      c,
      table,
      session,
      tableName,
      ids: [recordId],
      guard,
    })
    if (gateError) return gateError
  } else if (!passesUnguardedTableGate(app, table, { userRole, userGroups }, 'delete')) {
    // S1 anti-enumeration: restore-permission denial returns 404.
    return c.json(
      {
        success: false,
        error: 'Not Found',
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  const result = await runOnRequest(
    c,
    restoreRecordWithSideEffects({
      ...{ session, app, tableName, recordId, userRole, userGroups },
      requester: recordWriteRequester(session.userId, userRole),
      processEnv: process.env,
    })
  )

  if (result._tag === 'Failure') {
    return handleRestoreRecordError(c, result.failure)
  }

  if (!result.success.success) {
    return notFound(c)
  }

  return c.json(result.success, 200)
}
