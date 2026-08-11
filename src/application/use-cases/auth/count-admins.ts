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
 * Count the users who currently hold one of `adminRoles` and are not banned.
 *
 * Promise-based wrapper around the Effect-native
 * `AuthRepository.countActiveAdmins` so the plain-async Better Auth `before`
 * hook can consult it without rewriting that hook in `Effect.gen` (same shape
 * as `findUserEmailById`).
 *
 * Returns `undefined` when the lookup fails. The caller (the last-admin
 * lockout guard) then SKIPS the guard rather than blocking: a transient DB
 * error must not make role management unusable, and the guard is a foot-gun
 * rail between two already-privileged actors — not a security boundary.
 */
export async function countActiveAdmins(
  adminRoles: readonly string[]
): Promise<number | undefined> {
  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.countActiveAdmins(adminRoles)
  }).pipe(Effect.provide(AuthRepositoryLive))

  try {
    return await Effect.runPromise(program)
  } catch {
    return undefined
  }
}
