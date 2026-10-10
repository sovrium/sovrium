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
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { badRequest, internalError, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext, requestLogAttributes } from '@/presentation/api/runtime/context-helpers'
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
const answerOutcome = (c: Context, userId: string, result: GroupMembershipOutcome): Response => {
  if (result._tag === 'AtCapacity') {
    return c.json(
      {
        success: false,
        message: describeMembershipRefusal(result),
        code: ApiErrorCode.VALIDATION_ERROR,
      },
      422
    )
  }
  if (result._tag !== 'Changed') return badRequest(c, describeMembershipRefusal(result))
  const body = decodeSafe(adminUserGroupsUpdateResponseSchema)({
    userId,
    groups: result.groups,
    added: result.added,
    removed: result.removed,
  })
  if (!body.success) return internalError(c, 'Failed to build the account groups response')
  return c.json(body.data, 200)
}

/** `PUT /api/admin/users/:userId/groups`. */
async function handleSetUserGroups(c: Context, resolveApp: () => App) {
  const session = getSessionContext(c)
  if (session === undefined) return notFound(c)
  const app = resolveApp()
  const userId = c.req.param('userId') ?? ''

  const admitted = await runRequestEffect(
    c,
    provideDomain(c, admitsCaller(session.userId, userId, app)).pipe(Effect.result)
  )
  if (admitted._tag === 'Failure') {
    logError('[admin] user groups: caller check failed', admitted.failure, requestLogAttributes(c))
    return internalError(c, 'Failed to set the account groups')
  }
  if (!admitted.success) return notFound(c)

  // Decoded only once the caller is admitted: a refused caller learns nothing,
  // not even that its body would have been malformed.
  const parsed = await validateRequest(c, adminUserGroupsUpdateRequestSchema)
  if (!parsed.success) return parsed.response

  const outcome = await runRequestEffect(
    c,
    provideDomain(
      c,
      changeUserGroups({
        app,
        userId,
        plan: { mode: 'set', groups: parsed.data.groups },
        author: { kind: 'user', userId: session.userId },
      })
    ).pipe(Effect.result)
  )
  if (outcome._tag === 'Failure') {
    logError('[admin] user groups: write failed', outcome.failure, requestLogAttributes(c))
    return internalError(c, 'Failed to set the account groups')
  }
  return answerOutcome(c, userId, outcome.success)
}

/** Chain the account-groups write onto a Hono app. */
export function chainAdminUserGroupsRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return honoApp.put('/api/admin/users/:userId/groups', (c) =>
    handleSetUserGroups(c, resolveApp)
  ) as T
}
