/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Data, Effect } from 'effect'
import {
  UserViewDbError,
  UserViewNotFoundError,
  UserViewRepository,
  type UserViewResponse,
} from '@/application/ports/repositories/user-view-repository'
import { hasReadPermissionForRoles } from '@/application/use-cases/tables/permissions/permissions'
import { buildEffectiveRoles, getUserGroups } from '@/application/use-cases/tables/user-groups'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import type { App } from '@/domain/models/app'

export class UserViewForbiddenError extends Data.TaggedError('UserViewForbiddenError')<{
  readonly viewId: string
}> {}

export interface GetSharedViewInput {
  readonly userId: string
  readonly viewId: string
  readonly app: App
}

export const getSharedView = (
  input: GetSharedViewInput
): Effect.Effect<
  UserViewResponse,
  UserViewDbError | UserViewForbiddenError | UserViewNotFoundError,
  UserViewRepository
> =>
  Effect.gen(function* () {
    const repo = yield* UserViewRepository
    const view = yield* repo.getShared({ viewId: input.viewId })

    const targetTable = (input.app.tables ?? []).find((t) => t.name === view.tableName)
    if (!targetTable) {
      return yield* new UserViewNotFoundError({ viewId: input.viewId })
    }

    const [userRole, userGroups] = yield* Effect.tryPromise({
      try: () => Promise.all([getUserRole(input.userId), getUserGroups(input.userId)]),
      catch: (cause) => new UserViewDbError({ cause }),
    })
    const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
    if (!hasReadPermissionForRoles(targetTable, effectiveRoles, input.app.tables)) {
      return yield* new UserViewForbiddenError({ viewId: input.viewId })
    }

    return view
  })
