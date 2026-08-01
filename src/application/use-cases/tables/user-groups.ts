/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { toGroupReference } from '@/domain/models/app/auth/groups/group-reference'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'

export type UserGroupsService = {
  readonly getUserGroups: (userId: string) => Promise<readonly string[]>
}

export async function getUserGroups(
  userId: string,
  service?: UserGroupsService
): Promise<readonly string[]> {
  if (service) {
    return service.getUserGroups(userId)
  }

  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.getUserGroups(userId)
  }).pipe(
    Effect.provide(AuthRepositoryLive),
    Effect.catchAll(() => Effect.succeed([] as readonly string[]))
  )

  return Effect.runPromise(program)
}

export function buildEffectiveRoles(
  userRole: string,
  groupNames: readonly string[]
): readonly string[] {
  const groupRoles = groupNames.map(toGroupReference)
  return [userRole, ...groupRoles]
}
