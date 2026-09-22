/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'

/**
 * Count the users who currently hold one of `adminRoles` and are not banned.
 *
 * Yields `undefined` when the lookup fails. The caller (the last-admin lockout
 * guard) then SKIPS the guard rather than blocking: a transient DB error must
 * not make role management unusable, and the guard is a foot-gun rail between
 * two already-privileged actors — not a security boundary. That degradation is
 * folded into the value here, so the effect cannot fail.
 *
 * `AuthRepository` is declared rather than provided (standing rule E1); see the
 * sibling `readUserRoleById` for where the Promise bridge lives and why.
 */
export const countActiveAdmins = (
  adminRoles: readonly string[]
): Effect.Effect<number | undefined, never, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.countActiveAdmins(adminRoles)
  }).pipe(
    // effect-swallow: `undefined` means "the count is unknown", and the last-admin guard skips itself rather than blocking — a transient DB error must not make role management unusable between two already-privileged actors.
    Effect.orElseSucceed(() => undefined),
    Effect.withSpan('auth.count-active-admins')
  )
