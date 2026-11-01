/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `PUT /api/admin/users/:userId/groups` — set the groups an account belongs to.
 *
 * The body is the WHOLE desired set (`{ groups: string[] }`), which is what the
 * console's multi-select commits; the server diffs it against the stored
 * membership and answers `200 { userId, groups, added, removed }`, each sorted.
 * Sending the set the account already has changes nothing and answers two empty
 * lists. The organization is resolved server-side — the instance serves one —
 * so the body names nothing but groups (the request schema is strict).
 *
 * ─── WHO MAY CALL IT ────────────────────────────────────────────────────────
 *
 * Only an admin-equivalent caller (`isAdminEquivalent`, the predicate behind the
 * console's `administer-accounts` capability), by session or by API key. The
 * `/api/admin/*` tier guard 404s a stranger and a signed-in non-admin; this
 * handler 404s the read-only console tier too, and an account id naming nobody —
 * the same answer every time, so the route confirms neither itself nor an
 * account to whoever probes it (S1).
 *
 * ─── WHAT IT REFUSES ────────────────────────────────────────────────────────
 *
 * A body that is not a list of names, and a name `auth.groups` does not
 * declare, are 400s; an add past a group's `maxMembers` is a 422, as on the
 * native team route. Each refusal is decided before the first row moves, so a
 * refused request changes nothing. The change itself — and its one
 * `user.groups.changed` audit entry — is `changeUserGroups`, the program the
 * `auth` group operators run too.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import {
  changeUserGroups,
  describeMembershipRefusal,
  type GroupMembershipOutcome,
} from '@/application/use-cases/auth/group-membership'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import {
  adminUserGroupsUpdateRequestSchema,
  adminUserGroupsUpdateResponseSchema,
} from '@/domain/models/api/admin/users/groups'
import { ApiErrorCode } from '@/domain/models/api/error'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { logError } from '@/infrastructure/logging/logger'
import { badRequest, internalError, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext, requestLogAttributes } from '@/presentation/api/runtime/context-helpers'
import { respondWith, runHandlerEffect } from '@/presentation/api/runtime/run-effect'
import { validateRequest } from '@/presentation/api/runtime/validate-request'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Whether the caller may set this account's groups: an admin-equivalent caller,
 * and an account that exists. Either "no" is the same 404.
 */
const admitsCaller = (callerId: string, userId: string, app: App) =>
  Effect.gen(function* () {
    const role = yield* getUserRole(callerId)
    if (!isAdminEquivalent(role, app)) return false
    return yield* (yield* AuthRepository).userExists(userId)
  })

/** The answer for a membership change that ran: the new membership, or the refusal. */
const answerOutcome = (
  c: Context,
  userId: string,
  result: GroupMembershipOutcome
): Effect.Effect<Response> => {
  if (result._tag === 'AtCapacity') {
    return Effect.succeed(
      c.json(
        {
          success: false,
          message: describeMembershipRefusal(result),
          code: ApiErrorCode.VALIDATION_ERROR,
        },
        422
      )
    )
  }
  if (result._tag !== 'Changed') {
    return Effect.succeed(badRequest(c, describeMembershipRefusal(result)))
  }
  return respondWith(
    c,
    Effect.succeed({
      userId,
      groups: result.groups,
      added: result.added,
      removed: result.removed,
    }),
    adminUserGroupsUpdateResponseSchema
  )
}

/** The answer to a read or write that did not finish: logged, and the route's own 500. */
const answerFailed = (c: Context, what: string, failure: unknown): Response => {
  logError(`[admin] user groups: ${what} failed`, failure, requestLogAttributes(c))
  return internalError(c, 'Failed to set the account groups')
}

/** `PUT /api/admin/users/:userId/groups`. */
function handleSetUserGroups(c: Context, app: App): Promise<Response> | Response {
  const session = getSessionContext(c)
  if (session === undefined) return notFound(c)
  const userId = c.req.param('userId') ?? ''

  return runHandlerEffect(
    c,
    Effect.gen(function* () {
      const admitted = yield* Effect.result(admitsCaller(session.userId, userId, app))
      if (admitted._tag === 'Failure') return answerFailed(c, 'caller check', admitted.failure)
      if (!admitted.success) return notFound(c)

      // Decoded only once the caller is admitted: a refused caller learns nothing,
      // not even that its body would have been malformed.
      // effect-promise: total -- validateRequest catches every read and decode failure and answers it as a value
      const parsed = yield* Effect.promise(() =>
        validateRequest(c, adminUserGroupsUpdateRequestSchema)
      )
      if (!parsed.success) return parsed.response

      const outcome = yield* Effect.result(
        changeUserGroups({
          app,
          userId,
          plan: { mode: 'set', groups: parsed.data.groups },
          author: { kind: 'user', userId: session.userId },
        })
      )
      if (outcome._tag === 'Failure') return answerFailed(c, 'write', outcome.failure)
      return yield* answerOutcome(c, userId, outcome.success)
    })
  )
}

/** Chain the account-groups write onto a Hono app. */
export function chainAdminUserGroupsRoutes(honoApp: Hono, app: App): Hono {
  return honoApp.put('/api/admin/users/:userId/groups', (c) => handleSetUserGroups(c, app))
}
