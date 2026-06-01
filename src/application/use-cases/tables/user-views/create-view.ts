/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import {
  UserViewRepository,
  type CreateUserViewInput,
  type UserViewConflictError,
  type UserViewDbError,
  type UserViewNotFoundError,
  type UserViewResponse,
} from '@/application/ports/repositories/user-view-repository'

export const createUserView = (
  input: CreateUserViewInput
): Effect.Effect<
  UserViewResponse,
  UserViewConflictError | UserViewDbError | UserViewNotFoundError,
  UserViewRepository
> =>
  Effect.gen(function* () {
    const repo = yield* UserViewRepository
    return yield* repo.create(input)
  })
