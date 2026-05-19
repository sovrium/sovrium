/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth-repository'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth-repository-live'

const DEFAULT_ROLE = 'member'

export type AuthRoleService = {
  readonly getUserRole: (userId: string) => Promise<string | undefined>
}

export async function getUserRole(userId: string, service?: AuthRoleService): Promise<string> {
  if (service) {
    const role = await service.getUserRole(userId)
    return role ?? DEFAULT_ROLE
  }

  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.getUserRole(userId)
  }).pipe(Effect.provide(AuthRepositoryLive))

  const role = await Effect.runPromise(program)

  return role ?? DEFAULT_ROLE
}

export async function updateUserRole(userId: string, role: string): Promise<void> {
  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    yield* repo.updateUserRole(userId, role)
  }).pipe(Effect.provide(AuthRepositoryLive))

  return Effect.runPromise(program)
}

export async function getUserSessionToken(userId: string): Promise<string | undefined> {
  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.getUserSessionToken(userId)
  }).pipe(Effect.provide(AuthRepositoryLive))

  return await Effect.runPromise(program)
}
