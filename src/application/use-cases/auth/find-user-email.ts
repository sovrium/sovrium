/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth-repository'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth-repository-live'

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
