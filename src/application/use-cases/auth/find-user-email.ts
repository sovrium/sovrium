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
 * Resolve a user's email address by user id. Returns `undefined` when the
 * user is not found or the lookup fails (the form prefill path treats
 * missing email as "drop the prefill entry" — never leak the literal
 * `$user.email` token).
 *
 * Promise-based wrapper around the Effect-native
 * `AuthRepository.findUserEmailById` so the form route can call it from
 * the existing async `buildPrefillContext` without rewriting the entire
 * prefill code path in Effect.gen.
 */
export async function findUserEmailById(userId: string): Promise<string | undefined> {
  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.findUserEmailById(userId)
  }).pipe(Effect.provide(AuthRepositoryLive))

  try {
    return await Effect.runPromise(program)
  } catch {
    return undefined
  }
}
