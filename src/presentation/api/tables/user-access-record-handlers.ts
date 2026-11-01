/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Option } from 'effect'
import {
  UserAccessRepository,
  type UserAccessRow,
} from '@/application/ports/repositories/auth/user-access-repository'
import { changeUserAccessGrant } from '@/application/use-cases/tables/mint-user-access-grant'
import { userAccessRecordSchema } from '@/domain/models/api/tables'
import { isRecordKeyShaped } from '@/domain/models/app/tables/record-id-service'
import { validateUserAccessChange } from '@/domain/models/app/tables/user-access-validation'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
} from '@/presentation/api/runtime/run-effect'
import {
  collectRoleNames,
  collectScopeTables,
  extractFields,
  gateUserAccessAdmin,
  parseJsonBody,
  respondNotFound,
  respondServerError,
  respondValidationError,
  toFieldsResponse,
} from './user-access-handlers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * HTTP handlers for ONE grant of the `user_access` junction, addressed by its
 * id: `/api/tables/user_access/records/:grantId` (read, change, revoke).
 *
 * Every route is for an admin-equivalent caller only, and a refused caller —
 * the grant's own holder included — is answered 404 as if the grant did not
 * exist (S1), before the id or the body is read. Grant ids are UUIDs, so an id
 * of any other shape names no grant and is answered 404 before any query runs.
 */

/** The grant id of the request, when it could name a grant at all. */
const grantIdOf = (c: Context): string | undefined => {
  const id = c.req.param('grantId')
  return id !== undefined && isRecordKeyShaped(id, { primaryKey: { type: 'uuid' } }, undefined)
    ? id
    : undefined
}

/** A grant in the record envelope every records route answers, through its wire contract (S4). */
const respondGrant = (c: Context, row: Readonly<UserAccessRow>) =>
  respondWith(c, Effect.succeed(toFieldsResponse(row)), userAccessRecordSchema)

/** GET /api/tables/user_access/records/:grantId — one grant, or 404. */
export function handleGetUserAccessRecord(c: Context, app: App): Promise<Response> {
  return runHandlerEffect(c, answerFailures(c, getGrantResponse(c, app)))
}

/** Gate and answer one grant, as one program. */
const getGrantResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    const refused = yield* gateUserAccessAdmin(c, app)
    if (refused) return refused
    const id = grantIdOf(c)
    if (id === undefined) return respondNotFound(c)

    const result = yield* Effect.result(
      Effect.gen(function* () {
        const repo = yield* UserAccessRepository
        return yield* repo.get(id)
      })
    )
    if (result._tag === 'Failure') return respondServerError(c, result.failure.cause)
    return yield* Option.match(result.success, {
      onNone: () => Effect.succeed<Response>(respondNotFound(c)),
      onSome: (row) => respondGrant(c, row),
    })
  })

/**
 * PATCH /api/tables/user_access/records/:grantId
 *
 * Body: `{ fields: { record_ids?, role? } }`. Validated as a new grant is — a
 * record id that is no record of the grant's table is refused (400) — and a
 * body naming `user_id` or `table_slug` is refused (400) and changes nothing.
 * A role change onto a role the account already holds over the table folds the
 * grant into the held one, and the answer is that grant.
 * The account reads what the grant now names on its next request: the
 * repository closes its live subscriptions, which are judged again at the
 * handshake.
 */
export function handleUpdateUserAccessRecord(c: Context, app: App): Promise<Response> {
  return runHandlerEffect(c, answerFailures(c, updateGrantResponse(c, app)))
}

/** Gate, validate and change a grant, as one program. */
const updateGrantResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    const refused = yield* gateUserAccessAdmin(c, app)
    if (refused) return refused
    const id = grantIdOf(c)
    if (id === undefined) return respondNotFound(c)

    const parsed = yield* parseJsonBody(c)
    if (!parsed.success) return respondValidationError(c, 'Invalid JSON body')
    const fields = extractFields(parsed.value)
    const invalid = validateUserAccessChange(fields, {
      scopeTables: collectScopeTables(app),
      roleNames: collectRoleNames(app),
    })
    if (invalid) return respondValidationError(c, invalid.message, invalid.field)

    const recordIds = fields['record_ids'] as readonly string[] | undefined
    const result = yield* Effect.result(
      changeUserAccessGrant(app, id, {
        ...(recordIds === undefined ? {} : { recordIds }),
        ...(fields['role'] === undefined ? {} : { role: fields['role'] as string }),
      })
    )
    if (result._tag === 'Failure') return respondServerError(c, result.failure.cause)
    if ('field' in result.success) {
      return respondValidationError(c, result.success.message, result.success.field)
    }
    return yield* Option.match(result.success, {
      onNone: () => Effect.succeed<Response>(respondNotFound(c)),
      onSome: (row) => respondGrant(c, row),
    })
  })

/**
 * DELETE /api/tables/user_access/records/:grantId — revoke a grant (204).
 *
 * The row is erased, not soft-deleted: a revoked grant leaves nothing a later
 * query could resurrect.
 */
export function handleDeleteUserAccessRecord(c: Context, app: App): Promise<Response> {
  return runHandlerEffect(c, answerFailures(c, deleteGrantResponse(c, app)))
}

/** Gate and revoke a grant, as one program. */
const deleteGrantResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    const refused = yield* gateUserAccessAdmin(c, app)
    if (refused) return refused
    const id = grantIdOf(c)
    if (id === undefined) return respondNotFound(c)

    const result = yield* Effect.result(
      Effect.gen(function* () {
        const repo = yield* UserAccessRepository
        return yield* repo.remove(id)
      })
    )
    if (result._tag === 'Failure') return respondServerError(c, result.failure.cause)
    return Option.match(result.success, {
      onNone: () => respondNotFound(c),
      onSome: () => c.body(null, 204),
    })
  })
