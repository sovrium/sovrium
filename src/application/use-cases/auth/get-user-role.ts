/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'

/**
 * Resolve a user's stored role by id.
 *
 * Reads the CURRENT role of a target user so the plain-async Better Auth
 * `before` hooks (last-admin lockout guard, impersonation target guard) can see
 * it before the mutation runs.
 *
 * Yields `undefined` when the user does not exist, carries no role, or the
 * lookup fails. Both callers treat `undefined` as "cannot establish that this
 * is a privileged target" and fall through to Better Auth's own handling
 * (which 404s an unknown user id) — so the failure is folded into the value
 * HERE rather than left for each caller to re-swallow, and the effect cannot
 * fail.
 *
 * `AuthRepository` is declared rather than provided (standing rule E1): the
 * composition root that owns a runtime discharges it. The Better Auth hook that
 * consumes this has no request and no fiber of its own, so the Promise bridge
 * lives beside that hook in `infrastructure/auth/better-auth/admin-role-guards.ts`.
 */
export const readUserRoleById = (
  userId: string
): Effect.Effect<string | undefined, never, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.getUserRole(userId)
  }).pipe(
    // effect-swallow: an unreadable role is reported as `undefined`, which both Better Auth guards already treat as "cannot establish that this is a privileged target" and answer by falling through to Better Auth's own 404. Logging here would fire on every unknown user id a probe sends.
    Effect.orElseSucceed(() => undefined),
    Effect.withSpan('auth.read-user-role-by-id')
  )
