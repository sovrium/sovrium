/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'
import type { Actor, ActorRole } from '@/domain/models/api/admin/_shared/actor'

const DEFAULT_ROLE = 'member'

export async function resolveActor(userId: string): Promise<Actor> {
  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    const [role, email] = yield* Effect.all([
      repo.getUserRole(userId),
      repo.findUserEmailById(userId),
    ])
    return { role: role ?? DEFAULT_ROLE, email }
  }).pipe(Effect.provide(AuthRepositoryLive))

  const { role, email } = await Effect.runPromise(program)

  const resolvedRole: ActorRole =
    role === 'admin' || role === 'operator' || role === 'system' ? role : 'system'

  return {
    id: userId,
    type: 'user',
    role: resolvedRole,
    ...(email ? { email } : {}),
  }
}
