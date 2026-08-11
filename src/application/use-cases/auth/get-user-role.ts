/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'

/**
 * Resolve a user's stored role by id.
 *
 * Promise-based wrapper around the Effect-native `AuthRepository.getUserRole`
 * so the plain-async Better Auth `before` hooks (last-admin lockout guard,
 * impersonation target guard) can read the CURRENT role of the target user
 * before the mutation runs.
 *
 * Returns `undefined` when the user does not exist, carries no role, or the
 * lookup fails. Both callers treat `undefined` as "cannot establish that this
 * is a privileged target" and fall through to Better Auth's own handling
 * (which 404s an unknown user id).
 */
export async function getUserRoleById(userId: string): Promise<string | undefined> {
  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.getUserRole(userId)
  }).pipe(Effect.provide(AuthRepositoryLive))

  try {
    return await Effect.runPromise(program)
  } catch {
    return undefined
  }
}
