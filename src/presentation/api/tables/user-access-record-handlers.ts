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
import { decodeOrThrow } from '@/domain/models/api/combinators/decode'
import { userAccessRecordSchema } from '@/domain/models/api/tables'
import { isRecordKeyShaped } from '@/domain/models/app/tables/record-id-service'
import { validateUserAccessChange } from '@/domain/models/app/tables/user-access-validation'
import { runUserAccessProgram } from '@/infrastructure/layers/table-layer'
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
  c.json(decodeOrThrow(userAccessRecordSchema)(toFieldsResponse(row)), 200)

/** GET /api/tables/user_access/records/:grantId — one grant, or 404. */
export async function handleGetUserAccessRecord(c: Context, app: App): Promise<Response> {
  const refused = await gateUserAccessAdmin(c, app)
  if (refused) return refused
  const id = grantIdOf(c)
  if (id === undefined) return respondNotFound(c)

  const result = await runUserAccessProgram(
    Effect.gen(function* () {
      const repo = yield* UserAccessRepository
      return yield* repo.get(id)
    })
  )
  if (result._tag === 'Failure') return respondServerError(c, result.failure.cause)
  return Option.match(result.success, {
    onNone: () => respondNotFound(c),
    onSome: (row) => respondGrant(c, row),
  })
}

/**
 * PATCH /api/tables/user_access/records/:grantId
 *
 * Body: `{ fields: { record_ids?, role? } }`. Validated as a new grant is; a
 * body naming `user_id` or `table_slug` is refused (400) and changes nothing.
 * The account reads what the grant now names on its next request: the
 * repository closes its live subscriptions, which are judged again at the
 * handshake.
 */
export async function handleUpdateUserAccessRecord(c: Context, app: App): Promise<Response> {
  const refused = await gateUserAccessAdmin(c, app)
  if (refused) return refused
  const id = grantIdOf(c)
  if (id === undefined) return respondNotFound(c)

  const parsed = await parseJsonBody(c)
  if (!parsed.success) return respondValidationError(c, 'Invalid JSON body')
  const fields = extractFields(parsed.value)
  const invalid = validateUserAccessChange(fields, {
    scopeTables: collectScopeTables(app),
    roleNames: collectRoleNames(app),
  })
  if (invalid) return respondValidationError(c, invalid.message, invalid.field)

  const result = await runUserAccessProgram(
    Effect.gen(function* () {
      const repo = yield* UserAccessRepository
      return yield* repo.update(id, {
        ...(fields['record_ids'] === undefined
          ? {}
          : { recordIds: fields['record_ids'] as readonly string[] }),
        ...(fields['role'] === undefined ? {} : { role: fields['role'] as string }),
      })
    })
  )
  if (result._tag === 'Failure') return respondServerError(c, result.failure.cause)
  return Option.match(result.success, {
    onNone: () => respondNotFound(c),
    onSome: (row) => respondGrant(c, row),
  })
}

/**
 * DELETE /api/tables/user_access/records/:grantId — revoke a grant (204).
 *
 * The row is erased, not soft-deleted: a revoked grant leaves nothing a later
 * query could resurrect.
 */
export async function handleDeleteUserAccessRecord(c: Context, app: App): Promise<Response> {
  const refused = await gateUserAccessAdmin(c, app)
  if (refused) return refused
  const id = grantIdOf(c)
  if (id === undefined) return respondNotFound(c)

  const result = await runUserAccessProgram(
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
}
