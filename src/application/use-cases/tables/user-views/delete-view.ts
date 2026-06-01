/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import {
  UserViewRepository,
  type UserViewDbError,
  type UserViewNotFoundError,
} from '@/application/ports/repositories/user-view-repository'

export interface DeleteUserViewInput {
  readonly userId: string
  readonly tableName: string
  readonly viewId: string
}

export const deleteUserView = (
  input: DeleteUserViewInput
): Effect.Effect<void, UserViewDbError | UserViewNotFoundError, UserViewRepository> =>
  Effect.gen(function* () {
    const repo = yield* UserViewRepository
    return yield* repo.delete(input)
  })
